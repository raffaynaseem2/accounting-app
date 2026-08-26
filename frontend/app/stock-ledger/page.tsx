"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { apiRequest } from "../../lib/api-client";
import { useEffect, useMemo, useState } from "react";
import OverflowMenu from "../../components/overflow-menu";
import TablePagination from "../../components/table-pagination";
import TableSortHeader from "../../components/table-sort-header";
import SearchField from "../../components/search-field";
import { NumAmount } from "../../components/money-amount";
import EmptyState from "../../components/empty-state";
import { usePagination } from "../../lib/use-pagination";

const today = () => new Date().toISOString().slice(0, 10);

export default function StockLedgerPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [movements, setMovements] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ itemId: "", quantity: "", reason: "PURCHASE", referenceId: "", date: today() });
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("ALL");
  const [productFilter, setProductFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [message, setMessage] = useState("");

  const request = (path: string, options: RequestInit = {}) => apiRequest(path, getToken, options);

  const load = async () => {
    try {
      const [movementResult, itemResult] = await Promise.allSettled([request("/items/movements"), request("/items")]);
      if (movementResult.status === "fulfilled") setMovements(movementResult.value);
      if (itemResult.status === "fulfilled") setItems(itemResult.value.filter((x: any) => x.type === "GOOD" && x.isActive));
      const failed = [movementResult, itemResult].find((result) => result.status === "rejected");
      if (failed?.status === "rejected") setMessage(failed.reason instanceof Error ? failed.reason.message : "Some stock data could not be loaded");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load stock ledger");
    }
  };

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      const productId = new URLSearchParams(window.location.search).get("productId");
      if (productId) setProductFilter(productId);
      void load();
    }
  }, [isLoaded, isSignedIn]);

  const close = () => {
    setShowForm(false);
    setForm({ itemId: "", quantity: "", reason: "PURCHASE", referenceId: "", date: today() });
  };

  const record = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await request(`/items/${form.itemId}/movements`, { method: "POST", body: JSON.stringify({ quantity: Number(form.quantity), reason: form.reason, referenceId: form.referenceId || undefined }) });
      close();
      await load();
      setMessage("Stock movement recorded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to record movement");
    }
  };

  const visible = useMemo(() => movements.filter((m) => {
    const day = m.createdAt.slice(0, 10);
    return `${m.item.name} ${m.item.productCode} ${m.referenceId ?? ""}`.toLowerCase().includes(search.toLowerCase()) && (reason === "ALL" || m.reason === reason) && (!productFilter || m.itemId === productFilter) && (!dateFrom || day >= dateFrom) && (!dateTo || day <= dateTo);
  }).sort((a, b) => {
    const result = Date.parse(a.createdAt) - Date.parse(b.createdAt);
    return sortDir === "asc" ? result : -result;
  }), [movements, search, reason, productFilter, dateFrom, dateTo, sortDir]);

  const { page, setPage, totalPages, pageItems, totalItems, pageSize } = usePagination(visible);

  const sort = (key: string) => {
    if (key === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setReason("ALL");
    setProductFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const hasFilters = Boolean(search || reason !== "ALL" || productFilter || dateFrom || dateTo);

  if (!isLoaded) return <main className="panel">Loading...</main>;
  if (!isSignedIn) return <main className="panel"><Link href="/">Sign in</Link></main>;

  return (
    <main className="content-stack">
      <div className="page-heading">
        <div>
          <h1>Stock Ledger</h1>
          <p>Review how goods quantity changed over time.</p>
        </div>
        <button className="primary-button" onClick={() => setShowForm(true)}>+ Add stock movement</button>
      </div>

      {showForm ? (
        <section className="panel form-panel">
          <div className="toolbar-row">
            <h2>Add stock movement</h2>
            <button className="icon-button" onClick={close} aria-label="Close form">×</button>
          </div>
          <form className="form-grid" onSubmit={record}>
            <label className="field">Product<select required value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })}><option value="">Select a good</option>{items.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.productCode}</option>)}</select></label>
            <label className="field">Movement type<select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}><option value="OPENING_BALANCE">Opening stock</option><option value="PURCHASE">Purchase</option><option value="SALE">Sale</option><option value="MANUAL_ADJUSTMENT">Manual adjustment</option></select></label>
            <label className="field">Date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            <label className="field">Quantity<input required type="number" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label>
            <label className="field">Reference<input value={form.referenceId} onChange={(e) => setForm({ ...form, referenceId: e.target.value })} /></label>
            <div className="form-actions">
              <button className="primary-button">Record movement</button>
              <button type="button" className="secondary-button" onClick={close}>Cancel</button>
            </div>
          </form>
        </section>
      ) : null}

      <p>{message}</p>

      <section className="panel">
        <div className="table-controls">
          <SearchField placeholder="Search product or reference" value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
          <select value={productFilter} onChange={(e) => { setProductFilter(e.target.value); setPage(1); }}>
            <option value="">All products</option>
            {items.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <select value={reason} onChange={(e) => { setReason(e.target.value); setPage(1); }}>
            <option value="ALL">All movement types</option>
            <option value="OPENING_BALANCE">Opening stock</option>
            <option value="PURCHASE">Purchase</option>
            <option value="SALE">Sale</option>
            <option value="MANUAL_ADJUSTMENT">Manual adjustment</option>
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
                <th>Product</th>
                <th>Reason</th>
                <th className="col-num">Quantity</th>
                <th>Reference</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((m) => (
                <tr key={m.id} onClick={() => { window.location.href = `/items/${m.itemId}`; }}>
                  <td>{new Date(m.createdAt).toLocaleDateString()}</td>
                  <td>{m.item.name}</td>
                  <td>{m.reason.replaceAll("_", " ")}</td>
                  <td className="col-num"><NumAmount value={m.quantity} /></td>
                  <td>{m.referenceId ?? "—"}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <OverflowMenu items={[
                      { label: "View product", onClick: () => { window.location.href = `/items/${m.itemId}`; } },
                      ...(m.reason === "PURCHASE" && m.referenceId ? [{ label: "Open bill", onClick: () => { window.location.href = `/purchase-bills/${m.referenceId}`; } }] : []),
                      ...(m.reason === "SALE" && m.referenceId ? [{ label: "Open invoice", onClick: () => { window.location.href = `/sales-invoices/${m.referenceId}`; } }] : []),
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!pageItems.length ? (
          <EmptyState icon="box" title="No stock movements yet" description="Record opening stock, purchases, or adjustments to track inventory." actionLabel="+ Add stock movement" onAction={() => setShowForm(true)} />
        ) : null}
        <TablePagination page={page} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPageChange={setPage} />
      </section>
    </main>
  );
}
