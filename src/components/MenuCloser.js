'use client';

import { useEffect } from 'react';

// The header survives client navigation, so the phone menu (a native popover)
// would stay open after a link or button inside it is used. Close it then.
export default function MenuCloser({ id }) {
  useEffect(() => {
    const menu = document.getElementById(id);
    const close = (event) => {
      if (event.target.closest('a, button') && menu.matches(':popover-open')) menu.hidePopover();
    };
    menu.addEventListener('click', close);
    return () => menu.removeEventListener('click', close);
  }, [id]);

  return null;
}
