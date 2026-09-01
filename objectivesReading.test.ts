import {
  buildExecutiveKpiReading,
  buildHistoricalComplianceSeries,
  objectiveExecutiveStatus,
  trendFromSeries,
} from "./objectivesReading";

const thresholds = { onTrack: 90, atRisk: 70 };
const item = (
  progress: Array<number | null>,
  goals: Array<number | null> = progress.map(() => 100),
) => ({
  id: "kpi",
  indicator: "KPI",
  weight: 1,
  monthlyGoals: goals,
  monthlyProgress: progress,
  unit: "%",
  type: "average" as const,
  goalType: "maximize" as const,
});
const now = new Date(2026, 7, 31);

describe("strategic executive reading contracts", () => {
  test.each([
    [99, "BAJO CONTROL"],
    [84, "REQUIERE ATENCIÓN"],
    [53, "CRÍTICO"],
  ])("maps canonical compliance %s to %s", (progress, status) => {
    expect(
      buildExecutiveKpiReading(
        item([progress as number]),
        thresholds,
        [],
        2026,
        now,
      ),
    ).toMatchObject({ score: progress, status });
  });

  test("0/0 is not evaluable, is excluded from history and never becomes improvement", () => {
    const reading = buildExecutiveKpiReading(
      item([0, 0], [0, 0]),
      thresholds,
      [],
      2026,
      now,
    );
    expect(reading).toMatchObject({
      score: null,
      status: "NO EVALUABLE",
      trend: "SIN TENDENCIA",
      series: [],
    });
  });

  test("trend requires two evaluable comparable periods", () => {
    expect(trendFromSeries([{ periodIndex: 0, value: 80 }])).toBe(
      "SIN TENDENCIA",
    );
    expect(
      trendFromSeries([
        { periodIndex: 0, value: 80 },
        { periodIndex: 1, value: 90 },
      ]),
    ).toBe("MEJORA");
    expect(
      trendFromSeries([
        { periodIndex: 0, value: 90 },
        { periodIndex: 1, value: 80 },
      ]),
    ).toBe("DETERIORO");
    expect(
      trendFromSeries([
        { periodIndex: 0, value: 80 },
        { periodIndex: 1, value: 80 },
      ]),
    ).toBe("ESTABLE");
  });

  test("history is chronological and excludes missing, future and no-obligation periods", () => {
    const series = buildHistoricalComplianceSeries(
      item([70, null, 0, 90, 120], [100, 100, 0, 100, 100]),
      [],
      2026,
      new Date(2026, 3, 15),
    );
    expect(series).toEqual([
      { periodIndex: 0, value: 70 },
      { periodIndex: 3, value: 90 },
    ]);
  });

  test("sparkline eligibility derives from the real evaluable series", () => {
    expect(
      buildExecutiveKpiReading(item([70, 80, 90]), thresholds, [], 2026, now)
        .series,
    ).toHaveLength(3);
    expect(
      buildExecutiveKpiReading(item([70, 80]), thresholds, [], 2026, now)
        .series,
    ).toHaveLength(2);
    expect(
      buildExecutiveKpiReading(item([70]), thresholds, [], 2026, now).series,
    ).toHaveLength(1);
  });

  test("objective status is conservative and never averages KPIs", () => {
    expect(objectiveExecutiveStatus(["BAJO CONTROL", "CRÍTICO"])).toBe(
      "REQUIERE INTERVENCIÓN",
    );
    expect(
      objectiveExecutiveStatus(["BAJO CONTROL", "REQUIERE ATENCIÓN"]),
    ).toBe("REQUIERE ATENCIÓN");
    expect(objectiveExecutiveStatus(["BAJO CONTROL", "BAJO CONTROL"])).toBe(
      "BAJO CONTROL",
    );
    expect(objectiveExecutiveStatus([])).toBe("SIN INDICADORES");
  });
});
