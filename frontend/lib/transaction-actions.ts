export type TransactionSource = {
  sourceType: string | null;
  sourceId: string | null;
  journalEntryId: string;
  paymentId?: string | null;
};

export function transactionEditPath(source: TransactionSource): string | null {
  const id = source.sourceId;
  if (source.sourceType === "SALES_INVOICE" && id) return `/sales-invoices?edit=${id}`;
  if (source.sourceType === "PURCHASE_BILL" && id) return `/purchase-bills?edit=${id}`;
  if (source.sourceType === "PAYMENT") return null;
  return `/journal-entries?edit=${source.journalEntryId}`;
}

export function transactionDeletePath(source: TransactionSource): string {
  const id = source.sourceId ?? source.paymentId;
  if (source.sourceType === "SALES_INVOICE" && id) return `/sales-invoices/${id}`;
  if (source.sourceType === "PURCHASE_BILL" && id) return `/purchase-bills/${id}`;
  if (source.sourceType === "PAYMENT" && id) return `/payments/${id}`;
  return `/journal-entries/${source.journalEntryId}`;
}

export function transactionDeleteLabel(source: TransactionSource): string {
  if (source.sourceType === "SALES_INVOICE") return "invoice";
  if (source.sourceType === "PURCHASE_BILL") return "bill";
  if (source.sourceType === "PAYMENT") return "payment";
  return "journal entry";
}

export function sourceFromJournalEntry(entry: {
  id: string;
  sourceType?: string | null;
  sourceId?: string | null;
  payment?: { id: string } | null;
}): TransactionSource {
  return {
    sourceType: entry.sourceType ?? null,
    sourceId: entry.sourceId ?? null,
    journalEntryId: entry.id,
    paymentId: entry.payment?.id ?? (entry.sourceType === "PAYMENT" ? entry.sourceId : null),
  };
}
