import React, { useEffect, useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import type { ActionPlan, Dashboard, SystemSettings } from '../../types';
import type { ControlExecutiveReportFormat, ControlReportFilters } from '../../utils/controlExecutiveReport';
import type { TrackingPeriod } from '../../utils/trackingObligation';
import { exportControlExecutiveReport } from '../../utils/controlExecutiveReportExport';

interface Props {
  clientId: string;
  clientName: string;
  dashboards: Dashboard[];
  period: TrackingPeriod;
  filters: ControlReportFilters;
  filterLabels: string[];
  clientSettings?: Pick<SystemSettings, 'defaultTrackingStartPeriod'>;
  loadActionPlans: (dashboards: Dashboard[]) => Promise<ActionPlan[]>;
}

export const ControlReportExport: React.FC<Props> = ({ clientId, clientName, dashboards, period, filters, filterLabels, clientSettings, loadActionPlans }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ControlExecutiveReportFormat | null>(null);
  const [message, setMessage] = useState('');
  const busyRef = useRef(false);
  const scopeKey = JSON.stringify([clientId, dashboards, period, filters, filterLabels]);
  const currentScopeKey = useRef(scopeKey);
  const generation = useRef({ scopeKey, generatedAt: new Date().toISOString() });
  if (generation.current.scopeKey !== scopeKey) generation.current = { scopeKey, generatedAt: new Date().toISOString() };
  currentScopeKey.current = scopeKey;
  useEffect(() => () => { currentScopeKey.current = ''; }, []);
  const available = clientId.trim() !== '' && clientName.trim() !== '' && dashboards.length > 0 && dashboards.every(board =>
    String(board.clientId || '').trim().toUpperCase() === clientId.trim().toUpperCase() &&
    board.items.length > 0 && board.items.every(item => (item.frequency || board.periodicity || 'monthly') === period.frequency));
  const run = async (format: ControlExecutiveReportFormat) => {
    if (!available || busyRef.current) { setMessage('No se puede verificar el alcance autorizado para exportar el informe.'); return; }
    busyRef.current = true;
    setBusy(format); setMessage('');
    try {
      const actionPlans = await loadActionPlans(dashboards);
      if (currentScopeKey.current !== scopeKey) throw new Error('El alcance de CONTROL cambió durante la generación.');
      await exportControlExecutiveReport({
        format,
        source: { scope: { clientId, clientName, period, operationalPeriod: period, authorizedDashboardIds: dashboards.map(board => board.id), filters, filterLabels }, dashboards, actionPlans, clientSettings, generatedAt: generation.current.generatedAt },
        renderPdf: async (report) => { const module = await import('../../utils/controlExecutiveReportPdf'); return module.renderControlExecutiveReportPdf(report); },
        renderDocx: async (report) => { const module = await import('../../utils/controlExecutiveReportDocx'); return module.renderControlExecutiveReportDocx(report); },
        save: (blob, filename) => {
          if (currentScopeKey.current !== scopeKey) throw new Error('El alcance de CONTROL cambió durante la generación.');
          saveAs(blob, filename);
        },
      });
      setMessage(`Informe ${format === 'pdf' ? 'PDF' : 'Word'} generado correctamente.`);
      setOpen(false);
    } catch (error) {
      console.error('CONTROL report export failed', error);
      setMessage('No fue posible generar el informe. Verifica el alcance autorizado e inténtalo nuevamente.');
    } finally { busyRef.current = false; setBusy(null); }
  };
  return <div className="relative">
    <button type="button" disabled={!available || Boolean(busy)} onClick={() => setOpen(value => !value)} className="min-h-[36px] rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-cyan-200 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Generando informe…' : 'Exportar informe'}</button>
    {open && <div role="menu" aria-label="Formatos de exportación" className="absolute right-0 z-20 mt-2 min-w-48 rounded-lg border border-cyan-500/30 bg-slate-950 p-2 shadow-2xl"><p className="px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500">Formato</p><button role="menuitem" type="button" disabled={Boolean(busy)} onClick={() => void run('pdf')} className="block w-full rounded px-2 py-2 text-left text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50">Descargar PDF</button><button role="menuitem" type="button" disabled={Boolean(busy)} onClick={() => void run('docx')} className="block w-full rounded px-2 py-2 text-left text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50">Descargar Word</button></div>}
    {(message || !available) && <p role="status" className="absolute right-0 top-full z-10 mt-2 w-72 rounded border border-white/10 bg-slate-950 p-2 text-xs text-slate-300">{message || 'No hay indicadores verificables para este cliente, período y filtros.'}</p>}
  </div>;
};
