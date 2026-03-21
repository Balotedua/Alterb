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
  isInsight?: boolean;   // autonomous discovery — golden pulsing aura
  ephemeral?: boolean;   // view stars — auto-deleted after 15 days
  lastAccessedAt?: string; // ISO string, for ephemeral cleanup
}

// ─── Widget ──────────────────────────────────────────────────
export type RenderType = 'chart' | 'list' | 'diary' | 'stats' | 'mood' | 'timeline' | 'insight' | 'nexus';

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
