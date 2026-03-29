import { useAlterStore } from '../../store/alterStore';

const TABS = [
  { id: 'chat' as const,    label: 'Chat' },
  { id: 'galaxy' as const,  label: 'Galaxy' },
  { id: 'nexus' as const,   label: 'Amici' },
];

export default function TabBar() {
  const { viewMode, setViewMode, showSettings, setShowSettings } = useAlterStore();

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      zIndex: 400,
      height: 44,
      display: 'flex',
      background: 'var(--tab-bg, rgba(5,5,8,0.96))',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: '1px solid var(--border, rgba(255,255,255,0.07))',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {TABS.map(tab => {
        const active = viewMode === tab.id && !showSettings;
        return (
          <button
            key={tab.id}
            onClick={() => { setShowSettings(false); setViewMode(tab.id); }}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {active && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: '20%', right: '20%',
                height: 1,
                background: 'var(--accent, #f0c040)',
              }} />
            )}
            <span className="alter-label" style={{
              fontSize: 11,
              letterSpacing: '0.10em',
              fontWeight: 500,
              color: active ? 'var(--text, #ffffff)' : 'var(--text-dim, rgba(255,255,255,0.28))',
              transition: 'color 0.2s',
              fontFamily: 'inherit',
            }}>
              {tab.label.toUpperCase()}
            </span>
          </button>
        );
      })}

    </nav>
  );
}
