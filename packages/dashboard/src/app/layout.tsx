import type { Metadata } from "next";
import "./globals.css";
import { SidebarNav } from "./sidebar-nav";
import { IconChain } from "../components/icons";

export const metadata: Metadata = {
  title: "Soroban State Ops — Storage Lifecycle Dashboard",
  description:
    "Monitor Soroban contract state health, TTL snapshots, renewal automation, and storage costs across the Stellar network.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="layout">
          <aside className="sidebar">
            <div className="sidebar-logo">
              <span className="logo-icon" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <IconChain size={22} />
              </span>
              <span>State Ops</span>
            </div>

            <SidebarNav />

            <div style={{ marginTop: "auto" }}>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                  padding: "var(--space-sm)",
                }}
              >
                soroban-state-ops v0.1.0
              </div>
            </div>
          </aside>

          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
