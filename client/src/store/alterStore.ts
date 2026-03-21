import { create } from 'zustand';
import type { Star, WidgetData, ChatMessage, AlterUser, NexusBeam, SemanticLink, Theme } from '../types';

interface AlterStore {
  // ── Auth ────────────────────────────────────────────────
  user: AlterUser | null;
  setUser: (u: AlterUser | null) => void;

  // ── Stars (galassia) ────────────────────────────────────
  stars: Star[];
  setStars: (stars: Star[]) => void;
  upsertStar: (star: Star) => void;
  removeStar: (id: string) => void;
  markStarSeen: (id: string) => void;

  // ── Active widget ────────────────────────────────────────
  activeWidget: WidgetData | null;
  setActiveWidget: (w: WidgetData | null) => void;

  // ── Chat history ─────────────────────────────────────────
  messages: ChatMessage[];
  addMessage: (role: 'user' | 'nebula', text: string) => void;

  // ── UI states ────────────────────────────────────────────
  isProcessing: boolean;
  setProcessing: (v: boolean) => void;

  focusMode: boolean;        // "?" command → labels on stars
  setFocusMode: (v: boolean) => void;

  knownCategories: string[]; // for localParser training
  addKnownCategory: (cat: string) => void;

  // ── Query feedback ───────────────────────────────────────────
  highlightedStarId: string | null;  // star lit during a query response
  setHighlightedStar: (id: string | null) => void;

  // ── Sentinel alert ───────────────────────────────────────────
  alertEvent: { title: string; scheduledAt: string } | null;
  setAlertEvent: (e: { title: string; scheduledAt: string } | null) => void;

  // ── Nexus beam ───────────────────────────────────────────────
  nexusBeam: NexusBeam | null;
  setNexusBeam: (beam: NexusBeam | null) => void;

  // ── Semantic clustering ───────────────────────────────────────
  semanticLinks: SemanticLink[];
  setSemanticLinks: (links: SemanticLink[]) => void;

  // ── Ghost star prompt (click on missing pillar → pre-fill input) ─
  ghostStarPrompt: string | null;
  setGhostStarPrompt: (prompt: string | null) => void;

  // ── View mode ─────────────────────────────────────────────────
  viewMode: 'chat' | 'galaxy' | 'dashboard';
  setViewMode: (mode: 'chat' | 'galaxy' | 'dashboard') => void;

  // ── Settings ──────────────────────────────────────────────────
  theme: Theme;
  setTheme: (t: Theme) => void;
  username: string;
  setUsername: (n: string) => void;
  showSettings: boolean;
  setShowSettings: (v: boolean) => void;
}

export const useAlterStore = create<AlterStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),

  stars: [],
  setStars: (stars) => set({ stars }),
  upsertStar: (star) =>
    set((s) => {
      const exists = s.stars.find((st) => st.id === star.id);
      if (!exists) return { stars: [...s.stars, star] };
      return { stars: s.stars.map((st) => (st.id === star.id ? { ...st, ...star } : st)) };
    }),
  removeStar: (id) =>
    set((s) => ({ stars: s.stars.filter((st) => st.id !== id) })),
  markStarSeen: (id) =>
    set((s) => ({
      stars: s.stars.map((st) => (st.id === id ? { ...st, isNew: false } : st)),
    })),

  activeWidget: null,
  setActiveWidget: (activeWidget) => set({ activeWidget }),

  messages: [],
  addMessage: (role, text) =>
    set((s) => ({
      messages: [...s.messages, { role, text, ts: Date.now() }],
    })),

  isProcessing: false,
  setProcessing: (isProcessing) => set({ isProcessing }),

  focusMode: false,
  setFocusMode: (focusMode) => set({ focusMode }),

  knownCategories: ['finance', 'health', 'psychology', 'calendar'],
  addKnownCategory: (cat) =>
    set((s) => ({
      knownCategories: s.knownCategories.includes(cat)
        ? s.knownCategories
        : [...s.knownCategories, cat],
    })),

  highlightedStarId: null,
  setHighlightedStar: (highlightedStarId) => set({ highlightedStarId }),

  alertEvent: null,
  setAlertEvent: (alertEvent) => set({ alertEvent }),

  nexusBeam: null,
  setNexusBeam: (nexusBeam) => set({ nexusBeam }),

  semanticLinks: [],
  setSemanticLinks: (semanticLinks) => set({ semanticLinks }),

  ghostStarPrompt: null,
  setGhostStarPrompt: (ghostStarPrompt) => set({ ghostStarPrompt }),

  viewMode: 'chat',
  setViewMode: (viewMode) => set({ viewMode }),

  theme: (localStorage.getItem('alter-theme') as Theme) ?? 'dark',
  setTheme: (theme) => { localStorage.setItem('alter-theme', theme); set({ theme }); },
  username: localStorage.getItem('alter-username') ?? '',
  setUsername: (username) => { localStorage.setItem('alter-username', username); set({ username }); },
  showSettings: false,
  setShowSettings: (showSettings) => set({ showSettings }),
}));
