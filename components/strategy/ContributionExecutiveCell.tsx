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
  onNavigateToKpi?: (
    dashboardId: number | string,
    itemId: number | string,
  ) => void;
};

const tone = (status: string) =>
  status === "CRÍTICO" || status === "REQUIERE INTERVENCIÓN"
    ? "text-rose-300 bg-rose-400"
    : status === "REQUIERE ATENCIÓN"
      ? "text-amber-300 bg-amber-400"
      : status === "BAJO CONTROL"
        ? "text-emerald-300 bg-emerald-400"
        : "text-slate-300 bg-slate-400";

export const ContributionExecutiveCell: React.FC<Props> = ({
  code,
  title,
  kpis,
  status,
  onNavigateToKpi,
}) => {
  const empty = kpis.length === 0;
  return (
    <div
      className={`rounded-xl border p-3 ${empty ? "border-slate-700/50 bg-slate-950/20" : "border-white/10 bg-slate-950/30"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p
            className={`text-xs font-black ${empty ? "text-slate-400" : tone(status).split(" ")[0]}`}
          >
            <span
              className={`mr-1 inline-block h-2 w-2 rounded-full ${empty ? "bg-slate-500" : tone(status).split(" ")[1]}`}
            />
            {code}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-200">{title}</p>
        </div>
        {!empty && (
          <span className="shrink-0 text-[9px] font-black uppercase text-slate-400">
            {kpis.length} KPI
          </span>
        )}
      </div>
      {empty ? (
        <p className="mt-3 text-[9px] font-black uppercase tracking-widest text-slate-500">
          SIN INDICADORES
        </p>
      ) : (
        <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
          {kpis.map((kpi) => {
            const [textTone, dotTone] = tone(kpi.status).split(" ");
            const label = kpi.item?.indicator || kpi.item?.name || "Indicador";
            return (
              <div
                key={kpi.identity}
                role="button"
                tabIndex={0}
                className="block w-full cursor-pointer rounded-lg border border-white/5 bg-slate-950/30 p-2 text-left transition hover:border-cyan-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                onClick={() => onNavigateToKpi?.(kpi.dashboard?.id, kpi.item?.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ")
                    onNavigateToKpi?.(kpi.dashboard?.id, kpi.item?.id);
                }}
              >
                <span className="flex items-start gap-2">
                  <span
                    className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${dotTone}`}
                  />
                  <span className="min-w-0 flex-1 text-[10px] font-semibold leading-snug text-slate-200">
                    {label}
                  </span>
                  <span
                    className={`shrink-0 text-[9px] font-black ${textTone}`}
                  >
                    {kpi.score == null ? "—" : `${Math.round(kpi.score)}%`}
                  </span>
                </span>
                <span className="mt-1 flex items-center justify-between pl-3.5">
                  <span className="text-[9px] uppercase tracking-wide text-slate-500">
                    {kpi.score == null ? "—" : `${Math.round(kpi.score)}%`} ·{" "}
                    {kpi.status}
                  </span>
                  <button
                    type="button"
                    className="text-[9px] font-black uppercase tracking-widest text-cyan-300"
                    onClick={(event) => {
                      event.stopPropagation();
                      onNavigateToKpi?.(kpi.dashboard.id, kpi.item.id);
                    }}
                  >
                    VER KPI
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
