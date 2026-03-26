import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAlterStore } from '../../store/alterStore';
import { saveCalibration } from '../../vault/vaultService';
import type { UserCalibration } from '../../types';

const DIMENSIONS: Array<{
  key: keyof Omit<UserCalibration, 'updatedAt'>;
  label: string;
  low: string;
  high: string;
}> = [
  { key: 'empathy',    label: 'Empatia',    low: 'Freddo',    high: 'Caloroso'  },
  { key: 'directness', label: 'Direttezza', low: 'Elaborato', high: 'Diretto'   },
  { key: 'humor',      label: 'Umorismo',   low: 'Serio',     high: 'Giocoso'   },
  { key: 'logic',      label: 'Logica',     low: 'Intuitivo', high: 'Analitico' },
];

export default function CalibrationForm() {
  const { user, calibration, setCalibration, setShowCalibration, addMessage } = useAlterStore();

  const [values, setValues] = useState<Omit<UserCalibration, 'updatedAt'>>({
    empathy:    calibration?.empathy    ?? 5,
    directness: calibration?.directness ?? 5,
    humor:      calibration?.humor      ?? 5,
    logic:      calibration?.logic      ?? 5,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      await saveCalibration(user.id, values);
      setCalibration({ ...values, updatedAt: new Date().toISOString() });
      setShowCalibration(false);
      addMessage('nebula', '✦ Profilo comunicativo aggiornato — da ora parlerò come preferisci 🌌');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={{
        margin: '12px 16px',
        padding: '18px 20px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(167,139,250,0.12)',
        borderRadius: 14,
        backdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(167,139,250,0.9)', marginBottom: 14, letterSpacing: 0.3 }}>
        ✦ Come preferisci che ti parli?
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {DIMENSIONS.map(({ key, label, low, high }) => (
          <div key={key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{low}</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{label}</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{high}</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={values[key]}
              onChange={e => setValues(v => ({ ...v, [key]: parseInt(e.target.value) }))}
              style={{
                width: '100%',
                height: 3,
                accentColor: 'rgba(167,139,250,0.85)',
                cursor: 'pointer',
              }}
            />
            <div style={{ textAlign: 'center', fontSize: 10, color: 'rgba(167,139,250,0.6)', marginTop: 2 }}>
              {values[key]}/10
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
        <button
          onClick={() => setShowCalibration(false)}
          style={{
            padding: '7px 14px', fontSize: 12,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
          }}
        >
          Salta
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '7px 18px', fontSize: 12, fontWeight: 600,
            background: saving ? 'rgba(167,139,250,0.2)' : 'rgba(167,139,250,0.25)',
            border: '1px solid rgba(167,139,250,0.35)',
            borderRadius: 8, color: 'rgba(167,139,250,0.95)',
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {saving ? '...' : 'Salva profilo'}
        </button>
      </div>
    </motion.div>
  );
}
