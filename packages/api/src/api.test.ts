import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { registerCostRoutes } from "./routes/cost.js";

describe("API — Cost Estimator Route", () => {
  it("calculates storage rent estimate correctly", async () => {
    const app = Fastify();
    await registerCostRoutes(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/cost/estimate",
      payload: {
        entries: [
          {
            tier: "persistent",
            cardinality: 1000,
            key_size_bytes: 32,
            value_size_bytes: 256,
            target_ttl_ledgers: 535680,
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    const json = JSON.parse(response.body);
    expect(json.entries.length).toBe(1);
    expect(json.entries[0].tier).toBe("persistent");
    expect(json.total_xlm).toBeGreaterThan(0);
    expect(json.total_per_year_xlm).toBeGreaterThan(0);
  }, 15000);

  it("returns 400 for empty or invalid entries", async () => {
    const app = Fastify();
    await registerCostRoutes(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/cost/estimate",
      payload: {
        entries: [],
      },
    });

    expect(response.statusCode).toBe(400);
  }, 15000);
});
