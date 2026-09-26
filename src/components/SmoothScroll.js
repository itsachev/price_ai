'use client';

import { useEffect } from 'react';
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

  return (
    <ReactLenis root options={{ autoRaf: false, smoothWheel, lerp: 0.12, anchors: { offset: -96 } }}>
      {children}
    </ReactLenis>
  );
}
