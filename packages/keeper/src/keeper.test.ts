import { describe, it, expect, vi } from "vitest";
import { AlertDispatcher } from "./alerts.js";

describe("Keeper AlertDispatcher", () => {
  it("dispatches alerts to log channel and deduplicates within cooldown window", async () => {
    const mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as any;

    const dispatcher = new AlertDispatcher(
      [{ type: "log", min_severity: "low" }],
      mockLogger
    );

    const alert = {
      alert_type: "ttl_warning",
      severity: "warning",
      message: "TTL approaching threshold",
      contract_id: "CA1234",
      key_name: "ReserveData",
      ttl_at_alert: 90000,
      threshold: 100000,
    };

    // First dispatch should succeed
    await dispatcher.dispatch(alert);
    expect(mockLogger.info).toHaveBeenCalledTimes(1);

    // Immediate second dispatch should be suppressed by deduplication
    await dispatcher.dispatch(alert);
    expect(mockLogger.info).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ dedupeKey: "CA1234:ReserveData:ttl_warning" }),
      "Alert suppressed (cooldown)"
    );
  });
});
