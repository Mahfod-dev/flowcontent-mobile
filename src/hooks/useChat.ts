import { useCallback, useEffect, useRef, useState } from 'react';
import { socketService } from '../services/socket';
import { apiService } from '../services/api';
import { MediaAttachment, Message, ToolCall } from '../types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://flowbackendapi.store';

/** Fetch with AbortController timeout — 300s default for agent runs */
function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = 300_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// Typewriter speed: characters per chunk & interval
const TYPEWRITER_CHUNK = 6;
const TYPEWRITER_MS = 12;
// Stream buffer flush interval (ms) — higher = smoother but slightly delayed
const STREAM_FLUSH_MS = 22;

export function useChat(sessionId: string, userId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [thinkingText, setThinkingText] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [canRetry, setCanRetry] = useState(false);
  const streamingIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const bufferRef = useRef('');
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const safetyNetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingRecoveryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track whether we received any stream event after sending
  const gotStreamEventRef = useRef(false);
  // Guard: prevent double-processing stream:done / stream:complete
  const doneProcessedRef = useRef(false);
  // Track if a send is in progress (prevent showing error after stream:done already arrived)
  const sendInProgressRef = useRef(false);
  // Keep sessionId in a ref to avoid stale closures in timers
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  // Retry last user message
  const lastUserMsgRef = useRef<{ text: string; media?: MediaAttachment[]; model?: string | null } | null>(null);

  useEffect(() => {
    apiService.getToken().then((t) => { tokenRef.current = t; });
  }, []);

  // Cancel any running typewriter animation
  const stopTypewriter = useCallback(() => {
    if (typewriterRef.current) {
      clearInterval(typewriterRef.current);
      typewriterRef.current = null;
    }
  }, []);

  // Animate text appearing progressively (typewriter effect)
  const animateFullText = useCallback((fullText: string) => {
    stopTypewriter();
    const msgId = `stream-${Date.now()}`;
    let pos = 0;

    // Create empty streaming message
    setMessages((prev) => [
      ...prev,
      { id: msgId, role: 'assistant', content: '', timestamp: new Date(), isStreaming: true },
    ]);

    typewriterRef.current = setInterval(() => {
      pos += TYPEWRITER_CHUNK;
      if (pos >= fullText.length) {
        // Done — show full text, stop animation
        setMessages((prev) =>
          prev.map((m) => m.id === msgId ? { ...m, content: fullText, isStreaming: false } : m)
        );
        stopTypewriter();
      } else {
        setMessages((prev) =>
          prev.map((m) => m.id === msgId ? { ...m, content: fullText.slice(0, pos) } : m)
        );
      }
    }, TYPEWRITER_MS);
  }, [stopTypewriter]);

  const flushBuffer = useCallback(() => {
    const buffered = bufferRef.current;
    if (!buffered) return;
    bufferRef.current = '';

    setMessages((prev) => {
      const sid = streamingIdRef.current;
      if (sid) {
        return prev.map((m) =>
          m.id === sid ? { ...m, content: m.content + buffered, isStreaming: true } : m
        );
      }
      const newId = `stream-${Date.now()}`;
      streamingIdRef.current = newId;
      return [
        ...prev,
        { id: newId, role: 'assistant', content: buffered, timestamp: new Date(), isStreaming: true },
      ];
    });
  }, []);

  /** Poll backend for the actual response — fallback when WebSocket fails.
   *  Uses sessionIdRef to avoid stale closures in setTimeout callbacks. */
  const pollRecovery = useCallback(async () => {
    try {
      const token = tokenRef.current;
      const sid = sessionIdRef.current;
      if (!token || !sid || doneProcessedRef.current) return;
      const raw = await apiService.getSessionMessages(token, sid);
      // Abort if session changed during the async call
      if (sessionIdRef.current !== sid) return;
      const lastBackend = [...raw].reverse().find((m: any) => m.role === 'assistant');
      if (lastBackend?.content) {
        doneProcessedRef.current = true;
        if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
        flushBuffer();

        setMessages((prev) => {
          // Remove any error message
          const cleaned = prev.filter((m) => !(m.role === 'assistant' && m.content.startsWith('⚠️')));
          const lastLocal = [...cleaned].reverse().find((m) => m.role === 'assistant');

          if (lastLocal && lastLocal.content.length >= lastBackend.content.length) {
            // Local already has the full content
            return cleaned.map((m) => m.id === lastLocal.id ? { ...m, isStreaming: false } : m);
          }
          if (lastLocal) {
            return cleaned.map((m) =>
              m.id === lastLocal.id ? { ...m, content: lastBackend.content, isStreaming: false } : m
            );
          }
          return [...cleaned, {
            id: lastBackend.id || `recovered-${Date.now()}`,
            role: 'assistant' as const,
            content: lastBackend.content,
            timestamp: new Date(),
          }];
        });
        setIsTyping(false);
        setThinkingText('');
        setToolCalls([]);
        setCanRetry(false);
        streamingIdRef.current = null;
        sendInProgressRef.current = false;
      }
    } catch { /* network down — user will retry */ }
  }, [flushBuffer]);

  // Reset stream timeout — 2 min (backend sends heartbeats during long tasks)
  const resetStreamTimeout = useCallback(() => {
    if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
    streamTimeoutRef.current = setTimeout(async () => {
      if (streamingIdRef.current || bufferRef.current) {
        if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
        flushBuffer();
        setIsTyping(false);
        setThinkingText('');
        if (streamingIdRef.current) {
          setMessages((prev) =>
            prev.map((m) => m.id === streamingIdRef.current ? { ...m, isStreaming: false } : m)
          );
          streamingIdRef.current = null;
        }
      }

      // Polling recovery: fetch actual response from backend in case stream:done was missed
      await pollRecovery();
    }, 120000);
  }, [flushBuffer, pollRecovery]);

  // Load existing messages
  useEffect(() => {
    if (!sessionId) { setIsLoadingMessages(false); return; }
    setIsLoadingMessages(true);
    setMessages([]);
    streamingIdRef.current = null;
    stopTypewriter();
    let cancelled = false;
    (async () => {
      try {
        const token = await apiService.getToken();
        if (!token || cancelled) return;
        const raw = await apiService.getSessionMessages(token, sessionId);
        if (cancelled) return;
        setMessages(raw.map((m: any) => ({
          id: m.id || `msg-${Math.random().toString(36).slice(2)}`,
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content || '',
          timestamp: new Date(m.created_at || m.createdAt || Date.now()),
        })));
      } catch {}
      finally { if (!cancelled) setIsLoadingMessages(false); }
    })();
    return () => { cancelled = true; };
  }, [sessionId, stopTypewriter]);

  // WebSocket streaming — FIX: register listeners BEFORE joining session room
  useEffect(() => {
    if (!sessionId) return;

    // FIX BUG #3: Register stream listener FIRST, THEN join session
    const offStream = socketService.onStream((event: any) => {
      switch (event.type) {
        case 'stream:start':
          gotStreamEventRef.current = true;
          doneProcessedRef.current = false;
          setIsTyping(true);
          setThinkingText('Flow démarre...');
          // Cancel polling recovery if stream events start flowing
          if (pollingRecoveryRef.current) { clearTimeout(pollingRecoveryRef.current); pollingRecoveryRef.current = null; }
          resetStreamTimeout();
          break;
        case 'stream:text_delta':
          gotStreamEventRef.current = true;
          setIsTyping(true);
          setThinkingText('');
          resetStreamTimeout();
          bufferRef.current += (event.delta || '');
          // First token: flush immediately for zero-latency feel
          if (!streamingIdRef.current) {
            flushBuffer();
          } else if (!flushTimerRef.current) {
            flushTimerRef.current = setTimeout(() => {
              flushTimerRef.current = null;
              flushBuffer();
            }, STREAM_FLUSH_MS);
          }
          break;
        case 'stream:thinking':
          setThinkingText(event.content || event.delta || 'Flow réfléchit...');
          resetStreamTimeout();
          break;
        case 'stream:tool_start': {
          const toolId = event.toolCallId || `tool-${Date.now()}`;
          const toolLabel = event.displayLabel || event.toolName || 'Outil';
          setToolCalls((prev) => [
            ...prev,
            { id: toolId, name: toolLabel, status: 'running', startedAt: Date.now() },
          ]);
          setThinkingText(`${toolLabel}...`);
          resetStreamTimeout();
          break;
        }
        case 'stream:tool_done':
          setToolCalls((prev) =>
            prev.map((t) =>
              t.id === event.toolCallId
                ? { ...t, status: 'done' as const, durationMs: event.durationMs || (Date.now() - t.startedAt) }
                : t
            )
          );
          setThinkingText('');
          resetStreamTimeout();
          break;
        case 'stream:tool_progress':
          setToolCalls((prev) =>
            prev.map((t) =>
              t.id === event.toolCallId ? { ...t, message: event.message } : t
            )
          );
          setThinkingText(`${event.message || event.displayLabel || event.toolName || 'En cours'}...`);
          resetStreamTimeout();
          break;
        case 'stream:heartbeat':
          resetStreamTimeout();
          break;
        case 'stream:fallback':
          gotStreamEventRef.current = true;
          setThinkingText('Changement de modèle...');
          resetStreamTimeout();
          break;
        case 'stream:done':
        case 'stream:complete': {
          // Guard: skip if already processed (backend may send both done + complete)
          if (doneProcessedRef.current) break;
          doneProcessedRef.current = true;
          sendInProgressRef.current = false;

          if (streamTimeoutRef.current) { clearTimeout(streamTimeoutRef.current); streamTimeoutRef.current = null; }
          if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
          if (safetyNetRef.current) { clearTimeout(safetyNetRef.current); safetyNetRef.current = null; }
          if (pollingRecoveryRef.current) { clearTimeout(pollingRecoveryRef.current); pollingRecoveryRef.current = null; }
          flushBuffer();

          // If an error message was shown (e.g. HTTP timeout), remove it — stream succeeded
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant' && last.content.startsWith('⚠️')) {
              return prev.slice(0, -1);
            }
            return prev;
          });
          setCanRetry(false);

          const fullText = event.fullText as string | undefined;
          if (fullText && !streamingIdRef.current) {
            // Non-stream path: animate fullText with typewriter effect
            setIsTyping(false);
            setThinkingText('');
            setToolCalls([]);
            streamingIdRef.current = null;
            animateFullText(fullText);
          } else {
            // Normal streaming path: finalize
            if (streamingIdRef.current) {
              setMessages((prev) =>
                prev.map((m) => m.id === streamingIdRef.current ? { ...m, isStreaming: false } : m)
              );
            }
            setIsTyping(false);
            setThinkingText('');
            setToolCalls([]);
            streamingIdRef.current = null;
          }
          break;
        }
        case 'stream:error': {
          if (streamTimeoutRef.current) { clearTimeout(streamTimeoutRef.current); streamTimeoutRef.current = null; }
          if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
          if (pollingRecoveryRef.current) { clearTimeout(pollingRecoveryRef.current); pollingRecoveryRef.current = null; }
          stopTypewriter();
          bufferRef.current = '';
          setIsTyping(false);
          setThinkingText('');
          setToolCalls([]);
          streamingIdRef.current = null;
          sendInProgressRef.current = false;
          const errMsg = event.error || 'Une erreur est survenue';
          setMessages((prev) => [
            ...prev,
            { id: `err-${Date.now()}`, role: 'assistant', content: `⚠️ ${errMsg}`, timestamp: new Date() },
          ]);
          setCanRetry(true);
          break;
        }
      }
    });

    const offTyping = socketService.onTyping((data: any) => {
      setIsTyping(data.isTyping);
    });

    // NOW join session room — after listeners are registered
    socketService.joinSessionAsync(sessionId);

    return () => {
      offStream();
      offTyping();
      stopTypewriter();
      bufferRef.current = '';
      // Reset all refs to prevent state bleed between sessions
      sendInProgressRef.current = false;
      gotStreamEventRef.current = false;
      doneProcessedRef.current = false;
      streamingIdRef.current = null;
      if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
      if (streamTimeoutRef.current) { clearTimeout(streamTimeoutRef.current); streamTimeoutRef.current = null; }
      if (safetyNetRef.current) { clearTimeout(safetyNetRef.current); safetyNetRef.current = null; }
      if (pollingRecoveryRef.current) { clearTimeout(pollingRecoveryRef.current); pollingRecoveryRef.current = null; }
    };
  // FIX BUG #4: Only depend on sessionId — other callbacks use refs/stable-refs
  }, [sessionId]);

  // Send message via HTTP (triggers stream via WebSocket)
  const sendMessage = useCallback(
    async (text: string, media?: MediaAttachment[], model?: string | null) => {
      if ((!text.trim() && !media?.length) || !sessionId) return;
      stopTypewriter();

      // Ensure socket is alive and session room is joined BEFORE sending
      socketService.ensureConnected();

      const displayText = media?.length
        ? `${text}${text ? '\n' : ''}${media.map((a) => `📎 ${a.filename}`).join('\n')}`
        : text;
      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: 'user', content: displayText, timestamp: new Date(), attachments: media },
      ]);
      setIsTyping(true);
      setCanRetry(false);
      gotStreamEventRef.current = false;
      doneProcessedRef.current = false;
      sendInProgressRef.current = true;
      lastUserMsgRef.current = { text, media: media ?? undefined, model };

      // FIX BUG #1: Await session join before sending HTTP
      await socketService.joinSessionAsync(sessionId);

      try {
        // Always read fresh token (may have been rotated by refresh-token flow)
        const token = await apiService.getToken();
        tokenRef.current = token;
        if (!token) throw new Error('Non authentifié');
        const body: any = { message: text };
        if (media?.length) body.media = media;
        if (model) body.model = model;
        const res = await fetchWithTimeout(`${API_URL}/api/fc-agent/sessions/${sessionId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }, 300_000); // 5 min — agent runs can take time
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.message || `Erreur ${res.status}`);
        }

        // HTTP 200 = backend run is DONE. If stream:done wasn't received via WebSocket
        // (socket may have disconnected during the run), recover immediately via polling.
        if (!doneProcessedRef.current) {
          console.warn('[useChat] HTTP 200 but stream:done not received — polling recovery NOW');
          socketService.ensureConnected();
          socketService.joinSessionAsync(sessionId);
          // Poll immediately — the response is in the DB since HTTP 200 means run completed
          await pollRecovery();
        }
      } catch (err: any) {
        // If stream:done already came via WebSocket, ignore the HTTP error
        if (doneProcessedRef.current) return;

        // On network timeout (AbortError), the backend may still be running.
        // Don't show error immediately — try polling recovery first.
        if (err.name === 'AbortError') {
          console.warn('[useChat] HTTP timed out — backend may still be running, trying recovery...');
          socketService.ensureConnected();
          socketService.joinSessionAsync(sessionId);
          // Try polling recovery
          await pollRecovery();
          if (doneProcessedRef.current) return; // Recovery succeeded
        }

        // Real error or recovery failed — show error to user
        if (!doneProcessedRef.current) {
          sendInProgressRef.current = false;
          setIsTyping(false);
          setThinkingText('');
          const msg = err.name === 'AbortError' ? 'Délai de réponse dépassé' : (err.message || 'Une erreur est survenue');
          setMessages((prev) => [
            ...prev,
            { id: `err-${Date.now()}`, role: 'assistant', content: `⚠️ ${msg}`, timestamp: new Date() },
          ]);
          setCanRetry(true);
        }
      }
    },
    [sessionId, stopTypewriter, pollRecovery]
  );

  const cancelRun = useCallback(() => {
    if (!sessionId) return;
    socketService.cancelRun(sessionId);
    stopTypewriter();
    if (streamTimeoutRef.current) { clearTimeout(streamTimeoutRef.current); streamTimeoutRef.current = null; }
    if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
    flushBuffer();
    setIsTyping(false);
    setThinkingText('');
    setToolCalls([]);
    sendInProgressRef.current = false;
    if (streamingIdRef.current) {
      setMessages((prev) =>
        prev.map((m) => m.id === streamingIdRef.current ? { ...m, isStreaming: false } : m)
      );
      streamingIdRef.current = null;
    }
  }, [sessionId, flushBuffer, stopTypewriter]);

  const retry = useCallback(() => {
    if (!lastUserMsgRef.current) return;
    setCanRetry(false);
    // Remove the error message before retrying
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === 'assistant' && last.content.startsWith('⚠️')) {
        return prev.slice(0, -1);
      }
      return prev;
    });
    const { text, media, model } = lastUserMsgRef.current;
    // Remove the previous user message too (sendMessage will re-add it)
    setMessages((prev) => {
      const lastIdx = [...prev].reverse().findIndex((m) => m.role === 'user');
      if (lastIdx >= 0) return prev.slice(0, prev.length - 1 - lastIdx).concat(prev.slice(prev.length - lastIdx));
      return prev;
    });
    sendMessage(text, media ?? undefined, model);
  }, [sendMessage]);

  return { messages, setMessages, isTyping, thinkingText, sendMessage, isLoadingMessages, cancelRun, toolCalls, canRetry, retry };
}
