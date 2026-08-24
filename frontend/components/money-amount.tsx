import { money } from "../lib/money";

type Props = {
  value: unknown;
  className?: string;
};

export default function MoneyAmount({ value, className = "" }: Props) {
  const n = Number(value) || 0;
  const negative = n < 0;

  return (
    <span className={`amount${negative ? " amount-negative" : ""}${className ? ` ${className}` : ""}`}>
      {money(value)}
    </span>
  );
}

export function NumAmount({ value, className = "" }: Props) {
  const n = Number(value) || 0;
  const negative = n < 0;
  const hasDecimals = Math.round((n - Math.floor(n)) * 100) !== 0;

  return (
    <span className={`amount${negative ? " amount-negative" : ""}${className ? ` ${className}` : ""}`}>
      {new Intl.NumberFormat("en-PK", {
        minimumFractionDigits: hasDecimals ? 2 : 0,
        maximumFractionDigits: 2,
      }).format(n)}
    </span>
  );
}
