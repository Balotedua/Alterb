import { type ReactNode } from 'react';
import { motion } from 'framer-motion';

export type FragmentVariant = 'finance' | 'health' | 'psychology' | 'default';

interface NebulaCardProps {
  children: ReactNode;
  icon?: string;
  title?: string;
  className?: string;
  variant?: FragmentVariant;
}

export const FRAGMENT_ANIM = {
  initial:    { opacity: 0, x: 36 },
  animate:    { opacity: 1, x: 0  },
  exit:       { opacity: 0, x: 36 },
  transition: {
    duration: 0.3,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
};

export function NebulaCard({ children, icon, title, className, variant = 'default' }: NebulaCardProps) {
  const variantClass = variant !== 'default' ? `fragment--${variant}` : '';

  return (
    <motion.div
      className={['fragment', variantClass, className].filter(Boolean).join(' ')}
      {...FRAGMENT_ANIM}
    >
      {(icon || title) && (
        <div className="fragment-header">
          {icon && <span className="fragment-icon">{icon}</span>}
          {title && <span className="fragment-title">{title}</span>}
        </div>
      )}
      {children}
    </motion.div>
  );
}
