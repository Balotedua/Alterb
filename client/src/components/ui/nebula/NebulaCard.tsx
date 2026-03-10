import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useNebulaStore } from '@/store/nebulaStore';

export type FragmentVariant = 'finance' | 'health' | 'psychology' | 'default';

interface NebulaCardProps {
  children: ReactNode;
  icon?: ReactNode;
  title?: string;
  className?: string;
  variant?: FragmentVariant;
  closable?: boolean;
}

export const FRAGMENT_ANIM = {
  initial: { opacity: 0, y: 22, scale: 0.93, filter: 'blur(10px)' },
  animate: {
    opacity: 1, y: 0, scale: 1, filter: 'blur(0px)',
    transition: {
      duration: 0.52,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
  exit: {
    opacity: 0, y: -10, scale: 0.97, filter: 'blur(6px)',
    transition: {
      duration: 0.32,
      ease: [0.4, 0, 1, 1] as [number, number, number, number],
    },
  },
};

export function NebulaCard({ 
  children, 
  icon, 
  title, 
  className, 
  variant = 'default',
  closable = true 
}: NebulaCardProps) {
  const clearFragment = useNebulaStore((state) => state.clearFragment);
  const variantClass = variant !== 'default' ? `fragment--${variant}` : '';

  const handleClose = () => {
    clearFragment();
  };

  return (
    <motion.div
      className={['nebula-card', variantClass, className].filter(Boolean).join(' ')}
      {...FRAGMENT_ANIM}
    >
      {(icon || title || closable) && (
        <div className="nebula-card-header">
          <div className="nebula-card-header-left">
            {icon && <span className="nebula-card-icon">{icon}</span>}
            {title && <h3 className="nebula-card-title">{title}</h3>}
          </div>
          {closable && (
            <button 
              className="nebula-card-close" 
              onClick={handleClose}
              aria-label="Chiudi"
            >
              <X size={18} />
            </button>
          )}
        </div>
      )}
      <div className="nebula-card-content">
        {children}
      </div>
    </motion.div>
  );
}
