'use client';

import { useEffect } from 'react';

// The header survives client navigation, so the phone menu and the account
// submenu (native popovers) would stay open after a link or button inside
// them is used. Close them then; buttons that open a popover are left alone.
export default function MenuCloser({ id }) {
  useEffect(() => {
    const menu = document.getElementById(id);
    const close = (event) => {
      if (!event.target.closest('a, button') || event.target.closest('[popovertarget]')) return;
      for (const open of menu.querySelectorAll(':popover-open')) open.hidePopover();
      if (menu.matches(':popover-open')) menu.hidePopover();
    };
    menu.addEventListener('click', close);
    return () => menu.removeEventListener('click', close);
  }, [id]);

  return null;
}
