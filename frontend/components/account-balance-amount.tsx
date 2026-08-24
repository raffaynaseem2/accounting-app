import MoneyAmount from "./money-amount";
import { displayAccountBalance } from "../lib/account-balance";

type Props = {
  rawBalance: unknown;
  accountType: string;
  className?: string;
};

export default function AccountBalanceAmount({ rawBalance, accountType, className }: Props) {
  return <MoneyAmount value={displayAccountBalance(rawBalance, accountType)} className={className} />;
}
