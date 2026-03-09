import { type ReactNode } from 'react';
import { motion } from 'framer-motion';

interface NebulaCardProps {
  children: ReactNode;
  icon?: string;
  title?: string;
  className?: string;
}

export const FRAGMENT_ANIM = {
  initial:    { opacity: 0, scale: 0.88, y: 24 },
  animate:    { opacity: 1, scale: 1,    y: 0   },
  exit:       { opacity: 0, scale: 0.88, y: 24  },
  transition: { duration: 0.45, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] },
};

export function NebulaCard({ children, icon, title, className }: NebulaCardProps) {
  return (
    <motion.div
      className={['fragment', className].filter(Boolean).join(' ')}
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
