import { MonitoredContract, AlertItem, CostCalculationInput, CostCalculationResult } from "./types";
import { MOCK_CONTRACTS, MOCK_ALERTS } from "./mock-data";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface DashboardSummaryData {
  total_contracts: number;
  total_state_keys: number;
  health_distribution: {
    healthy: number;
    warning: number;
    critical: number;
    archived: number;
  };
  active_alerts: number;
  pending_jobs: number;
  total_renewal_cost_xlm: number;
  last_snapshot_at?: string | null;
}

export async function fetchContracts(): Promise<MonitoredContract[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/contracts`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      const rawList = Array.isArray(data) ? data : Array.isArray(data?.contracts) ? data.contracts : null;
      if (rawList && rawList.length > 0) {
        return rawList.map((c: any) => ({
          id: c.id ?? c.contract_id,
          name: c.name ?? "Contract",
          network: c.network ?? "testnet",
          address: c.address ?? c.contract_id,
          status: c.status ?? "healthy",
          totalKeys: c.total_keys ?? c.keys?.length ?? 1,
          persistentKeys: c.persistent_keys ?? 1,
          temporaryKeys: c.temporary_keys ?? 0,
          instanceKeys: c.instance_keys ?? 0,
          minTtlLedgers: c.min_ttl_ledgers ?? 535680,
          avgTtlLedgers: c.avg_ttl_ledgers ?? 535680,
          lastCheckTime: c.last_polled_at ? new Date(c.last_polled_at).toLocaleTimeString() : "Recently",
          nextRenewalEstimated: "Policy automated",
          keys: Array.isArray(c.keys) ? c.keys : [],
        }));
      }
    }
  } catch {
    // Graceful fallback to mock data
  }
  return MOCK_CONTRACTS;
}

export async function fetchContractById(id: string): Promise<MonitoredContract | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/contracts/${id}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data) {
        const c = data.contract ?? data;
        return {
          id: c.id ?? c.contract_id,
          name: c.name ?? "Contract",
          network: c.network ?? "testnet",
          address: c.address ?? c.contract_id,
          status: c.status ?? (data.keys?.some((k: any) => k.health === "critical") ? "critical" : "healthy"),
          totalKeys: data.keys?.length ?? 1,
          persistentKeys: data.keys?.filter((k: any) => k.tier === "persistent").length ?? 1,
          temporaryKeys: data.keys?.filter((k: any) => k.tier === "temporary").length ?? 0,
          instanceKeys: data.keys?.filter((k: any) => k.tier === "instance").length ?? 0,
          minTtlLedgers: Math.min(...(data.keys?.map((k: any) => k.currentTtlLedgers) ?? [535680])),
          avgTtlLedgers: 535680,
          lastCheckTime: "Recently",
          nextRenewalEstimated: "Policy automated",
          keys: Array.isArray(data.keys) ? data.keys : [],
        };
      }
    }
  } catch {
    // Graceful fallback
  }
  return MOCK_CONTRACTS.find((c) => c.id === id || c.address === id) || null;
}

export async function fetchAlerts(): Promise<AlertItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/alerts`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      const rawAlerts = Array.isArray(data) ? data : Array.isArray(data?.alerts) ? data.alerts : null;
      if (rawAlerts && rawAlerts.length > 0) {
        return rawAlerts.map((a: any) => ({
          id: a.id ?? "ALT",
          contractId: a.contract_id ?? "",
          contractName: a.contract_name ?? "Contract",
          keyName: a.key_name ?? "StateKey",
          severity: a.severity ?? "warning",
          message: a.message ?? "",
          remainingLedgers: a.ttl_at_alert ?? 0,
          thresholdLedgers: a.threshold ?? 100000,
          createdAt: a.created_at ?? new Date().toISOString(),
          acknowledged: Boolean(a.acknowledged),
          channel: (a.channel as any) ?? "webhook",
          status: a.acknowledged ? "acknowledged" : "active",
        }));
      }
    }
  } catch {
    // Graceful fallback
  }
  return MOCK_ALERTS;
}

