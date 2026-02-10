import React, { useState } from 'react';
import { ComplianceStatus } from '../types';

export interface PaiRow {
    action: string;
    date: string;
    result: string;
    impact?: 'positive' | 'low' | 'none';
}

interface ActionPlanProps {
    initialRows?: PaiRow[];
    status: ComplianceStatus;
    onSave: (rows: PaiRow[]) => void;
    canEdit: boolean;
    year?: number;
}

export const ActionPlan: React.FC<ActionPlanProps> = ({ initialRows = [], status, onSave, canEdit, year = new Date().getFullYear() }) => {
    const [rows, setRows] = useState<PaiRow[]>(initialRows.length > 0 ? initialRows : []);
    const [isEditing, setIsEditing] = useState(false);

    const isAlert = status === "AtRisk" || status === "OffTrack";

    // Status specific styling
    const statusConfig = {
        "OnTrack": {
            bg: 'bg-green-500/5',
            border: 'border-green-500/20',
            icon: '✅',
            title: 'Estrategia de Mantenimiento',
            description: 'Documenta las acciones que mantienen el indicador en éxito.',
            accent: 'text-green-400',
            buttonBg: 'bg-green-600/20 hover:bg-green-600/40 text-green-400'
        },
        "AtRisk": {
            bg: 'bg-yellow-500/10',
            border: 'border-yellow-500/30',
            icon: '⚠️',
            title: 'PM: Plan de Mitigación',
            description: 'Acciones preventivas para evitar desviaciones críticas.',
            accent: 'text-yellow-400',
            buttonBg: 'bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-400'
        },
        "OffTrack": {
            bg: 'bg-red-500/10',
            border: 'border-red-500/30',
            icon: '🚨',
            title: 'Protocolo de acción inmediata',
            description: '',
            accent: 'text-red-400',
            buttonBg: 'bg-red-600/30 hover:bg-red-600/50 text-red-400'
        },
        "Neutral": {
            bg: 'bg-slate-500/5',
            border: 'border-slate-500/20',
            icon: '⚪',
            title: 'Sin Datos / Neutral',
            description: 'No hay actividad suficiente para detonar alertas.',
            accent: 'text-slate-400',
            buttonBg: 'bg-slate-600/20 hover:bg-slate-600/40 text-slate-400'
        }
    };

    const config = statusConfig[status] || statusConfig["Neutral"];

    const handleAddRow = () => {
        setRows([...rows, { action: '', date: '', result: '', impact: 'none' }]);
    };

    const handleRemoveRow = (index: number) => {
        setRows(rows.filter((_, i) => i !== index));
    };

    const handleUpdateRow = (index: number, field: keyof PaiRow, value: string) => {
        const newRows = [...rows];
        newRows[index] = { ...newRows[index], [field]: value };
        setRows(newRows);
    };

    const handleSave = () => {
        const activeRows = rows.filter(r => r.action.trim() !== '' || r.date.trim() !== '' || r.result.trim() !== '');
        onSave(activeRows);
        setIsEditing(false);
    };

    const getImpactColor = (impact?: string) => {
        switch (impact) {
            case 'positive': return 'text-green-400 border-green-500/50 hover:bg-green-500/10';
            case 'low': return 'text-yellow-400 border-yellow-500/50 hover:bg-yellow-500/10';
            case 'none': default: return 'text-red-400 border-red-500/50 hover:bg-red-500/10';
        }
    };

    const getImpactLabel = (impact?: string) => {
        switch (impact) {
            case 'positive': return 'Positivo';
            case 'low': return 'Bajo';
            case 'none': default: return 'Nulo';
        }
    };

    return (
        <div className={`mt-6 rounded-2xl border p-6 transition-all duration-500 ${config.bg} ${config.border} shadow-inner`}>
            {/* Header section */}
            <div className="flex items-start justify-between gap-4 mb-6">
                <div className="flex gap-4">
                    <span className="text-3xl mt-1">{config.icon}</span>
                    <div>
                        <h4 className={`font-black text-base uppercase tracking-widest ${config.accent}`}>
                            {config.title}
                        </h4>
                        {config.description && <p className="text-xs text-slate-400 mt-0.5 font-medium">{config.description}</p>}
                    </div>
                </div>
                {canEdit && !isEditing && (
                    <button
                        onClick={() => {
                            if (rows.length === 0) handleAddRow();
                            setIsEditing(true);
                        }}
                        className={`text-[10px] px-4 py-2 rounded-xl font-black uppercase tracking-widest shadow-lg transition-all hover:scale-105 active:scale-95 ${config.buttonBg}`}
                    >
                        {rows.length > 0 ? 'Gestionar Project Manager' : 'Iniciar Plan de Acción'}
                    </button>
                )}
            </div>

            {isEditing ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="hidden md:grid grid-cols-[1fr,140px,1fr,100px,40px] gap-4 px-2">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Acción Táctica</label>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Fecha</label>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Resultados / Notas</label>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Impacto</label>
                        <span></span>
                    </div>

                    <div className="space-y-3">
                        {rows.map((row, index) => (
                            <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr,140px,1fr,100px,40px] gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-700/30 group">
                                <textarea
                                    value={row.action}
                                    onChange={(e) => handleUpdateRow(index, 'action', e.target.value)}
                                    placeholder="Describir acción..."
                                    className="bg-slate-950/50 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:ring-1 focus:ring-cyan-500 outline-none min-h-[60px]"
                                />
                                <div>
                                    <input
                                        type="date"
                                        value={row.date}
                                        min={`${year}-01-01`}
                                        max={`${year}-12-31`}
                                        onChange={(e) => handleUpdateRow(index, 'date', e.target.value)}
                                        className="w-full bg-slate-950/50 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:ring-1 focus:ring-cyan-500 outline-none"
                                    />
                                </div>
                                <textarea
                                    value={row.result}
                                    onChange={(e) => handleUpdateRow(index, 'result', e.target.value)}
                                    placeholder="Logros o notas..."
                                    className="bg-slate-950/50 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:ring-1 focus:ring-cyan-500 outline-none min-h-[60px]"
                                />
                                <div>
                                    <select
                                        value={row.impact || 'none'}
                                        onChange={(e) => handleUpdateRow(index, 'impact', e.target.value)}
                                        className={`w-full bg-slate-950/50 border rounded-lg p-2 text-xs font-bold focus:ring-1 focus:ring-cyan-500 outline-none appearance-none ${getImpactColor(row.impact)}`}
                                    >
                                        <option value="positive" className="text-green-400 bg-slate-900">🟢 Positivo</option>
                                        <option value="low" className="text-yellow-400 bg-slate-900">🟡 Bajo</option>
                                        <option value="none" className="text-red-400 bg-slate-900">🔴 Nulo</option>
                                    </select>
                                </div>
                                <button
                                    onClick={() => handleRemoveRow(index)}
                                    className="flex items-center justify-center text-slate-600 hover:text-red-500 transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-between items-center pt-2">
                        <button
                            onClick={handleAddRow}
                            className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.2em] border border-cyan-500/20 px-4 py-2 rounded-lg hover:bg-cyan-500/10 transition-all"
                        >
                            + Agregar Acción
                        </button>
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setRows(initialRows); setIsEditing(false); }}
                                className="text-xs text-slate-500 hover:text-slate-300 px-4 py-2 font-bold uppercase tracking-widest"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-2.5 rounded-xl font-black uppercase tracking-widest shadow-xl shadow-cyan-900/40"
                            >
                                Guardar Itinerario
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    {rows.length > 0 ? (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-800/50">
                                    <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Acción</th>
                                    <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500 w-[120px]">Fecha</th>
                                    <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500 w-[200px]">Resultados</th>
                                    <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500 w-[100px] text-center">Impacto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/30">
                                {rows.map((row, idx) => (
                                    <tr key={idx} className="group hover:bg-slate-950/20 transition-colors">
                                        <td className="py-4 px-4">
                                            <p className="text-sm text-slate-200 font-medium leading-relaxed italic">&quot;{row.action}&quot;</p>
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className="text-xs bg-slate-900 border border-slate-800 px-3 py-1 rounded-full text-slate-400 font-bold whitespace-nowrap">
                                                {row.date || 'Pendiente'}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4">
                                            <p className="text-xs text-slate-400 leading-relaxed italic">{row.result || '--'}</p>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${getImpactColor(row.impact)}`}>
                                                {getImpactLabel(row.impact)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        isAlert ? (
                            <div className="text-center py-8 bg-slate-950/20 rounded-2xl border border-dashed border-slate-800">
                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] animate-pulse">
                                    -- Protocolo PAI Pendiente de Definición --
                                </p>
                            </div>
                        ) : null
                    )}
                </div>
            )
            }
        </div >
    );
};
