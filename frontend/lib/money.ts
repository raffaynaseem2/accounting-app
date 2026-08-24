export function money(v: unknown) {
  const n = Number(v) || 0;
  const hasDecimals = Math.round((n - Math.floor(n)) * 100) !== 0;
  return `PKR ${new Intl.NumberFormat("en-PK", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(n)}`;
}
