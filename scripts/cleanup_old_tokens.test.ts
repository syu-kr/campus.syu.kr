import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { expect, it, vi } from "vitest";
import { deleteOldTokens } from "./cleanup_old_tokens";

it("keeps token cleanup logs free of legacy token-derived document identifiers", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
  const document = {
    get id(): never { throw new Error("Token-derived document IDs must not be read for logging"); },
    ref: { path: "user_devices/private" },
    updateTime: Timestamp.fromMillis(1),
  };
  const get = vi.fn().mockResolvedValueOnce({ empty: false, size: 1, docs: [document] }).mockResolvedValueOnce({ empty: true });
  const query = { where: () => query, limit: () => query, get };
  const remove = vi.fn(), commit = vi.fn();
  const db = { collection: () => query, batch: () => ({ delete: remove, commit }) } as unknown as Firestore;

  expect(await deleteOldTokens(db, Timestamp.fromMillis(2))).toBe(1);
  expect(remove).toHaveBeenCalledWith(document.ref, { lastUpdateTime: document.updateTime });
  expect(commit).toHaveBeenCalledTimes(1);
  expect(log).not.toHaveBeenCalled();
});
