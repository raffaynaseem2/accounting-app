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
import AccountBalanceAmount from "./account-balance-amount";
import EmptyState from "./empty-state";
import { usePagination } from "../lib/use-pagination";
import { displayAccountBalance } from "../lib/account-balance";
import { apiRequest } from "../lib/api-client";

const empty = { name: "", code: "", type: "ASSET" };

export default function AccountManager() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirm, setConfirm] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [saving, setSaving] = useState(false);

  const request = (path: string, options: RequestInit = {}) => apiRequest(path, getToken, options);

  const load = async () => {
    try {
      const data = await request("/accounts/with-balances");
      const accountList = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : null;
      if (!accountList) {
        console.error("[ACCOUNTS RESPONSE SHAPE ERROR]", { data, dataType: typeof data });
        throw new Error("Accounts response was not a list.");
      }
      setAccounts(accountList);
    } catch (e) {
      console.error("[ACCOUNTS LOAD FAILED]", e);
      setMessage(e instanceof Error ? e.message : "Unable to load accounts");
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
    setForm(empty);
    setShowForm(false);
  };

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setShowForm(true);
  };

  const edit = (a: any) => {
    setEditing(a);
    setForm({ name: a.name, code: a.code ?? "", type: a.type });
    setShowForm(true);
  };

  const deactivate = async () => {
    try {
      await request(`/accounts/${confirm.id}`, { method: "PATCH", body: JSON.stringify({ isActive: false }) });
      setConfirm(null);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to deactivate account");
    }
  };

  const activate = async (a: any) => {
    try {
      await request(`/accounts/${a.id}`, { method: "PATCH", body: JSON.stringify({ isActive: true }) });
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to activate account");
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await request(editing ? `/accounts/${editing.id}` : "/accounts", { method: editing ? "PATCH" : "POST", body: JSON.stringify(form) });
      close();
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save account");
    } finally {
      setSaving(false);
    }
  };

  const visible = useMemo(
    () =>
      accounts
        .filter((a) => `${a.name} ${a.code ?? ""}`.toLowerCase().includes(search.toLowerCase()) && (typeFilter === "ALL" || a.type === typeFilter) && (statusFilter === "ALL" || (statusFilter === "ACTIVE" ? a.isActive : !a.isActive)))
        .sort((a, b) => {
          const value = (x: any) => sortKey === "name" ? x.name.toLowerCase() : sortKey === "code" ? (x.code ?? "").toLowerCase() : sortKey === "type" ? x.type : displayAccountBalance(x.balance, x.type);
          const av = value(a), bv = value(b);
          return (av < bv ? -1 : av > bv ? 1 : 0) * (sortDir === "asc" ? 1 : -1);
        }),
    [accounts, search, typeFilter, statusFilter, sortKey, sortDir],
  );

  const { page, setPage, totalPages, pageItems, totalItems, pageSize } = usePagination(visible);

  const sort = (k: string) => {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("ALL");
    setStatusFilter("ALL");
    setPage(1);
  };

  const hasFilters = Boolean(search || typeFilter !== "ALL" || statusFilter !== "ALL");
  const types = ["ALL", "ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];

  if (!isLoaded) return <main className="panel">Loading...</main>;
  if (!isSignedIn) return <main className="panel"><Link href="/">Sign in</Link></main>;

  return (
    <main className="content-stack">
      <div className="page-heading">
        <div>
          <h1>Chart of Accounts</h1>
          <p>Review account balances and ledgers.</p>
        </div>
        <button className="primary-button" onClick={openNew}>
          + New account
        </button>
      </div>

      {showForm ? (
        <section className="panel form-panel">
          <div className="toolbar-row">
            <h2>{editing ? "Edit" : "New"} account</h2>
            <button className="icon-button" onClick={close}>
              ×
            </button>
          </div>
          <form className="form-grid" onSubmit={save}>
            <label className="field">Name
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="field">Code
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </label>
            <label className="field">Type
              <select disabled={Boolean(editing)} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {types.slice(1).map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
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
          <SearchField placeholder="Search account name or code" value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
          <div className="chip-row">
            {types.map((x) => (
              <button key={x} className={typeFilter === x ? "filter-chip active" : "filter-chip"} onClick={() => { setTypeFilter(x); setPage(1); }}>
                {x === "ALL" ? "All types" : x}
              </button>
            ))}
            <button className={statusFilter === "ALL" ? "filter-chip active" : "filter-chip"} onClick={() => { setStatusFilter("ALL"); setPage(1); }}>All statuses</button>
            <button className={statusFilter === "ACTIVE" ? "filter-chip active" : "filter-chip"} onClick={() => { setStatusFilter("ACTIVE"); setPage(1); }}>Active</button>
            <button className={statusFilter === "INACTIVE" ? "filter-chip active" : "filter-chip"} onClick={() => { setStatusFilter("INACTIVE"); setPage(1); }}>Inactive</button>
            {hasFilters ? <button className="secondary-button" onClick={clearFilters}>Clear Filters</button> : null}
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th><TableSortHeader label="Name" sortKey="name" currentKey={sortKey} sortDir={sortDir} onSort={sort} /></th>
                <th><TableSortHeader label="Code" sortKey="code" currentKey={sortKey} sortDir={sortDir} onSort={sort} /></th>
                <th><TableSortHeader label="Type" sortKey="type" currentKey={sortKey} sortDir={sortDir} onSort={sort} /></th>
                <th className="col-num"><TableSortHeader label="Balance" sortKey="balance" currentKey={sortKey} sortDir={sortDir} onSort={sort} /></th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((a) => (
                <tr key={a.id} onClick={() => { window.location.href = `/accounts/${a.id}`; }}>
                  <td><strong>{a.name}</strong></td>
                  <td>{a.code || "—"}</td>
                  <td>{a.type}</td>
                  <td className="col-num"><AccountBalanceAmount rawBalance={a.balance} accountType={a.type} /></td>
                  <td><StatusBadge active={a.isActive} /></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {!a.systemKey ? (
                      <OverflowMenu items={[
                        { label: "View ledger", onClick: () => { window.location.href = `/accounts/${a.id}`; } },
                        { label: "Edit", onClick: () => edit(a) },
                        ...(a.isActive ? [{ label: "Deactivate", danger: true, onClick: () => setConfirm(a) }] : [{ label: "Activate", onClick: () => activate(a) }]),
                      ]} />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <TablePagination page={page} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPageChange={setPage} />
        {!pageItems.length ? (
          <EmptyState icon="account" title="No accounts yet" description="Add accounts to build your chart and track balances." actionLabel="+ New account" onAction={openNew} />
        ) : null}
      </section>

      {confirm ? (
        <ConfirmDialog
          title="Deactivate account?"
          message={`${confirm.name} will remain available in historical records.`}
          confirmLabel="Deactivate"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => void deactivate()}
        />
      ) : null}
    </main>
  );
}
