'use client';

import { useActionState } from 'react';
import { authenticate } from '@/app/actions/auth';

// `t` is dict.auth, passed from the server page (dictionaries are server-only).
export default function LoginForm({ t, initialError }) {
  const [state, action, pending] = useActionState(authenticate, initialError ? { error: initialError } : null);
  const message = state?.error ? t.errors[state.error] ?? t.errors.unknown : state?.notice && t[state.notice];

  return (
    <form action={action} className="auth-form card stack">
      <label className="field">
        <span>{t.email}</span>
        <input type="email" name="email" autoComplete="email" required defaultValue={state?.email} />
      </label>
      <label className="field">
        <span>{t.password}</span>
        <input type="password" name="password" autoComplete="current-password" minLength={8} required />
      </label>
      {message && (
        <p className="auth-form__message" role={state.error ? 'alert' : 'status'} data-kind={state.error ? 'error' : 'notice'}>
          {message}
        </p>
      )}
      <div className="actions">
        <button className="button button--primary" name="intent" value="signin" disabled={pending}>
          {t.signIn}
        </button>
        <button className="button" name="intent" value="signup" disabled={pending}>
          {t.signUp}
        </button>
      </div>
    </form>
  );
}
