"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MonitoredContract, AlertItem } from "../lib/types";
import { fetchContracts, fetchAlerts } from "../lib/api";

export default function OverviewPage() {
  const [contracts, setContracts] = useState<MonitoredContract[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const [c, a] = await Promise.all([fetchContracts(), fetchAlerts()]);
      setContracts(c);
      setAlerts(a);
      setLoading(false);
    }
    loadData();
  }, []);

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedId(addr);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const totalKeys = contracts.reduce((acc, c) => acc + c.totalKeys, 0);
  const persistentKeys = contracts.reduce((acc, c) => acc + c.persistentKeys, 0);
  const tempKeys = contracts.reduce((acc, c) => acc + c.temporaryKeys, 0);
  const instanceKeys = contracts.reduce((acc, c) => acc + c.instanceKeys, 0);
  const criticalCount = contracts.filter((c) => c.status === "critical").length;
  const warningCount = contracts.filter((c) => c.status === "warning").length;
  const healthyCount = contracts.filter((c) => c.status === "healthy").length;

  return (
    <div className="animate-in">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Soroban State Lifecycle Overview</h1>
          <p className="page-subtitle">
            Autonomous TTL monitoring, proactive rent renewal, and storage policy telemetry for Stellar smart contracts.
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
          <Link href="/contracts" className="btn btn-primary">
            ➕ Watch Contract
          </Link>
          <Link href="/cost" className="btn btn-ghost">
            💰 Rent Estimator
          </Link>
        </div>
      </div>

      {/* Network & Keeper Live Status Banner */}
      <div
        className="card"
        style={{
          marginBottom: "var(--space-xl)",
          padding: "var(--space-md) var(--space-xl)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "linear-gradient(90deg, hsla(240, 80%, 65%, 0.1), hsla(280, 70%, 55%, 0.05))",
          borderColor: "hsla(240, 80%, 65%, 0.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
          <span className="health-dot healthy" />
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
            RPC Network: <span style={{ color: "var(--color-healthy)" }}>Stellar Testnet (Protocol 21)</span>
          </span>
          <span style={{ color: "var(--border-default)" }}>|</span>
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Current Ledger: <span className="mono" style={{ color: "var(--text-primary)" }}>#3,126,450</span>
          </span>
          <span style={{ color: "var(--border-default)" }}>|</span>
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Ledger Interval: <span className="mono">~5.1s</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", fontSize: "0.8rem" }}>
          <span className="badge badge-info">Keeper: Active</span>
          <span className="badge badge-healthy">Signer: AES-256</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stat-grid">
        <div className="card stat-card animate-in-delay-1">
          <div className="stat-label">Monitored Contracts</div>
          <div className="stat-value">{contracts.length}</div>
          <div className="stat-sub">
            <span style={{ color: "var(--color-healthy)" }}>{healthyCount} healthy</span> •{" "}
            <span style={{ color: "var(--color-warning)" }}>{warningCount} warning</span> •{" "}
            <span style={{ color: "var(--color-critical)" }}>{criticalCount} critical</span>
          </div>
        </div>

        <div className="card stat-card animate-in-delay-2">
          <div className="stat-label">Critical TTL Evictions</div>
          <div
            className="stat-value"
            style={{
              background: criticalCount > 0 ? "linear-gradient(135deg, hsl(0, 80%, 60%), hsl(20, 90%, 55%))" : undefined,
              WebkitBackgroundClip: criticalCount > 0 ? "text" : undefined,
              WebkitTextFillColor: criticalCount > 0 ? "transparent" : undefined,
            }}
          >
            {criticalCount}
          </div>
          <div className="stat-sub">
            {criticalCount > 0 ? (
              <span style={{ color: "var(--color-critical)" }}>⚠️ Immediate action required</span>
            ) : (
              <span style={{ color: "var(--color-healthy)" }}>All state safely buffered</span>
            )}
          </div>
        </div>

        <div className="card stat-card animate-in-delay-3">
          <div className="stat-label">Tracked State Entries</div>
          <div className="stat-value">{totalKeys}</div>
          <div className="stat-sub">
            {persistentKeys} Persistent • {tempKeys} Temp • {instanceKeys} Instance
          </div>
        </div>

        <div className="card stat-card animate-in-delay-4">
          <div className="stat-label">Automated Renewals (24h)</div>
          <div className="stat-value">14</div>
          <div className="stat-sub">
            <span style={{ color: "var(--color-healthy)" }}>100% success rate</span> (0.07 XLM gas)
          </div>
        </div>
      </div>

      {/* Critical Alerts Banner (if any active) */}
      {alerts.some((a) => a.severity === "critical" && !a.acknowledged) && (
        <div
          className="card"
          style={{
            marginBottom: "var(--space-2xl)",
            background: "hsla(0, 75%, 55%, 0.1)",
            borderColor: "hsla(0, 75%, 55%, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
            <span style={{ fontSize: "1.5rem" }}>🚨</span>
            <div>
              <div style={{ fontWeight: 700, color: "var(--color-critical)" }}>
                Critical State Expiry Imminent
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                {alerts.find((a) => a.severity === "critical")?.message}
              </div>
            </div>
          </div>
          <Link href="/alerts" className="btn btn-primary" style={{ background: "var(--color-critical)" }}>
            Review Alerts
          </Link>
        </div>
      )}

      {/* Storage Tier Distribution & Health Visualizer */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--space-xl)", marginBottom: "var(--space-2xl)" }}>
        <div className="card">
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "var(--space-sm)" }}>
            Storage Tier Distribution
          </h3>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "var(--space-md)" }}>
            Breakdown of smart contract state storage across Persistent, Temporary, and Instance allocations.
          </p>

          {/* Tier Bar */}
          <div
            style={{
              display: "flex",
              height: "20px",
              borderRadius: "var(--radius-sm)",
              overflow: "hidden",
              marginBottom: "var(--space-md)",
            }}
          >
            <div
              style={{
                width: `${totalKeys ? (persistentKeys / totalKeys) * 100 : 60}%`,
                background: "hsl(240, 80%, 65%)",
                transition: "width 0.5s ease",
              }}
              title={`Persistent: ${persistentKeys}`}
            />
            <div
              style={{
                width: `${totalKeys ? (tempKeys / totalKeys) * 100 : 25}%`,
                background: "hsl(200, 80%, 55%)",
                transition: "width 0.5s ease",
              }}
              title={`Temporary: ${tempKeys}`}
            />
            <div
              style={{
                width: `${totalKeys ? (instanceKeys / totalKeys) * 100 : 15}%`,
                background: "hsl(280, 70%, 55%)",
                transition: "width 0.5s ease",
              }}
              title={`Instance: ${instanceKeys}`}
            />
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: "var(--space-xl)", fontSize: "0.8rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "hsl(240, 80%, 65%)" }} />
              <span>Persistent ({persistentKeys})</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "hsl(200, 80%, 55%)" }} />
              <span>Temporary ({tempKeys})</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "hsl(280, 70%, 55%)" }} />
              <span>Instance ({instanceKeys})</span>
            </div>
          </div>
        </div>

        {/* State Policy Linter Summary */}
        <div className="card">
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "var(--space-sm)" }}>
            Policy Compliance
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", marginTop: "var(--space-sm)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
              <span style={{ color: "var(--text-secondary)" }}>Rule SOL001 (Unbounded Keys)</span>
              <span className="badge badge-healthy">Pass</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
              <span style={{ color: "var(--text-secondary)" }}>Rule SOL002 (Missing Bump)</span>
              <span className="badge badge-warning">1 Warning</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
              <span style={{ color: "var(--text-secondary)" }}>Rule SOL003 (Archived Recovery)</span>
              <span className="badge badge-healthy">Pass</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
              <span style={{ color: "var(--text-secondary)" }}>Rule SOL004 (Instance Waste)</span>
              <span className="badge badge-healthy">Pass</span>
            </div>
          </div>
        </div>
      </div>

      {/* Contracts Table */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-lg)" }}>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Monitored Contracts</h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Active contracts evaluated by the Soroban State Ops Keeper daemon.
            </p>
          </div>
          <Link href="/contracts" className="btn btn-ghost" style={{ fontSize: "0.8rem" }}>
            View All Contracts →
          </Link>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Contract</th>
                <th>Network</th>
                <th>Storage Breakdown</th>
                <th>Min TTL Buffer</th>
                <th>Next Renewal</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
                      <span className={`health-dot ${c.status}`} />
                      <span className={`badge badge-${c.status}`}>{c.status}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
                      <span className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {c.address.slice(0, 10)}...{c.address.slice(-6)}
                      </span>
                      <button
                        onClick={() => copyAddress(c.address)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "0.75rem",
                          color: copiedId === c.address ? "var(--color-healthy)" : "var(--text-muted)",
                        }}
                        title="Copy Address"
                      >
                        {copiedId === c.address ? "✓ Copied" : "📋"}
                      </button>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-tier">{c.network}</span>
                  </td>
                  <td>
                    <span className="badge badge-tier" style={{ marginRight: 4 }}>
                      {c.persistentKeys}P
                    </span>
                    <span className="badge badge-info" style={{ marginRight: 4 }}>
                      {c.temporaryKeys}T
                    </span>
                    <span className="badge badge-warning">{c.instanceKeys}I</span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.minTtlLedgers.toLocaleString()} ledgers</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      ~{Math.round(c.minTtlLedgers / 17280)} days remaining
                    </div>
                  </td>
                  <td style={{ fontSize: "0.85rem" }}>{c.nextRenewalEstimated}</td>
                  <td>
                    <Link href={`/contracts/${c.id}`} className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: "0.75rem" }}>
                      Inspect →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
