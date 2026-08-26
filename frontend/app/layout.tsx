import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import AppShell from "../components/app-shell";

export const metadata: Metadata = {
  title: "Accounting App",
  description: "Accounting expense tracker",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body><AppShell>{children}</AppShell></body>
      </html>
    </ClerkProvider>
  );
}
