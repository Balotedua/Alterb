import { useAuth } from '@/hooks/useAuth';

export default function Dashboard() {
  const { user } = useAuth();
  return (
    <div className="page page--dashboard">
      <h1>Dashboard</h1>
      {user ? <p className="page__welcome">Bentornato, {user.email}</p> : null}
    </div>
  );
}
