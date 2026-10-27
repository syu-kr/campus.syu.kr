import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
const remote = vi.hoisted(() => ({ enabled: vi.fn(), active: vi.fn(), read: vi.fn() }));
vi.mock("./public-data-storage", () => ({ publicDataFirebaseEnabled: remote.enabled, getActivePublicData: remote.active, readFirebasePublicData: remote.read }));
import { readPublicDataBundle } from "./public-data";

beforeEach(() => { remote.enabled.mockReset().mockReturnValue(false); remote.active.mockReset(); remote.read.mockReset(); });
describe("version-pinned public data bundles", () => {
  it("keeps the unconfigured CI path entirely local", async () => {
    const snapshot = await readPublicDataBundle(["phone-numbers.json"]);
    expect(snapshot.source).toBe("bundled-fallback"); expect(snapshot.version).toBe("bundled");
    expect(snapshot.data["phone-numbers.json"]).toEqual(JSON.parse(await readFile(path.join(process.cwd(), "public/data/phone-numbers.json"), "utf8")));
    expect(remote.active).not.toHaveBeenCalled(); expect(remote.read).not.toHaveBeenCalled();
  });
  it("pins one active manifest for every related file", async () => {
    remote.enabled.mockReturnValue(true);
    const active = { manifest: { version: "remote-a" }, revision: 2 };
    remote.active.mockResolvedValue(active); remote.read.mockImplementation(async (file: string) => ({ data: { file }, manifest: active.manifest }));
    const snapshot = await readPublicDataBundle(["phone-numbers.json", "schedules-major.json"]);
    expect(remote.active).toHaveBeenCalledTimes(1);
    expect(remote.read).toHaveBeenNthCalledWith(1, "phone-numbers.json", active);
    expect(remote.read).toHaveBeenNthCalledWith(2, "schedules-major.json", active);
    expect(snapshot.source).toBe("firebase-storage"); expect(snapshot.version).toBe("remote-a");
  });
  it("falls back as a complete bundle when one remote file fails", async () => {
    remote.enabled.mockReturnValue(true); remote.active.mockResolvedValue({ manifest: { version: "remote-a" }, revision: 2 });
    remote.read.mockResolvedValueOnce({ data: ["remote only"] }).mockRejectedValueOnce(new Error("unavailable"));
    const snapshot = await readPublicDataBundle(["phone-numbers.json", "schedules-major.json"]);
    expect(snapshot.source).toBe("bundled-fallback"); expect(snapshot.version).toBe("bundled");
    expect(snapshot.data["phone-numbers.json"]).not.toEqual(["remote only"]);
    expect(snapshot.data["schedules-major.json"]).toEqual(JSON.parse(await readFile(path.join(process.cwd(), "public/data/schedules-major.json"), "utf8")));
  });
});
