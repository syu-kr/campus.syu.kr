import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { describe, expect, it, vi } from "vitest";
import { cleanupSubmissionMetadata, readCleanupApply } from "./cleanup_submission_metadata";

type RecordData = { collection: string; id: string; data: Record<string, unknown> };

function fixture(records: RecordData[]) {
  const update = vi.fn();
  const commit = vi.fn(async () => undefined);
  const batch = vi.fn(() => ({ update, commit }));
  const selects: string[][] = [];
  const filters: unknown[][] = [];
  const cursors: string[] = [];
  const db = {
    batch,
    collection: (name: string) => {
      let after = "", fields: string[] = [], statuses: string[] = [], limit = 0;
      const query = {
        where: (field: string, operator: string, value: string[]) => {
          filters.push([field, operator, value]); statuses = value; return query;
        },
        orderBy: () => query,
        select: (...value: string[]) => { fields = value; selects.push(value); return query; },
        limit: (value: number) => { limit = value; return query; },
        startAfter: (doc: { id: string }) => { after = doc.id; cursors.push(after); return query; },
        get: async () => {
          const docs = records.filter((record) => record.collection === name && record.id > after && statuses.includes(String(record.data.status)))
            .sort((a, b) => a.id.localeCompare(b.id)).slice(0, limit)
            .map((record) => {
              const data = Object.fromEntries(fields.filter((field) => Object.hasOwn(record.data, field)).map((field) => [field, record.data[field]]));
              return { id: record.id, ref: { path: `${name}/${record.id}` }, updateTime: Timestamp.fromMillis(1), data: () => data, get: (field: string) => data[field] };
            });
          return { empty: docs.length === 0, docs };
        },
      };
      return query;
    },
  } as unknown as Firestore;
  return { db, batch, update, commit, selects, filters, cursors };
}

const record = (id: string, status: string, fields: Record<string, unknown> = {}, collection = "site_inquiries"): RecordData => ({ collection, id, data: { status, ...fields } });

describe("manual closed submission metadata cleanup", () => {
  it("defaults to dry-run, reads only dedicated fields and never prints identifiers or content", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const f = fixture([
      record("private-id", "done", { contact: "private@example.test", user_agent: "private-browser", message: "original private body" }),
      record("tip-id", "rejected", { contact: "", user_agent: "browser" }, "campus_tip_suggestions"),
      record("open-id", "pending", { contact: "keep@example.test" }),
    ]);
    expect(await cleanupSubmissionMetadata(f.db)).toEqual({ scanned: 2, candidates: 2, contactFields: 2, nonemptyContacts: 1, userAgentFields: 2, updated: 0 });
    expect(f.batch).not.toHaveBeenCalled();
    expect(f.selects.every((fields) => fields.join() === "status,contact,user_agent")).toBe(true);
    expect(f.filters.every((filter) => JSON.stringify(filter) === JSON.stringify(["status", "in", ["done", "rejected"]]))).toBe(true);
    expect(log).not.toHaveBeenCalled();
  });

  it("applies only present dedicated fields with update-time guards, including null and empty values", async () => {
    const f = fixture([
      record("a", "done", { contact: null, message: "keep original", ai_classification: { summary: "keep AI" } }),
      record("b", "rejected", { contact: "", user_agent: "browser" }),
      record("c", "done"),
      record("d", "accepted", { contact: "keep" }),
    ]);
    expect(await cleanupSubmissionMetadata(f.db, true)).toEqual({ scanned: 3, candidates: 2, contactFields: 2, nonemptyContacts: 0, userAgentFields: 1, updated: 2 });
    expect(f.commit).toHaveBeenCalledTimes(1);
    expect(f.update).toHaveBeenCalledTimes(2);
    for (const [ref, changes, precondition] of f.update.mock.calls) {
      expect(ref.path).toMatch(/^site_inquiries\/[ab]$/);
      expect(changes).toEqual(ref.path.endsWith("/a")
        ? { contact: FieldValue.delete() }
        : { contact: FieldValue.delete(), user_agent: FieldValue.delete() });
      expect(precondition).toEqual({ lastUpdateTime: Timestamp.fromMillis(1) });
    }
  });

  it("paginates and does not write pages without remaining metadata", async () => {
    const f = fixture(Array.from({ length: 101 }, (_, index) => record(String(index).padStart(3, "0"), "done", index === 100 ? {} : { user_agent: "browser" })));
    expect(await cleanupSubmissionMetadata(f.db, true)).toMatchObject({ scanned: 101, candidates: 100, updated: 100 });
    expect(f.cursors).toEqual(["099", "100"]);
    expect(f.commit).toHaveBeenCalledTimes(1);
  });

  it("stops on a concurrent update conflict instead of retrying against a changed submission", async () => {
    const f = fixture([record("a", "done", { contact: "private" })]);
    f.commit.mockRejectedValueOnce(new Error("precondition failed"));
    await expect(cleanupSubmissionMetadata(f.db, true)).rejects.toThrow("precondition failed");
    expect(f.commit).toHaveBeenCalledTimes(1);
  });

  it.each<{ args: string[]; apply: boolean }>([
    { args: [], apply: false },
    { args: ["--dry-run"], apply: false },
    { args: ["--apply"], apply: true },
  ])("requires an explicit apply flag: $args", ({ args, apply }) => {
    expect(readCleanupApply(args)).toBe(apply);
  });

  it.each([["--unknown"], ["--dry-run", "--apply"], ["--apply", "--apply"]])("rejects ambiguous CLI flags: %j", (...args) => {
    expect(() => readCleanupApply(args)).toThrow("Use no option, --dry-run, or --apply.");
  });
});
