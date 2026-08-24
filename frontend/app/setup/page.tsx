"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function SetupPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [message, setMessage] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    const token = await getToken();
    if (!token) {
      setMessage("Please sign in first.");
      return;
    }
    const response = await fetch(`${API_URL}/auth/bootstrap`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ businessName }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      setMessage(error?.message ?? "Business setup failed.");
      return;
    }
    router.push("/");
  };

  return (
    <main style={{ padding: "20px" }}>
      <h1>Set up your business</h1>
      <form onSubmit={submit}>
        <input placeholder="Business name" value={businessName} onChange={(event) => setBusinessName(event.target.value)} required />
        <button type="submit">Continue</button>
      </form>
      <p>{message}</p>
    </main>
  );
}
