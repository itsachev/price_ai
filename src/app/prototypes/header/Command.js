'use client';

import { useEffect, useRef, useState } from 'react';
import { Mark, Wordmark, LangSwitch, ThemeSwitch, Bell, Avatar, SECTIONS, USER } from './Shared';

const PRODUCTS = [
  ['Vereya fresh milk 3% 1L', '€1.39', 'at-risk'],
  ['Olympus yoghurt 2% 400g', '€1.09', 'opportunity'],
  ['Kostenurka sunflower oil 1L', '€2.79', 'at-risk'],
  ['Devin mineral water 1.5L', '€0.69', 'opportunity'],
  ['Dobrudzha white bread 650g', '€1.45', 'competitive'],
];
const ACTIONS = ['Add product', 'Import CSV', 'Apply 12 suggestions', 'Export prices'];

// Command: search-first. The bar holds the brand, the current section (a
// switcher) and a wide search field that opens a palette over pages, products
// and actions. "/" or Ctrl/⌘K opens it from anywhere.
export default function Command({ section, onSection }) {
  const dialog = useRef(null);
  const input = useRef(null);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);

  const match = (s) => s.toLowerCase().includes(q.trim().toLowerCase());
  const groups = [
    ['Pages', SECTIONS.filter(match).map((s) => ({ label: s, run: () => onSection(s) }))],
    ['Products', PRODUCTS.filter(([n]) => match(n)).map(([n, p, st]) => ({ label: n, meta: p, status: st, run: () => {} }))],
    ['Actions', ACTIONS.filter(match).map((a) => ({ label: a, run: () => {} }))],
  ].filter(([, items]) => items.length);
  const flat = groups.flatMap(([, items]) => items);

  const open = () => {
    setQ('');
    setActive(0);
    dialog.current.showModal();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (dialog.current?.open) return;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        open();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const onListKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && flat[active]) { flat[active].run(); dialog.current.close(); }
  };

  let n = -1;

  return (
    <header className="pr-cmd">
      <div className="pr-cmd__inner container">
        <a href="#" className="pr-cmd__brand" aria-label="PriceAI" onClick={(e) => { e.preventDefault(); onSection('Dashboard'); }}>
          <Mark /><Wordmark />
        </a>
        <span className="pr-cmd__slash" aria-hidden="true">/</span>
        <button className="pr-cmd__section" popoverTarget="cmd-sections">
          {section}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 15 5 5 5-5M7 9l5-5 5 5" /></svg>
        </button>
        <div id="cmd-sections" popover="auto" className="proto-pop proto-pop--narrow">
          {SECTIONS.map((s) => (
            <button
              key={s}
              className="proto-pop__item"
              aria-current={s === section ? 'page' : undefined}
              popoverTarget="cmd-sections"
              popoverTargetAction="hide"
              onClick={() => onSection(s)}
            >
              {s}
            </button>
          ))}
        </div>

        <button className="pr-cmd__search" onClick={open} aria-keyshortcuts="/ Control+K">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <span>Search products or jump to…</span>
          <kbd>/</kbd>
        </button>

        <Bell id="cmd-bell" />
        <button className="pr-cmd__me" popoverTarget="cmd-me" aria-label="Account menu">
          <Avatar name={USER.name} />
        </button>
        <div id="cmd-me" popover="auto" className="proto-pop">
          <div className="proto-pop__who">
            <Avatar name={USER.name} />
            <span><strong>{USER.name}</strong><small>{USER.email}</small></span>
          </div>
          <div className="proto-pop__row"><span>Language</span><LangSwitch /></div>
          <div className="proto-pop__row"><span>Theme</span><ThemeSwitch /></div>
          <button className="proto-pop__item proto-pop__item--danger">Sign out</button>
        </div>
      </div>

      <dialog ref={dialog} className="pr-palette" aria-label="Search" onClick={(e) => e.target === dialog.current && dialog.current.close()}>
        <div className="pr-palette__field">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            ref={input}
            autoFocus
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={onListKey}
            placeholder="Search products, pages and actions"
            aria-label="Search"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={flat.length ? `pal-${active}` : undefined}
          />
          <kbd>Esc</kbd>
        </div>
        <div id="palette-list" role="listbox" className="pr-palette__list">
          {groups.map(([title, items]) => (
            <div key={title} role="group" aria-label={title}>
              <p className="pr-palette__group">{title}</p>
              {items.map((it) => {
                n += 1;
                const i = n;
                return (
                  <div
                    key={it.label}
                    id={`pal-${i}`}
                    role="option"
                    aria-selected={i === active}
                    className="pr-palette__opt"
                    onMouseMove={() => setActive(i)}
                    onClick={() => { it.run(); dialog.current.close(); }}
                  >
                    {it.status && <span className={`proto-dot proto-dot--${it.status}`} aria-hidden="true" />}
                    <span>{it.label}</span>
                    {it.meta && <small>{it.meta}</small>}
                  </div>
                );
              })}
            </div>
          ))}
          {!flat.length && <p className="pr-palette__empty">Nothing matches “{q}”.</p>}
        </div>
      </dialog>
    </header>
  );
}
