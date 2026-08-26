"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
import SearchableSelect from "./searchable-select";
import MoneyAmount from "./money-amount";
import SideDrawer from "./side-drawer";
import { apiRequest } from "../lib/api-client";

type Mode = "sales" | "purchases";
type Line = { itemId: string; quantity: string; price: string };

const blank = (): Line => ({ itemId: "", quantity: "", price: "" });

type Props = {
  mode: Mode;
  documentId: string;
  onClose: () => void;
  onSaved: () => void;
};

export default function DocumentFormDrawer({ mode, documentId, onClose, onSaved }: Props) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const isSales = mode === "sales";
  const base = isSales ? "/sales-invoices" : "/purchase-bills";
  const partyLabel = isSales ? "Customer" : "Supplier";
  const [parties, setParties] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [partyId, setPartyId] = useState("");
  const [number, setNumber] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [editable, setEditable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const request = (path: string, options: RequestInit = {}) => apiRequest(path, getToken, options);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void (async () => {
      try {
        const [p, i, doc] = await Promise.all([
          request(`/${isSales ? "customers" : "suppliers"}`),
          request("/items"),
          request(`${base}/${documentId}`),
        ]);
        setParties(p.filter((x: any) => x.isActive));
        setItems(i.filter((x: any) => x.isActive));
        setPartyId(isSales ? doc.customerId : doc.supplierId);
        setNumber(isSales ? doc.invoiceNumber : doc.billNumber);
        setDate((isSales ? doc.issueDate : doc.billDate).slice(0, 10));
        setNotes(doc.notes ?? "");
        setLines(
          doc.lines.map((l: any) => ({
            itemId: l.itemId,
            quantity: String(l.quantity),
            price: String(isSales ? l.unitPrice : l.unitCost),
          })),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load document");
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn, documentId, isSales, base]);

  const chooseItem = (index: number, itemId: string) => {
    const item = items.find((x) => x.id === itemId);
    setLines(
      lines.map((l, i) =>
        i === index
          ? { ...l, itemId, price: l.price || String(isSales ? item?.unitPrice ?? "" : item?.unitCost ?? "") }
          : l,
      ),
    );
  };

  const total = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.price) || 0), 0),
    [lines],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editable || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await request(`${base}/${documentId}`, {
        method: "PATCH",
        body: JSON.stringify({
          [isSales ? "customerId" : "supplierId"]: partyId,
          [isSales ? "invoiceNumber" : "billNumber"]: number || undefined,
          [isSales ? "issueDate" : "billDate"]: date,
          notes,
          lines: lines.map((l) => ({
            itemId: l.itemId,
            quantity: Number(l.quantity),
            [isSales ? "unitPrice" : "unitCost"]: Number(l.price),
          })),
        }),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save document");
    } finally {
      setSubmitting(false);
    }
  };

  const partyOptions = parties.map((p) => ({ value: p.id, label: p.name }));
  const itemOptions = items.map((i) => ({ value: i.id, label: `${i.name} · ${i.productCode}` }));
  const disabled = !editable;

  return (
    <SideDrawer title={isSales ? "Invoice" : "Bill"} onClose={onClose} wide>
      {loading ? <p>Loading...</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {!loading && !error ? (
        <form
          className="drawer-form"
          onSubmit={(e) => {
            if (!editable) {
              e.preventDefault();
              return;
            }
            void submit(e);
          }}
        >
            <SearchableSelect
              label={partyLabel}
              required
              value={partyId}
              onChange={setPartyId}
              options={partyOptions}
              disabled={disabled}
            />
            <label className="field">
              {isSales ? "Invoice number" : "Bill number"}
              <input value={number} disabled={disabled} onChange={(e) => setNumber(e.target.value)} />
            </label>
            <label className="field">
              Date
              <input required type="date" value={date} disabled={disabled} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="field full-width">
              Notes
              <textarea value={notes} disabled={disabled} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <div className="toolbar-row">
              <h3>Line items</h3>
              {editable ? (
                <button type="button" className="secondary-button" onClick={() => setLines([...lines, blank()])}>
                  + Add line
                </button>
              ) : null}
            </div>
            {lines.map((line, i) => (
              <div className="line-item" key={i}>
                <SearchableSelect
                  label="Product/service"
                  required
                  value={line.itemId}
                  onChange={(v) => chooseItem(i, v)}
                  options={itemOptions}
                  disabled={disabled}
                />
                <label className="field">
                  Quantity
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={line.quantity}
                    disabled={disabled}
                    onChange={(e) => setLines(lines.map((x, n) => (n === i ? { ...x, quantity: e.target.value } : x)))}
                  />
                </label>
                <label className="field">
                  {isSales ? "Unit price" : "Unit cost"}
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={line.price}
                    disabled={disabled}
                    onChange={(e) => setLines(lines.map((x, n) => (n === i ? { ...x, price: e.target.value } : x)))}
                  />
                </label>
                {editable && lines.length > 1 ? (
                  <button className="icon-button" type="button" onClick={() => setLines(lines.filter((_, n) => n !== i))}>×</button>
                ) : null}
              </div>
            ))}
            <div className="total-box">
              <span>Total</span>
              <strong><MoneyAmount value={total} /></strong>
            </div>
            <div className="form-actions">
              {editable ? (
                <button type="submit" className="primary-button" disabled={submitting}>
                  {submitting ? "Saving..." : "Save changes"}
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-button"
                  onClick={(e) => {
                    e.preventDefault();
                    setEditable(true);
                  }}
                >
                  Edit
                </button>
              )}
              <button type="button" className="secondary-button" onClick={onClose}>Close</button>
            </div>
          </form>
        ) : null}
    </SideDrawer>
  );
}
