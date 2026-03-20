import { create } from 'zustand';
import type { Star, WidgetData, ChatMessage, AlterUser } from '../types';

interface AlterStore {
  // ── Auth ────────────────────────────────────────────────
  user: AlterUser | null;
  setUser: (u: AlterUser | null) => void;

  // ── Stars (galassia) ────────────────────────────────────
  stars: Star[];
  setStars: (stars: Star[]) => void;
  upsertStar: (star: Star) => void;
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

  knownCategories: ['finance', 'health', 'psychology'],
  addKnownCategory: (cat) =>
    set((s) => ({
      knownCategories: s.knownCategories.includes(cat)
        ? s.knownCategories
        : [...s.knownCategories, cat],
    })),
}));
