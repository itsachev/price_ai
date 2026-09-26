'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

// Site backdrop: one WebGL canvas, three draw calls per frame (shader, links, nodes).
// Layers: aurora glows, a dot matrix whose "live" clusters drift like a market
// field, and a diagonal scan sweep that lights dots as it passes (the daily
// scan), plus a particle constellation the same sweep lights up. Colours come
// from the CSS tokens, so both themes just work.
// Without WebGL the CSS aurora underneath stays as the fallback.

const DPR_CAP = 1.5; // soft ambient art: sharper than 1.5x costs fill rate for nothing
const CELL = 24; // dot spacing in CSS px, same as the old CSS matrix
const SCAN_SECONDS = 12;

const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float; // time grows; mediump hashes turn to noise after minutes
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uDpr, uTime, uScroll;
uniform vec2 uPointer;
uniform vec3 uBg, uInk, uHot;
uniform vec4 uGlow1, uGlow2, uGlow3;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + 1.), f.x), f.y);
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y * uDpr - gl_FragCoord.y) / uDpr; // CSS px, top-left origin
  vec2 uv = px / uRes;
  float t = uTime;
  float aspect = uRes.x / uRes.y;

  // Aurora: domain-warped noise, strongest near the top like the old ribbons.
  vec2 q = vec2(uv.x * aspect, uv.y) * 1.4;
  float warp = noise(q * 1.3 + vec2(t * .04, -t * .03));
  float a1 = smoothstep(.35, .85, noise(q + vec2(t * .025, 0.) + warp * 1.6));
  float a2 = smoothstep(.4, .9, noise(q * .8 - vec2(t * .02, t * .012) + 7.3 + warp));
  float a3 = smoothstep(.45, .95, noise(q * 1.7 + vec2(-t * .03, t * .02) + 13.1));
  float top = 1. - smoothstep(0., 1.15, uv.y);
  vec3 col = uBg;
  col = mix(col, uGlow1.rgb, uGlow1.a * a1 * top * 2.);
  col = mix(col, uGlow2.rgb, uGlow2.a * a2 * (.4 + top) * 1.6);
  col = mix(col, uGlow3.rgb, uGlow3.a * a3 * 1.5);

  // Dot matrix drifts at a fraction of the scroll for depth.
  vec2 g = px + vec2(0., uScroll * .12);
  vec2 id = floor(g / ${CELL}.);
  vec2 f = (fract(g / ${CELL}.) - .5) * ${CELL}.;
  vec2 centre = (id + .5) * ${CELL}. - vec2(0., uScroll * .12);
  vec2 cuv = centre / uRes;

  float market = smoothstep(.58, .85, noise(id * .16 + vec2(t * .07, t * .02)));
  float sweep = fract(t / ${SCAN_SECONDS}.) * 1.9 - .45;
  float along = cuv.x * .72 + cuv.y * .28;
  float band = (along - sweep) * 11.;
  float scan = exp(-band * band);
  float wake = (1. - smoothstep(0., .25, sweep - along)) * step(along, sweep) * market; // lit clusters linger behind the band
  float pd = length(centre - uPointer);
  float lift = exp(-pd * pd / 22000.);

  float mask = 1. - smoothstep(.15, .95, length((cuv - vec2(.5, 0.)) / vec2(.85, .75)));
  float r = .9 + market * .9 + scan * 1.3 + lift * 1.3;
  float dotA = 1. - smoothstep(r - .7, r + .7, length(f));
  float heat = clamp(scan + wake * .8 + lift * .7, 0., 1.);
  float alpha = clamp((.14 + market * .3) * mask + heat * .75, 0., 1.);
  col = mix(col, mix(uInk, uHot, heat), dotA * alpha);

  gl_FragColor = vec4(col, 1.);
}`;

// Constellation layer (the particles.js look, without its second canvas and
// rAF loop): nodes drift, hairlines join close pairs and reach to the cursor.
// Count scales with viewport area, so phones get a sparse field.
const PARTICLE_AREA = 16000; // CSS px² per particle
const PARTICLE_MAX = 100; // O(n²) link check: 100 → ~5k distance tests a frame
const LINK = 140; // max px between linked particles
const GRAB = 190; // cursor link radius

// Per vertex: x, y (CSS px), alpha, heat (0 ink → 1 scan colour).
const P_VERT = `
attribute vec4 v;
uniform vec2 uRes;
uniform float uSize;
varying vec2 vAH;
void main() {
  gl_Position = vec4(v.x / uRes.x * 2. - 1., 1. - v.y / uRes.y * 2., 0., 1.);
  gl_PointSize = uSize;
  vAH = v.zw;
}`;

const P_FRAG = `
precision mediump float;
uniform vec3 uInk, uHot;
uniform float uRound;
varying vec2 vAH;
void main() {
  float a = vAH.x;
  if (uRound > .5) a *= 1. - smoothstep(.25, .5, length(gl_PointCoord - .5));
  gl_FragColor = vec4(mix(uInk, uHot, vAH.y), a);
}`;

// Resolve any CSS colour (light-dark(), color-mix(), var()) to 0..1 RGBA by
// letting the browser compute it, then painting it into one pixel.
function readColors(probe) {
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  return (value) => {
    probe.style.color = value;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = getComputedStyle(probe).color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return [r / 255, g / 255, b / 255, a / 255];
  };
}

export default function AiBackground() {
  const root = useRef(null);

  useEffect(() => {
    const box = root.current;
    const canvas = box.querySelector('canvas');
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return;

    const shader = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const program = (vert, frag, attr) => {
      const p = gl.createProgram();
      gl.attachShader(p, shader(gl.VERTEX_SHADER, vert));
      gl.attachShader(p, shader(gl.FRAGMENT_SHADER, frag));
      gl.bindAttribLocation(p, 0, attr);
      gl.linkProgram(p);
      return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
    };
    const bg = program(VERT, FRAG, 'p');
    const pts = program(P_VERT, P_FRAG, 'v');
    if (!bg || !pts) return; // keep the CSS fallback
    const loc = new Map();
    const u = (p, name) => {
      const key = (p === bg ? 'b' : 'p') + name;
      if (!loc.has(key)) loc.set(key, gl.getUniformLocation(p, name));
      return loc.get(key);
    };

    const tri = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tri);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // one oversized triangle
    const pbuf = gl.createBuffer();
    gl.enableVertexAttribArray(0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const color = readColors(box.querySelector('.ai-bg__probe'));
    const setColors = () => {
      const ink = color('var(--bg-ink)').slice(0, 3);
      const hot = color('var(--bg-hot)').slice(0, 3);
      gl.useProgram(bg);
      gl.uniform3fv(u(bg, 'uBg'), color('var(--bg)').slice(0, 3));
      gl.uniform3fv(u(bg, 'uInk'), ink);
      gl.uniform3fv(u(bg, 'uHot'), hot);
      gl.uniform4fv(u(bg, 'uGlow1'), color('var(--glow-1)'));
      gl.uniform4fv(u(bg, 'uGlow2'), color('var(--glow-2)'));
      gl.uniform4fv(u(bg, 'uGlow3'), color('var(--glow-3)'));
      gl.useProgram(pts);
      gl.uniform3fv(u(pts, 'uInk'), ink);
      gl.uniform3fv(u(pts, 'uHot'), hot);
    };

    let w = 0, h = 0, dpr = 1;
    let particles = [];
    let verts = new Float32Array(0);
    const resize = () => {
      dpr = Math.min(devicePixelRatio || 1, DPR_CAP);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(bg);
      gl.uniform2f(u(bg, 'uRes'), w, h);
      gl.uniform1f(u(bg, 'uDpr'), dpr);
      gl.useProgram(pts);
      gl.uniform2f(u(pts, 'uRes'), w, h);

      // Keep existing particles on resize (mobile URL bar), only top up or trim.
      const n = Math.min(PARTICLE_MAX, Math.round((w * h) / PARTICLE_AREA));
      while (particles.length < n) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 6 + Math.random() * 12; // px per second
        particles.push({ x: Math.random() * w, y: Math.random() * h, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, heat: 0 });
      }
      particles.length = n;
      // Worst case: every pair linked, plus a cursor link and a point per particle.
      verts = new Float32Array(((n * (n - 1)) / 2 + n) * 2 * 4 + n * 4);
    };

    const still = matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = { x: -1e4, y: -1e4 };
    const target = { x: -1e4, y: -1e4 };
    const start = performance.now();
    let last = start;

    const drawParticles = (t, dt) => {
      const sweep = ((t / SCAN_SECONDS) % 1) * 1.9 - 0.45; // same band as the shader
      for (const p of particles) {
        p.x = (p.x + p.vx * dt + w) % w;
        p.y = (p.y + p.vy * dt + h) % h;
        const band = (p.x / w * 0.72 + p.y / h * 0.28 - sweep) * 11;
        p.heat = Math.max(Math.exp(-band * band), p.heat * Math.exp(-dt * 1.5)); // flash, then cool
      }
      // Fade toward the bottom, like the dot matrix, so content stays calm.
      const fade = (y) => 0.35 + 0.65 * (1 - y / h);
      let k = 0;
      const push = (x, y, a, heat) => { verts[k++] = x; verts[k++] = y; verts[k++] = a; verts[k++] = heat; };
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d > LINK) continue;
          const alpha = (1 - d / LINK) * 0.28 * fade((a.y + b.y) / 2);
          push(a.x, a.y, alpha, a.heat);
          push(b.x, b.y, alpha, b.heat);
        }
        const d = Math.hypot(a.x - pointer.x, a.y - pointer.y);
        if (d < GRAB) {
          const alpha = (1 - d / GRAB) * 0.5;
          push(a.x, a.y, alpha, 1);
          push(pointer.x, pointer.y, alpha, 1);
        }
      }
      const lineVerts = k / 4;
      for (const p of particles) push(p.x, p.y, (0.35 + p.heat * 0.6) * fade(p.y), p.heat);

      gl.useProgram(pts);
      gl.bindBuffer(gl.ARRAY_BUFFER, pbuf);
      gl.bufferData(gl.ARRAY_BUFFER, verts.subarray(0, k), gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
      gl.uniform1f(u(pts, 'uRound'), 0);
      gl.drawArrays(gl.LINES, 0, lineVerts);
      gl.uniform1f(u(pts, 'uRound'), 1);
      gl.uniform1f(u(pts, 'uSize'), 3.5 * dpr);
      gl.drawArrays(gl.POINTS, lineVerts, particles.length);
    };

    const draw = () => {
      const now = performance.now();
      const dt = still.matches ? 0 : Math.min((now - last) / 1000, 0.1); // no jump after a hidden tab
      last = now;
      const t = still.matches ? 4 : (now - start) / 1000;
      pointer.x += (target.x - pointer.x) * 0.12;
      pointer.y += (target.y - pointer.y) * 0.12;

      gl.useProgram(bg);
      gl.bindBuffer(gl.ARRAY_BUFFER, tri);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(u(bg, 'uTime'), t);
      gl.uniform1f(u(bg, 'uScroll'), still.matches ? 0 : scrollY);
      gl.uniform2f(u(bg, 'uPointer'), pointer.x, pointer.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      drawParticles(t, dt);
    };
    // Reduced motion: one static frame, redrawn only when size or theme changes.
    const tick = () => { if (!still.matches) draw(); };
    const redraw = () => { resize(); setColors(); draw(); };

    const onMove = (e) => { target.x = e.clientX; target.y = e.clientY; };
    const onLeave = () => { target.x = target.y = -1e4; };
    const scheme = matchMedia('(prefers-color-scheme: dark)');
    const themeObserver = new MutationObserver(redraw); // theme toggle and PageTone set <html data-theme|data-tone>
    const onLost = (e) => { e.preventDefault(); gsap.ticker.remove(tick); box.classList.remove('is-gl'); };

    redraw();
    box.classList.add('is-gl');
    gsap.ticker.add(tick); // shares the Lenis/GSAP clock; rAF already sleeps in hidden tabs
    addEventListener('resize', redraw);
    addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    scheme.addEventListener('change', redraw);
    still.addEventListener('change', redraw);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-tone'] });
    canvas.addEventListener('webglcontextlost', onLost);

    return () => {
      gsap.ticker.remove(tick);
      removeEventListener('resize', redraw);
      removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      scheme.removeEventListener('change', redraw);
      still.removeEventListener('change', redraw);
      themeObserver.disconnect();
      canvas.removeEventListener('webglcontextlost', onLost);
      box.classList.remove('is-gl');
    };
  }, []);

  return (
    <div ref={root} className="ai-bg" aria-hidden="true">
      <span className="ai-bg__aurora" />
      <span className="ai-bg__aurora" />
      <span className="ai-bg__aurora" />
      <canvas className="ai-bg__canvas" />
      <span className="ai-bg__probe" />
    </div>
  );
}
