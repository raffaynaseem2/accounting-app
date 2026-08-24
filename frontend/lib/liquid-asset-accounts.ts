/** Asset accounts suitable for bank/cash payment lines — excludes control accounts. */
export function isLiquidAssetAccount(account: {
  type: string;
  subledgerType: string;
  systemKey: string | null;
}) {
  return account.type === "ASSET" && account.subledgerType === "NONE" && !account.systemKey;
}
