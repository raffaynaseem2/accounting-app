"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import MoneyAmount, { NumAmount } from "./money-amount";
import EmptyState from "./empty-state";
import { apiRequest } from "../lib/api-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function DocumentDetail({ kind, id }: { kind: "invoice" | "bill"; id: string }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [document, setDocument] = useState<any>(null);
  const [error, setError] = useState("");
  const isInvoice = kind === "invoice";
  const base = isInvoice ? "/sales-invoices" : "/purchase-bills";

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void (async () => {
      try {
        setDocument(await apiRequest(`${base}/${id}`, getToken));
      } catch (error) {
        setError(error instanceof Error ? error.message : "Unable to load document");
      }
    })();
  }, [isLoaded, isSignedIn, getToken, base, id]);

  if (!isLoaded) return <main className="panel">Loading...</main>;
  if (!isSignedIn) return <main className="panel"><Link href="/">Sign in</Link></main>;
  if (error) return <main className="panel">{error}</main>;
  if (!document) return <main className="panel">Loading...</main>;

  const total = document.lines.reduce((sum: number, line: any) => sum + Number(line.lineTotal), 0);
  const number = isInvoice ? document.invoiceNumber : document.billNumber;
  const party = isInvoice ? document.customer : document.supplier;
  const partyKind = isInvoice ? "customers" : "suppliers";

  return (
    <main className="content-stack">
      <div className="page-heading">
        <div>
          <Link className="back-link" href={base}>← {isInvoice ? "Invoices" : "Bills"}</Link>
          <h1>{number}</h1>
          <p>
            <Link className="table-link" href={`/${partyKind}/${party.id}`}>{party.name}</Link>
            {" · "}
            {new Date(isInvoice ? document.issueDate : document.billDate).toLocaleDateString()}
          </p>
        </div>
        <strong className="ledger-balance"><MoneyAmount value={total} /></strong>
      </div>

      <section className="panel">
        <div className="toolbar-row">
          <h2>{isInvoice ? "Invoice" : "Bill"} details</h2>
          <Link className="primary-button" href={`/${partyKind}/${party.id}?payment=1`}>Record payment</Link>
        </div>
        <div className="metric-grid">
          <div className="metric-card"><span className="metric-label">Total</span><strong className="metric-value"><MoneyAmount value={total} /></strong></div>
        </div>
        <p>{document.notes || "No notes"}</p>
      </section>

      <section className="panel">
        <h2>Line items</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Code</th>
                <th className="col-num">Quantity</th>
                <th className="col-num">{isInvoice ? "Unit price" : "Unit cost"}</th>
                <th className="col-num">Total</th>
              </tr>
            </thead>
            <tbody>
              {document.lines.map((line: any) => (
                <tr key={line.id}>
                  <td>{line.itemName}</td>
                  <td>{line.productCode || "—"}</td>
                  <td className="col-num"><NumAmount value={line.quantity} /></td>
                  <td className="col-num"><MoneyAmount value={isInvoice ? line.unitPrice : line.unitCost} /></td>
                  <td className="col-num"><MoneyAmount value={line.lineTotal} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!document.lines.length ? (
          <EmptyState icon="document" title="No line items" description="This document has no lines." />
        ) : null}
      </section>
    </main>
  );
}
