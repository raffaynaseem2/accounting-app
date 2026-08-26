"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import OverflowMenu from "./overflow-menu";
import ConfirmDialog from "./confirm-dialog";
import TablePagination from "./table-pagination";
import TableSortHeader from "./table-sort-header";
import SearchField from "./search-field";
import StatusBadge from "./status-badge";
import MoneyAmount from "./money-amount";
import EmptyState from "./empty-state";
import { usePagination } from "../lib/use-pagination";
import { apiRequest } from "../lib/api-client";

type Kind = "customers" | "suppliers";
const empty = { name: "", contactEmail: "", contactPhone: "", billingAddress: "" };

export default function PartyManager({ kind }: { kind: Kind }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const label = kind === "customers" ? "Customer" : "Supplier";
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState(empty as any);
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirm, setConfirm] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const request = (path: string, options: RequestInit = {}) => apiRequest(path, getToken, options);

  const load = async () => {
    try {
      const data = await request(`/${kind}`);
      setRows(await Promise.all(data.map(async (p: any) => ({ ...p, balance: await request(`/${kind}/${p.id}/balance`) }))));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : `Unable to load ${kind}`);
    }
  };

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      if (new URLSearchParams(window.location.search).get("new") === "1") setShowForm(true);
      void load();
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (showForm) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [showForm]);

  const close = () => {
    setEditing(null);
    setForm(empty as any);
    setShowForm(false);
  };

  const openNew = () => {
    setEditing(null);
    setForm(empty as any);
    setShowForm(true);
  };

  const edit = (p: any) => {
    setEditing(p);
    setForm({ name: p.name, contactEmail: p.contactEmail ?? "", contactPhone: p.contactPhone ?? "", billingAddress: p.billingAddress ?? "" });
    setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await request(editing ? `/${kind}/${editing.id}` : `/${kind}`, { method: editing ? "PATCH" : "POST", body: JSON.stringify(form) });
      close();
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : `Unable to save ${label}`);
    }
  };

  const deactivate = async () => {
    try {
      await request(`/${kind}/${confirm.id}`, { method: "PATCH", body: JSON.stringify({ isActive: false }) });
      setConfirm(null);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : `Unable to deactivate ${label}`);
    }
  };

  const activate = async (p: any) => {
    try {
      await request(`/${kind}/${p.id}`, { method: "PATCH", body: JSON.stringify({ isActive: true }) });
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : `Unable to activate ${label}`);
    }
  };

  const filteredSorted = useMemo(() => rows.filter((p) => `${p.name} ${p.contactEmail ?? ""} ${p.contactPhone ?? ""}`.toLowerCase().includes(search.toLowerCase()) && (status === "ALL" || (status === "ACTIVE" ? p.isActive : !p.isActive))).sort((a, b) => {
    const value = (p: any) => sortKey === "name" ? p.name.toLowerCase() : sortKey === "email" ? (p.contactEmail ?? "").toLowerCase() : Number(p.balance || 0);
    const av = value(a), bv = value(b);
    return (av < bv ? -1 : av > bv ? 1 : 0) * (sortDir === "asc" ? 1 : -1);
  }), [rows, search, status, sortKey, sortDir]);

  const { page, setPage, totalPages, pageItems: pageRows, totalItems, pageSize } = usePagination(filteredSorted);

  const sort = (k: string) => {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("ALL");
    setPage(1);
  };

  const hasFilters = Boolean(search || status !== "ALL");

  if (!isLoaded) return <main className="panel">Loading...</main>;
  if (!isSignedIn) return <main className="panel"><Link href="/">Sign in</Link></main>;

  return (
    <main className="content-stack">
      <div className="page-heading">
        <div>
          <h1>{label}s</h1>
          <p>Find, open, and manage your {kind}.</p>
        </div>
        <button className="primary-button" onClick={openNew}>+ New {label}</button>
      </div>

      {showForm ? (
        <section className="panel form-panel">
          <div className="toolbar-row">
            <h2>{editing ? "Edit" : "New"} {label}</h2>
            <button className="icon-button" onClick={close}>×</button>
          </div>
          <form className="form-grid" onSubmit={save}>
            <label className="field">Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="field">Email<input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></label>
            <label className="field">Phone<input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></label>
            <label className="field full-width">Billing address<textarea value={form.billingAddress} onChange={(e) => setForm({ ...form, billingAddress: e.target.value })} /></label>
            <div className="form-actions"><button className="primary-button">Save</button><button type="button" className="secondary-button" onClick={close}>Cancel</button></div>
          </form>
        </section>
      ) : null}

      <p>{message}</p>

      <section className="panel">
        <div className="table-controls">
          <SearchField placeholder="Search name, email, or phone" value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
          <div className="chip-row">
            <button className={status === "ALL" ? "filter-chip active" : "filter-chip"} onClick={() => { setStatus("ALL"); setPage(1); }}>All</button>
            <button className={status === "ACTIVE" ? "filter-chip active" : "filter-chip"} onClick={() => { setStatus("ACTIVE"); setPage(1); }}>Active</button>
            <button className={status === "INACTIVE" ? "filter-chip active" : "filter-chip"} onClick={() => { setStatus("INACTIVE"); setPage(1); }}>Inactive</button>
            {hasFilters ? <button className="secondary-button" onClick={clearFilters}>Clear Filters</button> : null}
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th><TableSortHeader label="Name" sortKey="name" currentKey={sortKey} sortDir={sortDir} onSort={sort} /></th>
                <th><TableSortHeader label="Email" sortKey="email" currentKey={sortKey} sortDir={sortDir} onSort={sort} /></th>
                <th>Phone</th>
                <th className="col-num"><TableSortHeader label="Balance" sortKey="balance" currentKey={sortKey} sortDir={sortDir} onSort={sort} /></th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((p) => (
                <tr key={p.id} onClick={() => { window.location.href = `/${kind}/${p.id}`; }}>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.contactEmail || "—"}</td>
                  <td>{p.contactPhone || "—"}</td>
                  <td className="col-num"><MoneyAmount value={p.balance} /></td>
                  <td><StatusBadge active={p.isActive} /></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <OverflowMenu items={[
                      { label: "View", onClick: () => { window.location.href = `/${kind}/${p.id}`; } },
                      { label: "Edit", onClick: () => edit(p) },
                      ...(p.isActive ? [{ label: "Deactivate", danger: true, onClick: () => setConfirm(p) }] : [{ label: "Activate", onClick: () => activate(p) }]),
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <TablePagination page={page} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPageChange={setPage} />
        {!pageRows.length ? (
          <EmptyState
            icon="users"
            title={`No ${kind} yet`}
            description={`Create your first ${label.toLowerCase()} to start tracking balances and documents.`}
            actionLabel={`+ New ${label}`}
            onAction={openNew}
          />
        ) : null}
      </section>

      {confirm ? <ConfirmDialog title={`Deactivate ${label}?`} message="The record remains available in historical records." confirmLabel="Deactivate" danger onCancel={() => setConfirm(null)} onConfirm={() => void deactivate()} /> : null}
    </main>
  );
}
