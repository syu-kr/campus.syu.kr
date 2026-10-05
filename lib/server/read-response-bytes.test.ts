import { describe, expect, it, vi } from "vitest";
import { readResponseBytes } from "./read-response-bytes";

describe("bounded response reader", () => {
  it("cancels oversized streams, releases the lock, and preserves exact-limit bytes", async () => {
    const cancel = vi.fn();
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) { pulled += 1; controller.enqueue(new Uint8Array(1024)); },
      cancel,
    }, { highWaterMark: 0 });
    await expect(readResponseBytes(new Response(stream), 512, "source")).rejects.toThrow("source response is too large");
    expect(pulled).toBe(1);
    expect(cancel).toHaveBeenCalledOnce();
    expect(stream.locked).toBe(false);
    expect(Array.from(await readResponseBytes(new Response("삼육"), 6, "source"))).toEqual(Array.from(new TextEncoder().encode("삼육")));
    await expect(readResponseBytes(new Response("[]", { headers: { "content-length": "100" } }), 10, "source")).rejects.toThrow("too large");
  });
});
