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
  return new Elysia({ prefix: "/api/stream" }).get("/activity", ({ request }) => {
    let unsubscribe: (() => void) | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let cleanedUp = false;

    const cleanup = () => {
      if (cleanedUp) {
        return;
      }

      cleanedUp = true;

      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = undefined;
      }

      unsubscribe?.();
      unsubscribe = undefined;
    };

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`));
        unsubscribe = stream.subscribe(controller);
        heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": keep-alive\n\n"));
          } catch {
            cleanup();
          }
        }, 25_000);
        request.signal.addEventListener("abort", cleanup, { once: true });
      },
      cancel() {
        cleanup();
      },
    });

    return new Response(body, {
      headers: {
        // SSE must stay unbuffered; no-transform prevents proxies from compressing or coalescing chunks.
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "content-type": "text/event-stream; charset=utf-8",
        "x-accel-buffering": "no",
      },
    });
  });
}
