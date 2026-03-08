import { MoodTracker } from '@/components/psychology/MoodTracker';
import { EntryList } from '@/components/psychology/EntryList';

export default function Psychology() {
  return (
    <div className="page page--psychology">
      <h1>Psicologia</h1>
      <MoodTracker />
      <EntryList />
    </div>
  );
}
