"use client";

import Link from "next/link";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import MoneyAmount from "../components/money-amount";
import { apiRequest } from "../lib/api-client";

export default function DashboardPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [metrics, setMetrics] = useState<any>({ cash: 0, receivable: 0, payable: 0, inventory: 0, sales: 0, purchases: 0 });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void (async () => {
      try {
        const summary = await apiRequest("/dashboard/summary", getToken);
        setMetrics(summary);
      } catch {
        /* dashboard remains usable while API starts */
      }
    })();
  }, [isLoaded, isSignedIn, getToken]);

  if (!isLoaded) return <main className="panel">Loading...</main>;
  if (!isSignedIn) return <main className="panel"><h1>Accounting app</h1><SignInButton mode="modal" fallbackRedirectUrl="/" forceRedirectUrl="/" /></main>;

  const cards = [
    ["Cash & bank", metrics.cash],
    ["Accounts receivable", metrics.receivable],
    ["Accounts payable", metrics.payable],
    ["Inventory value", metrics.inventory],
    ["Sales", metrics.sales],
    ["Purchases", metrics.purchases],
  ] as const;

  return (
    <main>
      <div className="page-heading">
        <div>
          <h1>Dashboard</h1>
          <p>Overview of your activity.</p>
        </div>
        <div className="new-action-menu" ref={ref}>
          <button className="primary-button" onClick={() => setOpen(!open)}>+ New ▾</button>
          {open ? (
            <div className="new-action-popover">
              <Link href="/sales-invoices?new=1">Invoice</Link>
              <Link href="/purchase-bills?new=1">Bill</Link>
              <Link href="/customers?new=1">Customer</Link>
              <Link href="/suppliers?new=1">Supplier</Link>
              <Link href="/payments?kind=customer&new=1">Customer payment</Link>
              <Link href="/payments?kind=supplier&new=1">Supplier payment</Link>
            </div>
          ) : null}
        </div>
      </div>

      <div className="metric-grid">
        {cards.map(([label, value]) => (
          <div className="metric-card" key={label}>
            <span className="metric-label">{label}</span>
            <strong className="metric-value"><MoneyAmount value={value} /></strong>
          </div>
        ))}
      </div>

      <section className="panel">
        <h2>Quick actions</h2>
        <p className="muted-text">Use + New to begin a transaction or open a master record.</p>
      </section>
    </main>
  );
}
