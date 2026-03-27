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

export interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
  site_name?: string;
  phone?: string;
}

export interface Credits {
  total_available: number;
  free_credits_remaining: number;
  plan: string;
}

export interface DashboardStats {
  articlesGenerated: number;
  videosGenerated?: number;
  audiosGenerated?: number;
  imagesCreated: number;
  averageTime: number;
  successRate: number;
}

export interface RecentActivity {
  id: string;
  title: string;
  type: 'success' | 'error';
  domain: string;
  timestamp: string;
}

export interface DomainStat {
  domain: string;
  articles: number;
  images: number;
  successRate: number;
}

export interface DashboardData {
  stats: DashboardStats;
  recentActivity: RecentActivity[];
  domainStats: DomainStat[];
}

export interface NangoConnection {
  provider: string;
  provider_config_key?: string;
  connection_id?: string;
  provider_display_name?: string;
  displayName?: string;
  connected: boolean;
  account_name?: string;
  connected_at?: string;
}

export interface NangoProvider {
  id: string;
  name?: string;
  displayName?: string;
  display_name?: string;
  description?: string;
  category?: string;
  iconUrl?: string;
  icon?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  credits: number;
  interval?: string;
  features?: string[];
  stripe_price_id?: string;
}

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price: number;
  stripe_price_id?: string;
}

export interface CreditTransaction {
  id: string;
  type: string;
  amount: number;
  description?: string;
  created_at: string;
}

export interface CurrentSubscription {
  id?: string;
  plan: string;
  status: string;
  credits_remaining: number;
  credits_total: number;
  current_period_end?: string;
  cancel_at_period_end?: boolean;
}

export interface MediaFile {
  name: string;
  path: string;
  bucket: string;
  size: number;
  mimeType: string;
  created_at: string;
  url?: string;
}
