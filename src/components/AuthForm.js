'use client';

import { useActionState, useState } from 'react';

// Password input with a show/hide toggle. The value survives the type switch
// because the input stays uncontrolled.
function PasswordInput({ t, ...input }) {
  const [shown, setShown] = useState(false);
  const label = shown ? t.hidePassword : t.showPassword;

  return (
    <span className="field__password">
      <input {...input} type={shown ? 'text' : 'password'} />
      <button type="button" className="field__reveal" aria-pressed={shown} aria-label={label} title={label} onClick={() => setShown(!shown)}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {shown && <path d="M3 3l18 18" />}
        </svg>
      </button>
    </span>
  );
}

// One form for every auth page. `t` is dict.auth (dictionaries are server-only),
// `fields` are <input> props plus a label, `hidden` becomes hidden inputs and
// `children` render under the fields (e.g. the "forgot password" link).
export default function AuthForm({ action, t, fields, submit, hidden = {}, initialError, children }) {
  const [state, formAction, pending] = useActionState(action, initialError ? { error: initialError } : null);
  const message = state?.error ? t.errors[state.error] ?? t.errors.unknown : state?.notice && t.notices[state.notice];

  return (
    <form action={formAction} className="auth-form stack">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {fields.map(({ label, hint, ...input }) => {
        const props = { required: true, ...input, defaultValue: state?.[input.name] ?? input.defaultValue };
        return (
          <label key={input.name} className="field">
            <span>
              {label}
              {hint && <small>{hint}</small>}
            </span>
            {input.type === 'password' ? <PasswordInput t={t} {...props} /> : <input {...props} />}
          </label>
        );
      })}
      {children}
      {message && (
        <p className="auth-form__message" role={state.error ? 'alert' : 'status'} data-kind={state.error ? 'error' : 'notice'}>
          {message}
        </p>
      )}
      <button className="button button--primary" disabled={pending} aria-busy={pending}>
        {submit}
      </button>
    </form>
  );
}
