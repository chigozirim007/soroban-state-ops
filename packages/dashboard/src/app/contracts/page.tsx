"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MonitoredContract } from "../../lib/types";
import { fetchContracts } from "../../lib/api";

export default function ContractsPage() {
  const [contracts, setContracts] = useState<MonitoredContract[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [networkFilter, setNetworkFilter] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);

  // Form state for adding a contract
  const [newAddress, setNewAddress] = useState("");
  const [newName, setNewName] = useState("");
  const [newNetwork, setNewNetwork] = useState<"testnet" | "mainnet">("testnet");

  useEffect(() => {
    async function load() {
      const data = await fetchContracts();
      setContracts(data);
    }
    load();
  }, []);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddress || !newName) return;

    const newContract: MonitoredContract = {
      id: "C" + Math.random().toString(36).substring(2, 11).toUpperCase(),
      name: newName,
      network: newNetwork,
      address: newAddress,
      status: "healthy",
      totalKeys: 1,
      persistentKeys: 1,
      temporaryKeys: 0,
      instanceKeys: 0,
      minTtlLedgers: 535680,
      avgTtlLedgers: 535680,
      lastCheckTime: "Just now",
      nextRenewalEstimated: "in 31 days",
      keys: [
        {
          keyName: "ContractConfig",
          tier: "persistent",
          currentTtlLedgers: 535680,
          thresholdLedgers: 100000,
          targetLedgers: 535680,
          criticality: "high",
          mode: "keeper",
          valueSizeBytes: 128,
          health: "healthy",
          estimatedExpiryDate: "2026-10-06",
        },
      ],
    };

    setContracts([newContract, ...contracts]);
    setShowModal(false);
    setNewAddress("");
    setNewName("");
  };

  const filteredContracts = contracts.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.address.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const matchesNetwork = networkFilter === "all" || c.network === networkFilter;
    return matchesSearch && matchesStatus && matchesNetwork;
  });

  return (
    <div className="animate-in">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Contract State Registry</h1>
          <p className="page-subtitle">
            Monitored Soroban contracts with live TTL telemetry, rent expiration horizons, and policy enforcement.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          ➕ Watch New Contract
        </button>
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
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 260 }}>
          <input
            type="text"
            placeholder="Search by contract name or C... address"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "var(--space-sm) var(--space-md)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-primary)",
              fontFamily: "inherit",
              fontSize: "0.875rem",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: "var(--space-sm) var(--space-md)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-primary)",
              fontFamily: "inherit",
              fontSize: "0.875rem",
            }}
          >
            <option value="all">All Statuses</option>
            <option value="healthy">Healthy</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>

          <select
            value={networkFilter}
            onChange={(e) => setNetworkFilter(e.target.value)}
            style={{
              padding: "var(--space-sm) var(--space-md)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-primary)",
              fontFamily: "inherit",
              fontSize: "0.875rem",
            }}
          >
            <option value="all">All Networks</option>
            <option value="testnet">Testnet</option>
            <option value="mainnet">Mainnet</option>
          </select>
        </div>
      </div>

      {/* Contracts Grid / Table */}
      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Health</th>
                <th>Contract Details</th>
                <th>Network</th>
                <th>State Entries</th>
                <th>Min TTL Buffer</th>
                <th>Keeper Renewal</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "var(--space-2xl)" }}>
                    No contracts matching criteria.
                  </td>
                </tr>
              ) : (
                filteredContracts.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
                        <span className={`health-dot ${c.status}`} />
                        <span className={`badge badge-${c.status}`}>{c.status}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</div>
                      <div className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {c.address.slice(0, 14)}...{c.address.slice(-8)}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-tier">{c.network}</span>
                    </td>
                    <td>
                      <span className="badge badge-tier" style={{ marginRight: 4 }}>
                        {c.persistentKeys} Persistent
                      </span>
                      {c.temporaryKeys > 0 && (
                        <span className="badge badge-info" style={{ marginRight: 4 }}>
                          {c.temporaryKeys} Temp
                        </span>
                      )}
                      {c.instanceKeys > 0 && <span className="badge badge-warning">{c.instanceKeys} Inst</span>}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.minTtlLedgers.toLocaleString()} ledgers</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        ~{Math.round(c.minTtlLedgers / 17280)} days remaining
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>{c.nextRenewalEstimated}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Checked {c.lastCheckTime}</div>
                    </td>
                    <td>
                      <Link href={`/contracts/${c.id}`} className="btn btn-ghost" style={{ padding: "4px 12px", fontSize: "0.8rem" }}>
                        Inspect State →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Watch Contract Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 520,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-default)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-lg)" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Watch New Soroban Contract</h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.2rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: 4 }}>
                  Contract Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Venus Lending Pool"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "var(--space-sm) var(--space-md)",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: 4 }}>
                  Contract Address (C...)
                </label>
                <input
                  type="text"
                  placeholder="CA..."
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  required
                  className="mono"
                  style={{
                    width: "100%",
                    padding: "var(--space-sm) var(--space-md)",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: 4 }}>
                  Target Network
                </label>
                <select
                  value={newNetwork}
                  onChange={(e) => setNewNetwork(e.target.value as any)}
                  style={{
                    width: "100%",
                    padding: "var(--space-sm) var(--space-md)",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="testnet">Stellar Testnet</option>
                  <option value="mainnet">Stellar Mainnet</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-sm)", marginTop: "var(--space-md)" }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Start Watching
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
