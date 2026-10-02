'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Rail from './Rail';
import Command from './Command';
import Masthead from './Masthead';

const VARIANTS = [
  { name: 'Rail', Component: Rail },
  { name: 'Command', Component: Command },
  { name: 'Masthead', Component: Masthead },
];

// The page behind the header: enough dashboard to judge the header in context
// and enough height to scroll.
function Page({ section }) {
  const rows = [
    ['Vereya fresh milk 3% 1L', '€1.39', '€1.29', 'at-risk'],
    ['Olympus yoghurt 2% 400g', '€1.09', '€1.19', 'opportunity'],
    ['Dobrudzha white bread 650g', '€1.45', '€1.45', 'competitive'],
    ['Kostenurka sunflower oil 1L', '€2.79', '€2.59', 'at-risk'],
    ['Devin mineral water 1.5L', '€0.69', '€0.75', 'opportunity'],
    ['Leki salami 200g', '€3.19', '€3.15', 'competitive'],
    ['Nescafé Classic 200g', '€8.49', '€7.99', 'at-risk'],
    ['Melinda butter 82% 125g', '€2.29', '€2.35', 'competitive'],
  ];
  return (
    <div className="proto-page container">
      <p className="eyebrow">Competitor prices as of 30 Sep 2026</p>
      <h1>{section === 'Dashboard' ? 'Your prices today' : section}</h1>
      <dl className="stat-grid proto-page__stats">
        <div><dt>At risk</dt><dd>12</dd></div>
        <div><dt>Opportunity</dt><dd>27</dd></div>
        <div><dt>Competitive</dt><dd>184</dd></div>
        <div><dt>Unmatched</dt><dd>9</dd></div>
      </dl>
      <div className="card proto-page__list">
        {[...rows, ...rows].map(([name, yours, cheapest, status], i) => (
          <div key={i} className="proto-page__row">
            <span>{name}</span>
            <span className="proto-page__nums">{yours} · cheapest {cheapest}</span>
            <span className={`proto-dot proto-dot--${status}`}>{status.replace('-', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Harness({ initial }) {
  const [current, setCurrent] = useState(initial);
  const [section, setSection] = useState('Dashboard');
  const [ready, setReady] = useState(false);
  const itemsRef = useRef([]);
  const highlightRef = useRef(null);

  // Mark ready after first paint so the highlight doesn't slide on load.
  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
  }, []);

  useLayoutEffect(() => {
    const move = () => {
      const el = itemsRef.current[current];
      if (!el || !highlightRef.current) return;
      highlightRef.current.style.width = `${el.offsetWidth}px`;
      highlightRef.current.style.transform = `translateX(${el.offsetLeft}px)`;
    };
    move();
    window.addEventListener('resize', move);
    return () => window.removeEventListener('resize', move);
  }, [current]);

  const select = (i) => {
    if (i < 0 || i >= VARIANTS.length) return;
    setCurrent(i);
    const url = new URL(location);
    url.searchParams.set('v', i + 1);
    history.replaceState(null, '', url);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= VARIANTS.length) select(num - 1);
      else if (e.key === 'ArrowRight') select((current + 1) % VARIANTS.length);
      else if (e.key === 'ArrowLeft') select((current - 1 + VARIANTS.length) % VARIANTS.length);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const { Component } = VARIANTS[current];

  return (
    <div className="proto">
      <Component key={current} section={section} onSection={setSection} />
      <Page section={section} />
      <nav className="proto-picker" aria-label="Prototype variants" data-ready={ready ? '' : undefined}>
        <span ref={highlightRef} className="proto-picker-highlight" aria-hidden="true" />
        {VARIANTS.map((v, i) => (
          <button
            key={v.name}
            ref={(el) => { itemsRef.current[i] = el; }}
            className="proto-picker-item"
            data-active={i === current ? '' : undefined}
            aria-current={i === current ? 'true' : undefined}
            onClick={() => select(i)}
          >
            {v.name}
          </button>
        ))}
      </nav>
    </div>
  );
}
