// Price-trend line chart: the merchant's price against the market average.
// Server-rendered markup only (no JS); lines are an SVG stretched over the
// plot, ticks and dots are HTML placed by percent (see components/chart.css).
// t: { title, subtitle, yours, market, current, delta, label }, with {yours}
// and {market} filled into label. Series and xLabels are the same length.
const TICKS = 5;
const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, k) => values[k]);

export default function PriceTrend({ t, product, yours, market, xLabels, money, pct, ...rest }) {
  const all = [...yours, ...market];
  // Pad the range so lines don't touch the edges; at least 4 cents so tick labels differ.
  const pad = Math.max((Math.max(...all) - Math.min(...all)) * 0.15, 0.02);
  const [lo, hi] = [Math.min(...all) - pad, Math.max(...all) + pad];
  const ticks = Array.from({ length: TICKS }, (_, i) => lo + ((hi - lo) * i) / (TICKS - 1));
  const yPct = (v) => ((hi - v) / (hi - lo)) * 100;
  const xPct = (i) => (yours.length > 1 ? (i / (yours.length - 1)) * 100 : 50);
  const points = (series) => series.map((v, i) => `${xPct(i)},${yPct(v)}`).join(' ');
  const series = { yours, market };
  const [nowYours, nowMarket] = [yours.at(-1), market.at(-1)];
  const delta = (nowYours - nowMarket) / nowMarket;

  return (
    <figure className="chart card" {...rest}>
      <figcaption className="chart__head">
        <span className="stack">
          <strong>{t.title}</strong>
          {product && <span>{product}</span>}
          <small>{t.subtitle}</small>
        </span>
        <span className="chart__legend">
          <span data-series="yours">{t.yours}</span>
          <span data-series="market">{t.market}</span>
        </span>
      </figcaption>
      <div className="chart__area" role="img" aria-label={fill(t.label, { yours: money(nowYours), market: money(nowMarket) })}>
        {ticks.map((v) => (
          <span key={v} className="chart__tick" style={{ '--y': `${yPct(v)}%` }}>{money(v)}</span>
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline data-series="market" points={points(market)} />
          <polyline data-series="yours" points={points(yours)} />
        </svg>
        {['market', 'yours'].map((s) =>
          series[s].map((v, i) => (
            <span key={s + i} className="chart__dot" data-series={s} style={{ '--x': `${xPct(i)}%`, '--y': `${yPct(v)}%` }} />
          ))
        )}
      </div>
      <ol className="chart__x" aria-hidden="true">
        {xLabels.map((m, i) => <li key={i}>{m}</li>)}
      </ol>
      <dl className="chart__foot">
        <div><dt>{t.current}</dt><dd>{money(nowYours)}</dd></div>
        <div data-series="market"><dt>{t.market}</dt><dd>{money(nowMarket)}</dd></div>
        <div data-status={delta > 0 ? 'at-risk' : 'competitive'}><dt>{t.delta}</dt><dd>{pct(delta)}</dd></div>
      </dl>
    </figure>
  );
}
