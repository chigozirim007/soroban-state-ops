"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertItem } from "../../lib/types";
import { fetchAlerts, acknowledgeAlert, resolveAlert } from "../../lib/api";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    async function load() {
      const data = await fetchAlerts();
      setAlerts(data);
    }
    load();
  }, []);

  const handleAcknowledge = async (id: string) => {
    setAlerts(
      alerts.map((a) =>
        a.id === id ? { ...a, acknowledged: true, status: "acknowledged" } : a
      )
    );
    await acknowledgeAlert(id);
  };

  const handleResolve = async (id: string) => {
    setAlerts(
      alerts.map((a) =>
        a.id === id ? { ...a, status: "resolved" } : a
      )
    );
    await resolveAlert(id);
  };

  const filteredAlerts = alerts.filter((a) => {
    const matchesSev = severityFilter === "all" || a.severity === severityFilter;
    const matchesStat = statusFilter === "all" || a.status === statusFilter;
    return matchesSev && matchesStat;
  });

  const activeCount = alerts.filter((a) => a.status === "active").length;
  const criticalCount = alerts.filter((a) => a.severity === "critical" && a.status === "active").length;

  return (
    <div className="animate-in">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Alert Center</h1>
          <p className="page-subtitle">
            Real-time alert feed for TTL expiry threats, missing rent buffers, and Keeper delivery notifications.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="stat-grid" style={{ marginBottom: "var(--space-xl)" }}>
        <div className="card stat-card">
          <div className="stat-label">Active Unresolved Alerts</div>
          <div className="stat-value" style={{ color: activeCount > 0 ? "var(--color-warning)" : "var(--color-healthy)" }}>
            {activeCount}
          </div>
          <div className="stat-sub">Pending keeper or dev intervention</div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">Critical Expiry Threats</div>
          <div className="stat-value" style={{ color: criticalCount > 0 ? "var(--color-critical)" : "var(--color-healthy)" }}>
            {criticalCount}
          </div>
          <div className="stat-sub">{criticalCount > 0 ? "Under 50k ledgers (<24h)" : "No immediate threats"}</div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">Dispatch Channels</div>
          <div className="stat-value">3 / 3</div>
          <div className="stat-sub">Slack, PagerDuty, Webhook connected</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        className="card"
        style={{
          marginBottom: "var(--space-xl)",
          padding: "var(--space-md) var(--space-lg)",
          display: "flex",
          gap: "var(--space-md)",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>Filters:</span>

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          style={{
            padding: "var(--space-sm) var(--space-md)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-primary)",
            fontSize: "0.875rem",
          }}
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: "var(--space-sm) var(--space-md)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-primary)",
            fontSize: "0.875rem",
          }}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {/* Alerts Feed */}
      <div className="card" style={{ marginBottom: "var(--space-2xl)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          {filteredAlerts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "var(--space-2xl)", color: "var(--text-muted)" }}>
              No alerts found matching current filters.
            </div>
          ) : (
            filteredAlerts.map((a) => (
              <div
                key={a.id}
                style={{
                  padding: "var(--space-lg)",
                  borderRadius: "var(--radius-md)",
                  border: `1px solid ${
                    a.severity === "critical"
                      ? "hsla(0, 75%, 55%, 0.4)"
                      : a.severity === "warning"
                      ? "hsla(40, 90%, 55%, 0.4)"
                      : "var(--border-subtle)"
                  }`,
                  background:
                    a.severity === "critical"
                      ? "hsla(0, 75%, 55%, 0.06)"
                      : a.severity === "warning"
                      ? "hsla(40, 90%, 55%, 0.06)"
                      : "var(--bg-elevated)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "var(--space-lg)",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, minWidth: 280 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-xs)" }}>
                    <span className={`badge badge-${a.severity}`}>{a.severity.toUpperCase()}</span>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>{a.contractName}</span>
                    <span className="mono" style={{ fontSize: "0.75rem", color: "var(--accent-primary)" }}>
                      ::{a.keyName}
                    </span>
                    <span className="badge badge-tier" style={{ textTransform: "capitalize" }}>
                      📡 {a.channel}
                    </span>
                  </div>

                  <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "var(--space-xs)" }}>
                    {a.message}
                  </p>

                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Remaining TTL: <span className="mono" style={{ color: "var(--text-primary)" }}>{a.remainingLedgers.toLocaleString()} ledgers</span>{" "}
                    • Threshold: <span className="mono">{a.thresholdLedgers.toLocaleString()} ledgers</span>{" "}
                    • Triggered: {new Date(a.createdAt).toLocaleTimeString()}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                  {a.status === "active" && (
                    <button
                      onClick={() => handleAcknowledge(a.id)}
                      className="btn btn-ghost"
                      style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                    >
                      Acknowledge
                    </button>
                  )}
                  {a.status !== "resolved" && (
                    <button
                      onClick={() => handleResolve(a.id)}
                      className="btn btn-primary"
                      style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                    >
                      Resolve
                    </button>
                  )}
                  {a.status === "resolved" && (
                    <span className="badge badge-healthy">✓ Resolved</span>
                  )}
                  <Link
                    href={`/contracts/${a.contractId}`}
                    className="btn btn-ghost"
                    style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                  >
                    View State →
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Notification Channel Integrations */}
      <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "var(--space-md)" }}>
        Configured Dispatch Channels
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--space-lg)" }}>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-sm)" }}>
            <span style={{ fontWeight: 600 }}>💬 Slack Webhook</span>
            <span className="badge badge-healthy">Active</span>
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "var(--space-sm)" }}>
            Posts rich block notifications to <span className="mono">#soroban-alerts</span> when TTL enters warning threshold.
          </p>
          <div className="mono" style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
            Webhook: https://hooks.slack.com/services/T01...
          </div>
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-sm)" }}>
            <span style={{ fontWeight: 600 }}>📟 PagerDuty Events v2</span>
            <span className="badge badge-healthy">Active</span>
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "var(--space-sm)" }}>
            Triggers high-urgency incidents when any critical tier state drops below emergency threshold.
          </p>
          <div className="mono" style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
            Routing Key: pd-live-prod-38910...
          </div>
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-sm)" }}>
            <span style={{ fontWeight: 600 }}>🔗 Custom Webhook</span>
            <span className="badge badge-healthy">Active</span>
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "var(--space-sm)" }}>
            Sends signed HMAC payloads for automated DevOps, Discord bots, or SIEM pipelines.
          </p>
          <div className="mono" style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
            Endpoint: https://ops.internal/webhooks/ttl
          </div>
        </div>
      </div>
    </div>
  );
}
