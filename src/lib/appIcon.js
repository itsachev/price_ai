import { ImageResponse } from 'next/og';

// The header's price-tag mark on the dark brand background. Kept inside the
// middle 60%, so the same image works as a maskable (Android) icon.
export function appIcon(size) {
  const mark = Math.round(size * 0.6);
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0f1a' }}>
        <svg width={mark} height={mark} viewBox="0 0 24 24">
          <path fill="#7dd3fc" fillRule="evenodd" d="M3 4.5A1.5 1.5 0 0 1 4.5 3h7.4a1.5 1.5 0 0 1 1.06.44l7.6 7.6a1.5 1.5 0 0 1 0 2.12l-7.4 7.4a1.5 1.5 0 0 1-2.12 0l-7.6-7.6A1.5 1.5 0 0 1 3 11.9zM8 9.75a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5z" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
