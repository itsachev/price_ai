'use client';

import ButtonLabel from '@/components/ButtonLabel';
import { Mark, Wordmark, LangSwitch, ThemeSwitch, Bell, Avatar, SECTIONS, USER } from './Shared';

// Masthead: two tiers, like the reports page's printed idiom. A thin utility
// strip (data date, language, theme, account) scrolls away; the sticky row
// below carries the brand, numbered sections and the day's main action.
// Phones: a full-screen sheet with large numbered links.
export default function Masthead({ section, onSection }) {
  const links = (cls, close) =>
    SECTIONS.map((s, i) => (
      <button
        key={s}
        className={cls}
        style={{ '--i': i }}
        aria-current={s === section ? 'page' : undefined}
        onClick={() => onSection(s)}
        {...(close && { popoverTarget: 'mast-sheet', popoverTargetAction: 'hide' })}
      >
        <span className="pr-mast__num">{String(i + 1).padStart(2, '0')}</span>
        <span>{s}</span>
      </button>
    ));

  return (
    <>
      <div className="pr-mast__strip">
        <div className="container pr-mast__strip-inner">
          <p className="pr-mast__live"><span aria-hidden="true" />Prices as of 30 Sep · 6 chains</p>
          <div className="pr-mast__util">
            <LangSwitch />
            <ThemeSwitch />
            <span className="pr-mast__who"><Avatar name={USER.name} />{USER.name}</span>
            <button className="pr-mast__out">Sign out</button>
          </div>
        </div>
      </div>
      <header className="pr-mast">
        <div className="container pr-mast__inner">
          <a href="#" className="pr-mast__brand" onClick={(e) => { e.preventDefault(); onSection('Dashboard'); }}>
            <Mark /><Wordmark />
          </a>
          <nav className="pr-mast__nav" aria-label="Main">{links('pr-mast__link')}</nav>
          <div className="pr-mast__end">
            <Bell id="mast-bell" />
            <button className="button button--primary pr-mast__cta"><ButtonLabel>Add product</ButtonLabel></button>
            <button className="pr-mast__menu" popoverTarget="mast-sheet">Menu</button>
          </div>
        </div>
      </header>
      <div id="mast-sheet" popover="auto" className="pr-mast__sheet">
        <div className="pr-mast__sheet-top">
          <span className="pr-mast__brand"><Mark /><Wordmark /></span>
          <button className="pr-mast__menu" popoverTarget="mast-sheet" popoverTargetAction="hide">Close</button>
        </div>
        <nav className="pr-mast__sheet-nav" aria-label="Main">{links('pr-mast__big', true)}</nav>
        <div className="pr-mast__sheet-foot">
          <span className="pr-mast__who"><Avatar name={USER.name} />{USER.name}</span>
          <div className="pr-mast__util"><LangSwitch /><ThemeSwitch /></div>
          <button className="button button--quiet"><ButtonLabel>Sign out</ButtonLabel></button>
        </div>
      </div>
    </>
  );
}
