import gsap from 'gsap';

// Staggers `targets` up into place, for content that appears in an overlay
// (modals, popovers). The overlay shell animates in CSS; this runs on top.
// Rapid reopening restarts cleanly (overwrite), and inline styles are cleared
// after, so nothing stays hidden. Skipped under reduced motion.
export function revealIn(targets, { y = 12, stagger = 0.045 } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.fromTo(
    targets,
    { autoAlpha: 0, y },
    { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power3.out', stagger, delay: 0.05, overwrite: true, clearProps: 'opacity,visibility,transform' }
  );
}
