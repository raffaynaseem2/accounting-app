"use client";

import { UserButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const groups = [
  { label: "Sales", links: [{ label: "Invoices", href: "/sales-invoices" }, { label: "Customers", href: "/customers" }, { label: "Payments", href: "/payments?kind=customer" }] },
  { label: "Purchases", links: [{ label: "Bills", href: "/purchase-bills" }, { label: "Suppliers", href: "/suppliers" }, { label: "Payments", href: "/payments?kind=supplier" }] },
  { label: "Inventory", links: [{ label: "Products", href: "/items" }, { label: "Stock Ledger", href: "/stock-ledger" }] },
  { label: "Accounting", links: [{ label: "Chart of accounts", href: "/accounts" }, { label: "Journal", href: "/journal-entries" }] },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string>("CLERK");
  const [businessName, setBusinessName] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [businessChecked, setBusinessChecked] = useState(false);

  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem("ledgerly.sidebarCollapsed") === "true");
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("ledgerly.sidebarCollapsed", String(next));
      return next;
    });
  };

  useEffect(() => {
    if (!isLoaded) return;
    const isSignInRoute = pathname.startsWith("/sign-in");
    const isSetupRoute = pathname === "/setup" || pathname.startsWith("/setup/");
    if (!isSignedIn || isSignInRoute || isSetupRoute) {
      setBusinessChecked(true);
      return;
    }

    let cancelled = false;
    setBusinessChecked(false);
    void (async () => {
      try {
        const token = await getToken({ skipCache: true });
        if (!token) {
          if (!cancelled) router.replace(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`);
          return;
        }
        const response = await fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) {
          if (!cancelled && response.status === 401) router.replace(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`);
          return;
        }
        const data = await response.json();
        if (data.setupRequired) {
          setBusinessName("");
          if (pathname !== "/setup") {
            router.replace("/setup");
          } else if (!cancelled) {
            setBusinessChecked(true);
          }
          return;
        }
        setRole(data.role);
        setBusinessName(data.business?.name ?? "");
        if (pathname === "/setup") {
          router.replace("/");
        } else if (!cancelled) {
          setBusinessChecked(true);
        }
      } catch {
        // Keep protected pages gated until the API can confirm the workspace.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, pathname, router]);

  useEffect(() => {
    if (!isLoaded || pathname.startsWith("/sign-in")) return;
    if (!isSignedIn) {
      router.replace(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`);
      return;
    }

    let cancelled = false;
    const verifySession = async () => {
      try {
        const token = await getToken({ skipCache: true });
        if (!token && !cancelled) {
          router.replace(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`);
        }
      } catch {
        if (!cancelled) router.replace(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`);
      }
    };

    void verifySession();
    const interval = window.setInterval(() => void verifySession(), 10000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [getToken, isLoaded, isSignedIn, pathname, router]);

  if (!isLoaded || !isSignedIn) return <>{children}</>;
  const isSetupRoute = pathname === "/setup" || pathname.startsWith("/setup/");
  if (!pathname.startsWith("/sign-in") && !isSetupRoute && !businessChecked) {
    return <main className="panel">Checking your workspace...</main>;
  }
  const visibleGroups = groups;

  return <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
    <button className="mobile-menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">☰</button>
    <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
      <div className="brand-block"><span className="brand-mark">L</span><div className="brand-copy"><strong>Ledgerly</strong><small>{businessName || "Accounting"}</small></div><button className="sidebar-toggle" onClick={toggleSidebar} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>{sidebarCollapsed ? "→" : "←"}</button></div>
      <nav className="sidebar-nav">
        <Link className={pathname === "/" ? "nav-link active" : "nav-link"} href="/" onClick={() => setMenuOpen(false)}>Dashboard</Link>
        {visibleGroups.map((group) => <div className="nav-group" key={group.label}><div className="nav-group-label">{group.label}</div>{group.links.map((link) => <Link className={pathname.startsWith(link.href) ? "nav-link active" : "nav-link"} href={link.href} key={link.href} onClick={() => setMenuOpen(false)}>{link.label}</Link>)}</div>)}
        <Link className={pathname === "/reports" ? "nav-link active" : "nav-link"} href="/reports" onClick={() => setMenuOpen(false)}>Reports</Link>
        <Link className={pathname === "/settings" ? "nav-link active" : "nav-link"} href="/settings" onClick={() => setMenuOpen(false)}>Settings</Link>
      </nav>
    </aside>
    <div className="app-content">
      <header className="top-header"><div className="header-left"><button className="desktop-sidebar-toggle" onClick={toggleSidebar} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>{sidebarCollapsed ? "☰" : "←"}</button><span className="business-label">{businessName || "Accounting workspace"}</span></div><UserButton /></header>
      <div className="page-content">{children}</div>
    </div>
  </div>;
}
