// Layout for the auth pages: a single centred form panel.
export default function AuthShell({ title, intro, footer, children }) {
  return (
    <div className="auth">
      <section className="auth__panel stack" aria-labelledby="auth-title">
        <h1 id="auth-title">{title}</h1>
        {intro && <p className="muted">{intro}</p>}
        {children}
        {footer && <p className="auth__footer">{footer}</p>}
      </section>
    </div>
  );
}
