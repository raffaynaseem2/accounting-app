"use client";

import { UserButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const groups = [
  { label: "Sales", links: [{ label: "Invoices", href: "/sales-invoices" }, { label: "Customers", href: "/customers" }, { label: "Payments", href: "/payments?kind=customer" }] },
  { label: "Purchases", links: [{ label: "Bills", href: "/purchase-bills" }, { label: "Suppliers", href: "/suppliers" }, { label: "Payments", href: "/payments?kind=supplier" }] },
  { label: "Inventory", links: [{ label: "Products", href: "/items" }, { label: "Stock Ledger", href: "/stock-ledger" }] },
  { label: "Accounting", links: [{ label: "Chart of accounts", href: "/accounts" }, { label: "Journal", href: "/journal-entries" }] },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, signOut } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem("ledgerly.sidebarCollapsed") === "true");
  }, []);

  useEffect(() => {
    const handleAuthFailure = () => { void signOut({ redirectUrl: "/sign-in" }); };
    window.addEventListener("ledgerly:auth-failure", handleAuthFailure);
    return () => window.removeEventListener("ledgerly:auth-failure", handleAuthFailure);
  }, [signOut]);

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("ledgerly.sidebarCollapsed", String(next));
      return next;
    });
  };

  if (!isLoaded || !isSignedIn) return <>{children}</>;
  const visibleGroups = groups;

  return <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
    <button className="mobile-menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">☰</button>
    <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
      <div className="brand-block"><span className="brand-mark">L</span><div className="brand-copy"><strong>Ledgerly</strong><small>Accounting</small></div><button className="sidebar-toggle" onClick={toggleSidebar} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>{sidebarCollapsed ? "→" : "←"}</button></div>
      <nav className="sidebar-nav">
        <Link className={pathname === "/" ? "nav-link active" : "nav-link"} href="/" onClick={() => setMenuOpen(false)}>Dashboard</Link>
        {visibleGroups.map((group) => <div className="nav-group" key={group.label}><div className="nav-group-label">{group.label}</div>{group.links.map((link) => <Link className={pathname.startsWith(link.href) ? "nav-link active" : "nav-link"} href={link.href} key={link.href} onClick={() => setMenuOpen(false)}>{link.label}</Link>)}</div>)}
        <Link className={pathname === "/reports" ? "nav-link active" : "nav-link"} href="/reports" onClick={() => setMenuOpen(false)}>Reports</Link>
        <Link className={pathname === "/settings" ? "nav-link active" : "nav-link"} href="/settings" onClick={() => setMenuOpen(false)}>Settings</Link>
      </nav>
    </aside>
    <div className="app-content">
      <header className="top-header"><div className="header-left"><button className="desktop-sidebar-toggle" onClick={toggleSidebar} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>{sidebarCollapsed ? "☰" : "←"}</button><span className="app-label">Ledgerly</span></div><UserButton /></header>
      <div className="page-content">{children}</div>
    </div>
  </div>;
}
