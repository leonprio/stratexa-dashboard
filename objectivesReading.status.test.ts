import { resolveStrategicStatus } from './objectivesReading';

describe('resolveStrategicStatus', () => {
  it('uses the conservative priority and exposes its inputs', () => {
    expect(resolveStrategicStatus(['BAJO CONTROL', 'REQUIERE ATENCIÓN', 'CRÍTICO'])).toMatchObject({
      status: 'REQUIERE INTERVENCIÓN', criticalCount: 1, attentionCount: 1, underControlCount: 1, totalLogicalKpi: 3,
    });
  });

  it('does not manufacture a score when data is not evaluable', () => {
    expect(resolveStrategicStatus(['DATOS PENDIENTES', 'NO EVALUABLE'])).toMatchObject({
      status: 'DATOS PENDIENTES', pendingDataCount: 1, notEvaluableCount: 1,
    });
    expect(resolveStrategicStatus(['NO EVALUABLE'])).toMatchObject({ status: 'NO EVALUABLE' });
  });
});
