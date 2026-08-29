"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { apiRequest } from "../../lib/api-client";
import { useEffect, useMemo, useState } from "react";
import OverflowMenu from "../../components/overflow-menu";
import ConfirmDialog from "../../components/confirm-dialog";
import TablePagination from "../../components/table-pagination";
import TableSortHeader from "../../components/table-sort-header";
import SearchField from "../../components/search-field";
import StatusBadge from "../../components/status-badge";
import MoneyAmount, { NumAmount } from "../../components/money-amount";
import EmptyState from "../../components/empty-state";
import { usePagination } from "../../lib/use-pagination";

const empty = { type: "GOOD", name: "", unitCost: "", unitPrice: "", productCode: "", description: "" };

export default function ItemsPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>(empty);
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirm, setConfirm] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [sortKey, setSortKey] = useState<"name" | "code" | "type" | "quantity" | "price">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [saving, setSaving] = useState(false);

  const request = (path: string, options: RequestInit = {}) => apiRequest(path, getToken, options);

  const load = async () => {
    try {
      setItems(await request("/items"));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to load products");
    }
  };

  useEffect(() => {
    if (isLoaded && isSignedIn) void load();
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (showForm) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [showForm]);

  const close = () => {
    setEditing(null);
    setForm(empty);
    setShowForm(false);
  };

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setShowForm(true);
  };

  const edit = (i: any) => {
    setEditing(i);
    setForm({ type: i.type, name: i.name, unitCost: i.unitCost ?? "", unitPrice: i.unitPrice ?? "", productCode: i.productCode ?? "", description: i.description ?? "" });
    setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await request(editing ? `/items/${editing.id}` : "/items", { method: editing ? "PATCH" : "POST", body: JSON.stringify({ ...form, quantityOnHand: 0, unitCost: form.unitCost ? Number(form.unitCost) : null, unitPrice: form.unitPrice ? Number(form.unitPrice) : null }) });
      close();
      await load();
      setMessage("Product saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save product");
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    try {
      await request(`/items/${confirm.id}`, { method: "PATCH", body: JSON.stringify({ isActive: false }) });
      setConfirm(null);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to deactivate product");
    }
  };

  const activate = async (i: any) => {
    try {
      await request(`/items/${i.id}`, { method: "PATCH", body: JSON.stringify({ isActive: true }) });
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to activate product");
    }
  };

  const visible = useMemo(() => items.filter((i) => `${i.name} ${i.productCode}`.toLowerCase().includes(search.toLowerCase()) && (type === "ALL" || i.type === type) && (status === "ALL" || (status === "ACTIVE" ? i.isActive : !i.isActive))).sort((a, b) => {
    const value = (i: any) => sortKey === "name" ? i.name.toLowerCase() : sortKey === "code" ? i.productCode.toLowerCase() : sortKey === "type" ? i.type : sortKey === "quantity" ? Number(i.quantityOnHand || 0) : Number(i.unitPrice || 0);
    const av = value(a), bv = value(b);
    return (av < bv ? -1 : av > bv ? 1 : 0) * (sortDir === "asc" ? 1 : -1);
  }), [items, search, type, status, sortKey, sortDir]);

  const { page, setPage, totalPages, pageItems, totalItems, pageSize } = usePagination(visible);

  const sort = (k: string) => {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k as typeof sortKey); setSortDir("asc"); }
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setType("ALL");
    setStatus("ALL");
    setPage(1);
  };

  const hasFilters = Boolean(search || type !== "ALL" || status !== "ALL");

  if (!isLoaded) return <main className="panel">Loading...</main>;
  if (!isSignedIn) return <main className="panel"><Link href="/">Sign in</Link></main>;

  return (
    <main className="content-stack">
      <div className="page-heading">
        <div>
          <h1>Products</h1>
          <p>Review goods and services. Stock changes belong in Stock Ledger.</p>
        </div>
        <button className="primary-button" onClick={openNew}>+ New product</button>
      </div>

      {showForm ? (
        <section className="panel form-panel">
          <div className="toolbar-row">
            <h2>{editing ? "Edit product" : "New product"}</h2>
            <button className="icon-button" onClick={close}>×</button>
          </div>
          <form className="form-grid" onSubmit={save}>
            <label className="field">Item type<select disabled={Boolean(editing)} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="GOOD">Good</option><option value="SERVICE">Service</option></select></label>
            <label className="field">Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="field">Unit cost<input type="number" min="0" step="0.01" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} /></label>
            <label className="field">Unit price<input type="number" min="0" step="0.01" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} /></label>
            <label className="field">Product code<input placeholder="Generated if blank" value={form.productCode} onChange={(e) => setForm({ ...form, productCode: e.target.value })} /></label>
            <label className="field full-width">Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <div className="form-actions">
              <button className="primary-button" disabled={saving}>{saving ? "Saving" : "Save"}</button>
              <button type="button" className="secondary-button" onClick={close}>Cancel</button>
            </div>
          </form>
        </section>
      ) : null}

      <p>{message}</p>

      <section className="panel">
        <div className="table-controls">
          <SearchField placeholder="Search products or codes" value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
          <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
            <option value="ALL">All types</option>
            <option value="GOOD">Goods</option>
            <option value="SERVICE">Services</option>
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active only</option>
            <option value="INACTIVE">Inactive only</option>
          </select>
          {hasFilters ? <button className="secondary-button" onClick={clearFilters}>Clear Filters</button> : null}
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th><TableSortHeader label="Product" sortKey="name" currentKey={sortKey} sortDir={sortDir} onSort={sort} /></th>
                <th><TableSortHeader label="Code" sortKey="code" currentKey={sortKey} sortDir={sortDir} onSort={sort} /></th>
                <th><TableSortHeader label="Type" sortKey="type" currentKey={sortKey} sortDir={sortDir} onSort={sort} /></th>
                <th className="col-num"><TableSortHeader label="Quantity" sortKey="quantity" currentKey={sortKey} sortDir={sortDir} onSort={sort} /></th>
                <th className="col-num"><TableSortHeader label="Price" sortKey="price" currentKey={sortKey} sortDir={sortDir} onSort={sort} /></th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((i) => (
                <tr key={i.id} onClick={() => { window.location.href = `/items/${i.id}`; }}>
                  <td><strong>{i.name}</strong></td>
                  <td>{i.productCode}</td>
                  <td>{i.type}</td>
                  <td className="col-num">{i.type === "GOOD" ? <NumAmount value={i.quantityOnHand ?? 0} /> : "—"}</td>
                  <td className="col-num"><MoneyAmount value={i.unitPrice} /></td>
                  <td><StatusBadge active={i.isActive} /></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <OverflowMenu items={[
                      { label: "View", onClick: () => { window.location.href = `/items/${i.id}`; } },
                      { label: "Edit", onClick: () => edit(i) },
                      ...(i.type === "GOOD" && i.isActive ? [{ label: "Add stock", onClick: () => { window.location.href = `/items/${i.id}?addStock=1`; } }] : []),
                      ...(i.isActive ? [{ label: "Deactivate", danger: true, onClick: () => setConfirm(i) }] : [{ label: "Activate", onClick: () => activate(i) }]),
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!pageItems.length ? (
          <EmptyState icon="box" title="No products yet" description="Add goods and services to use them on invoices and bills." actionLabel="+ New product" onAction={openNew} />
        ) : null}
        <TablePagination page={page} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPageChange={setPage} />
      </section>

      {confirm ? <ConfirmDialog title="Deactivate product?" message={`${confirm.name} will remain available in historical records.`} confirmLabel="Deactivate" danger onCancel={() => setConfirm(null)} onConfirm={() => void deactivate()} /> : null}
    </main>
  );
}
