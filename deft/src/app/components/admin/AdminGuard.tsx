import { type ReactNode } from 'react';
import { Navigate } from 'react-router';
import { Loader2 } from 'lucide-react';
import { useAdmin } from '../../contexts/AdminContext';

export default function AdminGuard({ children }: { children: ReactNode }) {
  const { authenticated, checking } = useAdmin();

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!authenticated) {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
}
