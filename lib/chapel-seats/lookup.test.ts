import { expect, it } from "vitest";
import { lookupSeat } from "./lookup";

it("normalizes only whole positive decimal seat numbers", () => {
  expect(lookupSeat("na", " 0003 ")).toMatchObject({ status: "found", seat: { number: 3, section: "na", row: 1, source: "restored" } });
  for (const input of ["", " ", "0", "-1", "+3", "3.1", "1e2", "12x", "1 2", "9007199254740992"]) {
    expect(lookupSeat("na", input)).toEqual({ status: "invalid-number" });
  }
});

it("does not invent missing coordinates or correct invalid input to a nearby seat", () => {
  expect(lookupSeat("", "53")).toEqual({ status: "invalid-section" });
  expect(lookupSeat("ma", "53")).toEqual({ status: "invalid-section" });
  expect(lookupSeat("ga", "362")).toEqual({ status: "out-of-range" });
  expect(lookupSeat("da", "339")).toEqual({ status: "out-of-range" });
  expect(lookupSeat("ga", "34")).toEqual({ status: "unconfirmed" });
  expect(lookupSeat("ra", "23")).toEqual({ status: "unconfirmed" });
});
