"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertItem } from "../../lib/types";
import { fetchAlerts, acknowledgeAlert, resolveAlert, fetchDashboardSummary, DashboardSummaryData } from "../../lib/api";
import { IconSuccess, IconWebhook, IconCheck, IconTerminal, IconSlack, IconPagerDuty, IconArrowRight } from "../../components/icons";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [summary, setSummary] = useState<DashboardSummaryData | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    async function load() {
      const [data, sum] = await Promise.all([
        fetchAlerts(),
        fetchDashboardSummary(),
      ]);
      setAlerts(data);
      setSummary(sum);
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
  const activeChannels = summary?.active_channels ?? ["log"];

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
          <div className="stat-value">{activeChannels.length} Active</div>
          <div className="stat-sub">{activeChannels.join(", ")} enabled</div>
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
          {alerts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "var(--space-2xl)", color: "var(--text-secondary)" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "var(--space-sm)" }}><IconSuccess size={44} color="var(--color-healthy)" /></div>
              <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--color-healthy)", marginBottom: "var(--space-xs)" }}>
                All Systems Nominal
              </div>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", maxWidth: 440, margin: "0 auto", lineHeight: 1.5 }}>
                No active TTL warnings or archival threats detected. The Keeper daemon is actively monitoring on-chain storage buffers.
              </p>
            </div>
          ) : filteredAlerts.length === 0 ? (
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
                    <span className="badge badge-tier" style={{ textTransform: "capitalize", display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <IconWebhook size={12} /> {a.channel}
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
                    <span className="badge badge-healthy" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><IconCheck size={12} /> Resolved</span>
                  )}
                  <Link
                    href={`/contracts/${a.contractId}`}
                    className="btn btn-ghost"
                    style={{ padding: "4px 10px", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: 3 }}
                  >
                    View State <IconArrowRight size={12} />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Notification Channel Integrations */}
      <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "var(--space-md)", display: "flex", alignItems: "center", gap: "8px" }}>
        <span>Configured Dispatch Channels</span>
        <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          ({activeChannels.length}/4 Active)
        </span>
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "var(--space-lg)" }}>
        {/* System Logger */}
        <div className="card" style={{ display: "flex", flexDirection: "column", padding: "var(--space-lg)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-md)" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: "rgba(0, 240, 255, 0.1)",
                border: "1px solid rgba(0, 240, 255, 0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent-primary)",
                boxShadow: "0 0 12px rgba(0, 240, 255, 0.12)",
                flexShrink: 0,
              }}
            >
              <IconTerminal size={20} />
            </div>
            <span className="badge badge-healthy">
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-healthy)", boxShadow: "0 0 6px var(--color-healthy)", display: "inline-block" }} />
              Active
            </span>
          </div>

          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "var(--space-xs)" }}>
            System Logger
          </h3>
          <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.55, marginBottom: "var(--space-md)", flexGrow: 1 }}>
            Structured JSON logging via Pino to stdout/stderr. Always enabled as base fallback.
          </p>
          <div
            className="mono"
            style={{
              fontSize: "0.72rem",
              color: "var(--accent-primary)",
              background: "rgba(0, 240, 255, 0.05)",
              border: "1px solid rgba(0, 240, 255, 0.15)",
              padding: "7px 10px",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span style={{ opacity: 0.6 }}>›</span>
            <span>Channel: stdout/json</span>
          </div>
        </div>

        {/* Slack Webhook */}
        <div className="card" style={{ display: "flex", flexDirection: "column", padding: "var(--space-lg)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-md)" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: activeChannels.includes("slack") ? "rgba(0, 240, 255, 0.1)" : "rgba(255, 255, 255, 0.04)",
                border: activeChannels.includes("slack") ? "1px solid rgba(0, 240, 255, 0.25)" : "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: activeChannels.includes("slack") ? "var(--accent-primary)" : "var(--text-secondary)",
                boxShadow: activeChannels.includes("slack") ? "0 0 12px rgba(0, 240, 255, 0.12)" : "none",
                flexShrink: 0,
              }}
            >
              <IconSlack size={20} />
            </div>
            <span className={`badge ${activeChannels.includes("slack") ? "badge-healthy" : "badge-inactive"}`}>
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: activeChannels.includes("slack") ? "var(--color-healthy)" : "transparent",
                  border: activeChannels.includes("slack") ? "none" : "1.5px solid #64748B",
                  boxShadow: activeChannels.includes("slack") ? "0 0 6px var(--color-healthy)" : "none",
                  display: "inline-block",
                }}
              />
              {activeChannels.includes("slack") ? "Active" : "Not Set"}
            </span>
          </div>

          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "var(--space-xs)" }}>
            Slack Webhook
          </h3>
          <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.55, marginBottom: "var(--space-md)", flexGrow: 1 }}>
            Posts rich block notifications to Slack when contract TTL enters warning threshold.
          </p>
          <div
            className="mono"
            style={{
              fontSize: "0.72rem",
              color: activeChannels.includes("slack") ? "var(--accent-primary)" : "var(--text-muted)",
              background: activeChannels.includes("slack") ? "rgba(0, 240, 255, 0.05)" : "rgba(6, 10, 18, 0.7)",
              border: activeChannels.includes("slack") ? "1px solid rgba(0, 240, 255, 0.15)" : "1px dashed rgba(255, 255, 255, 0.1)",
              padding: "7px 10px",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span style={{ opacity: 0.6 }}>›</span>
            <span>{activeChannels.includes("slack") ? "Connected via SLACK_WEBHOOK_URL" : "Set SLACK_WEBHOOK_URL to enable"}</span>
          </div>
        </div>

        {/* PagerDuty Events v2 */}
        <div className="card" style={{ display: "flex", flexDirection: "column", padding: "var(--space-lg)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-md)" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: activeChannels.includes("pagerduty") ? "rgba(0, 240, 255, 0.1)" : "rgba(255, 255, 255, 0.04)",
                border: activeChannels.includes("pagerduty") ? "1px solid rgba(0, 240, 255, 0.25)" : "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: activeChannels.includes("pagerduty") ? "var(--accent-primary)" : "var(--text-secondary)",
                boxShadow: activeChannels.includes("pagerduty") ? "0 0 12px rgba(0, 240, 255, 0.12)" : "none",
                flexShrink: 0,
              }}
            >
              <IconPagerDuty size={20} />
            </div>
            <span className={`badge ${activeChannels.includes("pagerduty") ? "badge-healthy" : "badge-inactive"}`}>
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: activeChannels.includes("pagerduty") ? "var(--color-healthy)" : "transparent",
                  border: activeChannels.includes("pagerduty") ? "none" : "1.5px solid #64748B",
                  boxShadow: activeChannels.includes("pagerduty") ? "0 0 6px var(--color-healthy)" : "none",
                  display: "inline-block",
                }}
              />
              {activeChannels.includes("pagerduty") ? "Active" : "Not Set"}
            </span>
          </div>

          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "var(--space-xs)" }}>
            PagerDuty v2
          </h3>
          <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.55, marginBottom: "var(--space-md)", flexGrow: 1 }}>
            Triggers high-urgency incidents when critical state drops below emergency threshold.
          </p>
          <div
            className="mono"
            style={{
              fontSize: "0.72rem",
              color: activeChannels.includes("pagerduty") ? "var(--accent-primary)" : "var(--text-muted)",
              background: activeChannels.includes("pagerduty") ? "rgba(0, 240, 255, 0.05)" : "rgba(6, 10, 18, 0.7)",
              border: activeChannels.includes("pagerduty") ? "1px solid rgba(0, 240, 255, 0.15)" : "1px dashed rgba(255, 255, 255, 0.1)",
              padding: "7px 10px",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span style={{ opacity: 0.6 }}>›</span>
            <span>{activeChannels.includes("pagerduty") ? "Connected via PAGERDUTY_ROUTING_KEY" : "Set PAGERDUTY_ROUTING_KEY to enable"}</span>
          </div>
        </div>

        {/* Custom Webhook */}
        <div className="card" style={{ display: "flex", flexDirection: "column", padding: "var(--space-lg)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-md)" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: activeChannels.includes("webhook") ? "rgba(0, 240, 255, 0.1)" : "rgba(255, 255, 255, 0.04)",
                border: activeChannels.includes("webhook") ? "1px solid rgba(0, 240, 255, 0.25)" : "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: activeChannels.includes("webhook") ? "var(--accent-primary)" : "var(--text-secondary)",
                boxShadow: activeChannels.includes("webhook") ? "0 0 12px rgba(0, 240, 255, 0.12)" : "none",
                flexShrink: 0,
              }}
            >
              <IconWebhook size={20} />
            </div>
            <span className={`badge ${activeChannels.includes("webhook") ? "badge-healthy" : "badge-inactive"}`}>
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: activeChannels.includes("webhook") ? "var(--color-healthy)" : "transparent",
                  border: activeChannels.includes("webhook") ? "none" : "1.5px solid #64748B",
                  boxShadow: activeChannels.includes("webhook") ? "0 0 6px var(--color-healthy)" : "none",
                  display: "inline-block",
                }}
              />
              {activeChannels.includes("webhook") ? "Active" : "Not Set"}
            </span>
          </div>

          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "var(--space-xs)" }}>
            Custom Webhook
          </h3>
          <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.55, marginBottom: "var(--space-md)", flexGrow: 1 }}>
            Sends signed payloads for automated DevOps, Discord bots, or SIEM pipelines.
          </p>
          <div
            className="mono"
            style={{
              fontSize: "0.72rem",
              color: activeChannels.includes("webhook") ? "var(--accent-primary)" : "var(--text-muted)",
              background: activeChannels.includes("webhook") ? "rgba(0, 240, 255, 0.05)" : "rgba(6, 10, 18, 0.7)",
              border: activeChannels.includes("webhook") ? "1px solid rgba(0, 240, 255, 0.15)" : "1px dashed rgba(255, 255, 255, 0.1)",
              padding: "7px 10px",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span style={{ opacity: 0.6 }}>›</span>
            <span>{activeChannels.includes("webhook") ? "Connected via ALERT_WEBHOOK_URL" : "Set ALERT_WEBHOOK_URL to enable"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
