import { MonitoredContract, AlertItem, CostCalculationInput, CostCalculationResult } from "./types";
import { MOCK_CONTRACTS, MOCK_ALERTS } from "./mock-data";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function fetchContracts(): Promise<MonitoredContract[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/contracts`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
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
      return await res.json();
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
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch {
    // Graceful fallback
  }
  return MOCK_ALERTS;
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
