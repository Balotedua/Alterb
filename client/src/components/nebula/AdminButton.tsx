import { ShieldCheck } from 'lucide-react';
import { useNebulaStore } from '@/store/nebulaStore';

export function AdminButton() {
  const { setFragment, activeFragment } = useNebulaStore();

  if (activeFragment === 'Admin') return null;

  return (
    <button
      className="nb-admin-btn"
      aria-label="Area admin"
      title="Admin"
      onClick={() => setFragment('Admin', {}, 'ACTION')}
    >
      <ShieldCheck size={14} />
    </button>
  );
}
