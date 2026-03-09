import { create } from 'zustand';

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
  setThinking: (v: boolean) => void;
  addMessage: (role: 'user' | 'assistant', content: string) => void;
  reset: () => void;
  setTypingIntensity: (v: number) => void;
  triggerBurst: () => void;
  triggerResponseBurst: () => void;
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

  setIntent: (intent, intensity, message, data = {}) =>
    set({ intent, intensity, message, data }),

  setFragment: (activeFragment, fragmentParams, responseType) =>
    set({ activeFragment, fragmentParams, responseType }),

  setThinking: (isThinking) => set({ isThinking }),

  addMessage: (role, content) =>
    set((s) => ({
      chatHistory: [
        ...s.chatHistory.slice(-20),
        { role, content, timestamp: Date.now() },
      ],
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

  triggerBurst: () => {
    set({ isBursting: true, typingIntensity: 0 });
    setTimeout(() => set({ isBursting: false }), 700);
  },

  triggerResponseBurst: () => {
    set({ isResponseBursting: true });
    setTimeout(() => set({ isResponseBursting: false }), 2300);
  },
}));
