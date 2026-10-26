import { renderToStaticMarkup } from "react-dom/server";
import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { useUrlHash } from "./use-url-hash";

it("uses an empty hash during SSR and preserves the browser fragment for anchors after hydration and back", () => {
  window.history.replaceState(null, "", "/?extra=keep#list");
  function Link() { return <a href={`/page${useUrlHash()}`}>page</a>; }
  expect(renderToStaticMarkup(<Link />)).toBe('<a href="/page">page</a>');
  const { result } = renderHook(() => useUrlHash());
  expect(result.current).toBe("#list");
  act(() => { window.history.replaceState(null, "", "/?extra=keep#back"); window.dispatchEvent(new PopStateEvent("popstate")); });
  expect(result.current).toBe("#back");
});
