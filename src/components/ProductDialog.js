'use client';

import { useId, useRef } from 'react';

// Native modal <dialog> behind its own trigger button: focus trap, Esc and the
// backdrop come from the browser, and it opens instantly with no server trip.
// It stays open after an add, so several products can be added in a row; give
// it a `key` that changes on save (e.g. updated_at) to close it after an edit.
export default function ProductDialog({ label, title, closeLabel, variant, children }) {
  const ref = useRef(null);
  const titleId = useId();

  return (
    <>
      <button type="button" className={variant ? `button button--${variant}` : 'button'} onClick={() => ref.current.showModal()}>
        {label}
      </button>
      <dialog ref={ref} className="modal" aria-labelledby={titleId} closedby="any" data-lenis-prevent>
        <div className="modal__head">
          <h2 id={titleId}>{title}</h2>
          <form method="dialog">
            <button className="modal__close" aria-label={closeLabel} title={closeLabel}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </form>
        </div>
        <div className="modal__body">{children}</div>
      </dialog>
    </>
  );
}
