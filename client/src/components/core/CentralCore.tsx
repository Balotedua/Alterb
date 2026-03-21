import { motion } from 'framer-motion';
import { useAlterStore } from '../../store/alterStore';

export default function CentralCore() {
  const { isProcessing } = useAlterStore();

  return (
    <div style={{
      position: 'fixed',
      top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 10,
      pointerEvents: 'none',
      width: 40, height: 40,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Ring */}
      <motion.div
        animate={{ scale: [0.97, 1.03, 0.97] }}
        transition={{
          duration: isProcessing ? 1.4 : 6,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          position: 'absolute',
          width: 32, height: 32,
          borderRadius: '50%',
          border: isProcessing
            ? '1px solid rgba(240,192,64,0.40)'
            : '1px solid rgba(255,255,255,0.10)',
        }}
      />
      {/* Dot */}
      <motion.div
        animate={{ opacity: isProcessing ? [0.85, 1, 0.85] : [0.45, 0.60, 0.45] }}
        transition={{
          duration: isProcessing ? 1.4 : 6,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          width: 4, height: 4,
          borderRadius: '50%',
          background: '#ffffff',
          boxShadow: isProcessing ? '0 0 8px 3px rgba(240,192,64,0.45)' : 'none',
        }}
      />
    </div>
  );
}
