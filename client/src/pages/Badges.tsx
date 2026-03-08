import './Badges.css';
import { LevelHero } from '@/components/badges/LevelHero';
import { BadgeGrid  } from '@/components/badges/BadgeGrid';

export default function Badges() {
  return (
    <div className="page page--badges">
      <header className="badges-page__header">
        <h1 className="badges-page__title">Progressione</h1>
        <p className="badges-page__subtitle">
          Traccia i tuoi traguardi e sblocca nuovi badge completando le sfide quotidiane.
        </p>
      </header>

      <LevelHero />
      <BadgeGrid  />
    </div>
  );
}
