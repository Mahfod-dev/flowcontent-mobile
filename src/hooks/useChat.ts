import { useCallback, useEffect, useRef, useState } from 'react';
import { apiService } from '../services/api';
import { MediaAttachment, Message, ToolCall } from '../types';

// Typewriter speed: characters per chunk & interval (used only for the
// non-delta fallback where the full text arrives at once).
const TYPEWRITER_CHUNK = 6;
const TYPEWRITER_MS = 12;
// Stream buffer flush interval (ms) — coalesces deltas into smooth UI updates.
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
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // AbortController for the in-flight SSE request — enables cancel + cleanup.
  const abortRef = useRef<AbortController | null>(null);
  // Guard: stream:done / stream:complete may both arrive — process once.
  const doneProcessedRef = useRef(false);
  // Keep sessionId fresh inside async callbacks without re-subscribing.
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  // Last user message, for retry.
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

  // Animate text appearing progressively (used only when the full text arrives
  // at once without preceding deltas — e.g. cheap conversation lane).
  const animateFullText = useCallback((fullText: string) => {
    stopTypewriter();
    const msgId = `stream-${Date.now()}`;
    let pos = 0;
    setMessages((prev) => [
      ...prev,
      { id: msgId, role: 'assistant', content: '', timestamp: new Date(), isStreaming: true },
    ]);
    typewriterRef.current = setInterval(() => {
      pos += TYPEWRITER_CHUNK;
      if (pos >= fullText.length) {
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

  /** Handle a single SSE stream event — same event shape the WebSocket path used. */
  const handleStreamEvent = useCallback((event: any) => {
    switch (event.type) {
      case 'stream:start':
        doneProcessedRef.current = false;
        setIsTyping(true);
        setThinkingText('Flow démarre...');
        break;

      case 'stream:text_delta':
        setIsTyping(true);
        setThinkingText('');
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
        break;

      case 'stream:tool_start': {
        const toolId = event.toolCallId || `tool-${Date.now()}`;
        const toolLabel = event.displayLabel || event.toolName || 'Outil';
        setToolCalls((prev) => [
          ...prev,
          { id: toolId, name: toolLabel, status: 'running', startedAt: Date.now() },
        ]);
        setThinkingText(`${toolLabel}...`);
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
        break;

      case 'stream:tool_progress':
        setToolCalls((prev) =>
          prev.map((t) =>
            t.id === event.toolCallId ? { ...t, message: event.message } : t
          )
        );
        setThinkingText(`${event.message || event.displayLabel || event.toolName || 'En cours'}...`);
        break;

      case 'stream:heartbeat':
        break;

      case 'stream:fallback':
        setThinkingText('Changement de modèle...');
        break;

      case 'stream:done':
      case 'stream:complete': {
        if (doneProcessedRef.current) break;
        doneProcessedRef.current = true;
        if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
        flushBuffer();
        setCanRetry(false);

        // SSE final event carries `response`; legacy WS used `fullText`.
        const fullText = (event.fullText ?? event.response) as string | undefined;
        if (fullText && !streamingIdRef.current) {
          // No deltas arrived — animate the full text in one shot.
          setIsTyping(false);
          setThinkingText('');
          setToolCalls([]);
          streamingIdRef.current = null;
          animateFullText(fullText);
        } else {
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

      case 'stream:cancelled': {
        doneProcessedRef.current = true;
        if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
        flushBuffer();
        if (streamingIdRef.current) {
          setMessages((prev) =>
            prev.map((m) => m.id === streamingIdRef.current ? { ...m, isStreaming: false } : m)
          );
          streamingIdRef.current = null;
        }
        setIsTyping(false);
        setThinkingText('');
        setToolCalls([]);
        break;
      }

      case 'stream:error': {
        doneProcessedRef.current = true;
        if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
        stopTypewriter();
        bufferRef.current = '';
        setIsTyping(false);
        setThinkingText('');
        setToolCalls([]);
        streamingIdRef.current = null;
        const errMsg = event.error || 'Une erreur est survenue';
        setMessages((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, role: 'assistant', content: `⚠️ ${errMsg}`, timestamp: new Date() },
        ]);
        setCanRetry(true);
        break;
      }
    }
  }, [flushBuffer, animateFullText, stopTypewriter]);

  // Load existing messages when the session changes
  useEffect(() => {
    if (!sessionId) { setIsLoadingMessages(false); return; }
    setIsLoadingMessages(true);
    setMessages([]);
    streamingIdRef.current = null;
    stopTypewriter();
    // Abort any in-flight stream from the previous session
    abortRef.current?.abort();
    abortRef.current = null;
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
    return () => {
      cancelled = true;
      abortRef.current?.abort();
      abortRef.current = null;
      stopTypewriter();
      bufferRef.current = '';
      streamingIdRef.current = null;
      doneProcessedRef.current = false;
      if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
    };
  }, [sessionId, stopTypewriter]);

  // Send a message and consume the SSE stream (single HTTP connection)
  const sendMessage = useCallback(
    async (text: string, media?: MediaAttachment[], model?: string | null) => {
      if ((!text.trim() && !media?.length) || !sessionId) return;
      stopTypewriter();

      const displayText = media?.length
        ? `${text}${text ? '\n' : ''}${media.map((a) => `📎 ${a.filename}`).join('\n')}`
        : text;
      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: 'user', content: displayText, timestamp: new Date(), attachments: media },
      ]);
      setIsTyping(true);
      setThinkingText('Flow démarre...');
      setCanRetry(false);
      doneProcessedRef.current = false;
      bufferRef.current = '';
      streamingIdRef.current = null;
      lastUserMsgRef.current = { text, media: media ?? undefined, model };

      // Fresh AbortController for this run
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const token = await apiService.getToken();
        tokenRef.current = token;
        if (!token) throw new Error('Non authentifié');

        await apiService.streamMessage(
          token,
          sessionId,
          text,
          { media, model, signal: controller.signal },
          handleStreamEvent,
        );

        // Stream ended. If no terminal event arrived (rare: server closed early),
        // finalize whatever we have so the UI doesn't hang in "typing".
        if (!doneProcessedRef.current) {
          if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
          flushBuffer();
          if (streamingIdRef.current) {
            setMessages((prev) =>
              prev.map((m) => m.id === streamingIdRef.current ? { ...m, isStreaming: false } : m)
            );
            streamingIdRef.current = null;
          }
          setIsTyping(false);
          setThinkingText('');
          setToolCalls([]);
          doneProcessedRef.current = true;
        }
      } catch (err: any) {
        // Aborted by the user (cancelRun) — UI already reset there.
        if (err?.name === 'AbortError' || controller.signal.aborted) return;
        // A terminal stream:error/done already handled the UI.
        if (doneProcessedRef.current) return;

        if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
        flushBuffer();
        setIsTyping(false);
        setThinkingText('');
        setToolCalls([]);
        if (streamingIdRef.current) {
          // We received partial text before the drop — keep it, just stop streaming.
          setMessages((prev) =>
            prev.map((m) => m.id === streamingIdRef.current ? { ...m, isStreaming: false } : m)
          );
          streamingIdRef.current = null;
        } else {
          setMessages((prev) => [
            ...prev,
            { id: `err-${Date.now()}`, role: 'assistant', content: `⚠️ ${err?.message || 'Une erreur est survenue'}`, timestamp: new Date() },
          ]);
        }
        setCanRetry(true);
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [sessionId, stopTypewriter, handleStreamEvent, flushBuffer]
  );

  const cancelRun = useCallback(() => {
    // Aborting the SSE request closes the HTTP connection → backend stops the run.
    abortRef.current?.abort();
    abortRef.current = null;
    stopTypewriter();
    if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
    flushBuffer();
    doneProcessedRef.current = true;
    setIsTyping(false);
    setThinkingText('');
    setToolCalls([]);
    if (streamingIdRef.current) {
      setMessages((prev) =>
        prev.map((m) => m.id === streamingIdRef.current ? { ...m, isStreaming: false } : m)
      );
      streamingIdRef.current = null;
    }
  }, [flushBuffer, stopTypewriter]);

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
