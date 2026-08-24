"use client";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
export default function SettingsPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth(); const [form, setForm] = useState({ name: "", email: "" }); const [message, setMessage] = useState("");
  const request = async (path: string, options: RequestInit = {}) => { const token = await getToken(); const response = await fetch(`${API_URL}${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }); const data = await response.json().catch(() => null); if (!response.ok) throw new Error(data?.message ?? "Request failed"); return data; };
  useEffect(() => { if (isLoaded && isSignedIn) void request("/settings/business").then((data) => setForm({ name: data.name ?? "", email: data.email ?? "" })).catch((error) => setMessage(error.message)); }, [isLoaded, isSignedIn]);
  const save = async (event: React.FormEvent) => { event.preventDefault(); try { await request("/settings/business", { method: "PATCH", body: JSON.stringify(form) }); setMessage("Business profile saved."); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save profile"); } };
  if (!isLoaded) return <main className="panel">Loading...</main>; if (!isSignedIn) return <main className="panel">Sign in to manage settings.</main>;
  return <main className="content-stack"><div className="page-heading"><div><h1>Settings</h1><p>Manage your business workspace.</p></div></div><section className="panel form-panel"><h2>Business profile</h2><form className="form-grid" onSubmit={save}><label className="field">Business name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label className="field">Business email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><div className="form-actions"><button className="primary-button" type="submit">Save profile</button></div></form><p>{message}</p></section><section className="panel"><h2>Users</h2><p className="empty-state">User invitations and role assignment are managed through Clerk.</p></section></main>;
}
