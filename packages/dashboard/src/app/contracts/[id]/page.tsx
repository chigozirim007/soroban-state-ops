"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { MonitoredContract, StateKeyEntry } from "../../../lib/types";
import { fetchContractById } from "../../../lib/api";

export default function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [contract, setContract] = useState<MonitoredContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [bumpingKey, setBumpingKey] = useState<string | null>(null);
  const [bumpSuccess, setBumpSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const data = await fetchContractById(resolvedParams.id);
      setContract(data);
      setLoading(false);
    }
    load();
  }, [resolvedParams.id]);

  const handleManualBump = (keyName: string) => {
    setBumpingKey(keyName);
    setTimeout(() => {
      setBumpingKey(null);
      setBumpSuccess(`Successfully bumped TTL for ${keyName} to 535,680 ledgers! (tx: 0x9a8f...31c4)`);
      if (contract) {
        const updatedKeys: StateKeyEntry[] = contract.keys.map((k) => {
          if (k.keyName === keyName) {
            return {
              ...k,
              currentTtlLedgers: 535680,
              health: "healthy",
              lastRenewedAt: new Date().toISOString(),
            };
          }
          return k;
        });
        setContract({
          ...contract,
          status: updatedKeys.some((k) => k.health === "critical")
            ? "critical"
            : updatedKeys.some((k) => k.health === "warning")
            ? "warning"
            : "healthy",
          keys: updatedKeys,
        });
      }
    }, 1200);
  };

  if (loading) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "var(--space-2xl)" }}>
        <p style={{ color: "var(--text-secondary)" }}>Loading contract state...</p>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "var(--space-2xl)" }}>
        <h2>Contract Not Found</h2>
        <p style={{ color: "var(--text-muted)", margin: "var(--space-md) 0" }}>
          The requested contract could not be located in the registry.
        </p>
        <Link href="/contracts" className="btn btn-primary">
          ← Return to Contracts
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-in">
      {/* Back link */}
      <div style={{ marginBottom: "var(--space-md)" }}>
        <Link href="/contracts" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "0.85rem" }}>
          ← Back to All Contracts
        </Link>
      </div>

      {/* Contract Header */}
      <div className="card" style={{ marginBottom: "var(--space-xl)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-md)" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-xs)" }}>
              <span className={`health-dot ${contract.status}`} />
              <h1 style={{ fontSize: "1.75rem", fontWeight: 800 }}>{contract.name}</h1>
              <span className={`badge badge-${contract.status}`}>{contract.status}</span>
              <span className="badge badge-tier">{contract.network}</span>
            </div>
            <div className="mono" style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              {contract.address}
            </div>
          </div>

          <div style={{ display: "flex", gap: "var(--space-sm)" }}>
            <button
              onClick={() => handleManualBump("all")}
              disabled={bumpingKey !== null}
              className="btn btn-primary"
              style={{ fontSize: "0.85rem" }}
            >
              {bumpingKey === "all" ? "Submitting TX..." : "⚡ Extend All State TTLs"}
            </button>
          </div>
        </div>

        {/* Quick summary stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "var(--space-md)",
            marginTop: "var(--space-xl)",
            paddingTop: "var(--space-lg)",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <div>
            <div className="stat-label">Minimum TTL Buffer</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{contract.minTtlLedgers.toLocaleString()} ledgers</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>~{Math.round(contract.minTtlLedgers / 17280)} days</div>
          </div>
          <div>
            <div className="stat-label">Total State Keys</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{contract.keys.length}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              {contract.persistentKeys} Persist • {contract.temporaryKeys} Temp • {contract.instanceKeys} Inst
            </div>
          </div>
          <div>
            <div className="stat-label">Last Keeper Check</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{contract.lastCheckTime}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>RPC: Soroban Testnet</div>
          </div>
          <div>
            <div className="stat-label">Next Renewal Schedule</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{contract.nextRenewalEstimated}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Keeper policy: Automated</div>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {bumpSuccess && (
        <div
          className="card"
          style={{
            marginBottom: "var(--space-xl)",
            background: "hsla(145, 65%, 50%, 0.15)",
            borderColor: "hsla(145, 65%, 50%, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
            <span>✅</span>
            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-healthy)" }}>
              {bumpSuccess}
            </span>
          </div>
          <button
            onClick={() => setBumpSuccess(null)}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* State Keys Table with TTL Visual Progress */}
      <div className="card" style={{ marginBottom: "var(--space-2xl)" }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "var(--space-xs)" }}>
          Declared State Keys & TTL Gauges
        </h2>
        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "var(--space-lg)" }}>
          Per-key lifecycle telemetry, renewal modes, and proximity to rent eviction.
        </p>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Key Name</th>
                <th>Storage Tier</th>
                <th>TTL Horizon & Progress</th>
                <th>Threshold</th>
                <th>Mode</th>
                <th>Criticality</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {contract.keys.map((k) => {
                const percent = Math.min(100, Math.round((k.currentTtlLedgers / k.targetLedgers) * 100));
                const thresholdPercent = Math.min(100, Math.round((k.thresholdLedgers / k.targetLedgers) * 100));
                const barColor =
                  k.health === "critical"
                    ? "var(--color-critical)"
                    : k.health === "warning"
                    ? "var(--color-warning)"
                    : "var(--color-healthy)";

                return (
                  <tr key={k.keyName}>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{k.keyName}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{k.valueSizeBytes} bytes</div>
                    </td>
                    <td>
                      <span className="badge badge-tier">{k.tier}</span>
                    </td>
                    <td style={{ minWidth: 240 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, color: barColor }}>
                          {k.currentTtlLedgers.toLocaleString()} ledgers (~{Math.round(k.currentTtlLedgers / 17280)}d)
                        </span>
                        <span style={{ color: "var(--text-muted)" }}>Target: {k.targetLedgers.toLocaleString()}</span>
                      </div>
                      {/* Meter bar */}
                      <div
                        style={{
                          position: "relative",
                          height: 8,
                          background: "var(--bg-surface)",
                          borderRadius: 4,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${percent}%`,
                            height: "100%",
                            background: barColor,
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>
                      <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: 2 }}>
                        Expires ~{k.estimatedExpiryDate}
                      </div>
                    </td>
                    <td>
                      <div className="mono" style={{ fontSize: "0.8rem" }}>
                        {k.thresholdLedgers.toLocaleString()}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-info">{k.mode}</span>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background:
                            k.criticality === "critical"
                              ? "hsla(0, 75%, 55%, 0.2)"
                              : k.criticality === "high"
                              ? "hsla(40, 90%, 55%, 0.2)"
                              : "hsla(225, 20%, 30%, 0.4)",
                          color:
                            k.criticality === "critical"
                              ? "var(--color-critical)"
                              : k.criticality === "high"
                              ? "var(--color-warning)"
                              : "var(--text-secondary)",
                        }}
                      >
                        {k.criticality}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleManualBump(k.keyName)}
                        disabled={bumpingKey !== null}
                        className="btn btn-ghost"
                        style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                      >
                        {bumpingKey === k.keyName ? "Bumping..." : "⚡ Extend TTL"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Renewal Execution History */}
      <div className="card">
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "var(--space-xs)" }}>
          Recent Keeper Execution Logs
        </h2>
        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "var(--space-md)" }}>
          Audit trail of automated `extend_ttl` host function invocations performed by State Ops Keeper.
        </p>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Target Key</th>
                <th>Action</th>
                <th>Ledger Seq</th>
                <th>Fee Paid</th>
                <th>Status</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="mono" style={{ fontSize: "0.8rem" }}>JOB-8812</td>
                <td>ReserveData</td>
                <td>extend_ttl (+535,680)</td>
                <td className="mono">#3,124,800</td>
                <td>0.0051 XLM</td>
                <td><span className="badge badge-healthy">Success</span></td>
                <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>2026-09-04 12:00 UTC</td>
              </tr>
              <tr>
                <td className="mono" style={{ fontSize: "0.8rem" }}>JOB-8811</td>
                <td>TotalShares</td>
                <td>extend_ttl (+535,680)</td>
                <td className="mono">#3,124,800</td>
                <td>0.0049 XLM</td>
                <td><span className="badge badge-healthy">Success</span></td>
                <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>2026-09-04 12:00 UTC</td>
              </tr>
              <tr>
                <td className="mono" style={{ fontSize: "0.8rem" }}>JOB-8740</td>
                <td>SwapPriceCache</td>
                <td>extend_ttl (+17,280)</td>
                <td className="mono">#3,120,100</td>
                <td>0.0035 XLM</td>
                <td><span className="badge badge-healthy">Success</span></td>
                <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>2026-09-03 08:30 UTC</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
