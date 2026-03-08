import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileTopbar } from './MobileTopbar';

export function MainLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <MobileTopbar />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
