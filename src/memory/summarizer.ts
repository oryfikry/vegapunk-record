import { LLMRouter, type LLMResponse } from "../llm";
import type { ActivityLog } from "../db";

export type SleepSummaryInput = {
  agentId: string | null;
  activities: ActivityLog[];
};

export type SleepSummary = {
  content: string;
  model: string;
  provider: string;
  usage?: LLMResponse["usage"];
};

export type SleepSummarizer = {
  summarize(input: SleepSummaryInput): Promise<SleepSummary>;
};

function formatActivity(activity: ActivityLog): string {
  return [
    `id=${activity.id}`,
    `timestamp=${activity.timestamp}`,
    `agent=${activity.agent_id ?? "unassigned"}`,
    `task=${activity.task_id ?? "none"}`,
    `type=${activity.type}`,
    `level=${activity.level}`,
    `source=${activity.source}`,
    `message=${activity.message}`,
  ].join(" | ");
}

export function buildSleepSummaryPrompt(input: SleepSummaryInput): string {
  const activities = [...input.activities].sort((left, right) => left.timestamp.localeCompare(right.timestamp) || left.id.localeCompare(right.id));
  const agent = input.agentId ?? "unassigned";

  return [
    "Create a concise nightly sleep summary for Vegapunk-Record.",
    "Use only the supplied activity logs. Preserve important facts, decisions, blockers, and follow-up signals.",
    `Agent group: ${agent}`,
    "Activity logs:",
    ...activities.map(formatActivity),
  ].join("\n");
}

export function createSleepSummarizer(router = new LLMRouter()): SleepSummarizer {
  return {
    async summarize(input: SleepSummaryInput): Promise<SleepSummary> {
      const response = await router.route({
        model: "sleep-summary-mockable",
        temperature: 0,
        max_tokens: 512,
        messages: [
          {
            role: "system",
            content: "You summarize local activity logs into durable core knowledge. Be deterministic and do not invent facts.",
          },
          {
            role: "user",
            content: buildSleepSummaryPrompt(input),
          },
        ],
      });

      return {
        content: response.content,
        model: response.model,
        provider: response.provider,
        usage: response.usage,
      };
    },
  };
}
