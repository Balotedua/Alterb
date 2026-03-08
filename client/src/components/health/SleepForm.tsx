import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Input } from '@/components/ui';

export function SleepForm() {
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('0');
  const [quality, setQuality] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // TODO: useMutation per POST /sleep
  };

  return (
    <form onSubmit={handleSubmit} className="sleep-form">
      <h2 className="sleep-form__title">Registra il sonno</h2>
      <div className="sleep-form__duration">
        <Input
          label="Ore"
          type="number"
          min="0"
          max="24"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          required
        />
        <Input
          label="Minuti"
          type="number"
          min="0"
          max="59"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
        />
      </div>
      <div className="input-group">
        <label className="input-label">Qualità</label>
        <div className="quality-picker">
          {([1, 2, 3, 4, 5] as const).map((q) => (
            <button
              key={q}
              type="button"
              className={['quality-btn', quality === q ? 'quality-btn--active' : ''].filter(Boolean).join(' ')}
              onClick={() => setQuality(q)}
              aria-pressed={quality === q}
            >
              {q}
            </button>
          ))}
        </div>
      </div>
      <Input
        label="Data"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
      />
      <Button type="submit">Salva</Button>
    </form>
  );
}
