import { derivePendingKpiActivities } from '../components/CurrentPeriodFocus';
import { mergeActivityConfigPreservingResolutions } from './activityResolutionMerge';
import { reopenActivityResolution } from './activityResolutionMerge';

const activity = { id: 'a1', label: 'Establecer metas en Agosto', targetCount: 1, completedCount: 0 };
const pending = (config: any, month = 8) => derivePendingKpiActivities(config, month, false, 2026);

describe('resolución de pendientes frente a recargas y stale writes', () => {
  test('completar y recargar no reconstruye el pendiente', () => {
    const completed = { 7: [{ ...activity, resolution: { resolutionStatus: 'completed_later' as const, resolvedYear: 2026, resolvedPeriodIndex: 7 } }] };
    const reloaded = JSON.parse(JSON.stringify(completed));
    expect(pending({ 7: [activity] })).toHaveLength(1);
    expect(pending(reloaded)).toHaveLength(0);
  });
  test('descartar y reprogramar conservan semántica histórica', () => {
    const discarded = { 7: [{ ...activity, resolution: { resolutionStatus: 'discarded' as const, resolutionNote: 'No aplica' } }] };
    expect(pending(discarded)).toHaveLength(0);
    const rescheduled = { 7: [{ ...activity, resolution: { resolutionStatus: 'rescheduled' as const, scheduledResolutionYear: 2026, scheduledResolutionPeriodType: 'monthly' as const, scheduledResolutionPeriodIndex: 8 } }] };
    expect(pending(rescheduled, 7)[0].status).toBe('REPROGRAMADA');
    expect(pending(rescheduled, 8)[0].status).toBe('COMPROMISO ACTUAL');
    expect(rescheduled[7][0].resolution.resolutionStatus).toBe('rescheduled');
  });
  test('cancelar no cambia la actividad', () => expect(pending({ 7: [activity] })).toHaveLength(1));
  test('una escritura obsoleta no elimina el cierre persistido', () => {
    const current = { 7: [{ ...activity, resolution: { resolutionStatus: 'completed_later' as const } }] };
    const stale = { 7: [activity] };
    const merged = mergeActivityConfigPreservingResolutions(current, stale);
    expect(merged[7][0].resolution?.resolutionStatus).toBe('completed_later');
    expect(pending(merged)).toHaveLength(0);
  });
  test('reabrir conserva histórico y vuelve a activar el pendiente', () => {
    const completed = { ...activity, resolution: { resolutionStatus: 'completed_later' as const, resolvedAt: '2026-08-10T00:00:00.000Z' } };
    const reopened = reopenActivityResolution(completed, 2026, 7, '2026-08-11T00:00:00.000Z');
    expect(reopened.resolution?.resolutionStatus).toBe('reopened');
    expect(reopened.resolution?.previousResolutionStatus).toBe('completed_later');
    expect(reopened.resolution?.resolutionHistory).toHaveLength(1);
    expect(pending({ 7: [reopened] })).toHaveLength(1);
  });
  test('un stale write anterior no puede borrar una reapertura más reciente', () => {
    const current = { 7: [reopenActivityResolution({ ...activity, resolution: { resolutionStatus: 'completed_later' as const, resolvedAt: '2026-08-10T00:00:00.000Z' } }, 2026, 7, '2026-08-11T00:00:00.000Z')] };
    const stale = { 7: [{ ...activity, resolution: { resolutionStatus: 'completed_later' as const, resolvedAt: '2026-08-10T00:00:00.000Z' } }] };
    expect(mergeActivityConfigPreservingResolutions(current, stale)[7][0].resolution?.resolutionStatus).toBe('reopened');
  });
  test('la escritura de REABRIR reemplaza el cierre terminal vigente', () => {
    const current = { 7: [{ ...activity, resolution: { resolutionStatus: 'completed_later' as const, resolvedAt: '2026-08-10T00:00:00.000Z' } }] };
    const incoming = { 7: [reopenActivityResolution(current[7][0], 2026, 7, '2026-08-11T00:00:00.000Z')] };
    const merged = mergeActivityConfigPreservingResolutions(current, incoming);
    expect(merged[7][0].resolution?.resolutionStatus).toBe('reopened');
    expect(pending(merged)).toHaveLength(1);
  });
  test('la lista entrante elimina actividades ausentes sin crear falsos ceros', () => {
    const removed = { id: 'x', label: 'Prueba', targetCount: 3, completedCount: 0 };
    const merged = mergeActivityConfigPreservingResolutions(
      { 7: [activity, removed], 8: [{ ...activity, id: 'x2' }] },
      { 7: [activity], 8: [{ ...activity, id: 'x2' }] },
    );
    expect(merged[7].map((item) => item.id)).toEqual(['a1']);
    expect(merged[7].find((item) => item.id === 'x')).toBeUndefined();
    expect(merged[8].map((item) => item.id)).toEqual(['x2']);
  });
});
