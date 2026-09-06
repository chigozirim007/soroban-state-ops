import type { Metadata } from "next";
import "./globals.css";
import { SidebarNav } from "./sidebar-nav";
import { SorobanLogo } from "../components/logo";

export const metadata: Metadata = {
  title: "Soroban State Ops — Storage Lifecycle Dashboard",
  description:
    "Monitor Soroban contract state health, TTL snapshots, renewal automation, and storage costs across the Stellar network.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
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
              <SorobanLogo size={38} showText={true} />
            </div>

            <SidebarNav />

            <div style={{ marginTop: "auto" }}>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                  padding: "var(--space-sm)",
                  fontFamily: "var(--font-mono)",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent-primary)", boxShadow: "0 0 8px var(--accent-primary)" }}></span>
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
