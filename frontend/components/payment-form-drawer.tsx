"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import SearchableSelect from "./searchable-select";
import SideDrawer from "./side-drawer";
import { isLiquidAssetAccount } from "../lib/liquid-asset-accounts";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const today = () => new Date().toISOString().slice(0, 10);

type Props = {
  kind: "customer" | "supplier";
  partyId?: string;
  onClose: () => void;
  onSaved: () => void;
};

export default function PaymentFormDrawer({ kind, partyId: initialPartyId = "", onClose, onSaved }: Props) {
  const { getToken } = useAuth();
  const isCustomer = kind === "customer";
  const [parties, setParties] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [form, setForm] = useState({
    partyId: initialPartyId,
    accountId: "",
    amount: "",
    paymentDate: today(),
    reference: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const token = await getToken({ skipCache: true });
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };
      const [partiesRes, accountsRes] = await Promise.all([
        fetch(`${API_URL}/${isCustomer ? "customers" : "suppliers"}`, { headers }),
        fetch(`${API_URL}/accounts`, { headers }),
      ]);
      const partyList = await partiesRes.json();
      const accountList = await accountsRes.json();
      setParties(partyList.filter((x: any) => x.isActive));
      setAccounts(accountList.filter((x: any) => x.isActive && isLiquidAssetAccount(x)));
    })();
  }, [getToken, isCustomer]);

  const request = async (path: string, options: RequestInit = {}) => {
    const token = await getToken({ skipCache: true });
    if (!token) throw new Error("Please sign in first");
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message ?? "Request failed");
    return data;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await request("/payments", {
        method: "POST",
        body: JSON.stringify({
          kind: isCustomer ? "CUSTOMER_RECEIPT" : "SUPPLIER_PAYMENT",
          [isCustomer ? "customerId" : "supplierId"]: form.partyId,
          accountId: form.accountId,
          amount: Number(form.amount),
          paymentDate: form.paymentDate,
          reference: form.reference || undefined,
          notes: form.notes || undefined,
        }),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  const partyOptions = parties.map((p) => ({ value: p.id, label: p.name }));
  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }));

  return (
    <SideDrawer title="Record payment" onClose={onClose}>
      {error ? <p className="form-error">{error}</p> : null}
      <form className="drawer-form" onSubmit={submit}>
        <SearchableSelect
          label={isCustomer ? "Customer" : "Supplier"}
          required
          value={form.partyId}
          onChange={(v) => setForm({ ...form, partyId: v })}
          options={partyOptions}
        />
        <SearchableSelect
          label="Bank or cash account"
          required
          value={form.accountId}
          onChange={(v) => setForm({ ...form, accountId: v })}
          options={accountOptions}
        />
        <label className="field field-amount full-width">
          Amount
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            className="amount-input"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="0.00"
          />
        </label>
        <div className="form-row-pair">
          <label className="field">
            Date
            <input
              required
              type="date"
              value={form.paymentDate}
              onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
            />
          </label>
          <label className="field">
            Reference
            <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          </label>
        </div>
        <label className="field full-width">
          Notes
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </label>
        <div className="form-actions">
          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? "Recording..." : "Record payment"}
          </button>
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </SideDrawer>
  );
}
