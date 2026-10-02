// CSV cell for the exports: ";" separated with a decimal comma, so Bulgarian
// Excel opens it as is. Text that starts like a formula gets a leading ' so a
// spreadsheet shows it rather than runs it (CSV injection through a product name).
export const cell = (value) => {
  let s = typeof value === 'number' ? value.toFixed(2).replace('.', ',') : String(value ?? '');
  if (typeof value !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};
