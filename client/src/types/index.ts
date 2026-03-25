// ─── Vault ───────────────────────────────────────────────────
export interface VaultEntry {
  id: string;
  user_id: string;
  category: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ─── Orchestrator ────────────────────────────────────────────
export interface ParsedIntent {
  category: string;
  data: Record<string, unknown>;
  source: 'local' | 'ai';
  rawText: string;
  categoryMeta?: CategoryMeta;
}

export interface CategoryMeta {
  label: string;
  icon: string;
  color: string;
}

// ─── Starfield ───────────────────────────────────────────────
export interface Star {
  id: string;            // = category slug
  label: string;         // human readable
  color: string;         // hex
  icon: string;          // lucide icon name
  x: number;            // 0..1 normalized screen position
  y: number;
  intensity: number;     // 0..1 (dimmer = less used)
  entryCount: number;
  lastEntry: string | null;
  isNew?: boolean;       // triggers supernova animation
  ephemeral?: boolean;   // view stars — auto-deleted after 15 days
  lastAccessedAt?: string; // ISO string, for ephemeral cleanup
  witherFactor?: number; // 1=fresh, 0=fully withered (gray) after ~18 days of inactivity
}

// ─── Widget ──────────────────────────────────────────────────
export type RenderType = 'chart' | 'list' | 'diary' | 'stats' | 'mood' | 'timeline' | 'nexus' | 'activity' | 'numeric' | 'pie' | 'doc_download' | 'finance' | 'workout' | 'codex' | 'coherence' | 'void';

export interface NexusBeam {
  catA: string;
  catB: string;
  colorA: string;
  colorB: string;
  correlation: number;
}

export interface WidgetData {
  category: string;
  label: string;
  color: string;
  entries: VaultEntry[];
  renderType: RenderType;
  subTab?: string;
}

// ─── Chat ────────────────────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'nebula';
  text: string;
  ts: number;
}

// ─── Semantic Clustering ─────────────────────────────────────
export interface SemanticLink {
  catA: string;
  catB: string;
  similarity: number; // 0..1 cosine similarity between category centroids
}

// ─── Auth ────────────────────────────────────────────────────
export interface AlterUser {
  id: string;
  email: string;
  name?: string;
}

// ─── Theme ───────────────────────────────────────────────────
export type Theme = 'dark' | 'matrix' | 'nebula' | 'light';

// ─── Social (Nexus) ──────────────────────────────────────────
export interface UserProfile {
  user_id: string;
  username: string | null;
  display_name: string | null;
  public_stats: Record<string, number>;
  created_at: string;
}

export type FriendStatus = 'pending' | 'accepted' | 'declined';

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendStatus;
  created_at: string;
}

export type FriendWithProfile = Friendship & { profile: UserProfile };

export interface FriendMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  text: string;
  created_at: string;
}

export interface Challenge {
  id: string;
  creator_id: string;
  target_id: string;
  title: string;
  category: string;
  target_value: number | null;
  unit: string | null;
  end_date: string | null;
  creator_progress: number;
  target_progress: number;
  status: 'active' | 'completed' | 'declined';
  created_at: string;
}
