/**
 * AlertDispatcher — sends alerts through configured channels (log, webhook, Slack, PagerDuty).
 */

import type { Logger } from "pino";
import type { AlertChannel } from "@soroban-ops/shared-types";

interface AlertPayload {
  alert_type: string;
  severity: string;
  message: string;
  contract_id: string;
  key_name: string;
  ttl_at_alert?: number;
  threshold?: number;
}

// Cooldown tracking to prevent duplicate alerts
const alertCooldowns = new Map<string, number>();
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export class AlertDispatcher {
  constructor(
    private channels: AlertChannel[],
    private logger: Logger
  ) {}

  /**
   * Dispatch an alert through all configured channels.
   */
  async dispatch(payload: AlertPayload): Promise<void> {
    // Deduplication check
    const dedupeKey = `${payload.contract_id}:${payload.key_name}:${payload.alert_type}`;
    const lastSent = alertCooldowns.get(dedupeKey);
    if (lastSent && Date.now() - lastSent < COOLDOWN_MS) {
      this.logger.debug({ dedupeKey }, "Alert suppressed (cooldown)");
      return;
    }
    alertCooldowns.set(dedupeKey, Date.now());

    const severityRank = { low: 0, medium: 1, high: 2, critical: 3 };
    const payloadRank = severityRank[payload.severity as keyof typeof severityRank] ?? 0;

    for (const channel of this.channels) {
      const channelRank = severityRank[channel.min_severity as keyof typeof severityRank] ?? 0;

      // Skip channels below severity threshold
      if (payloadRank < channelRank) continue;

      try {
        await this.sendToChannel(channel, payload);
      } catch (err) {
        this.logger.error(
          { err, channelType: channel.type },
          "Failed to send alert"
        );
      }
    }
  }

  private async sendToChannel(
    channel: AlertChannel,
    payload: AlertPayload
  ): Promise<void> {
    switch (channel.type) {
      case "log":
        this.sendLog(payload);
        break;
      case "webhook":
        await this.sendWebhook(channel, payload);
        break;
      case "slack":
        await this.sendSlack(channel, payload);
        break;
      case "pagerduty":
        await this.sendPagerDuty(channel, payload);
        break;
    }
  }

  private sendLog(payload: AlertPayload): void {
    const emoji =
      payload.severity === "critical" ? "🚨" :
      payload.severity === "high" ? "🔴" :
      payload.severity === "medium" ? "🟡" : "🔵";

    this.logger.info(
      {
        alertType: payload.alert_type,
        severity: payload.severity,
        contract: payload.contract_id,
        key: payload.key_name,
      },
      `${emoji} ALERT: ${payload.message}`
    );
  }

  private async sendWebhook(
    channel: Extract<AlertChannel, { type: "webhook" }>,
    payload: AlertPayload
  ): Promise<void> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (channel.auth_header) {
      headers["Authorization"] = channel.auth_header;
    }

    await fetch(channel.url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        source: "soroban-state-ops/keeper",
        ...payload,
        timestamp: new Date().toISOString(),
      }),
    });

    this.logger.debug({ url: channel.url }, "Webhook alert sent");
  }

  private async sendSlack(
    channel: Extract<AlertChannel, { type: "slack" }>,
    payload: AlertPayload
  ): Promise<void> {
    const emoji =
      payload.severity === "critical" ? ":rotating_light:" :
      payload.severity === "high" ? ":red_circle:" :
      payload.severity === "medium" ? ":warning:" : ":information_source:";

    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${emoji} Soroban State Alert`,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Severity:*\n${payload.severity.toUpperCase()}` },
          { type: "mrkdwn", text: `*Type:*\n${payload.alert_type}` },
          { type: "mrkdwn", text: `*Contract:*\n\`${payload.contract_id.slice(0, 16)}...\`` },
          { type: "mrkdwn", text: `*Key:*\n${payload.key_name}` },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: payload.message },
      },
    ];

    await fetch(channel.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: channel.channel,
        blocks,
      }),
    });

    this.logger.debug("Slack alert sent");
  }

  private async sendPagerDuty(
    channel: Extract<AlertChannel, { type: "pagerduty" }>,
    payload: AlertPayload
  ): Promise<void> {
    const pdSeverity =
      payload.severity === "critical" ? "critical" :
      payload.severity === "high" ? "error" :
      payload.severity === "medium" ? "warning" : "info";

    await fetch("https://events.pagerduty.com/v2/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        routing_key: channel.routing_key,
        event_action: "trigger",
        payload: {
          summary: payload.message,
          severity: pdSeverity,
          source: "soroban-state-ops/keeper",
          component: payload.key_name,
          group: payload.contract_id,
          custom_details: {
            alert_type: payload.alert_type,
            ttl_at_alert: payload.ttl_at_alert,
            threshold: payload.threshold,
          },
        },
      }),
    });

    this.logger.debug("PagerDuty alert sent");
  }
}
