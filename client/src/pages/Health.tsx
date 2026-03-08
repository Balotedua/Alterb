import { SleepForm } from '@/components/health/SleepForm';
import { ActivityList } from '@/components/health/ActivityList';

export default function Health() {
  return (
    <div className="page page--health">
      <h1>Salute</h1>
      <SleepForm />
      <ActivityList />
    </div>
  );
}
