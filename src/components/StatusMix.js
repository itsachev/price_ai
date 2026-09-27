// Status mix over time: one stacked column a week, the share of products in
// each price status. Server-rendered HTML only; heights are percentages
// (see components/chart.css). t: { title, subtitle, label, since }: label gets
// each status's current share ({risk}, {opportunity}, {competitive}, {unmatched}), since gets {change} (percentage points) and
// {start} (the first week's date). weeks: [{ at-risk, opportunity,
// competitive, unmatched }] counts, oldest first, same length as xLabels.
const STATUSES = ['at-risk', 'opportunity', 'competitive', 'unmatched'];
const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, k) => values[k]);

export default function StatusMix({ t, names, weeks, xLabels, start, pct, share }) {
  const shares = weeks.map((w) => {
    const total = STATUSES.reduce((sum, s) => sum + w[s], 0) || 1;
    return Object.fromEntries(STATUSES.map((s) => [s, w[s] / total]));
  });
  const now = shares.at(-1);
  // Change against the oldest week shown.
  const then = shares[0];

  return (
    <figure className="chart card mix">
      <figcaption className="chart__head">
        <span className="stack">
          <strong>{t.title}</strong>
          <small>{t.subtitle}</small>
        </span>
        <span className="chart__legend">
          {STATUSES.map((s) => <span key={s} data-status={s}>{names[s]}</span>)}
        </span>
      </figcaption>
      <div
        className="mix__area"
        role="img"
        aria-label={fill(t.label, Object.fromEntries(STATUSES.map((s) => [s.replace('at-', ''), share(now[s])])))}
      >
        {shares.map((w, i) => (
          <span key={i} className="mix__col">
            {STATUSES.map((s) => w[s] > 0 && <span key={s} data-status={s} style={{ '--h': `${w[s] * 100}%` }} />)}
          </span>
        ))}
      </div>
      <ol className="chart__x mix__x" aria-hidden="true">
        {xLabels.map((m, i) => <li key={i}>{m}</li>)}
      </ol>
      <dl className="chart__foot">
        {STATUSES.map((s) => (
          <div key={s} data-status={s}>
            <dt>{names[s]}</dt>
            <dd>{share(now[s])}</dd>
            {weeks.length > 1 && <dd className="mix__since">{fill(t.since, { change: pct(now[s] - then[s]), start })}</dd>}
          </div>
        ))}
      </dl>
    </figure>
  );
}
