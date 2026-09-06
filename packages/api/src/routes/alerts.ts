/**
 * Alert management routes.
 */

import type { FastifyInstance } from "fastify";

export async function registerAlertRoutes(app: FastifyInstance): Promise<void> {
  const db = (app as any).db;

  // List alerts (paginated, filterable)
  app.get<{
    Querystring: {
      page?: string;
      per_page?: string;
      acknowledged?: string;
      severity?: string;
      contract_id?: string;
    };
  }>("/api/alerts", async (request, reply) => {
    const page = Math.max(1, Number(request.query.page ?? 1));
    const perPage = Math.min(100, Math.max(1, Number(request.query.per_page ?? 25)));
    const offset = (page - 1) * perPage;

    let where = "WHERE 1=1";
    const params: unknown[] = [];
    let paramIdx = 1;

    if (request.query.acknowledged !== undefined) {
      where += ` AND acknowledged = $${paramIdx++}`;
      params.push(request.query.acknowledged === "true");
    }

    if (request.query.severity) {
      where += ` AND severity = $${paramIdx++}`;
      params.push(request.query.severity);
    }

    if (request.query.contract_id) {
      where += ` AND contract_id = $${paramIdx++}`;
      params.push(request.query.contract_id);
    }

    const [alerts, total] = await Promise.all([
      db.query(
        `SELECT a.*, c.name as contract_name, c.contract_id as stellar_contract_id
         FROM alerts a
         LEFT JOIN contracts c ON c.id = a.contract_id
         ${where}
         ORDER BY a.created_at DESC
         LIMIT ${perPage} OFFSET ${offset}`,
        params
      ),
      db.query(`SELECT COUNT(*) as count FROM alerts ${where}`, params),
    ]);

    return reply.send({
      alerts: alerts.rows,
      pagination: {
        page,
        per_page: perPage,
        total: Number(total.rows[0].count),
        total_pages: Math.ceil(Number(total.rows[0].count) / perPage),
      },
    });
  });

  // Acknowledge an alert
  app.post<{
    Params: { id: string };
    Body: { acknowledged_by?: string };
  }>("/api/alerts/acknowledge/:id", async (request, reply) => {
    const { id } = request.params;
    const acknowledgedBy = (request.body as any)?.acknowledged_by ?? "api-user";

    const result = await db.query(
      `UPDATE alerts
       SET acknowledged = TRUE, acknowledged_by = $2, acknowledged_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, acknowledgedBy]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: "Alert not found" });
    }

    return reply.send({ alert: result.rows[0] });
  });

  // Bulk acknowledge alerts
  app.post<{
    Body: { alert_ids: string[]; acknowledged_by?: string };
  }>("/api/alerts/acknowledge-bulk", async (request, reply) => {
    const { alert_ids, acknowledged_by = "api-user" } = request.body as any;

    if (!Array.isArray(alert_ids) || alert_ids.length === 0) {
      return reply.status(400).send({ error: "alert_ids array required" });
    }

    const result = await db.query(
      `UPDATE alerts
       SET acknowledged = TRUE, acknowledged_by = $2, acknowledged_at = NOW()
       WHERE id = ANY($1)
       RETURNING id`,
      [alert_ids, acknowledged_by]
    );

    return reply.send({ acknowledged: result.rows.length });
  });

  // Resolve an alert
  app.post<{
    Params: { id: string };
    Body: { resolved_by?: string };
  }>("/api/alerts/resolve/:id", async (request, reply) => {
    const { id } = request.params;
    const resolvedBy = (request.body as any)?.resolved_by ?? "api-user";

    const result = await db.query(
      `UPDATE alerts
       SET acknowledged = TRUE, acknowledged_by = $2, acknowledged_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, resolvedBy]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: "Alert not found" });
    }

    return reply.send({ alert: result.rows[0], resolved: true });
  });

  // Bulk resolve alerts
  app.post<{
    Body: { alert_ids: string[]; resolved_by?: string };
  }>("/api/alerts/resolve-bulk", async (request, reply) => {
    const { alert_ids, resolved_by = "api-user" } = request.body as any;

    if (!Array.isArray(alert_ids) || alert_ids.length === 0) {
      return reply.status(400).send({ error: "alert_ids array required" });
    }

    const result = await db.query(
      `UPDATE alerts
       SET acknowledged = TRUE, acknowledged_by = $2, acknowledged_at = NOW()
       WHERE id = ANY($1)
       RETURNING id`,
      [alert_ids, resolved_by]
    );

    return reply.send({ resolved: result.rows.length });
  });
}
