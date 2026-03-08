import NoteEditor from '../components/consciousness/NoteEditor';
import NoteList from '../components/consciousness/NoteList';

export default function Consciousness() {
  return (
    <div className="page page--consciousness">
      <h1>Consciousness</h1>
      <NoteEditor />
      <NoteList />
    </div>
  );
}
