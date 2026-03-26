export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isThinking?: boolean;
  isStreaming?: boolean;
}

export interface Session {
  id: string;
  title: string;
  last_message_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  token: string;
  plan?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  status: 'running' | 'done';
  message?: string;
  durationMs?: number;
  startedAt: number;
}

export interface StreamEvent {
  type: 'chunk' | 'done' | 'thinking' | 'error' | 'tool_call';
  data: string | { content?: string; tool?: string };
  sessionId?: string;
}
