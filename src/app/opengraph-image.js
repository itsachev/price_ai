import { ImageResponse } from 'next/og';

// Built once at build time. Latin text only: the bundled OG font has no Cyrillic.
export const alt = 'PriceAI: AI price intelligence for Bulgarian grocers';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 96, background: '#0a0f1a', color: '#f4f6fa' }}>
        <div style={{ display: 'flex', fontSize: 120, fontWeight: 700, letterSpacing: -4 }}>
          Price<span style={{ color: '#7dd3fc' }}>AI</span>
        </div>
        <div style={{ fontSize: 48, marginTop: 24, maxWidth: 900 }}>Compete smarter. Price better.</div>
        <div style={{ fontSize: 30, marginTop: 32, color: '#94a3b8' }}>Daily competitor prices from Bulgarian chains, matched to your catalog by AI.</div>
      </div>
    ),
    size,
  );
}
