"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type Icon = "box" | "document" | "journal" | "payment" | "users" | "account" | "activity";

const icons: Record<Icon, ReactNode> = {
  box: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 12 20 7.5M12 12v9M12 12 4 7.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  document: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3h7l5 5v13H7V3Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 3v5h5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  journal: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 4h12v16H6V4Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 8h6M9 12h6M9 16h4" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  payment: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 7h18v10H3V7Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 10h18" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17" cy="9" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  account: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h10" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  activity: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 18V6M10 18V10M16 18v-4M22 18V8" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
};

type Props = {
  icon?: Icon;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
};

export default function EmptyState({ icon = "document", title, description, actionLabel, actionHref, onAction }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icons[icon]}</div>
      <h3 className="empty-state-title">{title}</h3>
      {description ? <p className="empty-state-description">{description}</p> : null}
      {actionLabel && actionHref ? (
        <Link className="empty-state-action" href={actionHref}>{actionLabel}</Link>
      ) : null}
      {actionLabel && onAction ? (
        <button type="button" className="empty-state-action" onClick={onAction}>{actionLabel}</button>
      ) : null}
    </div>
  );
}
