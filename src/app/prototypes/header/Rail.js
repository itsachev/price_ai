'use client';

import { useLayoutEffect, useRef } from 'react';
import { Mark, Wordmark, LangSwitch, ThemeSwitch, Bell, Avatar, SECTIONS, USER } from './Shared';

// Rail: a flat, full-width app bar. Underline tabs whose indicator slides along
// the bar's bottom edge; language, theme and sign out live in the avatar menu.
// Phones: the tabs drop to a second row, so there's no hamburger at all.
export default function Rail({ section, onSection }) {
  const tabs = useRef([]);
  const bar = useRef(null);

  useLayoutEffect(() => {
    const move = () => {
      const el = tabs.current[SECTIONS.indexOf(section)];
      if (!el) return;
      bar.current.style.width = `${el.offsetWidth}px`;
      bar.current.style.transform = `translateX(${el.offsetLeft}px)`;
    };
    move();
    window.addEventListener('resize', move);
    return () => window.removeEventListener('resize', move);
  }, [section]);

  return (
    <header className="pr-rail">
      <div className="pr-rail__inner container">
        <a href="#" className="pr-rail__brand" onClick={(e) => { e.preventDefault(); onSection('Dashboard'); }}>
          <Mark /><Wordmark />
        </a>
        <nav className="pr-rail__tabs" aria-label="Main">
          {SECTIONS.map((s, i) => (
            <button
              key={s}
              ref={(el) => { tabs.current[i] = el; }}
              aria-current={s === section ? 'page' : undefined}
              onClick={() => onSection(s)}
            >
              {s}
            </button>
          ))}
          <span ref={bar} className="pr-rail__bar" aria-hidden="true" />
        </nav>
        <div className="pr-rail__tools">
          <Bell id="rail-bell" />
          <button className="pr-rail__me" popoverTarget="rail-me" aria-label="Account menu">
            <Avatar name={USER.name} />
            <svg className="pr-rail__chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          <div id="rail-me" popover="auto" className="proto-pop">
            <div className="proto-pop__who">
              <Avatar name={USER.name} />
              <span><strong>{USER.name}</strong><small>{USER.email}</small></span>
            </div>
            <div className="proto-pop__row"><span>Language</span><LangSwitch /></div>
            <div className="proto-pop__row"><span>Theme</span><ThemeSwitch /></div>
            <button className="proto-pop__item" popoverTarget="rail-me" popoverTargetAction="hide" onClick={() => onSection('Settings')}>Account settings</button>
            <button className="proto-pop__item proto-pop__item--danger">Sign out</button>
          </div>
        </div>
      </div>
    </header>
  );
}
