import fs from 'fs';
import path from 'path';
import { calculateCompliance, calculateOperationalMetrics } from './compliance';
import { calculateAlertSeverity, calculateOperationalDataStatus, calculateReliabilityScore, findLastOperationalCapture } from './operationalAlerts';
import type { Dashboard, DashboardItem } from '../types';

const names = ['INGRESOS','ACTIVIDADES ESTRATÉGICAS','PROSPECTOS CONTACTADOS','REUNIONES CON PROSPECTOS','NUEVAS ASESORÍAS','APLICACIONES DESARROLLADAS','PRESUPUESTOS ENVIADOS','PRESUPUESTOS APROBADOS','APLICACIONES RENTADAS'];
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();

describe('reconciliación TABLERO y CONTROL', () => {
  beforeAll(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-08-29T12:00:00Z')); });
  afterAll(() => jest.useRealTimers());

  it('deriva ambas vistas de las mismas metas, avances y corte', () => {
    const dashboards = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'snapshots_operativos', 'dashboard_snapshot.json'), 'utf8')) as Dashboard[];
    const dashboard = dashboards.find(value => value.title === 'Prior Consultoría')!;
    const thresholds = dashboard.thresholds;
    const found = names.map(name => dashboard.items.find(item => normalize(item.indicator) === normalize(name))).filter(Boolean) as DashboardItem[];
    expect(found.map(item => normalize(item.indicator))).toEqual(names.slice(1).map(normalize));
    expect(dashboard.items.some(item => normalize(item.indicator) === 'INGRESOS')).toBe(false);
    for (const source of found) {
      const tablero = calculateCompliance(source, thresholds, 2026, 'realTime', dashboard.items);
      const metrics = calculateOperationalMetrics(source, thresholds, 2026, 'realTime', dashboard.items);
      expect(metrics.performanceScore).toBeCloseTo(tablero.overallPercentage, 8);
      const controlItem = { ...source, operationalMetrics: metrics };
      expect(calculateAlertSeverity(controlItem)).toBeTruthy();
      expect(calculateOperationalDataStatus(controlItem)).toBeTruthy();
      expect(calculateReliabilityScore(controlItem)).toBeGreaterThanOrEqual(0);
      findLastOperationalCapture(source, 2026, new Date('2026-08-29T12:00:00Z'));
    }
  });
});
