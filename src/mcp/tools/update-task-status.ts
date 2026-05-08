import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod/v4";
import type { Task, TaskStatus, VegapunkDatabase } from "../../db";
import { taskStatuses } from "../../db";

export const updateTaskStatusInputSchema = {
  task_id: z.string().trim().min(1),
  status: z.enum(taskStatuses),
  agent_id: z.string().trim().min(1),
};

export const updateTaskStatusOutputSchema = {
  ok: z.boolean(),
  task: z.object({
    task_id: z.string(),
    assigned_to: z.string().nullable(),
    status: z.enum(taskStatuses),
    updated_at: z.string(),
  }),
};

export type UpdateTaskStatusInput = {
  task_id: string;
  status: TaskStatus;
  agent_id: string;
};

type UpdateTaskStatusStructuredOutput = {
  ok: true;
  task: Pick<Task, "task_id" | "assigned_to" | "status" | "updated_at">;
};

function toolError(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

export async function updateTaskStatusTool(db: VegapunkDatabase, input: UpdateTaskStatusInput): Promise<CallToolResult> {
  if (!db.agents.getById(input.agent_id)) {
    return toolError(`Agent not found: ${input.agent_id}`);
  }

  if (!db.tasks.getById(input.task_id)) {
    return toolError(`Task not found: ${input.task_id}`);
  }

  const task = db.tasks.update(input.task_id, { status: input.status });
  if (!task) {
    return toolError(`Task not found: ${input.task_id}`);
  }

  const payload: UpdateTaskStatusStructuredOutput = {
    ok: true,
    task: {
      task_id: task.task_id,
      assigned_to: task.assigned_to,
      status: task.status,
      updated_at: task.updated_at,
    },
  };

  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
    structuredContent: payload,
  };
}
