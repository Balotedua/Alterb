import { formatDate } from '@/utils/formatters';
import type { Note } from '@/types';

interface NoteListProps {
  notes?: Note[];
}

export function NoteList({ notes = [] }: NoteListProps) {
  if (notes.length === 0) {
    return <p className="empty-state">Nessuna nota ancora.</p>;
  }

  return (
    <ul className="note-list">
      {notes.map((note) => (
        <li key={note.id} className="note-item">
          <h3 className="note-item__title">{note.title}</h3>
          <p className="note-item__content">{note.content}</p>
          <div className="note-item__footer">
            {note.tags.length > 0 ? (
              <div className="note-item__tags">
                {note.tags.map((tag) => (
                  <span key={tag} className="note-item__tag">
                    #{tag}
                  </span>
                ))}
              </div>
            ) : null}
            <time className="note-item__date" dateTime={note.updated_at}>
              {formatDate(note.updated_at, 'long')}
            </time>
          </div>
        </li>
      ))}
    </ul>
  );
}
