import React, { useState, useMemo } from 'react';

interface Activity {
    id: string;
    label: string;
    targetCount: number;
    completedCount: number;
}

interface ActivityManagerProps {
    periodLabel: string;
    initialActivities: Activity[];
    onSave: (activities: Activity[]) => void;
    onClose: () => void;
    canEdit: boolean;
    onCopyToAll?: () => void;
}

export const ActivityManager: React.FC<ActivityManagerProps> = ({
    periodLabel,
    initialActivities,
    onSave,
    onClose,
    canEdit,
    onCopyToAll
}) => {
    const [activities, setActivities] = useState<Activity[]>([...initialActivities]);
    const [search, setSearch] = useState('');
    const [bulkText, setBulkText] = useState('');
    const [isBulkMode, setIsBulkMode] = useState(false);

    const filtered = useMemo(() => {
        return activities.filter(a => a.label.toLowerCase().includes(search.toLowerCase()));
    }, [activities, search]);

    const stats = useMemo(() => {
        const totalT = activities.reduce((s, a) => s + Number(a.targetCount), 0);
        const totalC = activities.reduce((s, a) => s + Number(a.completedCount), 0);
        return { totalT, totalC, percent: totalT > 0 ? Math.round((totalC / totalT) * 100) : 0 };
    }, [activities]);

    const handleUpdate = (id: string, updates: Partial<Activity>) => {
        setActivities(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    };

    const handleBulkAdd = () => {
        const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
        const newItems = lines.map(l => ({
            id: Math.random().toString(36).substr(2, 9),
            label: l,
            targetCount: 1,
            completedCount: 0
        }));
        setActivities(prev => [...prev, ...newItems]);
        setBulkText('');
        setIsBulkMode(false);
    };

    const removeItem = (id: string) => {
        if (!confirm('¿Eliminar esta actividad?')) return;
        setActivities(prev => prev.filter(a => a.id !== id));
    };

    return (
        <div
            className="fixed inset-0 z-[110] bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="activity-manager-title"
        >
            <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-5xl h-[90vh] flex flex-col shadow-3xl overflow-hidden animate-in zoom-in-95 duration-300">

                {/* Header */}
                <div className="p-8 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-900/50">
                    <div>
                        <h3 id="activity-manager-title" className="text-3xl font-black text-white italic uppercase tracking-tighter mb-1">
                            Gestión de Actividades - {periodLabel}
                        </h3>
                        <p className="text-slate-500 text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                            Modo Detallado (Supervisiones/Checklist)
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="bg-slate-950/50 border border-indigo-500/20 px-6 py-3 rounded-2xl flex flex-col items-center min-w-[120px]">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Impacto Total</span>
                            <span className="text-2xl font-black text-white" aria-live="polite">{stats.totalC} / {stats.totalT}</span>
                            <div
                                className="w-full bg-slate-800 h-1 rounded-full mt-2 overflow-hidden"
                                role="progressbar"
                                aria-valuenow={stats.percent}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label={`Avance total: ${stats.percent}%`}
                            >
                                <div className="bg-indigo-500 h-full transition-all duration-500" style={{ width: `${stats.percent}%` }} />
                            </div>
                        </div>
                        <button
                            onClick={() => { if (canEdit) onSave(activities); onClose(); }}
                            className={`px-8 py-4 ${canEdit ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-700 hover:bg-slate-600'} text-white font-black rounded-2xl shadow-xl transition-all uppercase tracking-widest text-xs active:scale-95 flex items-center gap-2`}
                            aria-label={canEdit ? 'Guardar todos los cambios realizados' : 'Cerrar ventana de actividades'}
                        >
                            <span aria-hidden="true">{canEdit ? '💾' : '✕'}</span>
                            {canEdit ? 'GUARDAR CAMBIOS' : 'CERRAR'}
                        </button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="p-4 bg-slate-800/10 border-b border-white/5 flex flex-wrap gap-4 items-center">
                    <div className="flex-1 min-w-[300px] relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
                        <input
                            type="text"
                            placeholder="Buscar meta o actividad..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-slate-950/50 border border-white/5 rounded-xl py-3 pl-12 pr-4 text-white text-sm focus:ring-1 focus:ring-indigo-500/50 outline-none"
                        />
                    </div>
                    {canEdit && (
                        <>
                            <button
                                onClick={() => setIsBulkMode(!isBulkMode)}
                                className="px-4 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5 transition-all"
                                aria-expanded={isBulkMode}
                                aria-controls="bulk-add-panel"
                            >
                                ⚡ Carga Masiva
                            </button>
                            {onCopyToAll && (
                                <button onClick={onCopyToAll} className="px-4 py-3 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-cyan-500/10 transition-all">
                                    📋 Copiar a todo el año
                                </button>
                            )}
                        </>
                    )}
                </div>

                {/* Body */}
                <div className="flex-grow overflow-y-auto p-4 md:p-8 space-y-2 relative pb-32 md:pb-8">

                    {isBulkMode && (
                        <div
                            id="bulk-add-panel"
                            className="bg-slate-800/80 backdrop-blur-xl border border-indigo-500/30 rounded-2xl p-6 mb-6 animate-in slide-in-from-top-4 duration-300 z-20 shadow-2xl"
                        >
                            <h4 className="text-xs font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="text-xl" aria-hidden="true">⚡</span> Cargar Lista de Metas (Carga Masiva)
                            </h4>
                            <p className="text-[10px] text-slate-400 mb-4">Pega una lista de metas o elementos (uno por renglón). Se añadirán con meta = 1.</p>
                            <textarea
                                className="w-full bg-slate-950 border border-white/10 rounded-xl p-4 text-slate-200 text-sm min-h-[200px] mb-4 font-mono focus:ring-1 focus:ring-indigo-500 outline-none"
                                placeholder="Meta 1&#10;Meta 2&#10;..."
                                value={bulkText}
                                onChange={e => setBulkText(e.target.value)}
                                aria-label="Lista de metas para carga masiva"
                            />
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setIsBulkMode(false)} className="px-4 py-2 text-slate-400 text-xs font-black uppercase hover:text-white transition-colors">Cancelar</button>
                                <button onClick={handleBulkAdd} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-black uppercase shadow-lg transition-all active:scale-95">Añadir Metas a la Lista</button>
                            </div>
                        </div>
                    )}

                    {filtered.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-30 py-20">
                            <span className="text-6xl mb-4">📝</span>
                            <p className="font-black uppercase tracking-[0.3em]">Sin actividades registradas</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-2">
                            {filtered.map(a => (
                                <div key={a.id} className="group/row flex flex-col md:flex-row md:items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/5 p-4 rounded-2xl transition-all">
                                    <div className="flex-1 flex flex-col">
                                        <span className="text-xs font-black text-slate-300 uppercase tracking-wide">{a.label}</span>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div
                                                className="h-1 bg-slate-800 flex-grow rounded-full overflow-hidden max-w-[100px]"
                                                role="progressbar"
                                                aria-valuenow={Number(a.targetCount) > 0 ? Math.round((Number(a.completedCount) / Number(a.targetCount)) * 100) : 0}
                                                aria-valuemin={0}
                                                aria-valuemax={100}
                                                aria-label={`Avance de ${a.label}: ${Number(a.targetCount) > 0 ? Math.round((Number(a.completedCount) / Number(a.targetCount)) * 100) : 0}%`}
                                            >
                                                <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (Number(a.completedCount) / Number(a.targetCount)) * 100)}%` }} />
                                            </div>
                                            <span className="text-[8px] font-bold text-slate-500" aria-hidden="true">{Number(a.targetCount) > 0 ? Math.round((Number(a.completedCount) / Number(a.targetCount)) * 100) : 0}% de avance</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between md:justify-end gap-4 md:gap-12">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-[8px] font-black text-slate-500 uppercase">Meta</span>
                                            <div className="flex items-center gap-3">
                                                {canEdit && <button onClick={() => handleUpdate(a.id, { targetCount: Math.max(1, a.targetCount - 1) })} className="w-6 h-6 bg-slate-800 rounded-lg text-xs hover:bg-slate-700" aria-label={`Disminuir meta para ${a.label}`}>-</button>}
                                                <input
                                                    type="number"
                                                    value={a.targetCount}
                                                    onChange={(e) => handleUpdate(a.id, { targetCount: Math.max(1, parseInt(e.target.value) || 0) })}
                                                    className="bg-slate-800/50 border border-white/5 rounded-lg text-lg font-black text-white w-16 text-center focus:ring-1 focus:ring-indigo-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all selection:bg-indigo-500/30"
                                                    disabled={!canEdit}
                                                    aria-label={`Cantidad meta para ${a.label}`}
                                                />
                                                {canEdit && <button onClick={() => handleUpdate(a.id, { targetCount: a.targetCount + 1 })} className="w-6 h-6 bg-slate-800 rounded-lg text-xs hover:bg-slate-700" aria-label={`Aumentar meta para ${a.label}`}>+</button>}
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-[8px] font-black text-indigo-400 uppercase">Realizado</span>
                                            <div className="flex items-center gap-3 bg-indigo-500/10 p-1 rounded-xl border border-indigo-500/20">
                                                {canEdit && <button onClick={() => handleUpdate(a.id, { completedCount: Math.max(0, a.completedCount - 1) })} className="w-8 h-8 bg-indigo-600/30 rounded-lg text-lg hover:bg-indigo-600 text-white transition-colors" aria-label={`Disminuir avance de ${a.label}`}>-</button>}
                                                <input
                                                    type="number"
                                                    value={a.completedCount}
                                                    onChange={(e) => handleUpdate(a.id, { completedCount: Math.max(0, parseInt(e.target.value) || 0) })}
                                                    className={`bg-indigo-600/20 border border-indigo-500/30 rounded-lg text-2xl font-black w-20 text-center focus:ring-1 focus:ring-indigo-400 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all selection:bg-indigo-500/30 ${a.completedCount >= a.targetCount ? 'text-emerald-400' : 'text-white'}`}
                                                    disabled={!canEdit}
                                                    aria-label={`Cantidad realizada de ${a.label}`}
                                                />
                                                {canEdit && <button onClick={() => handleUpdate(a.id, { completedCount: a.completedCount + 1 })} className="w-8 h-8 bg-indigo-600/30 rounded-lg text-lg hover:bg-indigo-600 text-white transition-colors" aria-label={`Aumentar avance de ${a.label}`}>+</button>}
                                            </div>
                                        </div>

                                        {canEdit && (
                                            <button onClick={() => removeItem(a.id)} className="p-2 opacity-100 md:opacity-0 group-hover/row:opacity-100 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all" title="Eliminar esta meta">
                                                🗑️
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {canEdit && activities.length > 0 && (
                        <div className="pt-8 pb-12 flex justify-center">
                            <button
                                onClick={() => { onSave(activities); onClose(); }}
                                className="px-12 py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl shadow-2xl shadow-emerald-900/40 transition-all uppercase tracking-[0.2em] text-sm active:scale-95 flex items-center gap-3"
                                aria-label="Confirmar y guardar cambios definitivos de todas las actividades"
                            >
                                <span aira-hidden="true">💾</span>
                                GUARDAR CAMBIOS DEFINITIVOS
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer Flotante (Móvil) */}
                <div className="md:hidden fixed bottom-6 left-6 right-6 z-[120]">
                    <button
                        onClick={() => { if (canEdit) onSave(activities); onClose(); }}
                        className={`w-full py-5 ${canEdit ? 'bg-emerald-500 shadow-emerald-500/40' : 'bg-slate-700'} text-white font-black rounded-3xl shadow-2xl transition-all uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 border border-white/20`}
                    >
                        <span>{canEdit ? '💾' : '✕'}</span>
                        {canEdit ? 'GUARDAR TODO' : 'CERRAR'}
                    </button>
                </div>

            </div>
        </div>
    );
};
