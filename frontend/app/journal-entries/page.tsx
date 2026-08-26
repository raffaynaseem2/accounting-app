"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { apiRequest } from "../../lib/api-client";
import { useEffect, useMemo, useRef, useState } from "react";
import OverflowMenu from "../../components/overflow-menu";
import TablePagination from "../../components/table-pagination";
import TableSortHeader from "../../components/table-sort-header";
import SearchField from "../../components/search-field";
import MoneyAmount from "../../components/money-amount";
import EmptyState from "../../components/empty-state";
import ConfirmDialog from "../../components/confirm-dialog";
import { usePagination } from "../../lib/use-pagination";
import {
  sourceFromJournalEntry,
  transactionDeleteLabel,
  transactionDeletePath,
  transactionEditPath,
} from "../../lib/transaction-actions";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const today = () => new Date().toISOString().slice(0, 10);
type Line = { accountId: string; customerId: string; supplierId: string; side: "DEBIT" | "CREDIT"; amount: string };
const blank = (side: Line["side"] = "DEBIT"): Line => ({ accountId: "", customerId: "", supplierId: "", side, amount: "" });
const totalOf = (e: any) => e.lines.reduce((sum: number, l: any) => sum + Number(l.amount || 0), 0);

export default function JournalEntriesPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today());
  const [lines, setLines] = useState<Line[]>([blank(), blank("CREDIT")]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<"date" | "description" | "total">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pendingDelete, setPendingDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const editHandled = useRef(false);

  const request = (path: string, options: RequestInit = {}) => apiRequest(path, getToken, options);

  const load = async () => {
    try {
      const [accountsResult, customersResult, suppliersResult, entriesResult] = await Promise.allSettled([request("/accounts"), request("/customers"), request("/suppliers"), request("/journal-entries")]);
      if (accountsResult.status === "fulfilled") setAccounts(accountsResult.value.filter((x: any) => x.isActive));
      if (customersResult.status === "fulfilled") setCustomers(customersResult.value.filter((x: any) => x.isActive));
      if (suppliersResult.status === "fulfilled") setSuppliers(suppliersResult.value.filter((x: any) => x.isActive));
      if (entriesResult.status === "fulfilled") setEntries(entriesResult.value);
      const failed = [accountsResult, customersResult, suppliersResult, entriesResult].find((result) => result.status === "rejected");
      if (failed?.status === "rejected") setMessage(failed.reason instanceof Error ? failed.reason.message : "Some journal data could not be loaded");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load journal");
    }
  };

  useEffect(() => {
    if (isLoaded && isSignedIn) void load();
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    const editId = new URLSearchParams(window.location.search).get("edit");
    if (!editId || editHandled.current || !entries.length) return;
    const entry = entries.find((e) => e.id === editId);
    if (entry) {
      editHandled.current = true;
      openEntry(entry);
    }
  }, [entries]);

  useEffect(() => {
    if (showForm) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [showForm]);

  const close = () => {
    setShowForm(false);
    setEditingId(null);
    setDescription("");
    setDate(today());
    setLines([blank(), blank("CREDIT")]);
  };

  const openNew = () => {
    close();
    setShowForm(true);
  };

  const openEntry = (e: any) => {
    const source = sourceFromJournalEntry(e);
    const editPath = transactionEditPath(source);
    if (editPath && editPath !== `/journal-entries?edit=${e.id}`) {
      window.location.href = editPath;
      return;
    }
    setShowForm(true);
    setEditingId(e.id);
    setDescription(e.description);
    setDate(e.entryDate.slice(0, 10));
    setLines(e.lines.map((l: any) => ({ accountId: l.accountId, customerId: l.customerId ?? "", supplierId: l.supplierId ?? "", side: l.side, amount: String(l.amount) })));
  };

  const edit = (e: any) => openEntry(e);

  const totals = lines.reduce((r, l) => { r[l.side] += Number(l.amount) || 0; return r; }, { DEBIT: 0, CREDIT: 0 });

  const visible = useMemo(() => entries.filter((e) => {
    const day = e.entryDate.slice(0, 10);
    return e.description.toLowerCase().includes(search.toLowerCase()) && (!dateFrom || day >= dateFrom) && (!dateTo || day <= dateTo) && (!accountFilter || e.lines.some((l: any) => l.accountId === accountFilter));
  }).sort((a, b) => {
    const av = sortKey === "date" ? Date.parse(a.entryDate) : sortKey === "description" ? a.description.toLowerCase() : totalOf(a);
    const bv = sortKey === "date" ? Date.parse(b.entryDate) : sortKey === "description" ? b.description.toLowerCase() : totalOf(b);
    const result = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? result : -result;
  }), [entries, search, accountFilter, dateFrom, dateTo, sortKey, sortDir]);

  const { page, setPage, totalPages, pageItems, totalItems, pageSize } = usePagination(visible);

  const sort = (key: string) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key as typeof sortKey); setSortDir("asc"); }
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setAccountFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const hasFilters = Boolean(search || accountFilter || dateFrom || dateTo);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await request(editingId ? `/journal-entries/${editingId}` : "/journal-entries", { method: editingId ? "PATCH" : "POST", body: JSON.stringify({ description, entryDate: date, lines: lines.map((l) => ({ ...l, customerId: l.customerId || null, supplierId: l.supplierId || null, amount: Number(l.amount) })) }) });
      close();
      await load();
      setMessage("Journal entry saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save journal entry");
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      const source = sourceFromJournalEntry(pendingDelete);
      await request(transactionDeletePath(source), { method: "DELETE" });
      setPendingDelete(null);
      await load();
      setMessage(`${transactionDeleteLabel(source)} deleted.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete entry");
    } finally {
      setDeleting(false);
    }
  };

  const isManualEntry = (e: any) => !e.sourceType;

  if (!isLoaded) return <main className="panel">Loading...</main>;
  if (!isSignedIn) return <main className="panel"><Link href="/">Sign in</Link></main>;

  return (
    <main className="content-stack">
      <div className="page-heading">
        <div>
          <h1>Journal</h1>
          <p>Review manual accounting entries.</p>
        </div>
        <button className="primary-button" onClick={openNew}>+ New journal entry</button>
      </div>

      {showForm ? (
        <section className="panel form-panel">
          <div className="toolbar-row">
            <h2>{editingId ? "Edit journal entry" : "New journal entry"}</h2>
            <button className="icon-button" onClick={close} aria-label="Close form">×</button>
          </div>
          <form className="form-grid" onSubmit={submit}>
            <label className="field">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <label className="field full-width">Description<input required value={description} onChange={(e) => setDescription(e.target.value)} /></label>
            {lines.map((line, index) => {
              const account = accounts.find((a) => a.id === line.accountId);
              return (
                <div className="line-item" key={index}>
                  <label className="field line-account">Account<select required value={line.accountId} onChange={(e) => setLines(lines.map((l, i) => i === index ? { ...l, accountId: e.target.value, customerId: "", supplierId: "" } : l))}><option value="">Select account</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.type}</option>)}</select></label>
                  {account?.subledgerType === "CUSTOMER" ? <label className="field">Customer<select required value={line.customerId} onChange={(e) => setLines(lines.map((l, i) => i === index ? { ...l, customerId: e.target.value } : l))}><option value="">Select customer</option>{customers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label> : account?.subledgerType === "SUPPLIER" ? <label className="field">Supplier<select required value={line.supplierId} onChange={(e) => setLines(lines.map((l, i) => i === index ? { ...l, supplierId: e.target.value } : l))}><option value="">Select supplier</option>{suppliers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label> : null}
                  <label className="field">Side<select value={line.side} onChange={(e) => setLines(lines.map((l, i) => i === index ? { ...l, side: e.target.value as Line["side"] } : l))}><option value="DEBIT">Debit</option><option value="CREDIT">Credit</option></select></label>
                  <label className="field">Amount<input required type="number" min="0.01" step="0.01" value={line.amount} onChange={(e) => setLines(lines.map((l, i) => i === index ? { ...l, amount: e.target.value } : l))} /></label>
                  <button className="icon-button" type="button" onClick={() => lines.length > 2 && setLines(lines.filter((_, i) => i !== index))}>×</button>
                </div>
              );
            })}
            <div className="toolbar-row">
              <strong>Debit <MoneyAmount value={totals.DEBIT} /> · Credit <MoneyAmount value={totals.CREDIT} /> · Difference <MoneyAmount value={Math.abs(totals.DEBIT - totals.CREDIT)} /></strong>
              <button type="button" className="secondary-button" onClick={() => setLines([...lines, blank()])}>+ Add line</button>
            </div>
            <div className="form-actions">
              <button className="primary-button" disabled={totals.DEBIT <= 0 || totals.DEBIT !== totals.CREDIT}>{totals.DEBIT > 0 && totals.DEBIT === totals.CREDIT ? "Save journal entry" : "Entry must balance"}</button>
              <button type="button" className="secondary-button" onClick={close}>Cancel</button>
            </div>
          </form>
        </section>
      ) : null}

      <p>{message}</p>

      <section className="panel">
        <div className="table-controls">
          <SearchField placeholder="Search descriptions" value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
          <select value={accountFilter} onChange={(e) => { setAccountFilter(e.target.value); setPage(1); }}>
            <option value="">All accounts</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <label className="field compact-field">From<input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} /></label>
          <label className="field compact-field">To<input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} /></label>
          {hasFilters ? <button className="secondary-button" onClick={clearFilters}>Clear Filters</button> : null}
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th><TableSortHeader label="Date" sortKey="date" currentKey={sortKey} sortDir={sortDir} onSort={sort} /></th>
                <th><TableSortHeader label="Description" sortKey="description" currentKey={sortKey} sortDir={sortDir} onSort={sort} /></th>
                <th>Accounts</th>
                <th className="col-num text-right"><TableSortHeader label="Total amount" sortKey="total" currentKey={sortKey} sortDir={sortDir} onSort={sort} /></th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((e) => (
                <tr key={e.id} onClick={() => openEntry(e)}>
                  <td>{new Date(e.entryDate).toLocaleDateString()}</td>
                  <td><strong>{e.description}</strong></td>
                  <td>{e.lines.map((l: any) => l.account?.name ?? accounts.find((a) => a.id === l.accountId)?.name).filter(Boolean).slice(0, 3).join(", ")}</td>
                  <td className="col-num"><MoneyAmount value={totalOf(e)} /></td>
                  <td onClick={(ev) => ev.stopPropagation()}>
                    <OverflowMenu items={[
                      ...(isManualEntry(e) ? [{ label: "Edit", onClick: () => edit(e) }] : [{ label: "Edit source", onClick: () => openEntry(e) }]),
                      { label: "Delete", danger: true, onClick: () => setPendingDelete(e) },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!pageItems.length ? (
          <EmptyState icon="journal" title="No journal entries yet" description="Post manual debits and credits to adjust your books." actionLabel="+ New journal entry" onAction={openNew} />
        ) : null}
        <TablePagination page={page} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPageChange={setPage} />
      </section>

      {pendingDelete ? (
        <ConfirmDialog
          title={`Delete ${transactionDeleteLabel(sourceFromJournalEntry(pendingDelete))}?`}
          message="This will permanently reverse all linked effects including stock, balances, and payments. This cannot be undone."
          confirmLabel={deleting ? "Deleting..." : "Delete"}
          danger
          onCancel={() => !deleting && setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </main>
  );
}
