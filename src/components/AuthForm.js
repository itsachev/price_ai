'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import ButtonLabel from './ButtonLabel';
import { HONEYPOT } from '@/lib/formGuard';

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
// `fields` are <input> props plus a label (`half` pairs two side by side, `unit` shows a suffix like %,
// `options` [[value, label]…] makes it a <select>), `hidden` becomes hidden inputs and
// `children` render under the fields (e.g. the "forgot password" link).
// `guard` (guest forms) adds the bot traps isBot() checks: a field people never
// see, and the time the form came alive in the browser (set after hydration, so
// a bot that doesn't run scripts sends none).
export default function AuthForm({ action, t, fields, submit, hidden = {}, guard, initialError, children }) {
  const [state, formAction, pending] = useActionState(action, initialError ? { error: initialError } : null);
  const served = useRef(null);
  useEffect(() => {
    // A hidden input's value is its attribute, so React's form reset keeps it.
    if (served.current) served.current.value = Date.now();
  }, []);
  const message = state?.error ? t.errors[state.error] ?? t.errors.unknown : state?.notice && t.notices[state.notice];

  return (
    <form action={formAction} className="auth-form stack">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {guard && (
        <>
          <input ref={served} type="hidden" name="ts" />
          <label className="visually-hidden" aria-hidden="true">
            {/* Never shown, so not translated. */}
            Website
            <input name={HONEYPOT} tabIndex={-1} autoComplete="off" />
          </label>
        </>
      )}
      {fields.map(({ label, hint, half, unit, options, ...input }) => {
        const props = { required: true, ...input, defaultValue: state?.[input.name] ?? input.defaultValue };
        return (
          <label key={input.name} className={half ? 'field field--half' : 'field'}>
            <span>
              {label}
              {hint && <small>{hint}</small>}
            </span>
            {options ? (
              <span className="field__select">
                <select {...props}>
                  {options.map(([value, text]) => (
                    <option key={value} value={value}>{text}</option>
                  ))}
                </select>
              </span>
            ) : input.type === 'password' ? (
              <PasswordInput t={t} {...props} />
            ) : unit ? (
              <span className="field__unit" data-unit={unit}>
                <input {...props} />
              </span>
            ) : (
              <input {...props} />
            )}
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
        <ButtonLabel>{submit}</ButtonLabel>
      </button>
    </form>
  );
}
