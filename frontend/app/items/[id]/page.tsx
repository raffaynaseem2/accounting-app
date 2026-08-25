"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api-client";
import { money } from "../../../lib/money";

export default function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [item, setItem] = useState<any>(null);
  const [id, setId] = useState("");
  const [message, setMessage] = useState("");
  const [showStock, setShowStock] = useState(false);
  const [form, setForm] = useState({ quantity: "", reason: "OPENING_BALANCE", referenceId: "" });

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void (async () => {
      const { id: itemId } = await params;
      setId(itemId);
      try { setItem(await apiRequest(`/items/${itemId}/activity`, getToken)); }
      catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load item activity"); }
    })();
  }, [isLoaded, isSignedIn, getToken, params]);

  const addStock = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await apiRequest(`/items/${id}/movements`, getToken, { method: "POST", body: JSON.stringify({ quantity: Number(form.quantity), reason: form.reason, referenceId: form.referenceId || undefined }) });
      setItem(await apiRequest(`/items/${id}/activity`, getToken));
      setShowStock(false); setForm({ quantity: "", reason: "OPENING_BALANCE", referenceId: "" }); setMessage("Stock movement recorded.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to add stock"); }
  };

  if (!isLoaded) return <main className="panel">Loading...</main>;
  if (!isSignedIn) return <main className="panel"><Link href="/sign-in">Sign in</Link></main>;
  if (!item) return <main className="panel">{message || "Loading item..."}</main>;
  return <main className="content-stack">
    <div className="page-heading"><div><Link className="back-link" href="/items">← Products</Link><h1>{item.name}</h1><p>{item.productCode} · {item.type}</p></div>{item.type === "GOOD" ? <button className="primary-button" onClick={() => setShowStock(true)}>+ Add stock</button> : null}</div>
    <div className="metric-grid"><div className="metric-card"><span className="metric-label">Quantity on hand</span><strong className="metric-value">{item.type === "GOOD" ? item.quantityOnHand ?? "0" : "—"}</strong></div><div className="metric-card"><span className="metric-label">Unit cost</span><strong className="metric-value">{money(item.unitCost)}</strong></div><div className="metric-card"><span className="metric-label">Unit price</span><strong className="metric-value">{money(item.unitPrice)}</strong></div></div>
    <section className="panel"><h2>Sales</h2><div className="table-wrap"><table className="data-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Date</th><th>Quantity</th><th>Total</th></tr></thead><tbody>{item.salesInvoiceLines.map((line: any) => <tr key={line.id}><td><Link className="table-link" href={`/sales-invoices/${line.invoice.id}`}>{line.invoice.invoiceNumber}</Link></td><td>{line.invoice.customer.name}</td><td>{new Date(line.invoice.issueDate).toLocaleDateString()}</td><td>{line.quantity}</td><td>{money(line.lineTotal)}</td></tr>)}</tbody></table></div></section>
    <section className="panel"><h2>Purchases</h2><div className="table-wrap"><table className="data-table"><thead><tr><th>Bill</th><th>Supplier</th><th>Date</th><th>Quantity</th><th>Total</th></tr></thead><tbody>{item.purchaseBillLines.map((line: any) => <tr key={line.id}><td><Link className="table-link" href={`/purchase-bills/${line.bill.id}`}>{line.bill.billNumber}</Link></td><td>{line.bill.supplier.name}</td><td>{new Date(line.bill.billDate).toLocaleDateString()}</td><td>{line.quantity}</td><td>{money(line.lineTotal)}</td></tr>)}</tbody></table></div></section>
    <section className="panel"><div className="toolbar-row"><h2>Stock history</h2><Link className="secondary-button" href={`/stock-ledger?productId=${id}`}>Open filtered ledger</Link></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Movement</th><th>Quantity</th><th>Reference</th></tr></thead><tbody>{item.movements.map((movement: any) => <tr key={movement.id}><td>{new Date(movement.movementDate ?? movement.createdAt).toLocaleDateString()}</td><td>{movement.reason.replaceAll("_", " ")}</td><td>{movement.quantity}</td><td>{movement.referenceId || "—"}</td></tr>)}</tbody></table></div></section>
    {showStock ? <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowStock(false)}><aside className="side-drawer"><div className="toolbar-row"><h2>Add stock</h2><button className="icon-button" onClick={() => setShowStock(false)}>×</button></div><form className="form-grid" onSubmit={addStock}><label className="field">Product<input value={item.name} disabled /></label><label className="field">Movement type<select value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })}><option value="OPENING_BALANCE">Opening stock</option><option value="PURCHASE">Purchase</option><option value="SALE">Sale</option><option value="MANUAL_ADJUSTMENT">Manual adjustment</option></select></label><label className="field">Quantity<input required type="number" step="0.01" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label><label className="field">Reference<input value={form.referenceId} onChange={(event) => setForm({ ...form, referenceId: event.target.value })} /></label><div className="form-actions"><button className="primary-button">Add stock</button><button type="button" className="secondary-button" onClick={() => setShowStock(false)}>Cancel</button></div></form></aside></div> : null}
    {message ? <p>{message}</p> : null}
  </main>;
}
