"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import EmptyState from "./empty-state";
import EntityHero from "./entity-hero";
import DocumentFormDrawer from "./document-form-drawer";
import PaymentFormDrawer from "./payment-form-drawer";
import MoneyAmount from "./money-amount";
import { apiRequest } from "../lib/api-client";

export default function PartyDetail({ kind, id }: { kind: "customers" | "suppliers"; id: string }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [party, setParty] = useState<any>(null);
  const [balance, setBalance] = useState(0);
  const [message, setMessage] = useState("");
  const [documentModal, setDocumentModal] = useState<{ mode: "sales" | "purchases"; id: string } | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const label = kind === "customers" ? "Customer" : "Supplier";
  const isCustomer = kind === "customers";

  const load = useCallback(async () => {
    const [partyResult, balanceResult] = await Promise.allSettled([
      apiRequest(`/${kind}/${id}`, getToken),
      apiRequest(`/${kind}/${id}/balance`, getToken),
    ]);
    if (partyResult.status === "fulfilled") setParty(partyResult.value);
    if (balanceResult.status === "fulfilled") setBalance(balanceResult.value);
    const failed = [partyResult, balanceResult].find((result) => result.status === "rejected");
    if (failed?.status === "rejected") throw (failed.reason instanceof Error ? failed.reason : new Error("Unable to load record"));
  }, [getToken, id, kind]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void load().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Unable to load record");
    });
  }, [isLoaded, isSignedIn, load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "1") setShowPayment(true);
  }, []);

  const openDocumentFromLine = (line: any) => {
    const sourceType = line.journalEntry?.sourceType;
    const sourceId = line.journalEntry?.sourceId;
    if (sourceType === "SALES_INVOICE" && sourceId) {
      setDocumentModal({ mode: "sales", id: sourceId });
    } else if (sourceType === "PURCHASE_BILL" && sourceId) {
      setDocumentModal({ mode: "purchases", id: sourceId });
    }
  };

  if (!isLoaded) return <main className="panel">Loading...</main>;
  if (!isSignedIn) return <main className="panel"><Link href="/">Sign in</Link></main>;
  if (message) return <main className="panel">{message}</main>;
  if (!party) return <main className="panel">Loading...</main>;

  const lines = party.journalLines ?? [];
  let running = 0;

  return (
    <main className="content-stack">
      <EntityHero
        backHref={`/${kind}`}
        backLabel={kind[0].toUpperCase() + kind.slice(1)}
        name={party.name}
        subtitle={`${label} subledger statement`}
        balance={balance}
        balanceLabel={isCustomer ? "Amount receivable" : "Amount payable"}
        meta={
          <>
            <span>{party.contactEmail || "No email"}</span>
            {" · "}
            <span>{party.contactPhone || "No phone"}</span>
            {party.paymentTerms ? <> · {party.paymentTerms.replaceAll("_", " ")}</> : null}
            {party.billingAddress ? <div>{party.billingAddress}</div> : null}
          </>
        }
        actions={
          <>
            <button type="button" className="primary-button" onClick={() => setShowPayment(true)}>Record payment</button>
            <Link
              className="secondary-button"
              href={isCustomer ? `/sales-invoices?new=1&partyId=${id}` : `/purchase-bills?new=1&partyId=${id}`}
            >
              {isCustomer ? "New invoice" : "New bill"}
            </Link>
          </>
        }
      />

      <section className="panel">
        <div className="toolbar-row">
          <h2>Subledger statement</h2>
          <span className="muted-text">{lines.length} journal lines</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th className="col-num">Debit</th>
                <th className="col-num">Credit</th>
                <th className="col-num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line: any) => {
                const debit = line.side === "DEBIT" ? Number(line.amount) : 0;
                const credit = line.side === "CREDIT" ? Number(line.amount) : 0;
                running += isCustomer ? debit - credit : credit - debit;
                const clickable = line.journalEntry?.sourceType === "SALES_INVOICE" || line.journalEntry?.sourceType === "PURCHASE_BILL";
                return (
                  <tr
                    key={line.id}
                    onClick={() => openDocumentFromLine(line)}
                    style={{ cursor: clickable ? "pointer" : "default" }}
                  >
                    <td>{new Date(line.journalEntry.entryDate).toLocaleDateString()}</td>
                    <td>{line.journalEntry.description}</td>
                    <td className="col-num">{debit ? <MoneyAmount value={debit} /> : "—"}</td>
                    <td className="col-num">{credit ? <MoneyAmount value={credit} /> : "—"}</td>
                    <td className="col-num"><MoneyAmount value={running} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!lines.length ? (
          <EmptyState icon="activity" title="No subledger postings" description="Journal entries referencing this party will appear here." />
        ) : null}
      </section>

      {documentModal ? (
        <DocumentFormDrawer
          mode={documentModal.mode}
          documentId={documentModal.id}
          onClose={() => setDocumentModal(null)}
          onSaved={() => void load()}
        />
      ) : null}

      {showPayment ? (
        <PaymentFormDrawer
          kind={isCustomer ? "customer" : "supplier"}
          partyId={id}
          onClose={() => setShowPayment(false)}
          onSaved={() => void load()}
        />
      ) : null}
    </main>
  );
}
