import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Input } from '@/components/ui';

export function NoteEditor() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // TODO: useMutation per POST /notes
  };

  return (
    <form onSubmit={handleSubmit} className="note-editor">
      <h2 className="note-editor__title">Nuova nota</h2>
      <Input
        label="Titolo"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <div className="input-group">
        <label className="input-label" htmlFor="content">Contenuto</label>
        <textarea
          id="content"
          className="input note-editor__textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          placeholder="Scrivi i tuoi pensieri..."
        />
      </div>
      <Button type="submit">Salva nota</Button>
    </form>
  );
}
