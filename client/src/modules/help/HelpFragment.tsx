import { useState } from 'react';
import { NebulaCard } from '@/components/ui/nebula/NebulaCard';

const SECTIONS = [
  {
    id: 'finance',
    label: '💰 Finanze',
    commands: [
      { cmd: 'mostrami le spese', desc: 'Lista delle ultime uscite' },
      { cmd: 'aggiungi spesa 30€ supermercato', desc: 'Registra una nuova spesa' },
      { cmd: 'ho guadagnato 1200€', desc: 'Registra una nuova entrata' },
      { cmd: 'riepilogo finanze', desc: 'Panoramica KPI del mese corrente' },
      { cmd: 'grafico spese ultimi 14 giorni', desc: 'Sparkline entrate/uscite' },
      { cmd: 'analisi finanziaria', desc: 'Grafici: 7gg, giorno settimana, 6 mesi' },
      { cmd: 'spese per categoria', desc: 'Raggruppa e ricategorizza le transazioni' },
      { cmd: 'importa CSV', desc: 'Carica transazioni da file CSV' },
      { cmd: 'elimina tutte le spese', desc: 'Elimina in blocco con conferma' },
      { cmd: 'elimina le ultime 10 transazioni', desc: 'Elimina le N più recenti' },
      { cmd: 'elimina transazioni di marzo', desc: 'Filtra per mese/anno ed elimina' },
    ],
  },
  {
    id: 'health',
    label: '🏃 Salute',
    commands: [
      { cmd: 'come sto dormendo?', desc: 'Storico sonno con grafico' },
      { cmd: 'riepilogo salute', desc: 'Sonno + peso + idratazione' },
      { cmd: 'quanta acqua ho bevuto?', desc: 'Progress idratazione di oggi' },
    ],
  },
  {
    id: 'psych',
    label: '🧠 Psicologia',
    commands: [
      { cmd: 'come sto?', desc: 'Umore attuale + media recente' },
      { cmd: 'sono stressato', desc: 'Vista empatica + storico umore' },
      { cmd: 'storico umore ultimi 7 giorni', desc: 'Grafico andamento umore' },
    ],
  },
  {
    id: 'settings',
    label: '⚙️ Impostazioni',
    commands: [
      { cmd: 'apri impostazioni', desc: 'Profilo, tema, sicurezza, dati' },
      { cmd: 'logout', desc: 'Disconnetti l\'account' },
    ],
  },
  {
    id: 'help',
    label: '❓ Aiuto',
    commands: [
      { cmd: 'guida', desc: 'Mostra questa schermata' },
      { cmd: 'come si fa?', desc: 'Mostra questa schermata' },
      { cmd: 'cosa puoi fare?', desc: 'Mostra questa schermata' },
    ],
  },
];

export function HelpFragment(_: { params?: Record<string, unknown> }) {
  const [active, setActive] = useState('finance');
  const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

  return (
    <NebulaCard title="Guida ai comandi" variant="default" closable>
      <div className="help-tabs">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            className={['help-tab', active === s.id ? 'help-tab--active' : ''].filter(Boolean).join(' ')}
            onClick={() => setActive(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <ul className="help-list">
        {section.commands.map((c) => (
          <li key={c.cmd} className="help-item">
            <span className="help-cmd">"{c.cmd}"</span>
            <span className="help-desc">{c.desc}</span>
          </li>
        ))}
      </ul>

      <p className="help-footer">
        Puoi scrivere in modo naturale — Nebula capisce le varianti.
      </p>
    </NebulaCard>
  );
}
