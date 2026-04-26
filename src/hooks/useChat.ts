import { useCallback, useEffect, useRef, useState } from 'react';
import { socketService } from '../services/socket';
import { apiService } from '../services/api';
import { MediaAttachment, Message, ToolCall } from '../types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://flowbackendapi.store';

// Typewriter speed: characters per chunk & interval
const TYPEWRITER_CHUNK = 2;
const TYPEWRITER_MS = 20;

export function useChat(sessionId: string, userId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [thinkingText, setThinkingText] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const streamingIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const bufferRef = useRef('');
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Reset stream timeout — 2 min (backend sends heartbeats during long tasks)
  const resetStreamTimeout = useCallback(() => {
    if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
    streamTimeoutRef.current = setTimeout(() => {
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
    }, 120000);
  }, [flushBuffer]);

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

  // WebSocket streaming — all events now come via user: room (including text_delta)
  useEffect(() => {
    if (!sessionId) return;

    socketService.joinSession(sessionId);

    const offStream = socketService.onStream((event: any) => {
      switch (event.type) {
        case 'stream:start':
          setIsTyping(true);
          setThinkingText('Flow démarre...');
          resetStreamTimeout();
          break;
        case 'stream:text_delta':
          setIsTyping(true);
          setThinkingText('');
          resetStreamTimeout();
          bufferRef.current += (event.delta || '');
          if (!flushTimerRef.current) {
            flushTimerRef.current = setTimeout(() => {
              flushTimerRef.current = null;
              flushBuffer();
            }, 50);
          }
          break;
        case 'stream:thinking':
          setThinkingText(event.content || event.delta || 'Flow réfléchit...');
          resetStreamTimeout();
          break;
        case 'stream:tool_start': {
          const toolId = event.toolCallId || `tool-${Date.now()}`;
          setToolCalls((prev) => [
            ...prev,
            { id: toolId, name: event.toolName || 'Outil', status: 'running', startedAt: Date.now() },
          ]);
          setThinkingText(`${event.toolName || 'Outil en cours'}...`);
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
          setThinkingText(`${event.message || event.toolName || 'En cours'}...`);
          resetStreamTimeout();
          break;
        case 'stream:heartbeat':
          resetStreamTimeout();
          break;
        case 'stream:done':
        case 'stream:complete': {
          if (streamTimeoutRef.current) { clearTimeout(streamTimeoutRef.current); streamTimeoutRef.current = null; }
          if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
          flushBuffer();

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
          stopTypewriter();
          bufferRef.current = '';
          setIsTyping(false);
          setThinkingText('');
          setToolCalls([]);
          streamingIdRef.current = null;
          const errMsg = event.error || 'Erreur';
          const isNetErr = /network|fetch|abort|timeout|disconnect/i.test(errMsg);
          if (!isNetErr) {
            setMessages((prev) => [
              ...prev,
              { id: `err-${Date.now()}`, role: 'assistant', content: `⚠️ ${errMsg}`, timestamp: new Date() },
            ]);
          }
          break;
        }
      }
    });

    const offTyping = socketService.onTyping((data: any) => {
      setIsTyping(data.isTyping);
    });

    return () => {
      offStream();
      offTyping();
      stopTypewriter();
      if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
      if (streamTimeoutRef.current) { clearTimeout(streamTimeoutRef.current); streamTimeoutRef.current = null; }
    };
  }, [sessionId, flushBuffer, resetStreamTimeout, animateFullText, stopTypewriter]);

  // Send message via HTTP (triggers stream via WebSocket)
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

      try {
        const token = tokenRef.current;
        if (!token) throw new Error('Non authentifié');
        const body: any = { message: text };
        if (media?.length) body.media = media;
        if (model) body.model = model;
        const res = await fetch(`${API_URL}/api/fc-agent/sessions/${sessionId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || `Erreur ${res.status}`);
        }
      } catch (err: any) {
        setIsTyping(false);
        // Suppress transient network errors (e.g. app returning from background)
        const msg = err.message || '';
        const isNetworkError = /network|fetch|abort|timeout/i.test(msg);
        if (!isNetworkError) {
          setMessages((prev) => [
            ...prev,
            { id: `err-${Date.now()}`, role: 'assistant', content: `⚠️ ${msg}`, timestamp: new Date() },
          ]);
        }
      }
    },
    [sessionId, stopTypewriter]
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
    if (streamingIdRef.current) {
      setMessages((prev) =>
        prev.map((m) => m.id === streamingIdRef.current ? { ...m, isStreaming: false } : m)
      );
      streamingIdRef.current = null;
    }
  }, [sessionId, flushBuffer, stopTypewriter]);

  return { messages, setMessages, isTyping, thinkingText, sendMessage, isLoadingMessages, cancelRun, toolCalls };
}
