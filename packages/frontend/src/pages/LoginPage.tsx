import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sendPasswordResetEmailToUser } from '@/lib/firebase';

export default function LoginPage() {
  const { login, isAuthenticated, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resetState, setResetState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [resetError, setResetError] = useState<string | null>(null);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    setSubmitting(true);

    try {
      await login(email, password);
    } catch {
      // Error is already set in the store
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    setResetError(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setResetError('Enter your email address above first.');
      return;
    }
    setResetState('sending');
    try {
      await sendPasswordResetEmailToUser(email);
    } catch (err) {
      // An unknown email gets the same message, so this can't be used to discover accounts.
      const code = (err as { code?: string })?.code;
      if (code && !['auth/user-not-found', 'auth/invalid-email'].includes(code)) {
        setResetState('idle');
        setResetError('The reset email could not be sent right now. Ask your administrator for a reset link.');
        return;
      }
    }
    setResetState('sent');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/60">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
          <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center gap-8">
        <div className="space-y-3">
          <p className="text-2xl font-extrabold tracking-tight text-primary">farmflow</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Welcome back</h1>
          <p className="text-base text-muted-foreground">Sign in to run your farms, feed mill and money in one place.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl bg-panel p-6">
          {error && (
            <div role="alert" className="rounded-2xl bg-danger-soft p-3 text-sm font-medium text-danger">
              {error}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetState === 'sending'}
                className="text-sm font-semibold text-primary hover:underline disabled:opacity-60"
              >
                {resetState === 'sending' ? 'Sending…' : 'Forgot password?'}
              </button>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>

          {resetState === 'sent' ? (
            <p role="status" className="rounded-2xl bg-info-soft p-3 text-sm font-medium text-info">
              If {email} has a FarmFlow account, a link to reset the password is on its way. Check spam too.
            </p>
          ) : null}
          {resetError ? <p role="alert" className="rounded-2xl bg-warning-soft p-3 text-sm font-medium text-warning">{resetError}</p> : null}

          <Button type="submit" size="lg" disabled={submitting} className="w-full">
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
