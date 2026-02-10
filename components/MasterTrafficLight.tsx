import React, { useMemo } from 'react';
import { Dashboard as DashboardType } from '../types';
import { calculateDashboardWeightedScore } from '../utils/compliance';

interface MasterTrafficLightProps {
    allDashboards: DashboardType[];
    clients: string[];
    year: number;
    onClose: () => void;
    onSelectClient: (clientId: string) => void;
}

export const MasterTrafficLight: React.FC<MasterTrafficLightProps> = ({ allDashboards, clients, year, onClose, onSelectClient }) => {

    const clientSummaries = useMemo(() => {
        return clients.map(client => {
            const clientDashboards = allDashboards.filter(d =>
                (d.clientId || 'IPS').trim().toUpperCase() === client.toUpperCase() &&
                d.year === year &&
                !String(d.id).startsWith('agg-')
            );

            if (clientDashboards.length === 0) return null;

            // Calculate overall score for the client (simple average of their dashboards for master view)
            const scores = clientDashboards.map(d => {
                const thresholds = d.thresholds || { onTrack: 95, atRisk: 85 };
                return calculateDashboardWeightedScore(d.items || [], thresholds, year);
            });

            const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

            return {
                name: client,
                score: avgScore,
                boardsCount: clientDashboards.length,
                status: avgScore >= 95 ? 'OnTrack' : avgScore >= 85 ? 'AtRisk' : 'Critical'
            };
        }).filter(Boolean);
    }, [allDashboards, clients, year]);

    return (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-[150] p-8 flex flex-col items-center overflow-y-auto">
            <div className="w-full max-w-6xl">
                <div className="flex justify-between items-center mb-12">
                    <div>
                        <h1 className="text-5xl font-black italic uppercase tracking-tighter text-white">Semáforo Maestro</h1>
                        <p className="text-cyan-400 font-bold uppercase tracking-[0.3em] text-xs mt-2">Vista Ejecutiva Multi-Cliente • {year}</p>
                    </div>
                    <button onClick={onClose} className="p-4 bg-white/5 hover:bg-white/10 rounded-full transition-all text-slate-400 hover:text-white">✕</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {clientSummaries.map((c: any) => (
                        <div
                            key={c.name}
                            onClick={() => { onSelectClient(c.name); onClose(); }}
                            className="group relative bg-slate-900/50 border border-white/5 p-6 rounded-[2rem] hover:bg-slate-800/50 transition-all cursor-pointer overflow-hidden"
                        >
                            <div className={`absolute top-0 right-0 w-32 h-32 blur-[60px] opacity-20 transition-all group-hover:opacity-40 ${c.status === 'OnTrack' ? 'bg-emerald-500' : c.status === 'AtRisk' ? 'bg-amber-500' : 'bg-rose-500'}`} />

                            <div className="flex justify-between items-start mb-6 relative z-10">
                                <div>
                                    <h3 className="text-2xl font-black text-white uppercase tracking-tight group-hover:text-cyan-400 transition-colors">{c.name}</h3>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{c.boardsCount} Tableros operativos</span>
                                </div>
                                <div className={`text-4xl font-black tabular-nums ${c.status === 'OnTrack' ? 'text-emerald-400' : c.status === 'AtRisk' ? 'text-amber-400' : 'text-rose-400'}`}>
                                    {Math.round(c.score)}%
                                </div>
                            </div>

                            <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden mb-4">
                                <div
                                    className={`absolute top-0 left-0 h-full transition-all duration-1000 ${c.status === 'OnTrack' ? 'bg-emerald-500' : c.status === 'AtRisk' ? 'bg-amber-500' : 'bg-rose-500'}`}
                                    style={{ width: `${c.score}%` }}
                                />
                            </div>

                            <div className="flex justify-between items-center relative z-10">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${c.status === 'OnTrack' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' : c.status === 'AtRisk' ? 'text-amber-400 border-amber-500/20 bg-amber-500/5' : 'text-rose-400 border-rose-500/20 bg-rose-500/5'}`}>
                                    {c.status === 'OnTrack' ? 'En Tiempo' : c.status === 'AtRisk' ? 'En Riesgo' : 'Crítico'}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 group-hover:translate-x-1 transition-transform">Ver detalle →</span>
                            </div>
                        </div>
                    ))}
                </div>

                {clientSummaries.length === 0 && (
                    <div className="py-24 text-center opacity-30">
                        <span className="text-6xl mb-4 block">📊</span>
                        <p className="font-black uppercase tracking-[0.3em]">No hay datos consolidados para mostrar</p>
                    </div>
                )}
            </div>
        </div>
    );
};
