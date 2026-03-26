export interface MediaAttachment {
  type: 'document' | 'image';
  url: string;
  mimeType: string;
  filename: string;
  storagePath?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isThinking?: boolean;
  isStreaming?: boolean;
  attachments?: MediaAttachment[];
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

export interface SiteDomain {
  id: string;
  domain: string;
  displayName?: string;
  siteType?: string;
  isPrimary?: boolean;
  status?: string;
  faviconUrl?: string;
}

export interface AppNotification {
  id: string;
  type: string;
  category: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  action_url?: string;
  action_label?: string;
}
