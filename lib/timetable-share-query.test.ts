// @vitest-environment node
import { QueryClient } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { TimetableShareError, timetableShareQueryOptions } from "./timetable-share-query";

const shared = {
  success: true,
  data: { shareId: "same-share", courseIds: ["course"], year: "2026", semester: "2", createdAt: null },
};
const clients: QueryClient[] = [];
function client() {
  const result = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  clients.push(result);
  return result;
}
afterEach(() => { clients.forEach(value => value.clear()); clients.length = 0; vi.unstubAllGlobals(); });

it("does not cache a transient failure as success and reopens the same key before five minutes", async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(new Response("private provider detail", { status: 503 }))
    .mockResolvedValueOnce(Response.json(shared));
  vi.stubGlobal("fetch", fetch);
  const queries = client();
  const options = { ...timetableShareQueryOptions("same-share"), retry: false as const };
  await expect(queries.fetchQuery(options)).rejects.toMatchObject({ status: 503 });
  expect(queries.getQueryState(options.queryKey)).toMatchObject({ status: "error", data: undefined });
  expect(await queries.fetchQuery(options)).toEqual(shared);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(await queries.fetchQuery(options)).toEqual(shared);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it.each([400, 404, 429])("preserves HTTP %i without automatically retrying", async status => {
  const fetch = vi.fn().mockResolvedValue(new Response("private provider detail", { status }));
  vi.stubGlobal("fetch", fetch);
  const queries = client();
  await expect(queries.fetchQuery({ ...timetableShareQueryOptions("bad-share"), retryDelay: 0 }))
    .rejects.toMatchObject({ status, message: "Could not load shared timetable" });
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("retries a temporary service failure only once", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 }));
  vi.stubGlobal("fetch", fetch);
  await expect(client().fetchQuery({ ...timetableShareQueryOptions("same-share"), retryDelay: 0 }))
    .rejects.toBeInstanceOf(TimetableShareError);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("rejects an unsuccessful 200 response instead of making it fresh for five minutes", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ success: false })));
  await expect(client().fetchQuery({ ...timetableShareQueryOptions("same-share"), retry: false }))
    .rejects.toMatchObject({ status: 502 });
});
