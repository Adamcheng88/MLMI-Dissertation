import { Outlet, useNavigate, useLocation } from 'react-router';
import { Home, Settings, LogOut } from 'lucide-react';
import { useAdmin } from '../../contexts/AdminContext';
import AdminGuard from './AdminGuard';

function AdminToolbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAdmin();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  const isSettings = location.pathname.startsWith('/admin/settings');

  return (
    <div className="fixed bottom-6 left-6 z-[60] flex items-center gap-1 bg-card border border-border rounded-full shadow-lg px-2 py-1.5">
      <span className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Admin</span>
      <button
        onClick={() => navigate('/admin')}
        className="p-2 rounded-full hover:bg-accent transition-colors"
        title="Admin home"
      >
        <Home className="w-4 h-4" />
      </button>
      <button
        onClick={() => navigate('/admin/settings')}
        className={`p-2 rounded-full transition-colors ${isSettings ? 'bg-accent' : 'hover:bg-accent'}`}
        title="Experiment settings"
      >
        <Settings className="w-4 h-4" />
      </button>
      <button
        onClick={handleLogout}
        className="p-2 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
        title="Log out"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function AdminLayout() {
  return (
    <AdminGuard>
      <Outlet />
      <AdminToolbar />
    </AdminGuard>
  );
}
