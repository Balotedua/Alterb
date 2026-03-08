import { useState } from 'react';

interface Goal {
  id: number;
  label: string;
  category: 'skill' | 'project' | 'network' | 'finance';
  status: 'todo' | 'wip' | 'done';
  deadline?: string;
}

interface Skill {
  id: number;
  label: string;
  level: 1 | 2 | 3 | 4 | 5;
  category: string;
}

const CAT_ICON: Record<Goal['category'], string> = {
  skill: '📚',
  project: '🚀',
  network: '🤝',
  finance: '💰',
};

const STATUS_LABEL: Record<Goal['status'], string> = {
  todo: 'Da fare',
  wip: 'In corso',
  done: 'Completato',
};

const INIT_GOALS: Goal[] = [
  { id: 1, label: 'Ottenere certificazione TypeScript avanzata', category: 'skill', status: 'wip', deadline: '2026-06-01' },
  { id: 2, label: 'Lanciare il progetto side-project', category: 'project', status: 'todo', deadline: '2026-09-01' },
  { id: 3, label: 'Espandere network LinkedIn a 500+', category: 'network', status: 'wip' },
  { id: 4, label: 'Negoziare aumento stipendio', category: 'finance', status: 'todo', deadline: '2026-12-01' },
];

const INIT_SKILLS: Skill[] = [
  { id: 1, label: 'TypeScript', level: 4, category: 'Dev' },
  { id: 2, label: 'React', level: 4, category: 'Dev' },
  { id: 3, label: 'Public Speaking', level: 2, category: 'Soft' },
  { id: 4, label: 'Leadership', level: 3, category: 'Soft' },
  { id: 5, label: 'SQL', level: 3, category: 'Data' },
];

export default function Career() {
  const [goals, setGoals] = useState<Goal[]>(INIT_GOALS);
  const [skills, setSkills] = useState<Skill[]>(INIT_SKILLS);
  const [tab, setTab] = useState<'goals' | 'skills'>('goals');
  const [newGoal, setNewGoal] = useState('');
  const [newGoalCat, setNewGoalCat] = useState<Goal['category']>('skill');
  const [newSkill, setNewSkill] = useState('');
  const [newSkillCat, setNewSkillCat] = useState('Dev');

  const cycleStatus = (id: number) => {
    const cycle: Goal['status'][] = ['todo', 'wip', 'done'];
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        const idx = cycle.indexOf(g.status);
        return { ...g, status: cycle[(idx + 1) % cycle.length] };
      })
    );
  };

  const removeGoal = (id: number) => setGoals((prev) => prev.filter((g) => g.id !== id));

  const addGoal = () => {
    if (!newGoal.trim()) return;
    setGoals((prev) => [...prev, { id: Date.now(), label: newGoal.trim(), category: newGoalCat, status: 'todo' }]);
    setNewGoal('');
  };

  const setSkillLevel = (id: number, level: Skill['level']) =>
    setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, level } : s)));

  const addSkill = () => {
    if (!newSkill.trim()) return;
    setSkills((prev) => [...prev, { id: Date.now(), label: newSkill.trim(), level: 1, category: newSkillCat }]);
    setNewSkill('');
  };

  return (
    <div className="page page--career">
      <h1>Carriera & Sviluppo</h1>

      <div className="career-tabs">
        <button
          className={`career-tab ${tab === 'goals' ? 'career-tab--active' : ''}`}
          onClick={() => setTab('goals')}
          type="button"
        >
          🎯 Obiettivi
        </button>
        <button
          className={`career-tab ${tab === 'skills' ? 'career-tab--active' : ''}`}
          onClick={() => setTab('skills')}
          type="button"
        >
          📚 Competenze
        </button>
      </div>

      {tab === 'goals' && (
        <>
          <div className="career-add">
            <input
              className="career-add__input"
              type="text"
              placeholder="Nuovo obiettivo..."
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addGoal()}
            />
            <select
              className="career-add__cat"
              value={newGoalCat}
              onChange={(e) => setNewGoalCat(e.target.value as Goal['category'])}
            >
              {(Object.keys(CAT_ICON) as Goal['category'][]).map((c) => (
                <option key={c} value={c}>{CAT_ICON[c]} {c}</option>
              ))}
            </select>
            <button className="career-add__btn" onClick={addGoal} type="button">+</button>
          </div>

          <div className="career-goals">
            {goals.map((g) => (
              <div key={g.id} className={`career-goal career-goal--${g.status}`}>
                <span className="career-goal__icon">{CAT_ICON[g.category]}</span>
                <div className="career-goal__body">
                  <span className="career-goal__label">{g.label}</span>
                  {g.deadline && (
                    <span className="career-goal__deadline">
                      📅 {new Date(g.deadline).toLocaleDateString('it-IT')}
                    </span>
                  )}
                </div>
                <button
                  className={`career-goal__status career-goal__status--${g.status}`}
                  onClick={() => cycleStatus(g.id)}
                  type="button"
                >
                  {STATUS_LABEL[g.status]}
                </button>
                <button
                  className="career-goal__del"
                  onClick={() => removeGoal(g.id)}
                  type="button"
                  aria-label="Rimuovi"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'skills' && (
        <>
          <div className="career-add">
            <input
              className="career-add__input"
              type="text"
              placeholder="Nuova competenza..."
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSkill()}
            />
            <input
              className="career-add__cat"
              type="text"
              placeholder="Categoria (es. Dev)"
              value={newSkillCat}
              onChange={(e) => setNewSkillCat(e.target.value)}
              style={{ maxWidth: '120px' }}
            />
            <button className="career-add__btn" onClick={addSkill} type="button">+</button>
          </div>

          <div className="career-skills">
            {skills.map((s) => (
              <div key={s.id} className="career-skill">
                <div className="career-skill__meta">
                  <span className="career-skill__label">{s.label}</span>
                  <span className="career-skill__cat">{s.category}</span>
                </div>
                <div className="career-skill__stars">
                  {([1, 2, 3, 4, 5] as Skill['level'][]).map((n) => (
                    <button
                      key={n}
                      className={`career-star ${n <= s.level ? 'career-star--on' : ''}`}
                      onClick={() => setSkillLevel(s.id, n)}
                      type="button"
                      aria-label={`Livello ${n}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
