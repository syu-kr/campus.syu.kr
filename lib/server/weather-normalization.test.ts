import { describe, expect, it } from "vitest";
import { buildForecastCategoryMap } from "./weather-normalization";

describe("buildForecastCategoryMap", () => {
  const items = [
    {
      category: "T1H",
      fcstDate: "20260725",
      fcstTime: "2300",
      fcstValue: "28",
    },
    {
      category: "SKY",
      fcstDate: "20260725",
      fcstTime: "2300",
      fcstValue: "1",
    },
    {
      category: "T1H",
      fcstDate: "20260726",
      fcstTime: "0000",
      fcstValue: "27",
    },
    {
      category: "SKY",
      fcstDate: "20260726",
      fcstTime: "0000",
      fcstValue: "4",
    },
  ];

  it("selects one forecast timestamp across a midnight boundary", () => {
    expect(buildForecastCategoryMap(items, "202607252345")).toEqual({
      values: { T1H: 27, SKY: 4 },
      selectedDateTime: "202607260000",
    });
  });

  it("uses the latest available timestamp when all forecasts are older", () => {
    expect(buildForecastCategoryMap(items, "202607260100")).toEqual({
      values: { T1H: 27, SKY: 4 },
      selectedDateTime: "202607260000",
    });
  });

  it("does not combine categories from different forecast timestamps", () => {
    expect(
      buildForecastCategoryMap(
        [
          items[0],
          {
            category: "SKY",
            fcstDate: "20260726",
            fcstTime: "0000",
            fcstValue: "4",
          },
        ],
        "202607252300",
      ),
    ).toEqual({
      values: { T1H: 28 },
      selectedDateTime: "202607252300",
    });
  });
});
