import { create } from 'zustand';
import type { NebulaConfirmation, NebulaContext } from '@/types/nebula';
import { DEFAULT_THEME_ID, NB_THEME_KEY } from '@/config/nebulaThemes';

export type NebulaIntent =
  | 'IDLE'
  | 'FINANCE'
  | 'HEALTH'
  | 'PSYCHOLOGY'
  | 'CONSCIOUSNESS'
  | 'BADGES';

export type NebulaResponseType = 'TALK' | 'ACTION' | 'VISUAL' | 'HYBRID';

export interface ChatEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/** One item in the interaction ring-buffer (max 5, auto-overwrites) */
export interface InteractionEntry {
  /** 'msg_user' | 'msg_ai' | 'fragment' */
  type: 'msg_user' | 'msg_ai' | 'fragment';
  content: string;
  module?: string;
  timestamp: number;
}

const INTERACTION_LIMIT = 5;

interface NebulaState {
  intent: NebulaIntent;
  intensity: number;
  message: string;
  data: Record<string, unknown>;
  isThinking: boolean;
  chatHistory: ChatEntry[];

  /** Type of AI response — drives whether a Fragment is rendered */
  responseType: NebulaResponseType | null;
  /** Name key in FRAGMENT_REGISTRY to render (null = none) */
  activeFragment: string | null;
  /** Params forwarded to the active fragment */
  fragmentParams: Record<string, unknown>;

  /** 0–1: grows with each keystroke, resets after submit */
  typingIntensity: number;
  /** true for ~700 ms after the user hits send */
  isBursting: boolean;
  /** true for ~2300 ms after the AI responds */
  isResponseBursting: boolean;

  /** Last meaningful intent — enables pronoun resolution in the parser */
  lastContext: NebulaContext | null;
  /** Pending destructive action waiting for user confirmation */
  pendingConfirmation: NebulaConfirmation | null;
  /** Controls whether the reply bubble is visible — hidden after fragment close */
  replyVisible: boolean;

  setIntent: (
    intent: NebulaIntent,
    intensity: number,
    message: string,
    data?: Record<string, unknown>,
  ) => void;
  /** Set active fragment with its params and response type */
  setFragment: (
    fragment: string | null,
    params: Record<string, unknown>,
    type: NebulaResponseType,
  ) => void;
  clearFragment: () => void;
  setThinking: (v: boolean) => void;
  addMessage: (role: 'user' | 'assistant', content: string) => void;
  reset: () => void;
  setTypingIntensity: (v: number) => void;
  triggerBurst: () => void;
  triggerResponseBurst: () => void;
  /** Save context snapshot for pronoun resolution ("cancellala") */
  setLastContext: (ctx: NebulaContext) => void;
  /** Set or clear a pending confirmation gate */
  setConfirmation: (data: NebulaConfirmation | null) => void;
  /** Text to prefill in the chat input (set from HelpFragment clicks) */
  prefillInput: string | null;
  setPrefillInput: (v: string | null) => void;

  /** Active Nebula color theme — persisted in localStorage */
  nebulaTheme: string;
  setNebulaTheme: (id: string) => void;
  /** Fragment to reopen when the user presses X (back navigation from Help) */
  returnFragment: string | null;
  /** Open a fragment keeping track of the caller so X navigates back */
  openFromReturn: (fragment: string, params: Record<string, unknown>, returnTo: string) => void;

  /** Ring-buffer of last INTERACTION_LIMIT interactions (auto-overwrites) */
  interactionHistory: InteractionEntry[];
  addInteraction: (entry: Omit<InteractionEntry, 'timestamp'>) => void;
}

export const useNebulaStore = create<NebulaState>((set) => ({
  intent: 'IDLE',
  intensity: 0.2,
  message: 'Ciao. Dimmi come posso aiutarti.',
  data: {},
  isThinking: false,
  chatHistory: [],
  responseType: null,
  activeFragment: null,
  fragmentParams: {},
  typingIntensity: 0,
  isBursting: false,
  isResponseBursting: false,
  lastContext: null,
  pendingConfirmation: null,
  replyVisible: true,
  prefillInput: null,
  returnFragment: null,
  interactionHistory: [],
  nebulaTheme: localStorage.getItem(NB_THEME_KEY) ?? DEFAULT_THEME_ID,

  setIntent: (intent, intensity, message, data = {}) =>
    set({ intent, intensity, message, data }),

  setFragment: (activeFragment, fragmentParams, responseType) =>
    set({ activeFragment, fragmentParams, responseType, returnFragment: null }),

  clearFragment: () =>
    set((s) => {
      if (s.returnFragment) {
        return {
          activeFragment: s.returnFragment,
          fragmentParams: {},
          responseType: 'VISUAL' as NebulaResponseType,
          pendingConfirmation: null,
          returnFragment: null,
          replyVisible: false,
        };
      }
      return { activeFragment: null, fragmentParams: {}, responseType: null, pendingConfirmation: null, replyVisible: false };
    }),

  openFromReturn: (fragment, params, returnTo) =>
    set({ activeFragment: fragment, fragmentParams: params, responseType: 'VISUAL', returnFragment: returnTo }),

  setThinking: (isThinking) => set({ isThinking }),

  addMessage: (role, content) =>
    set((s) => ({
      chatHistory: [
        ...s.chatHistory.slice(-20),
        { role, content, timestamp: Date.now() },
      ],
      ...(role === 'assistant' ? { replyVisible: true } : {}),
    })),

  reset: () =>
    set({
      intent: 'IDLE',
      intensity: 0.2,
      message: 'Come posso aiutarti?',
      data: {},
      activeFragment: null,
      fragmentParams: {},
      responseType: null,
    }),

  setTypingIntensity: (typingIntensity) => set({ typingIntensity }),

  setLastContext: (lastContext) => set({ lastContext }),

  setConfirmation: (pendingConfirmation) => set({ pendingConfirmation }),
  setPrefillInput: (prefillInput) => set({ prefillInput }),

  setNebulaTheme: (id) => {
    localStorage.setItem(NB_THEME_KEY, id);
    set({ nebulaTheme: id });
  },

  addInteraction: (entry) =>
    set((s) => ({
      interactionHistory: [
        ...s.interactionHistory.slice(-(INTERACTION_LIMIT - 1)),
        { ...entry, timestamp: Date.now() },
      ],
    })),

  triggerBurst: () => {
    set({ isBursting: true, typingIntensity: 0 });
    setTimeout(() => set({ isBursting: false }), 700);
  },

  triggerResponseBurst: () => {
    set({ isResponseBursting: true });
    setTimeout(() => set({ isResponseBursting: false }), 2300);
  },
}));
