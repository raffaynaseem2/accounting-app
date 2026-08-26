"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import OverflowMenu from "./overflow-menu";
import SearchableSelect from "./searchable-select";
import TablePagination from "./table-pagination";
import TableSortHeader from "./table-sort-header";
import SearchField from "./search-field";
import MoneyAmount from "./money-amount";
import EmptyState from "./empty-state";
import ConfirmDialog from "./confirm-dialog";
import { usePagination } from "../lib/use-pagination";
import { apiRequest } from "../lib/api-client";

type Mode = "sales" | "purchases";
type Line = { itemId: string; quantity: string; price: string };
const today = () => new Date().toISOString().slice(0, 10);
const blank = (): Line => ({ itemId: "", quantity: "", price: "" });
const totalOf = (d: any) => d.lines.reduce((s: number, l: any) => s + Number(l.lineTotal), 0);

export default function DocumentManager({ mode }: { mode: Mode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const isSales = mode === "sales";
  const base = isSales ? "/sales-invoices" : "/purchase-bills";
  const partyLabel = isSales ? "Customer" : "Supplier";
  const [parties, setParties] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [partyId, setPartyId] = useState("");
  const [number, setNumber] = useState("");
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [quickParty, setQuickParty] = useState(false);
  const [quickForm, setQuickForm] = useState({ name: "", contactEmail: "", contactPhone: "", billingAddress: "" });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"reference" | "party" | "date" | "total">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pendingDelete, setPendingDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const editHandled = useRef(false);

  const request = (path: string, options: RequestInit = {}) => apiRequest(path, getToken, options);

  const load = async () => {
    try {
      const [partyResult, itemResult, documentResult] = await Promise.allSettled([request(`/${isSales ? "customers" : "suppliers"}`), request("/items"), request(base)]);
      if (partyResult.status === "fulfilled") setParties(partyResult.value.filter((x: any) => x.isActive));
      if (itemResult.status === "fulfilled") setItems(itemResult.value.filter((x: any) => x.isActive));
      if (documentResult.status === "fulfilled") setDocuments(documentResult.value);
      const failed = [partyResult, itemResult, documentResult].find((result) => result.status === "rejected");
      if (failed?.status === "rejected") setMessage(failed.reason instanceof Error ? failed.reason.message : "Some records could not be loaded");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to load documents");
    }
  };

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") {
      setShowForm(true);
      const presetParty = params.get("partyId");
      if (presetParty) setPartyId(presetParty);
    }
    void load();
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    const editId = new URLSearchParams(window.location.search).get("edit");
    if (!editId || editHandled.current || !documents.length) return;
    const doc = documents.find((d) => d.id === editId);
    if (doc) {
      editHandled.current = true;
      edit(doc);
    }
  }, [documents]);

  useEffect(() => {
    if (showForm) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [showForm]);

  const close = () => {
    setEditing(null);
    setShowForm(false);
    setPartyId("");
    setNumber("");
    setDate(today());
    setNotes("");
    setLines([blank()]);
  };

  const openNew = () => {
    close();
    setShowForm(true);
  };

  const edit = (d: any) => {
    setEditing(d);
    setShowForm(true);
    setPartyId(isSales ? d.customerId : d.supplierId);
    setNumber(isSales ? d.invoiceNumber : d.billNumber);
    setDate((isSales ? d.issueDate : d.billDate).slice(0, 10));
    setNotes(d.notes ?? "");
    setLines(d.lines.map((l: any) => ({ itemId: l.itemId, quantity: String(l.quantity), price: String(isSales ? l.unitPrice : l.unitCost) })));
  };

  const chooseItem = (index: number, itemId: string) => {
    const item = items.find((x) => x.id === itemId);
    setLines(lines.map((l, i) => i === index ? { ...l, itemId, price: l.price || String(isSales ? item?.unitPrice ?? "" : item?.unitCost ?? "") } : l));
  };

  const total = useMemo(() => lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.price) || 0), 0), [lines]);

  const visible = useMemo(() => documents.filter((d) => `${isSales ? d.invoiceNumber : d.billNumber} ${isSales ? d.customer?.name : d.supplier?.name}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => {
    const value = (d: any) => sortKey === "reference" ? (isSales ? d.invoiceNumber : d.billNumber).toLowerCase() : sortKey === "party" ? (isSales ? d.customer.name : d.supplier.name).toLowerCase() : sortKey === "total" ? totalOf(d) : Date.parse(isSales ? d.issueDate : d.billDate);
    const av = value(a), bv = value(b);
    return (av < bv ? -1 : av > bv ? 1 : 0) * (sortDir === "asc" ? 1 : -1);
  }), [documents, search, sortKey, sortDir, isSales]);

  const { page, setPage, totalPages, pageItems, totalItems, pageSize } = usePagination(visible);

  const sort = (key: string) => {
    if (key === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key as typeof sortKey); setSortDir("asc"); }
    setPage(1);
  };

  const saveParty = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await request(`/${isSales ? "customers" : "suppliers"}`, { method: "POST", body: JSON.stringify(quickForm) });
      setParties([...parties, created]);
      setPartyId(created.id);
      setQuickParty(false);
      setQuickForm({ name: "", contactEmail: "", contactPhone: "", billingAddress: "" });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to create party");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await request(editing ? `${base}/${editing.id}` : base, { method: editing ? "PATCH" : "POST", body: JSON.stringify({ [isSales ? "customerId" : "supplierId"]: partyId, [isSales ? "invoiceNumber" : "billNumber"]: number || undefined, [isSales ? "issueDate" : "billDate"]: date, notes, lines: lines.map((l) => ({ itemId: l.itemId, quantity: Number(l.quantity), [isSales ? "unitPrice" : "unitCost"]: Number(l.price) })) }) });
      close();
      await load();
      setMessage(`${isSales ? "Invoice" : "Bill"} saved.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save document");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      await request(`${base}/${pendingDelete.id}`, { method: "DELETE" });
      setPendingDelete(null);
      await load();
      setMessage(`${isSales ? "Invoice" : "Bill"} deleted.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to delete document");
    } finally {
      setDeleting(false);
    }
  };

  if (!isLoaded) return <main className="panel">Loading...</main>;
  if (!isSignedIn) return <main className="panel"><Link href="/">Sign in</Link></main>;

  const partyOptions = parties.map((p) => ({ value: p.id, label: p.name, search: `${p.contactEmail ?? ""} ${p.contactPhone ?? ""}` }));
  const itemOptions = items.map((i) => ({ value: i.id, label: `${i.name} · ${i.productCode}` }));

  return (
    <main className="content-stack">
      <div className="page-heading">
        <div>
          <h1>{isSales ? "Invoices" : "Bills"}</h1>
          <p>{isSales ? "Review customer invoices and balances." : "Review supplier bills and balances."}</p>
        </div>
        <button className="primary-button" onClick={openNew}>+ New {isSales ? "invoice" : "bill"}</button>
      </div>

      {showForm ? (
        <section className="panel form-panel">
          <div className="toolbar-row">
            <h2>{editing ? "Edit" : "New"} {isSales ? "invoice" : "bill"}</h2>
            <button className="icon-button" onClick={close}>×</button>
          </div>
          <form className="form-grid" onSubmit={submit}>
            <SearchableSelect label={partyLabel} required value={partyId} onChange={setPartyId} options={partyOptions} placeholder={`Search ${partyLabel.toLowerCase()}...`} />
            <button type="button" className="section-heading-link" onClick={() => setQuickParty(true)}>+ New {partyLabel.toLowerCase()}</button>
            <label className="field">{isSales ? "Invoice number" : "Bill number"}<input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Generated if blank" /></label>
            <label className="field">Date<input required type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <label className="field full-width">Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
            <div className="toolbar-row">
              <h3>Line items</h3>
              <button type="button" className="secondary-button" onClick={() => setLines([...lines, blank()])}>+ Add line</button>
            </div>
            {lines.map((line, i) => (
              <div className="line-item" key={i}>
                <SearchableSelect label="Product/service" required value={line.itemId} onChange={(v) => chooseItem(i, v)} options={itemOptions} />
                <label className="field">Quantity<input required type="number" min="0.01" step="0.01" value={line.quantity} onChange={(e) => setLines(lines.map((x, n) => n === i ? { ...x, quantity: e.target.value } : x))} /></label>
                <label className="field">{isSales ? "Unit price" : "Unit cost"}<input required type="number" min="0.01" step="0.01" value={line.price} onChange={(e) => setLines(lines.map((x, n) => n === i ? { ...x, price: e.target.value } : x))} /></label>
                <button className="icon-button" type="button" onClick={() => lines.length > 1 && setLines(lines.filter((_, n) => n !== i))}>×</button>
              </div>
            ))}
            <div className="total-box"><span>Total</span><strong><MoneyAmount value={total} /></strong></div>
            <div className="form-actions">
              <button className="primary-button" disabled={submitting}>{submitting ? "Saving..." : "Save"}</button>
              <button type="button" className="secondary-button" onClick={close}>Cancel</button>
            </div>
          </form>
        </section>
      ) : null}

      {quickParty ? (
        <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setQuickParty(false)}>
          <aside className="side-drawer">
            <div className="toolbar-row">
              <h2>New {partyLabel}</h2>
              <button className="icon-button" onClick={() => setQuickParty(false)}>×</button>
            </div>
            <form className="form-grid" onSubmit={saveParty}>
              <label className="field">Name<input required value={quickForm.name} onChange={(e) => setQuickForm({ ...quickForm, name: e.target.value })} /></label>
              <label className="field">Email<input type="email" value={quickForm.contactEmail} onChange={(e) => setQuickForm({ ...quickForm, contactEmail: e.target.value })} /></label>
              <label className="field">Phone<input value={quickForm.contactPhone} onChange={(e) => setQuickForm({ ...quickForm, contactPhone: e.target.value })} /></label>
              <label className="field full-width">Billing address<textarea value={quickForm.billingAddress} onChange={(e) => setQuickForm({ ...quickForm, billingAddress: e.target.value })} /></label>
              <button className="primary-button">Create and select</button>
            </form>
          </aside>
        </div>
      ) : null}

      <p>{message}</p>

      <section className="panel">
        <div className="table-controls">
          <SearchField placeholder={`Search ${isSales ? "invoice number or customer" : "bill number or supplier"}`} value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
          {search ? <button className="secondary-button" onClick={() => { setSearch(""); setPage(1); }}>Clear Filters</button> : null}
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th><TableSortHeader label="Reference" sortKey="reference" currentKey={sortKey} sortDir={sortDir} onSort={sort} /></th>
                <th><TableSortHeader label={partyLabel} sortKey="party" currentKey={sortKey} sortDir={sortDir} onSort={sort} /></th>
                <th><TableSortHeader label="Date" sortKey="date" currentKey={sortKey} sortDir={sortDir} onSort={sort} /></th>
                <th className="col-num"><TableSortHeader label="Total" sortKey="total" currentKey={sortKey} sortDir={sortDir} onSort={sort} /></th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((d) => (
                  <tr key={d.id} onClick={() => { window.location.href = `${base}/${d.id}`; }}>
                    <td><strong>{isSales ? d.invoiceNumber : d.billNumber}</strong></td>
                    <td>{isSales ? d.customer.name : d.supplier.name}</td>
                    <td>{new Date(isSales ? d.issueDate : d.billDate).toLocaleDateString()}</td>
                    <td className="col-num"><MoneyAmount value={totalOf(d)} /></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <OverflowMenu items={[
                        { label: "View", onClick: () => { window.location.href = `${base}/${d.id}`; } },
                        { label: "Edit", onClick: () => edit(d) },
                        { label: "Record payment", onClick: () => { window.location.href = `/payments?kind=${isSales ? "customer" : "supplier"}&partyId=${isSales ? d.customerId : d.supplierId}`; } },
                        { label: "Delete", danger: true, onClick: () => setPendingDelete(d) },
                      ]} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {!pageItems.length ? (
          <EmptyState
            icon="document"
            title={`No ${isSales ? "invoices" : "bills"} yet`}
            description={`Record your first ${isSales ? "invoice" : "bill"} to track balances and payments.`}
            actionLabel={`+ New ${isSales ? "invoice" : "bill"}`}
            onAction={openNew}
          />
        ) : null}
        <TablePagination page={page} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPageChange={setPage} />
      </section>

      {pendingDelete ? (
        <ConfirmDialog
          title={`Delete ${isSales ? "invoice" : "bill"}?`}
          message={`This will permanently delete ${isSales ? pendingDelete.invoiceNumber : pendingDelete.billNumber}, reverse stock movements, and delete the journal entry. This cannot be undone.`}
          confirmLabel={deleting ? "Deleting..." : "Delete"}
          danger
          onCancel={() => !deleting && setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </main>
  );
}
