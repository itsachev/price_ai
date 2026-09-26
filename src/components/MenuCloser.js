'use client';

import { useEffect } from 'react';
import { revealIn } from '@/lib/reveal';

// The header survives client navigation, so the phone menu and the account
// submenu (native popovers) would stay open after a link or button inside
// them is used. Close them then; buttons that open a popover are left alone.
// It also staggers each popover's items in as it opens.
export default function MenuCloser({ id }) {
  useEffect(() => {
    const menu = document.getElementById(id);
    const close = (event) => {
      if (!event.target.closest('a, button') || event.target.closest('[popovertarget]')) return;
      for (const open of menu.querySelectorAll(':popover-open')) open.hidePopover();
      if (menu.matches(':popover-open')) menu.hidePopover();
    };
    // `toggle` doesn't bubble, so listen in the capture phase to catch the submenu too.
    const reveal = (event) => {
      if (event.newState !== 'open') return;
      revealIn(event.target.querySelectorAll(':scope > :not(ul), :scope > ul > li'), { y: -8, stagger: 0.035 });
    };
    menu.addEventListener('click', close);
    menu.addEventListener('toggle', reveal, true);
    return () => {
      menu.removeEventListener('click', close);
      menu.removeEventListener('toggle', reveal, true);
    };
  }, [id]);

  return null;
}
