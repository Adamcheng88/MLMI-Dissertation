import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Lock, Loader2 } from 'lucide-react';
import { useAdmin } from '../../contexts/AdminContext';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { login, authenticated, checking } = useAdmin();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!checking && authenticated) navigate('/admin', { replace: true });
  }, [checking, authenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(password);
      navigate('/admin', { replace: true });
    } catch {
      setError('Incorrect password.');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-sm p-8">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
          <Lock className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-xl font-medium mb-1">Admin Login</h1>
        <p className="text-sm text-muted-foreground mb-6">Enter the administrator password to continue.</p>

        {error && (
          <div className="mb-4 px-4 py-2.5 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg text-sm">
            {error}
          </div>
        )}

        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 mb-4"
        />
        <button
          type="submit"
          disabled={busy || !password}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          Log In
        </button>
      </form>
    </div>
  );
}
