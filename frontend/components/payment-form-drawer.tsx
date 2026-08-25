"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import SearchableSelect from "./searchable-select";
import SideDrawer from "./side-drawer";
import { isLiquidAssetAccount } from "../lib/liquid-asset-accounts";
import { apiRequest } from "../lib/api-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const today = () => new Date().toISOString().slice(0, 10);

type Props = {
  kind: "customer" | "supplier";
  partyId?: string;
  onClose: () => void;
  onSaved: () => void;
};

export default function PaymentFormDrawer({ kind, partyId: initialPartyId = "", onClose, onSaved }: Props) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
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
    if (!isLoaded || !isSignedIn) return;
    void (async () => {
      const [partyList, accountList] = await Promise.all([
        apiRequest(`/${isCustomer ? "customers" : "suppliers"}`, getToken),
        apiRequest("/accounts", getToken),
      ]);
      setParties(partyList.filter((x: any) => x.isActive));
      setAccounts(accountList.filter((x: any) => x.isActive && isLiquidAssetAccount(x)));
    })();
  }, [isLoaded, isSignedIn, getToken, isCustomer]);

  const request = (path: string, options: RequestInit = {}) => apiRequest(path, getToken, options);

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
