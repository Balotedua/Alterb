import ActivityList from '../components/health/ActivityList';
import SleepForm from '../components/health/SleepForm';

export default function Health() {
  return (
    <div className="page page--health">
      <h1>Health</h1>
      <SleepForm />
      <ActivityList />
    </div>
  );
}
