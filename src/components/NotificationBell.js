'use client';

import { useEffect, useRef, useState } from 'react';
import { markNotificationsRead } from '@/app/actions/notifications';
import { revealIn } from '@/lib/reveal';

// Header bell and its popover. The list is server-rendered (children); opening
// it clears the badge right away and marks everything read in the background.
export default function NotificationBell({ unread, label, children }) {
  const [count, setCount] = useState(unread);
  const menu = useRef(null);
  const pending = useRef(unread > 0);

  useEffect(() => {
    const el = menu.current;
    const onToggle = (event) => {
      if (event.newState !== 'open') return;
      revealIn(el.querySelectorAll(':scope > :not(ul), :scope > ul > li'), { y: -8, stagger: 0.035 });
      if (!pending.current) return;
      pending.current = false;
      setCount(0);
      markNotificationsRead();
    };
    // The header survives client navigation, so close after a link inside is used.
    const onClick = (event) => event.target.closest('a') && el.hidePopover();
    el.addEventListener('toggle', onToggle);
    el.addEventListener('click', onClick);
    return () => {
      el.removeEventListener('toggle', onToggle);
      el.removeEventListener('click', onClick);
    };
  }, []);

  return (
    <div className="bell">
      <button
        type="button"
        className="bell__toggle"
        popoverTarget="notif-menu"
        aria-label={count ? `${label} (${count})` : label}
        title={label}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" />
        </svg>
        {count > 0 && <span className="bell__count" aria-hidden="true">{count > 99 ? '99+' : count}</span>}
      </button>
      <div id="notif-menu" ref={menu} className="bell__menu" popover="auto" data-lenis-prevent>
        {children}
      </div>
    </div>
  );
}
