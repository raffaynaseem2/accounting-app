"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
import OverflowMenu from "../../components/overflow-menu";
import TablePagination from "../../components/table-pagination";
import TableSortHeader from "../../components/table-sort-header";
import SearchField from "../../components/search-field";
import { usePagination } from "../../lib/use-pagination";
import MoneyAmount from "../../components/money-amount";
import EmptyState from "../../components/empty-state";
import ConfirmDialog from "../../components/confirm-dialog";
import PaymentFormDrawer from "../../components/payment-form-drawer";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function PaymentsPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [view, setView] = useState<"customer" | "supplier">("customer");
  const [payments, setPayments] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [presetPartyId, setPresetPartyId] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pendingDelete, setPendingDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const request = async (path: string, options: RequestInit = {}) => {
    const token = await getToken({ skipCache: true });
    const response = await fetch(`${API_URL}${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message ?? "Request failed");
    return data;
  };

  const load = async () => {
    try {
      setPayments(await request("/payments"));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to load payments");
    }
  };

  useEffect(() => {
    if (isLoaded && isSignedIn) void load();
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const supplier = p.get("kind") === "supplier";
    setView(supplier ? "supplier" : "customer");
    const partyId = p.get("partyId") || "";
    setPresetPartyId(partyId);
    if (partyId || p.get("new") === "1") setShowForm(true);
  }, []);

  const isCustomer = view === "customer";

  const visible = useMemo(() => payments.filter((p) =>
    (isCustomer ? p.kind === "CUSTOMER_RECEIPT" : p.kind === "SUPPLIER_PAYMENT")
    && `${p.customer?.name ?? p.supplier?.name ?? ""} ${p.reference ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  ).sort((a, b) => {
    const av = Date.parse(a.paymentDate);
    const bv = Date.parse(b.paymentDate);
    return (av < bv ? -1 : av > bv ? 1 : 0) * (sortDir === "asc" ? 1 : -1);
  }), [payments, isCustomer, search, sortDir]);

  const { page, setPage, totalPages, pageItems, totalItems, pageSize } = usePagination(visible);

  const sort = (key: string) => {
    if (key === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      await request(`/payments/${pendingDelete.id}`, { method: "DELETE" });
      setPendingDelete(null);
      await load();
      setMessage("Payment deleted.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to delete payment");
    } finally {
      setDeleting(false);
    }
  };

  if (!isLoaded) return <main className="panel">Loading...</main>;
  if (!isSignedIn) return <main className="panel"><Link href="/">Sign in</Link></main>;

  return (
    <main className="content-stack">
      <div className="page-heading">
        <div>
          <h1>{isCustomer ? "Customer Payments" : "Supplier Payments"}</h1>
          <p>Record payments against party subledger balances.</p>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="secondary-button" onClick={() => { setView(isCustomer ? "supplier" : "customer"); setShowForm(false); }}>{isCustomer ? "Supplier payments" : "Customer payments"}</button>
          <button type="button" className="primary-button" onClick={() => { setPresetPartyId(""); setShowForm(true); }}>+ Record payment</button>
        </div>
      </div>

      <p>{message}</p>

      <section className="panel">
        <div className="table-controls">
          <SearchField placeholder="Search party or reference" value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
          {search ? <button type="button" className="secondary-button" onClick={() => { setSearch(""); setPage(1); }}>Clear Filters</button> : null}
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th><TableSortHeader label="Date" sortKey="date" currentKey={sortKey} sortDir={sortDir} onSort={sort} /></th>
                <th>Party</th>
                <th>Account</th>
                <th className="col-num">Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((p) => (
                <tr key={p.id}>
                  <td>{new Date(p.paymentDate).toLocaleDateString()}</td>
                  <td>{p.customer?.name ?? p.supplier?.name}</td>
                  <td>{p.account?.name}</td>
                  <td className="col-num"><MoneyAmount value={p.amount} /></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <OverflowMenu items={[
                      { label: "Delete", danger: true, onClick: () => setPendingDelete(p) },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!pageItems.length ? (
          <EmptyState icon="payment" title="No payments yet" description="Record a payment to reduce the party subledger balance." actionLabel="+ Record payment" onAction={() => setShowForm(true)} />
        ) : null}
        <TablePagination page={page} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPageChange={setPage} />
      </section>

      {showForm ? (
        <PaymentFormDrawer
          kind={isCustomer ? "customer" : "supplier"}
          partyId={presetPartyId}
          onClose={() => setShowForm(false)}
          onSaved={() => void load()}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete payment?"
          message="This will permanently delete the payment and reverse its journal entry, restoring the party subledger balance."
          confirmLabel={deleting ? "Deleting..." : "Delete"}
          danger
          onCancel={() => !deleting && setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </main>
  );
}
