"use client";

import MoneyAmount, { NumAmount } from "./money-amount";
import SideDrawer from "./side-drawer";
import { formatDateOnly } from "../lib/date-only";

type Props = {
  mode: "sales" | "purchases";
  document: any;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
};

export default function DocumentPreviewDrawer({ mode, document, onEdit, onDelete, onClose }: Props) {
  const invoice = mode === "sales";
  const reference = invoice ? document.invoiceNumber : document.billNumber;
  const date = invoice ? document.issueDate : document.billDate;
  const party = invoice ? document.customer : document.supplier;
  const total = (document.lines ?? []).reduce((sum: number, line: any) => sum + Number(line.lineTotal), 0);

  return (
    <SideDrawer title={invoice ? "Invoice details" : "Bill details"} onClose={onClose} wide>
      <div className="entity-hero">
        <div><span className="eyebrow">{invoice ? "Invoice" : "Bill"}</span><h2>{reference}</h2><p>{party?.name} · {formatDateOnly(date)}</p></div>
        <strong className="ledger-balance"><MoneyAmount value={total} /></strong>
      </div>
      <div className="metric-grid"><div className="metric-card"><span className="metric-label">Total</span><strong className="metric-value"><MoneyAmount value={total} /></strong></div></div>
      <p className="muted-text">{document.notes || "No notes"}</p>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Item</th><th className="col-num">Quantity</th><th className="col-num">Price</th><th className="col-num">Total</th></tr></thead>
          <tbody>{(document.lines ?? []).map((line: any) => <tr key={line.id}><td>{line.itemName}</td><td className="col-num"><NumAmount value={line.quantity} /></td><td className="col-num"><MoneyAmount value={invoice ? line.unitPrice : line.unitCost} /></td><td className="col-num"><MoneyAmount value={line.lineTotal} /></td></tr>)}</tbody>
        </table>
      </div>
      <div className="form-actions">
        <button type="button" className="primary-button" onClick={onEdit}>Edit</button>
        <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
        <button type="button" className="danger-button" onClick={onDelete}>Delete</button>
      </div>
    </SideDrawer>
  );
}
