import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNebulaStore } from '@/store/nebulaStore';
import { useAuth } from '@/hooks/useAuth';

const VISITED_KEY = 'alter_visited';

const SHORTCUTS = [
  { label: 'finanze',  text: 'mostrami le finanze'  },
  { label: 'umore',    text: 'registra umore'        },
  { label: 'salute',   text: 'apri la salute'        },
  { label: 'note',     text: 'apri le note'          },
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
  const { chatHistory, setFragment, setPrefillInput } = useNebulaStore();
  const { user } = useAuth();

  const [show,        setShow       ] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(false);

  useEffect(() => {
    const visited = localStorage.getItem(VISITED_KEY);
    setIsFirstTime(!visited);
    localStorage.setItem(VISITED_KEY, '1');
    const t = setTimeout(() => setShow(true), 500);
    return () => clearTimeout(t);
  }, []);

  if (chatHistory.length > 0) return null;

  const firstName = (user?.user_metadata?.name as string | undefined)
    ?.split(' ')[0] ?? '';

  const greetWord = isFirstTime ? 'Benvenuto' : timeGreeting();

  const sub = isFirstTime
    ? 'Sono Nebula, il tuo assistente personale.'
    : 'Come posso aiutarti?';

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="nw-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease }}
        >
          {/* Greeting */}
          <motion.p
            className="nw-greeting"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.65, ease }}
          >
            {greetWord}
            {firstName && (
              <>, <em className="nw-name">{firstName}</em></>
            )}.
          </motion.p>

          {/* Subtitle */}
          <motion.p
            className="nw-sub"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.55, ease }}
          >
            {sub}
          </motion.p>

          {/* Divider */}
          <motion.div
            className="nw-divider"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ delay: 0.42, duration: 0.5, ease }}
          />

          {/* Shortcuts */}
          <motion.div
            className="nw-shortcuts"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.52, duration: 0.45, ease }}
          >
            {SHORTCUTS.map((s, i) => (
              <motion.button
                key={s.label}
                className="nw-shortcut"
                onClick={() => setPrefillInput(s.text)}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.56 + i * 0.055, duration: 0.38, ease }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                {s.label}
              </motion.button>
            ))}
          </motion.div>

          {/* Guide CTA */}
          <motion.button
            className="nw-cta"
            onClick={() => setFragment('Help', {}, 'VISUAL')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.82, duration: 0.4, ease }}
          >
            scopri la guida
            <span className="nw-cta-arrow">›</span>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
