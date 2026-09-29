export default function LegalPage({ t }) {
  return (
    <article className="legal">
      <header className="stack">
        <h1>{t.title}</h1>
        <p className="legal__updated">{t.updated}</p>
        <p className="lead">{t.intro}</p>
      </header>
      {t.sections.map((s) => (
        <section key={s.heading} className="legal__section">
          <h2>{s.heading}</h2>
          {s.body.map((p, i) => <p key={i}>{p}</p>)}
        </section>
      ))}
    </article>
  );
}
