type StatColor = 'green' | 'red' | 'blue' | 'purple' | 'neutral';

interface NebulaStatProps {
  label: string;
  value: string | number;
  color?: StatColor;
  sub?: string;
}

const COLOR_CLASS: Record<StatColor, string> = {
  green:   'fkv--green',
  red:     'fkv--red',
  blue:    'fkv--blue',
  purple:  'fkv--purple',
  neutral: '',
};

export function NebulaStat({ label, value, color = 'neutral', sub }: NebulaStatProps) {
  return (
    <div className="fragment-kpi">
      <span className="fragment-kpi-label">{label}</span>
      <span className={`fragment-kpi-value ${COLOR_CLASS[color]}`}>{value}</span>
      {sub && <span className="fragment-kpi-sub">{sub}</span>}
    </div>
  );
}
