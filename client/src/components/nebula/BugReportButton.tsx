import { AlertTriangle } from 'lucide-react';
import { useNebulaStore } from '@/store/nebulaStore';

export function BugReportButton() {
  const { setFragment, activeFragment } = useNebulaStore();

  // Hide while bug report itself is open
  if (activeFragment === 'BugReport') return null;

  return (
    <button
      className="nb-bug-btn"
      aria-label="Segnala un bug"
      title="Segnala bug"
      onClick={() => setFragment('BugReport', {}, 'ACTION')}
    >
      <AlertTriangle size={14} />
    </button>
  );
}
