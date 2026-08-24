"use client";

import Link from "next/link";
import MoneyAmount from "./money-amount";

type Props = {
  backHref: string;
  backLabel: string;
  name: string;
  subtitle: string;
  balance: number | string;
  balanceLabel?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
};

export default function EntityHero({
  backHref,
  backLabel,
  name,
  subtitle,
  balance,
  balanceLabel = "Outstanding balance",
  actions,
  meta,
}: Props) {
  const amount = Number(balance);
  const hasBalance = amount !== 0;

  return (
    <section className="entity-hero">
      <div className="entity-hero-main">
        <Link className="back-link" href={backHref}>← {backLabel}</Link>
        <h1 className="entity-hero-title">{name}</h1>
        <p className="entity-hero-subtitle">{subtitle}</p>
        {meta ? <div className="entity-hero-meta">{meta}</div> : null}
        <div className="entity-hero-stats">
          <div className={`balance-pill ${hasBalance ? "balance-pill-active" : "balance-pill-zero"}`}>
            <span className="balance-pill-label">{balanceLabel}</span>
            <strong className="balance-pill-value"><MoneyAmount value={amount} /></strong>
          </div>
        </div>
      </div>
      {actions ? <div className="entity-hero-actions">{actions}</div> : null}
    </section>
  );
}
