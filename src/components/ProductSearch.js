'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useTransition } from 'react';

const DEBOUNCE_MS = 300;

// Filters the product list as the merchant types: after a short pause it
// replaces ?q= (dropping ?page=) in a transition, so the current list stays on
// screen until the new one is ready. Enter searches at once; without JS the
// form still submits as a plain GET.
export default function ProductSearch({ action, defaultValue, placeholder, label, children }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const timer = useRef();
  const input = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  // Follow ?q= when it changes from elsewhere (Clear search, back/forward),
  // but never overwrite what the merchant is typing.
  useEffect(() => {
    if (document.activeElement !== input.current) input.current.value = defaultValue;
  }, [defaultValue]);

  // The form's other fields (a hidden status filter) ride along; empty ones and
  // the page number drop out, so a new search starts on page 1.
  function go(form) {
    clearTimeout(timer.current);
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(form)) if (v.trim()) params.set(k, v.trim());
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${action}?${query}` : action, { scroll: false });
    });
  }

  return (
    <form
      role="search"
      className="catalog__search"
      action={action}
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        go(e.currentTarget);
      }}
    >
      <input
        type="search"
        ref={input}
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        enterKeyHint="search"
        onChange={(e) => {
          const { form } = e.target;
          clearTimeout(timer.current);
          timer.current = setTimeout(() => go(form), DEBOUNCE_MS);
        }}
      />
      {children}
    </form>
  );
}
