import { useMonthlyStats } from '@/hooks/useFinance';
import { NebulaCard, NebulaGraph, NebulaStat } from '@/components/ui/nebula';
import { formatCurrency } from '@/utils/formatters';

interface Props {
  params: Record<string, unknown>;
}

export function FinanceChartFragment({ params }: Props) {
  const days = typeof params.days === 'number' ? Math.min(params.days, 30) : 14;
  const metric = (params.metric as string) || 'expenses';
  const { monthlyData, income, expenses } = useMonthlyStats();

  const slice = (monthlyData ?? []).slice(-days);
  const chartData = slice.map((d) =>
    metric === 'income' ? d.income : metric === 'both' ? d.income - d.expenses : d.expenses,
  );

  const color = metric === 'income' ? '#6ee7b7' : metric === 'both' ? '#a78bfa' : '#fca5a5';
  const label = metric === 'income' ? 'Entrate' : metric === 'both' ? 'Flusso netto' : 'Uscite';

  return (
    <NebulaCard icon="📈" title={`${label} · ultimi ${days}gg`}>
      <div className="fragment-kpis">
        <NebulaStat label="Entrate mese" value={formatCurrency(income)}   color="green" />
        <NebulaStat label="Uscite mese"  value={formatCurrency(expenses)} color="red"   />
      </div>
      <NebulaGraph data={chartData} color={color} height={52} label={label} />
    </NebulaCard>
  );
}
