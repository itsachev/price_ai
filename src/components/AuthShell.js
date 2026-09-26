import { COMPETITORS } from '@/lib/config';

// Layout for the auth pages: the form panel, plus a short reminder of what the
// account gets you (the chains come from config, so the list stays true).
export default function AuthShell({ t, title, intro, footer, children }) {
  const chains = Object.values(COMPETITORS);

  return (
    <div className="auth">
      <section className="auth__panel stack" aria-labelledby="auth-title">
        <h1 id="auth-title">{title}</h1>
        {intro && <p className="muted">{intro}</p>}
        {children}
        {footer && <p className="auth__footer">{footer}</p>}
      </section>
      <aside className="auth__aside stack" aria-labelledby="auth-aside-title">
        <h2 id="auth-aside-title">{t.aside.title}</h2>
        <ul className="auth__points">
          {t.aside.points.map((point) => (
            <li key={point}>{point.replace('{count}', chains.length)}</li>
          ))}
        </ul>
        <ul className="auth__chains" aria-label={t.aside.chains}>
          {chains.map((name) => <li key={name}>{name}</li>)}
        </ul>
      </aside>
    </div>
  );
}
