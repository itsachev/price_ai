// All money is EUR — never лв/BGN. Locale only changes separators/placement.
export function formatPrice(value, locale) {
  return new Intl.NumberFormat(locale === 'bg' ? 'bg-BG' : 'en-IE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}
