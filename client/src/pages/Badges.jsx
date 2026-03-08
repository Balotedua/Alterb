import BadgeGrid from '../components/badges/BadgeGrid';
import LevelProgress from '../components/badges/LevelProgress';

export default function Badges() {
  return (
    <div className="page page--badges">
      <h1>Badges</h1>
      <LevelProgress />
      <BadgeGrid />
    </div>
  );
}
