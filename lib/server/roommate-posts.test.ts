import { beforeEach, describe, expect, it, vi } from "vitest";
import { Timestamp } from "firebase-admin/firestore";

const fixture = vi.hoisted(() => ({ store: new Map<string, Record<string, unknown>>(), sequence: 0, queue: Promise.resolve() as Promise<unknown> }));

vi.mock("@/lib/server/firestore", async () => {
  const { Timestamp, FieldPath } = await import("firebase-admin/firestore");
  function reference(path: string) {
    return { path, id: path.split("/").at(-1)!, get: async () => snapshot(path) };
  }
  function snapshot(path: string) {
    return { id: path.split("/").at(-1)!, exists: fixture.store.has(path), data: () => fixture.store.get(path), get: (key: string) => fixture.store.get(path)?.[key] };
  }
  function collection(name: string) {
    const state: { conditions: [string, unknown][]; cursor?: [Timestamp, string]; max: number } = { conditions: [], max: Infinity };
    const query = {
      doc: (id?: string) => reference(`${name}/${id ?? String(++fixture.sequence).padStart(20, "0")}`),
      where: (key: string, _op: string, value: unknown) => { state.conditions.push([key, value]); return query; },
      orderBy: () => query,
      limit: (value: number) => { state.max = value; return query; },
      startAfter: (timestamp: Timestamp, id: string) => { state.cursor = [timestamp, id]; return query; },
      get: async () => {
        const docs = [...fixture.store.entries()].filter(([path, data]) => path.startsWith(`${name}/`) && state.conditions.every(([key, value]) => data[key] === value))
          .sort(([pathA, a], [pathB, b]) => {
            const left = a.created_at as Timestamp; const right = b.created_at as Timestamp;
            return right.seconds - left.seconds || right.nanoseconds - left.nanoseconds || pathB.localeCompare(pathA);
          })
          .filter(([path, data]) => {
            if (!state.cursor) return true;
            const [timestamp, id] = state.cursor; const actual = data.created_at as Timestamp;
            return actual.seconds < timestamp.seconds || (actual.seconds === timestamp.seconds && (actual.nanoseconds < timestamp.nanoseconds || (actual.nanoseconds === timestamp.nanoseconds && path.split("/").at(-1)! < id)));
          }).slice(0, state.max).map(([path]) => snapshot(path));
        return { docs };
      },
    };
    return query;
  }
  const db = {
    collection,
    runTransaction: (callback: (transaction: unknown) => Promise<unknown>) => {
      const result = fixture.queue.then(async () => {
        const writes: (() => void)[] = [];
        let wrote = false;
        const transaction = {
          get: async (ref: { path: string }) => { if (wrote) throw new Error("Firestore reads must precede writes"); return snapshot(ref.path); },
          create: (ref: { path: string }, value: Record<string, unknown>) => { wrote = true; writes.push(() => { if (fixture.store.has(ref.path)) throw new Error("Already exists"); fixture.store.set(ref.path, value); }); },
          set: (ref: { path: string }, value: Record<string, unknown>, options?: { merge: boolean }) => { wrote = true; writes.push(() => fixture.store.set(ref.path, options?.merge ? { ...fixture.store.get(ref.path), ...value } : value)); },
        };
        const value = await callback(transaction);
        writes.forEach((write) => write());
        return value;
      });
      fixture.queue = result.catch(() => {});
      return result;
    },
  };
  return { getFirestore: () => db, admin: { firestore: { Timestamp, FieldPath } } };
});

import { createRoommatePost, decodeRoommateCursor, encodeRoommateCursor, getMyRoommatePost, getRoommatePost, listRoommatePosts, mutateRoommatePost, reportRoommatePost, type RoommatePostDocument } from "@/lib/server/roommate-posts";
import { DAY_MS, koreaDate } from "@/lib/roommates";

