import { describe, expect, it } from "vitest";
import { getPhoneDisplayText, getPhoneNumberOptions, getTelHref, matchesPhoneQuery } from "./phone";

const phone = {
  department: "교목처 교목팀",
  description: "채플",
  phone: "02-3399-3328 02-3399-3334",
  phoneNumbers: ["02-3399-3328", "02-3399-3334"],
};

describe("phone directory", () => {
  it("separates numbers with commas, including older data without structured numbers", () => {
    expect(getPhoneDisplayText(phone)).toBe("02-3399-3328, 02-3399-3334");
    expect(getPhoneDisplayText({ phone: "02-3399-3328 / 02-3399-3334" }))
      .toBe("02-3399-3328, 02-3399-3334");
    const changedNumbers = ["02-1234-5678", "031-123-4567", "010-9876-5432", "051-987-6543"];
    for (const count of [1, 2, 3, 4]) {
      const numbers = changedNumbers.slice(0, count);
      for (const separator of [" ", " / ", "\n", ", "]) {
        const raw = numbers.join(separator);
        expect(getPhoneNumberOptions({ phone: raw })).toEqual(numbers);
        expect(getPhoneDisplayText({ phone: raw })).toBe(numbers.join(", "));
        expect(getPhoneDisplayText({ phone: raw, phoneNumbers: numbers })).toBe(numbers.join(", "));
      }
    }
  });

  it("preserves source labels, extension notes and shortened ranges", () => {
    for (const rawPhone of [
      "02-3399-3328(교목팀) / 02-3399-3334(채플)",
      "02-3399-3328 내선 2",
      "02-3399-3328~9",
    ]) {
      expect(getPhoneDisplayText({ phone: rawPhone })).toBe(rawPhone);
    }
  });

  it("matches formatted and unformatted numbers as well as department and task", () => {
    for (const query of ["0233993334", "02 3399 3334", " 3334 ", "교목팀", "채플"]) {
      expect(matchesPhoneQuery(phone, query)).toBe(true);
    }
    expect(matchesPhoneQuery(phone, "332802")).toBe(false);
    expect(matchesPhoneQuery(phone, "unknown3334")).toBe(false);
  });

  it("keeps separate dial targets and removes repeated numbers", () => {
    const numbers = getPhoneNumberOptions({ phone: "02-3399-3328 / 02-3399-3334 / 02-3399-3328" });
    expect(numbers).toEqual(["02-3399-3328", "02-3399-3334"]);
    expect(numbers.map(getTelHref)).toEqual(["tel:0233993328", "tel:0233993334"]);
  });
});
