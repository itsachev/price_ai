// Layout for the auth pages: a single centred form panel. `wide` fits a form
// that pairs fields side by side (signup).
export default function AuthShell({ title, intro, eyebrow, footer, wide = false, children }) {
  return (
    <div className="auth" data-wide={wide || undefined}>
      <section className="auth__panel stack" aria-labelledby="auth-title">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 id="auth-title">{title}</h1>
        {intro && <p className="muted">{intro}</p>}
        {children}
        {footer && <p className="auth__footer">{footer}</p>}
      </section>
    </div>
  );
}
