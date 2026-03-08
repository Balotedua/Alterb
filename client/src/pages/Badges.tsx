import { LevelProgress } from '@/components/badges/LevelProgress';
import { BadgeGrid } from '@/components/badges/BadgeGrid';

export default function Badges() {
  return (
    <div className="page page--badges">
      <h1>Badge</h1>
      <LevelProgress />
      <BadgeGrid />
    </div>
  );
}
