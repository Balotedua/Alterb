import { Component, type ReactNode } from 'react';
import { motion } from 'framer-motion';

interface Props    { children: ReactNode; }
interface State    { hasError: boolean;   }

const anim = {
  initial:    { opacity: 0, y: 12 },
  animate:    { opacity: 1, y: 0  },
  transition: { duration: 0.3 },
};

/**
 * Catches render errors inside any Nebula fragment.
 * Prevents a broken fragment from crashing the whole interface.
 */
export class FragmentErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[Nebula] Fragment render error:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <motion.div className="nebula-error-card" {...anim}>
        <p className="nebula-error-title">Errore nel caricamento</p>
        <p className="nebula-error-msg">
          Non riesco a mostrare questo fragment. Riprova.
        </p>
        <button
          className="nebula-error-retry"
          onClick={() => this.setState({ hasError: false })}
        >
          Riprova
        </button>
      </motion.div>
    );
  }
}
