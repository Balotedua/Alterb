import ProfileForm from '../components/settings/ProfileForm';
import ThemeSelector from '../components/settings/ThemeSelector';

export default function Settings() {
  return (
    <div className="page page--settings">
      <h1>Settings</h1>
      <ProfileForm />
      <ThemeSelector />
    </div>
  );
}
