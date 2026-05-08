import { Elysia } from "elysia";
import type { ActivityLog } from "../../db";

const encoder = new TextEncoder();

type ActivityController = ReadableStreamDefaultController<Uint8Array>;

export class ActivityStream {
  private readonly subscribers = new Set<ActivityController>();

  subscribe(controller: ActivityController): () => void {
    this.subscribers.add(controller);

    return () => {
      this.subscribers.delete(controller);
    };
  }

  publish(activity: ActivityLog): void {
    const payload = encoder.encode(`event: activity\ndata: ${JSON.stringify(activity)}\n\n`);

    for (const subscriber of this.subscribers) {
      try {
        subscriber.enqueue(payload);
      } catch {
        this.subscribers.delete(subscriber);
      }
    }
  }
}

export function createActivityStreamRoutes(stream: ActivityStream) {
  return new Elysia({ prefix: "/api/stream" }).get("/activity", () => {
    let unsubscribe: (() => void) | undefined;

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`));
        unsubscribe = stream.subscribe(controller);
      },
      cancel() {
        unsubscribe?.();
      },
    });

    return new Response(body, {
      headers: {
        "cache-control": "no-cache",
        connection: "keep-alive",
        "content-type": "text/event-stream; charset=utf-8",
      },
    });
  });
}
