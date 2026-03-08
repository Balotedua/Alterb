import { toast } from 'sonner';
import type { BadgeDefinition } from '@/types/gamification';
import { RARITY_META } from '@/types/gamification';

interface Props {
  badge:   BadgeDefinition;
  toastId: string | number;
}

export function BadgeUnlockToast({ badge, toastId }: Props) {
  const meta  = RARITY_META[badge.rarity];
  const color = meta.color;

  return (
    <div
      onClick={() => toast.dismiss(toastId)}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          '14px',
        padding:      '14px 18px',
        background:   'var(--bg-surface, #1e1e1e)',
        border:       `1px solid ${color}`,
        borderRadius: '14px',
        boxShadow:    `0 8px 32px rgba(0,0,0,0.3), 0 0 20px ${meta.glow}`,
        cursor:       'pointer',
        minWidth:     '280px',
        animation:    'badgeToastIn 0.4s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {/* Rarity-colored icon wrapper */}
      <div
        style={{
          width:           '48px',
          height:          '48px',
          borderRadius:    '12px',
          background:      `${color}22`,
          border:          `1px solid ${color}66`,
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          fontSize:        '1.6rem',
          flexShrink:      0,
        }}
      >
        🏆
      </div>

      <div style={{ flex: 1 }}>
        <p
          style={{
            margin:        0,
            fontSize:      '0.7rem',
            fontWeight:    700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color,
          }}
        >
          Badge Sbloccato!
        </p>
        <p
          style={{
            margin:     '2px 0 0',
            fontSize:   '0.92rem',
            fontWeight: 600,
            color:      'var(--text, #e8e8e8)',
          }}
        >
          {badge.name}
        </p>
        <p style={{ margin: '1px 0 0', fontSize: '0.75rem', color: 'var(--text-muted, #888)' }}>
          +{badge.xp_reward} XP · {meta.label}
        </p>
      </div>
    </div>
  );
}
