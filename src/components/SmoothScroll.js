'use client';

import { useEffect, useRef } from 'react';
import { ReactLenis } from 'lenis/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import 'lenis/dist/lenis.css';

gsap.registerPlugin(ScrollTrigger);

// Lenis driven by GSAP's ticker so ScrollTrigger and smooth scroll share one clock.
export default function SmoothScroll({ children }) {
  const lenisRef = useRef(null);

  useEffect(() => {
    const lenis = lenisRef.current?.lenis;
    if (!lenis) return;

    // Respect reduced motion: native wheel scrolling, no easing.
    lenis.options.smoothWheel = !matchMedia('(prefers-reduced-motion: reduce)').matches;

    lenis.on('scroll', ScrollTrigger.update);
    const update = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.off('scroll', ScrollTrigger.update);
      gsap.ticker.remove(update);
    };
  }, []);

  return (
    <ReactLenis root ref={lenisRef} options={{ autoRaf: false, lerp: 0.12, anchors: { offset: -64 } }}>
      {children}
    </ReactLenis>
  );
}
