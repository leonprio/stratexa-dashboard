import React, { useEffect, useState } from 'react';
import { ComplianceStatus } from '../types';

export interface PaiRow { action: string; date: string; result: string; impact?: 'positive' | 'low' | 'none'; }
interface ActionPlanProps { initialRows?: PaiRow[]; status: ComplianceStatus; onSave: (rows: PaiRow[]) => void; canEdit: boolean; year?: number; }

/** Visor de compatibilidad: conserva paiRows históricos sin ofrecer una segunda ruta de captura. */
export const ActionPlan: React.FC<ActionPlanProps> = ({ initialRows = [] }) => {
  const [rows, setRows] = useState<PaiRow[]>(initialRows);
  useEffect(() => setRows(initialRows), [initialRows]);
  if (rows.length === 0) return null;
  const impactLabel = (impact?: string) => impact === 'positive' ? 'Positivo' : impact === 'low' ? 'Bajo' : 'Nulo';
  return <section className="mt-5 rounded-xl border border-slate-700/50 bg-slate-950/25 p-4"><div className="mb-3 flex items-center justify-between"><div><h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Histórico de acciones</h4><p className="mt-1 text-[10px] uppercase tracking-widest text-slate-600">Registro histórico · solo lectura</p></div><span className="text-[10px] text-slate-600">{rows.length} registro{rows.length === 1 ? '' : 's'}</span></div><div className="space-y-2">{rows.map((row, index) => <div key={`${row.action}-${row.date}-${index}`} className="grid gap-2 rounded-lg border border-white/5 bg-slate-900/40 p-3 md:grid-cols-[2fr,120px,2fr,90px] md:items-center"><p className="text-xs text-slate-300">{row.action || '—'}</p><p className="text-[10px] text-slate-500">{row.date || 'Sin fecha'}</p><p className="text-[11px] text-slate-500">{row.result || 'Sin resultado / nota'}</p><span className="text-[10px] font-bold uppercase text-slate-500">{impactLabel(row.impact)}</span></div>)}</div></section>;
};
