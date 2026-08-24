"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import MoneyAmount from "../../../components/money-amount";
import AccountBalanceAmount from "../../../components/account-balance-amount";
import EmptyState from "../../../components/empty-state";
import OverflowMenu from "../../../components/overflow-menu";
import ConfirmDialog from "../../../components/confirm-dialog";
import SearchField from "../../../components/search-field";
import {
  sourceFromJournalEntry,
  transactionDeleteLabel,
  transactionDeletePath,
  transactionEditPath,
} from "../../../lib/transaction-actions";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function AccountLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [ledger, setLedger] = useState<any>(null);
  const [parties, setParties] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [partyFilter, setPartyFilter] = useState("");
  const [pendingDelete, setPendingDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void params.then((p) => setAccountId(p.id));
  }, [params]);

  const request = useCallback(async (path: string, options: RequestInit = {}) => {
    const token = await getToken({ skipCache: true });
    if (!token) throw new Error("Please sign in first");
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message ?? "Request failed");
    return data;
  }, [getToken]);

  const fetchLedger = useCallback(async (id: string, systemKey: string | null | undefined, partyId: string) => {
    const query = new URLSearchParams();
    if (systemKey === "AR" && partyId) query.set("customerId", partyId);
    if (systemKey === "AP" && partyId) query.set("supplierId", partyId);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request(`/accounts/${id}/ledger${suffix}`);
  }, [request]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !accountId) return;
    void (async () => {
      try {
        const data = await fetchLedger(accountId, null, "");
        setLedger(data);
        const systemKey = data.account?.systemKey;
        if (systemKey === "AR") {
          const customers = await request("/customers");
          setParties(customers.filter((c: any) => c.isActive));
        } else if (systemKey === "AP") {
          const suppliers = await request("/suppliers");
          setParties(suppliers.filter((s: any) => s.isActive));
        } else {
          setParties([]);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load account ledger");
      }
    })();
  }, [isLoaded, isSignedIn, accountId, fetchLedger, request]);

  useEffect(() => {
    if (!accountId || !ledger?.account) return;
    void fetchLedger(accountId, ledger.account.systemKey, partyFilter)
      .then(setLedger)
      .catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load account ledger"));
  }, [partyFilter]);

  const isAr = ledger?.account?.systemKey === "AR";
  const isAp = ledger?.account?.systemKey === "AP";
  const accountType = ledger?.account?.type ?? "ASSET";

  const lines = useMemo(() => {
    if (!ledger?.journalLines) return [];
    return ledger.journalLines.filter((line: any) => {
      const day = line.journalEntry.entryDate.slice(0, 10);
      const text = `${line.journalEntry.description} ${line.customer?.name ?? ""} ${line.supplier?.name ?? ""}`.toLowerCase();
      return text.includes(search.toLowerCase()) && (!dateFrom || day >= dateFrom) && (!dateTo || day <= dateTo);
    });
  }, [ledger, search, dateFrom, dateTo]);

  let running = 0;
  const hasFilters = Boolean(search || dateFrom || dateTo || partyFilter);

  const clearFilters = () => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setPartyFilter("");
  };

  const openEdit = (line: any) => {
    const path = transactionEditPath(sourceFromJournalEntry(line.journalEntry));
    if (path) window.location.href = path;
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deleting || !accountId) return;
    setDeleting(true);
    try {
      const source = sourceFromJournalEntry(pendingDelete.journalEntry);
      await request(transactionDeletePath(source), { method: "DELETE" });
      setPendingDelete(null);
      const data = await fetchLedger(accountId, ledger.account.systemKey, partyFilter);
      setLedger(data);
      setMessage(`${transactionDeleteLabel(source)} deleted.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete entry");
    } finally {
      setDeleting(false);
    }
  };

  if (!isLoaded) return <main className="panel">Loading...</main>;
  if (!isSignedIn) return <main className="panel"><Link href="/">Sign in</Link></main>;
  if (!ledger) return <main className="panel">{message || "Loading ledger..."}</main>;

  const deleteSource = pendingDelete ? sourceFromJournalEntry(pendingDelete.journalEntry) : null;

  return (
    <main className="content-stack">
      <div className="page-heading">
        <div>
          <Link className="back-link" href="/accounts">← Chart of accounts</Link>
          <h1>{ledger.account.name}</h1>
          <p>{accountType}</p>
        </div>
        <strong className="ledger-balance"><AccountBalanceAmount rawBalance={ledger.balance} accountType={accountType} /></strong>
      </div>

      <p>{message}</p>

      <section className="panel">
        <div className="toolbar-row">
          <h2>Ledger</h2>
          <span className="muted-text">GL postings and subledger references</span>
        </div>

        <div className="table-controls">
          <SearchField placeholder="Search descriptions or parties" value={search} onChange={setSearch} />
          {isAr ? (
            <select value={partyFilter} onChange={(e) => setPartyFilter(e.target.value)}>
              <option value="">All customers</option>
              {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          ) : null}
          {isAp ? (
            <select value={partyFilter} onChange={(e) => setPartyFilter(e.target.value)}>
              <option value="">All suppliers</option>
              {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          ) : null}
          <label className="field compact-field">From<input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
          <label className="field compact-field">To<input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
          {hasFilters ? <button className="secondary-button" onClick={clearFilters}>Clear Filters</button> : null}
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>{isAr ? "Customer" : isAp ? "Supplier" : "Customer/Supplier"}</th>
                <th className="col-num">Debit</th>
                <th className="col-num">Credit</th>
                <th className="col-num">Running balance</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((line: any) => {
                const debit = line.side === "DEBIT" ? Number(line.amount) : 0;
                const credit = line.side === "CREDIT" ? Number(line.amount) : 0;
                running += debit - credit;
                const editPath = transactionEditPath(sourceFromJournalEntry(line.journalEntry));
                return (
                  <tr key={line.id}>
                    <td>{new Date(line.journalEntry.entryDate).toLocaleDateString()}</td>
                    <td>{line.journalEntry.description}</td>
                    <td>{line.customer?.name ?? line.supplier?.name ?? "—"}</td>
                    <td className="col-num">{debit ? <MoneyAmount value={debit} /> : "—"}</td>
                    <td className="col-num">{credit ? <MoneyAmount value={credit} /> : "—"}</td>
                    <td className="col-num"><AccountBalanceAmount rawBalance={running} accountType={accountType} /></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <OverflowMenu items={[
                        ...(editPath ? [{ label: "Edit", onClick: () => openEdit(line) }] : []),
                        { label: "Delete", danger: true, onClick: () => setPendingDelete(line) },
                      ]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!lines.length ? (
          <EmptyState icon="activity" title="No ledger activity" description="Postings to this account will appear here." />
        ) : null}
      </section>

      {pendingDelete && deleteSource ? (
        <ConfirmDialog
          title={`Delete ${transactionDeleteLabel(deleteSource)}?`}
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
