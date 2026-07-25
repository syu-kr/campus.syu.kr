import { describe, expect, it } from "vitest";
import {
  buildMeetSlots,
  MeetValidationError,
  normalizeMeetRoomInput,
} from "./meet";

const validInput = {
  title: "팀 회의",
  description: "",
  dateStart: "2026-07-25",
  dateEnd: "2026-07-25",
  timeStart: "09:00",
  timeEnd: "10:00",
  slotMinutes: 30,
};

describe("normalizeMeetRoomInput", () => {
  it("returns a stable validation code and field for invalid input", () => {
    expect.assertions(3);

    try {
      normalizeMeetRoomInput({ ...validInput, title: "" });
    } catch (error) {
      expect(error).toBeInstanceOf(MeetValidationError);
      expect((error as MeetValidationError).code).toBe("INVALID_TITLE");
      expect((error as MeetValidationError).field).toBe("title");
    }
  });

  it("rejects an invalid date range without exposing a server error", () => {
    expect.assertions(2);

    try {
      normalizeMeetRoomInput({
        ...validInput,
        dateStart: "2026-07-26",
        dateEnd: "2026-07-25",
      });
    } catch (error) {
      expect((error as MeetValidationError).code).toBe(
        "END_DATE_BEFORE_START",
      );
      expect((error as MeetValidationError).field).toBe("dateEnd");
    }
  });

  it("rejects ranges longer than fourteen days", () => {
    expect.assertions(2);

    try {
      normalizeMeetRoomInput({
        ...validInput,
        dateEnd: "2026-08-08",
      });
    } catch (error) {
      expect((error as MeetValidationError).code).toBe(
        "DATE_RANGE_TOO_LONG",
      );
      expect((error as MeetValidationError).field).toBe("dateEnd");
    }
  });
});

describe("buildMeetSlots", () => {
  it("builds slots for a valid normalized input", () => {
    expect(buildMeetSlots(validInput)).toEqual([
      "2026-07-25T09:00:00+09:00",
      "2026-07-25T09:30:00+09:00",
    ]);
  });
});
