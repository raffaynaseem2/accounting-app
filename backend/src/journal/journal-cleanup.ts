import { Prisma } from "@prisma/client";

export async function deleteJournalEntry(tx: Prisma.TransactionClient, journalEntryId: string) {
  await tx.journalEntryLine.deleteMany({ where: { journalEntryId } });
  await tx.journalEntry.delete({ where: { id: journalEntryId } });
}

export async function deletePaymentRecord(
  tx: Prisma.TransactionClient,
  payment: { id: string; journalEntryId: string },
) {
  await tx.payment.delete({ where: { id: payment.id } });
  await deleteJournalEntry(tx, payment.journalEntryId);
}

export async function deleteSourceJournal(
  tx: Prisma.TransactionClient,
  userId: string,
  sourceType: string,
  sourceId: string,
) {
  const existing = await tx.journalEntry.findFirst({ where: { userId, sourceType, sourceId } });
  if (existing) await deleteJournalEntry(tx, existing.id);
}
