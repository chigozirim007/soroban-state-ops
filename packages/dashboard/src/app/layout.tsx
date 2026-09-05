import type { Metadata } from "next";
import "./globals.css";

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
              <span className="logo-icon">⛓️</span>
              <span>State Ops</span>
            </div>

            <nav className="nav-section">
              <span className="nav-label">Monitor</span>
              <a href="/" className="nav-link active">
                📊 Overview
              </a>
              <a href="/contracts" className="nav-link">
                📋 Contracts
              </a>
              <a href="/alerts" className="nav-link">
                🔔 Alerts
              </a>
            </nav>

            <nav className="nav-section">
              <span className="nav-label">Tools</span>
              <a href="/cost" className="nav-link">
                💰 Cost Estimator
              </a>
            </nav>

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
