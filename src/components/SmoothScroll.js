'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { ReactLenis, useLenis } from 'lenis/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import 'lenis/dist/lenis.css';

gsap.registerPlugin(ScrollTrigger);

// Lenis driven by GSAP's ticker so ScrollTrigger and smooth scroll share one clock.
// Respect reduced motion: native wheel scrolling, no easing. Lenis is only built
// on the client, so the server value never matters.
const smoothWheel = typeof window !== 'undefined' && !matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function SmoothScroll({ children }) {
  // ReactLenis creates its instance in an effect, so wait for it here (root store)
  // instead of reading a ref once — otherwise raf never runs and scrolling freezes.
  const lenis = useLenis(ScrollTrigger.update);

  useEffect(() => {
    if (!lenis) return;

    const update = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);

    return () => gsap.ticker.remove(update);
  }, [lenis]);

  // Next only scrolls a changed segment into view (and Lenis can carry its old
  // target over), so jump to the top on every new page. Back/forward keeps the
  // browser's restored position, and a #hash link keeps its anchor.
  const pathname = usePathname();
  const first = useRef(true);
  const popped = useRef(false);

  useEffect(() => {
    const onPop = () => { popped.current = true; };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (popped.current) { popped.current = false; return; }
    if (location.hash) return;
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
    else scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run per page, not when Lenis appears
  }, [pathname]);

  return (
    <ReactLenis root options={{ autoRaf: false, smoothWheel, lerp: 0.12, anchors: { offset: -96 } }}>
      {children}
    </ReactLenis>
  );
}
