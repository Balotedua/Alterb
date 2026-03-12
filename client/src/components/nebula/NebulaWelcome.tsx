import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNebulaStore } from '@/store/nebulaStore';
import { useAuth } from '@/hooks/useAuth';

const VISITED_KEY = 'alter_visited';

interface Section {
  label: string;
  fragment?: string;
  text?: string;
}

const SECTIONS: Section[] = [
  { label: 'Finanze',  fragment: 'FinancePanorama' },
  { label: 'Umore',    text: 'registra umore'      },
  { label: 'Salute',   text: 'apri la salute'      },
  { label: 'Note',     text: 'apri le note'        },
];

const ease = [0.16, 1, 0.3, 1] as [number, number, number, number];

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 5)  return 'Buonanotte';
  if (h < 12) return 'Buongiorno';
  if (h < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

export function NebulaWelcome() {
  const { chatHistory, setFragment, setPrefillInput, openFromReturn } = useNebulaStore();
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(false);

  useEffect(() => {
    const visited = localStorage.getItem(VISITED_KEY);
    setIsFirstTime(!visited);
    localStorage.setItem(VISITED_KEY, '1');
    const t = setTimeout(() => setShow(true), 500);
    return () => clearTimeout(t);
  }, []);

  if (chatHistory.length > 0) return null;

  const firstName = (user?.user_metadata?.name as string | undefined)?.split(' ')[0] ?? '';
  const greetWord = isFirstTime ? 'Benvenuto' : timeGreeting();
  const sub = isFirstTime ? 'Sono Nebula, il tuo assistente.' : 'Come posso aiutarti?';

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="nw-layout"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease }}
        >
          {/* 1. Saluto */}
          <div className="nw-greeting-block">
            <motion.p
              className="nw-greeting"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.55, ease }}
            >
              {greetWord}{firstName && <>, <em className="nw-name">{firstName}</em></>}.
            </motion.p>
            <motion.p
              className="nw-sub"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.45, ease }}
            >
              {sub}
            </motion.p>
          </div>

          {/* 2. Divider */}
          <motion.div
            className="nw-divider-line"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.4, ease }}
          />

          {/* 3. 4 sezioni */}
          <div className="nw-actions">
            <motion.div
              className="nw-chips"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.4, ease }}
            >
              {SECTIONS.map((s, i) => (
                <motion.button
                  key={s.label}
                  className="nw-chip"
                  onClick={() => s.fragment ? openFromReturn(s.fragment, {}, 'Welcome') : setPrefillInput(s.text ?? '')}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.48 + i * 0.05, duration: 0.28, ease }}
                  whileTap={{ scale: 0.95 }}
                >
                  {s.label}
                </motion.button>
              ))}
            </motion.div>

            {/* 4. Guida */}
            <motion.button
              className="nw-guide-btn"
              onClick={() => setFragment('Help', {}, 'VISUAL')}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.68, duration: 0.35, ease }}
              whileTap={{ scale: 0.97 }}
            >
              scopri la guida <span className="nw-guide-arrow">›</span>
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