export async function fetchDashboardSummary(): Promise<DashboardSummaryData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/dashboard/summary`, { cache: "no-store" });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Graceful fallback
  }
  return null;
}

/**
 * Soroban Protocol State Rent & Lifecycle Calculator
 * Parameters based on Protocol 20/21 rent formulas:
 * - 1 ledger close time: ~5 seconds = 17,280 ledgers/day = 518,400 ledgers/month = 6,307,200 ledgers/year
 * - Rent fee per byte per ledger: ~0.000000002 XLM (2 stroops per KB per ledger)
 * - Base entry write fee: ~0.01 XLM per entry
 */
export function calculateStorageCost(input: CostCalculationInput): CostCalculationResult {
  const entrySizeBytes = input.keySizeBytes + input.valueSizeBytes + 64; // +64 bytes protocol metadata overhead
  const totalStorageBytes = entrySizeBytes * input.cardinality;

  // Initial footprint write cost (XLM)
  const baseWritePerEntry = input.tier === "temporary" ? 0.002 : input.tier === "instance" ? 0.005 : 0.01;
  const initialWriteXlm = baseWritePerEntry * input.cardinality;

  // Rent rate per byte per ledger in XLM
  // Persistent storage costs ~2 stroops (0.0000002 XLM) per KB per ledger
  // Temporary storage costs ~0.5 stroops per KB per ledger
  const ratePerBytePerLedger =
    input.tier === "persistent"
      ? 0.0000000002
      : input.tier === "instance"
      ? 0.00000000015
      : 0.00000000005;

  const rentPerLedgerXlm = totalStorageBytes * ratePerBytePerLedger;
  const ledgersPerDay = 17280;
  const ledgersPerMonth = ledgersPerDay * 30;
  const ledgersPerYear = ledgersPerDay * 365;

  const rentPerDayXlm = rentPerLedgerXlm * ledgersPerDay;
  const rentPerMonthXlm = rentPerLedgerXlm * ledgersPerMonth;
  const rentPerYearXlm = rentPerLedgerXlm * ledgersPerYear;

  // Renewal frequency
  const targetLedgers = Math.max(input.targetTtlLedgers, 17280);
  const renewalCyclesPerYear = Math.ceil(ledgersPerYear / targetLedgers);
  const keeperGasPerRenewal = 0.005; // ~0.005 XLM invoke fee per extend_ttl
  const annualRenewalFeeXlm = renewalCyclesPerYear * keeperGasPerRenewal;

  const totalAnnualCostXlm = rentPerYearXlm + annualRenewalFeeXlm;

  return {
    entrySizeBytes,
    totalStorageBytes,
    initialWriteXlm,
    rentPerLedgerXlm,
    rentPerDayXlm,
    rentPerMonthXlm,
    rentPerYearXlm,
    renewalCyclesPerYear,
    annualRenewalFeeXlm,
    totalAnnualCostXlm,
  };
}

export async function registerContract(data: {
  contract_id: string;
  name: string;
  network: string;
  policy_toml?: string;
  tags?: string[];
}): Promise<{ success: boolean; contract?: any; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/contracts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const json = await res.json();
      return { success: true, contract: json.contract };
    }
    const err = await res.json().catch(() => ({}));
    return { success: false, error: err.error?.message || err.error || "Failed to register contract" };
  } catch (err: any) {
    return { success: false, error: err.message || "Network error" };
  }
}

export async function deleteContract(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/contracts/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      return { success: true };
    }
    const err = await res.json().catch(() => ({}));
    return { success: false, error: err.error || "Failed to delete contract" };
  } catch (err: any) {
    return { success: false, error: err.message || "Network error" };
  }
}

export async function renewContractKey(
  contractId: string,
  keyName: string,
  targetLedgers?: number
): Promise<{ success: boolean; job?: any; message?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/contracts/${contractId}/renew`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key_name: keyName, target_ledgers: targetLedgers }),
    });
    if (res.ok) {
      const json = await res.json();
      return { success: true, job: json.job, message: json.message };
    }
    const err = await res.json().catch(() => ({}));
    return { success: false, error: err.error || "Failed to queue renewal job" };
  } catch (err: any) {
    return { success: false, error: err.message || "Network error" };
  }
}

export async function acknowledgeAlert(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/alerts/acknowledge/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acknowledged_by: "dashboard-user" }),
    });
    if (res.ok) {
      return { success: true };
    }
    return { success: false, error: "Failed to acknowledge alert" };
  } catch (err: any) {
    return { success: false, error: err.message || "Network error" };
  }
}

export async function resolveAlert(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/alerts/resolve/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved_by: "dashboard-user" }),
    });
    if (res.ok) {
      return { success: true };
    }
    return { success: false, error: "Failed to resolve alert" };
  } catch (err: any) {
    return { success: false, error: err.message || "Network error" };
  }
}

