// All money is EUR — never лв/BGN. Locale only changes separators/placement.
export function formatPrice(value, locale) {
  return new Intl.NumberFormat(locale === 'bg' ? 'bg-BG' : 'en-IE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

// Percent from a ratio: 0.065 → "+6.5%" (en) / "+6,5 %" (bg). Pass sign 'auto' to drop the "+".
export function formatPercent(ratio, locale, sign = 'exceptZero') {
  return new Intl.NumberFormat(locale === 'bg' ? 'bg-BG' : 'en-IE', {
    style: 'percent',
    maximumFractionDigits: 1,
    signDisplay: sign,
  }).format(ratio);
}
