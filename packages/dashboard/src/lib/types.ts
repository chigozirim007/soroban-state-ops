export type StorageTier = "persistent" | "temporary" | "instance";
export type TtlHealth = "healthy" | "warning" | "critical" | "archived";
export type RenewalMode = "bump-on-access" | "keeper" | "sponsored" | "user-pays-on-access" | "manual";
export type Criticality = "low" | "medium" | "high" | "critical";

export interface StateKeyEntry {
  keyName: string;
  tier: StorageTier;
  currentTtlLedgers: number;
  thresholdLedgers: number;
  targetLedgers: number;
  lastRenewedLedger?: number;
  lastRenewedAt?: string;
  criticality: Criticality;
  mode: RenewalMode;
  valueSizeBytes: number;
  health: TtlHealth;
  estimatedExpiryDate: string;
}

export interface MonitoredContract {
  id: string;
  name: string;
  network: "testnet" | "mainnet" | "futurenet" | "local";
  address: string;
  status: TtlHealth;
  totalKeys: number;
  persistentKeys: number;
  temporaryKeys: number;
  instanceKeys: number;
  minTtlLedgers: number;
  avgTtlLedgers: number;
  lastCheckTime: string;
  nextRenewalEstimated: string;
  keys: StateKeyEntry[];
}

export interface AlertItem {
  id: string;
  contractId: string;
  contractName: string;
  keyName: string;
  severity: "critical" | "warning" | "info";
  message: string;
  remainingLedgers: number;
  thresholdLedgers: number;
  createdAt: string;
  acknowledged: boolean;
  channel: "slack" | "pagerduty" | "webhook";
  status: "active" | "acknowledged" | "resolved";
}

export interface CostCalculationInput {
  tier: StorageTier;
  cardinality: number;
  keySizeBytes: number;
  valueSizeBytes: number;
  targetTtlLedgers: number;
  network: "mainnet" | "testnet";
}

export interface CostCalculationResult {
  entrySizeBytes: number;
  totalStorageBytes: number;
  initialWriteXlm: number;
  rentPerLedgerXlm: number;
  rentPerDayXlm: number;
  rentPerMonthXlm: number;
  rentPerYearXlm: number;
  renewalCyclesPerYear: number;
  annualRenewalFeeXlm: number;
  totalAnnualCostXlm: number;
}
