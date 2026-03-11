import { Link2 } from 'lucide-react';
import { FinanceCategoryLinker } from '@/components/finance/FinanceCategoryLinker';
import { NebulaCard } from '@/components/ui/nebula';

export function FinanceLinkFragment(_: { params: Record<string, unknown> }) {
  return (
    <NebulaCard icon={<Link2 size={15} />} title="Associa categorie" variant="finance" closable>
      <FinanceCategoryLinker />
    </NebulaCard>
  );
}
