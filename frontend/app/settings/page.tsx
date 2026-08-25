"use client";
import { UserButton, useAuth } from "@clerk/nextjs";
export default function SettingsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <main className="panel">Loading...</main>;
  if (!isSignedIn) return <main className="panel">Sign in to manage settings.</main>;
  return <main className="content-stack"><div className="page-heading"><div><h1>Settings</h1><p>Manage your account and authentication.</p></div></div><section className="panel form-panel"><h2>Account</h2><p className="empty-state">Your profile, email, password, and sign-in methods are managed securely by Clerk.</p><UserButton /></section></main>;
}