const now = Date.parse("2026-10-04T06:00:00Z");
function input(at = now) {
  return { nickname: "학생님", dorm: "eden", roomSize: 3, stayStart: koreaDate(at), stayEnd: koreaDate(at + 80 * DAY_MS), roommatesNeeded: 1, recruitUntil: koreaDate(at + 20 * DAY_MS), habits: {}, description: "조용한 룸메이트", openChatUrl: "https://open.kakao.com/o/aB123" };
}
function document(id: string): RoommatePostDocument { return fixture.store.get(`roommate_posts/${id}`) as unknown as RoommatePostDocument; }
function owner(key: string) { return fixture.store.get(`roommate_owner_state/${key}`)!; }

beforeEach(() => { fixture.store.clear(); fixture.sequence = 0; fixture.queue = Promise.resolve(); });

describe("roommate post transactions", () => {
  it("allows only one of concurrent creations and counts successful creations", async () => {
    const result = await Promise.allSettled([createRoommatePost("owner", input(), now), createRoommatePost("owner", input(), now)]);
    expect(result.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(result.find((item) => item.status === "rejected")).toMatchObject({ reason: { status: 409, code: "ACTIVE_POST_EXISTS" } });
    expect([...fixture.store.entries()].filter(([key]) => key.startsWith("api_rate_limits/"))[0][1].count).toBe(1);
  });

  it("checks ownership, versions and forbidden fields without changing state", async () => {
    const post = await createRoommatePost("owner", input(), now);
    await expect(mutateRoommatePost("other", post.id, "delete", { expectedVersion: 1 }, now)).rejects.toMatchObject({ status: 403 });
    await expect(mutateRoommatePost("owner", post.id, "delete", { expectedVersion: 2 }, now)).rejects.toMatchObject({ status: 409 });
    await expect(mutateRoommatePost("owner", post.id, "delete", { expectedVersion: 1, status: "recruiting" }, now)).rejects.toMatchObject({ status: 400 });
    expect(document(post.id).version).toBe(1);
  });

  it("does not clear a newer active pointer from an older late deletion", async () => {
    const old = await createRoommatePost("owner", input(), now);
    await mutateRoommatePost("owner", old.id, "complete", { action: "complete", expectedVersion: 1 }, now + 1000);
    const fresh = await createRoommatePost("owner", input(), now + 2000);
    await mutateRoommatePost("owner", old.id, "delete", { expectedVersion: 2 }, now + 3000);
    expect(owner("owner").active_post_id).toBe(fresh.id);
    expect(document(old.id).expires_at.toMillis()).toBe(now + 1000 + 30 * DAY_MS);
    const deleted = document(old.id);
    await mutateRoommatePost("owner", old.id, "delete", { expectedVersion: 3 }, now + 4000);
    expect(document(old.id).expires_at.toMillis()).toBe(deleted.expires_at.toMillis());
    expect(document(old.id).version).toBe(3);
  });

  it("keeps original sorting time and rejects late edits and deadline extensions", async () => {
    const post = await createRoommatePost("owner", input(), now);
    await expect(mutateRoommatePost("owner", post.id, "update", { action: "update", expectedVersion: 1, ...input(), recruitUntil: koreaDate(now + 21 * DAY_MS) }, now + 1000)).rejects.toMatchObject({ status: 400 });
    const edited = await mutateRoommatePost("owner", post.id, "update", { action: "update", expectedVersion: 1, ...input(), description: "수정됨" }, now + 1000);
    expect(edited.createdAt).toBe(post.createdAt);
    expect(edited.version).toBe(2);
    await mutateRoommatePost("owner", post.id, "complete", { action: "complete", expectedVersion: 2 }, now + 2000);
    await expect(mutateRoommatePost("owner", post.id, "update", { action: "update", expectedVersion: 3, ...input() }, now + 3000)).rejects.toMatchObject({ status: 409, code: "POST_CLOSED" });
  });

  it("preserves holds through deletion and re-registration and honors hold expiry", async () => {
    const post = await createRoommatePost("owner", input(), now);
    fixture.store.set(`roommate_posts/${post.id}`, { ...document(post.id), status: "hidden", version: 2 });
    fixture.store.set("roommate_owner_state/owner", { ...owner("owner"), active_post_id: null, hold_until: Timestamp.fromMillis(now + 30 * DAY_MS), hold_reason: "검토 중", version: 5 });
    await expect(createRoommatePost("owner", input(), now + 1000)).rejects.toMatchObject({ status: 403, code: "WRITING_HELD" });
    await mutateRoommatePost("owner", post.id, "delete", { expectedVersion: 2 }, now + 2000);
    expect(owner("owner").hold_until).toEqual(Timestamp.fromMillis(now + 30 * DAY_MS));
    expect(owner("owner").version).toBe(5);
    await expect(createRoommatePost("owner", input(), now + 3000)).rejects.toMatchObject({ status: 403 });
    const later = now + 30 * DAY_MS;
    await expect(createRoommatePost("owner", input(later), later)).resolves.toMatchObject({ status: "recruiting" });
    expect(document(post.id).status).toBe("deleted");
  });

  it("blocks content edits during holds while allowing completion", async () => {
    const post = await createRoommatePost("owner", input(), now);
    fixture.store.set("roommate_owner_state/owner", { ...owner("owner"), hold_until: Timestamp.fromMillis(now + DAY_MS) });
    await expect(mutateRoommatePost("owner", post.id, "update", { action: "update", expectedVersion: 1, ...input() }, now)).rejects.toMatchObject({ status: 403, code: "WRITING_HELD" });
    const completed = await mutateRoommatePost("owner", post.id, "complete", { action: "complete", expectedVersion: 1 }, now + 1000);
    expect(completed.status).toBe("completed");
    const expiry = completed.expiresAt;
    expect((await mutateRoommatePost("owner", post.id, "complete", { action: "complete", expectedVersion: 2 }, now + 2000)).expiresAt).toBe(expiry);
  });

  it("returns remaining holds after latest post removal and hides expired content", async () => {
    const post = await createRoommatePost("owner", input(), now);
    await expect(getRoommatePost(post.id, "other", document(post.id).recruit_until.toMillis())).rejects.toMatchObject({ status: 404 });
    fixture.store.delete(`roommate_posts/${post.id}`);
    fixture.store.set("roommate_owner_state/owner", { ...owner("owner"), hold_until: Timestamp.fromMillis(now + DAY_MS), hold_reason: "확인 중" });
    expect(await getMyRoommatePost("owner", now)).toEqual({ post: null, holdUntil: new Date(now + DAY_MS).toISOString(), holdReason: "확인 중" });
  });

  it("enforces three successful creations per UTC day", async () => {
    for (let index = 0; index < 3; index++) {
      const post = await createRoommatePost("owner", input(), now + index);
      await mutateRoommatePost("owner", post.id, "complete", { action: "complete", expectedVersion: 1 }, now + index);
    }
    await expect(createRoommatePost("owner", input(), now + 100)).rejects.toMatchObject({ status: 429 });
    await expect(createRoommatePost("owner", input(now + DAY_MS), now + DAY_MS)).resolves.toMatchObject({ status: "recruiting" });
  });

  it("atomically deduplicates reports and retains evidence despite later edits", async () => {
    const post = await createRoommatePost("author", input(), now);
    await expect(reportRoommatePost("author", post.id, { reason: "spam" }, now)).rejects.toMatchObject({ code: "SELF_REPORT" });
    const result = await Promise.allSettled([reportRoommatePost("reporter", post.id, { reason: "privacy", description: "확인 요청" }, now), reportRoommatePost("reporter", post.id, { reason: "spam" }, now)]);
    expect(result.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(result.find((item) => item.status === "rejected")).toMatchObject({ reason: { code: "ALREADY_REPORTED" } });
    await mutateRoommatePost("author", post.id, "update", { action: "update", expectedVersion: 1, ...input(), description: "수정 후" }, now + 1000);
    await mutateRoommatePost("author", post.id, "delete", { expectedVersion: 2 }, now + 2000);
    const reports = [...fixture.store.entries()].filter(([path]) => path.startsWith("roommate_reports/"));
    expect(reports).toHaveLength(1);
    expect(reports[0][1].evidence).toMatchObject({ version: 1, description: "조용한 룸메이트" });
    expect((reports[0][1].expires_at as Timestamp).toMillis()).toBe(now + 30 * DAY_MS);
    await expect(reportRoommatePost("another", post.id, { reason: "spam" }, now + 3000)).rejects.toMatchObject({ status: 404 });
  });

  it("limits a reporter to five successful reports across different posts", async () => {
    const posts = await Promise.all(Array.from({ length: 6 }, (_, index) => createRoommatePost(`author-${index}`, input(), now)));
    for (const post of posts.slice(0, 5)) await reportRoommatePost("reporter", post.id, { reason: "spam" }, now);
    await expect(reportRoommatePost("reporter", posts[5].id, { reason: "spam" }, now)).rejects.toMatchObject({ status: 429 });
    expect([...fixture.store.keys()].filter((key) => key.startsWith("roommate_reports/"))).toHaveLength(5);
    expect(document(posts[5].id).status).toBe("recruiting");
  });
});

describe("private listing and precise cursors", () => {
  it("preserves timestamp nanoseconds and rejects malformed cursor payloads", () => {
    const timestamp = new Timestamp(123, 456);
    expect(decodeRoommateCursor(encodeRoommateCursor(timestamp, "12345678901234567890"))).toEqual({ seconds: 123, nanoseconds: 456, id: "12345678901234567890" });
    expect(() => decodeRoommateCursor(Buffer.from(JSON.stringify({ seconds: 123, nanoseconds: 1_000_000_000, id: "12345678901234567890" })).toString("base64url"))).toThrow();
    expect(() => decodeRoommateCursor("../bad")).toThrow();
  });
  it.each([253402300800, Number.MAX_SAFE_INTEGER])("rejects cursor seconds outside Firestore Timestamp range: %s", async (seconds) => {
    const cursor = Buffer.from(JSON.stringify({ seconds, nanoseconds: 0, id: "12345678901234567890" })).toString("base64url");
    await expect(listRoommatePosts({}, cursor, now)).rejects.toMatchObject({ status: 400, code: "INVALID_CURSOR", field: "cursor" });
  });

  it("continues after 100 unmatched candidates and uses last scanned cursor", async () => {
    const first = await createRoommatePost("base", input(), now);
    const base = document(first.id);
    fixture.store.clear();
    for (let index = 0; index < 101; index++) {
      fixture.store.set(`roommate_posts/${String(index).padStart(20, "0")}`, { ...base, dorm: index === 0 ? "eden" : "sion", created_at: new Timestamp(123, index), owner_key: "private-owner" });
    }
    const page = await listRoommatePosts({ dorm: "eden" }, null, now);
    expect(page.items).toHaveLength(0);
    expect(page.nextCursor).not.toBeNull();
    expect(decodeRoommateCursor(page.nextCursor!)).toMatchObject({ nanoseconds: 1 });
    const final = await listRoommatePosts({ dorm: "eden" }, page.nextCursor, now);
    expect(final.items.map((post) => post.id)).toEqual(["00000000000000000000"]);
    expect(final.nextCursor).toBeNull();
    expect(final.items[0]).not.toHaveProperty("owner_key");
    expect(final.items[0]).not.toHaveProperty("openChatUrl");
    expect(final.items[0]).not.toHaveProperty("description");
  });

  it("paginates tied timestamps by ID without duplicate or missing results", async () => {
    const first = await createRoommatePost("base", input(), now);
    const base = document(first.id);
    fixture.store.clear();
    for (let index = 0; index < 25; index++) fixture.store.set(`roommate_posts/${String(index).padStart(20, "0")}`, { ...base });
    const page = await listRoommatePosts({}, null, now);
    expect(page.items).toHaveLength(20);
    const final = await listRoommatePosts({}, page.nextCursor, now);
    expect(final.items).toHaveLength(5);
    expect(new Set([...page.items, ...final.items].map((post) => post.id)).size).toBe(25);
    expect(final.nextCursor).toBeNull();
  });
});
