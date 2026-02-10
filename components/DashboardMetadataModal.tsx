import React, { useState, useEffect } from 'react';

interface DashboardMetadataModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentTitle: string;
    currentSubtitle: string;
    currentGroup?: string;
    currentArea?: string;
    currentTargetIndicatorCount?: number;
    totalIndicatorsCount?: number;
    onSave: (newTitle: string, newSubtitle: string, newGroup: string, newArea: string, targetIndicatorCount?: number) => Promise<void>;
    existingGroups: string[];
    groupLabel: string;
    dashboardLabel: string;
}

export const DashboardMetadataModal: React.FC<DashboardMetadataModalProps> = ({
    isOpen,
    onClose,
    currentTitle,
    currentSubtitle,
    currentGroup,
    currentArea,
    currentTargetIndicatorCount,
    totalIndicatorsCount,
    onSave,
    existingGroups,
    groupLabel,
    dashboardLabel
}) => {
    const [title, setTitle] = useState(currentTitle);
    const [subtitle, setSubtitle] = useState(currentSubtitle);
    const [group, setGroup] = useState(currentGroup || '');
    const [area, setArea] = useState(currentArea || '');
    const [targetIndicatorCount, setTargetIndicatorCount] = useState<string>(currentTargetIndicatorCount?.toString() || '');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setTitle(currentTitle);
            setSubtitle(currentSubtitle);
            setGroup(currentGroup || '');
            setArea(currentArea || '');
            setTargetIndicatorCount(currentTargetIndicatorCount?.toString() || '');
        }
    }, [isOpen, currentTitle, currentSubtitle, currentGroup, currentArea, currentTargetIndicatorCount]);

    const handleSave = async () => {
        if (!title.trim()) {
            alert("El título es obligatorio");
            return;
        }
        setIsSaving(true);
        try {
            const numericTarget = targetIndicatorCount === '' ? undefined : parseInt(targetIndicatorCount, 10);
            await onSave(title.trim(), subtitle.trim(), group.trim(), area.trim().toUpperCase(), numericTarget);
            onClose();
        } catch (error) {
            console.error("Error saving metadata:", error);
            alert("Error al guardar cambios. Inténtalo de nuevo.");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 border-b border-slate-700 flex justify-between items-center" onClick={e => e.stopPropagation()}>
                    <h3 className="text-lg font-bold text-white">Editar Información del {dashboardLabel}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                    {/* Title Input */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                            Título del {dashboardLabel} <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none transition-all placeholder:text-slate-600"
                            placeholder={`Ej: "Ventas", "Operaciones"`}
                            autoFocus
                        />
                    </div>

                    {/* Subtitle Input */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                            Subtítulo
                        </label>
                        <input
                            type="text"
                            value={subtitle}
                            onChange={(e) => setSubtitle(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 focus:ring-2 focus:ring-cyan-500 outline-none transition-all placeholder:text-slate-600"
                            placeholder="Ej: Resumen Mensual"
                        />
                    </div>

                    {/* Group Input with Datalist */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                            <span>{groupLabel}</span>
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                list="group-suggestions-modal"
                                value={group}
                                onChange={(e) => setGroup(e.target.value.toUpperCase())}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none transition-all placeholder:text-slate-600 uppercase"
                                placeholder={`Ej: "METRO", "ZONA A"`}
                            />
                            <datalist id="group-suggestions-modal">
                                {existingGroups.map(g => (
                                    <option key={g} value={g} />
                                ))}
                            </datalist>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">
                            Asigna este tablero a un grupo para organizarlo.
                        </p>
                    </div>

                    {/* Area Input */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                            <span>Área Funcional (Sistema de Áreas)</span>
                        </label>
                        <input
                            type="text"
                            value={area}
                            onChange={(e) => setArea(e.target.value.toUpperCase())}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all placeholder:text-slate-600 uppercase"
                            placeholder='Ej: "OPERACIONES", "ADMINISTRACIÓN"'
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                            El &quot;Sistema de Áreas&quot; permite sincronizar KPIs solo entre tableros del mismo área.
                        </p>
                    </div>

                    {/* Target Indicator Count Input (v5.5.3) */}
                    <div className="pt-2 border-t border-slate-800">
                        <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                            <span>🎯 Meta de Captura de Indicadores</span>
                            <span className="bg-cyan-500/10 text-cyan-500 px-1.5 py-0.5 rounded text-[8px]">v5.5.3</span>
                        </label>
                        <input
                            type="number"
                            value={targetIndicatorCount}
                            onChange={(e) => setTargetIndicatorCount(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none transition-all placeholder:text-slate-600"
                            placeholder={`Vacío = Usar total de indicadores (${totalIndicatorsCount || 0})`}
                        />
                        <p className="text-[9px] text-slate-500 mt-1.5 leading-relaxed">
                            Define cuántos indicadores debe capturar este usuario para cumplir con su reporte mensual.
                            <strong> Si se deja vacío, se usará el total de indicadores configurados.</strong>
                        </p>
                    </div>
                </div>

                <div className="p-4 bg-slate-800/50 border-t border-slate-700 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                        disabled={isSaving}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 transition-all shadow-lg shadow-cyan-900/20 flex items-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Guardando...
                            </>
                        ) : (
                            "Guardar Cambios"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
