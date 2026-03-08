import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button, Input } from '@/components/ui';

export function ProfileForm() {
  const { user } = useAuth();
  const [name, setName] = useState((user?.user_metadata?.['name'] as string) ?? '');
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // TODO: aggiorna profilo via Supabase
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <form onSubmit={handleSubmit} className="profile-form">
      <h2 className="profile-form__title">Profilo</h2>
      <Input label="Email" type="email" value={user?.email ?? ''} disabled />
      <Input
        label="Nome"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Button type="submit">{saved ? '✓ Salvato' : 'Salva'}</Button>
    </form>
  );
}
