import React from "react";
import type { Dashboard, DashboardItem } from "../../types";

export type ContributionCellKpi = {
  identity: string;
  item: DashboardItem;
  dashboard: Dashboard;
  score: number | null;
  status: string;
};

type Props = {
  code: string;
  title: string;
  kpis: ContributionCellKpi[];
  status: string;
  onNavigateToKpi?: (dashboardId: number | string, itemId: number | string) => void;
};

const tone = (status: string) => status === "CRÍTICO" || status === "REQUIERE INTERVENCIÓN"
  ? "text-rose-300 bg-rose-400"
  : status === "REQUIERE ATENCIÓN"
    ? "text-amber-300 bg-amber-400"
    : status === "BAJO CONTROL"
      ? "text-emerald-300 bg-emerald-400"
      : "text-slate-300 bg-slate-400";

export const ContributionExecutiveCell: React.FC<Props> = ({ code, title, kpis, status, onNavigateToKpi }) => {
  const empty = kpis.length === 0;
  return <div className={`rounded-xl border p-3 ${empty ? "border-slate-700/50 bg-slate-950/20" : "border-white/10 bg-slate-950/30"}`}>
    <p className={`text-xs font-black ${empty ? "text-slate-400" : tone(status).split(" ")[0]}`}><span className={`mr-1 inline-block h-2 w-2 rounded-full ${empty ? "bg-slate-500" : tone(status).split(" ")[1]}`} />{code}</p>
    <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-200">{title}</p>
    {empty ? <p className="mt-2 text-[9px] font-black uppercase tracking-widest text-slate-500">SIN INDICADORES</p> : <div className="mt-2 space-y-1 border-t border-white/5 pt-2">{kpis.slice(0, 3).map((kpi) => <div key={kpi.identity} className="flex items-center justify-between gap-2 text-[10px]"><span className="flex min-w-0 items-center gap-1 text-slate-200"><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone(kpi.status).split(" ")[1]}`} /><span className="whitespace-normal">{kpi.item.indicator || kpi.item.name}</span></span><span className="shrink-0 text-right text-slate-400">{kpi.score == null ? "—" : `${Math.round(kpi.score)}%`} · {kpi.status}</span><button type="button" className="shrink-0 font-black uppercase tracking-widest text-cyan-300" onClick={() => onNavigateToKpi?.(kpi.dashboard.id, kpi.item.id)}>REVISAR KPI</button></div>)}{kpis.length > 3 && <span className="text-[9px] text-slate-500">+{kpis.length - 3} más</span>}</div>}
    {!empty && <p className="mt-2 text-[9px] font-black uppercase text-slate-400">{kpis.length} KPI · {status}</p>}
  </div>;
};
