import React, { useState } from 'react';
import { DashboardItem } from '../types';

type EditableIndicator = Omit<DashboardItem, 'id'> & { id: number | string };

/**
 * Props for the IndicatorManager component.
 * Allows managing KPIs for a specific dashboard or across all available dashboards.
 */
interface IndicatorManagerProps {
    /** Optional React key for forcing remounts. */
    key?: React.Key;
    /** The initial list of dashboard items to edit. */
    initialItems: DashboardItem[];
    /** Callback triggered when save is confirmed. Receives updated items and global flag. */
    onSaveChanges: (items: DashboardItem[], applyGlobally: boolean) => void;
    /** Callback triggered to close the manager modal. */
    onCancel: () => void;
    /** Array of all available dashboards for global sync or selector. */
    dashboards: { id: number | string; title: string }[];
    /** Currently selected dashboard ID. */
    activeDashboardId: number | string;
    /** Callback when user selects a different dashboard from dropdown. */
    onDashboardSelect: (id: number | string) => void;
    /** Default IPS specific template items. */
    defaultItems?: DashboardItem[];
}

const NEW_INDICATOR_TEMPLATE: Omit<DashboardItem, 'id'> = {
    indicator: 'Nuevo Indicador',
    weight: 0,
    monthlyGoals: Array(12).fill(0),
    monthlyProgress: Array(12).fill(0),
    unit: '%',
    type: 'accumulative',
    goalType: 'maximize',
    frequency: 'monthly',
    weeklyGoals: Array(53).fill(null),
    weeklyProgress: Array(53).fill(null),
    actionPlan: "",
    paiRows: [],
    indicatorType: 'simple',
    componentIds: [],
    formula: '',
};

/**
 * Component used by Global Admins and Editors to Add, Edit, or Delete KPIs.
 * Features:
 * - Hybrid ID engine support (Strings and Numbers)
 * - Safe aggregate dashboard protection via forced redirection
 * - Drag and drop manual sorting
 * 
 * @example
 * <IndicatorManager
 *    initialItems={dashboard.items}
 *    activeDashboardId={dashboard.id}
 *    dashboards={allDashboards}
 *    onSaveChanges={handleSave}
 *    onCancel={closeModal}
 * />
 */
export const IndicatorManager = ({ initialItems, onSaveChanges, onCancel, dashboards, activeDashboardId, onDashboardSelect, defaultItems }: IndicatorManagerProps) => {
    const [items, setItems] = useState<EditableIndicator[]>(() => {
        return [...initialItems].sort((a, b) => {
            // 🛡️ V6.2.1: Sort by order first, then ID
            if (a.order !== undefined && b.order !== undefined) {
                return a.order - b.order;
            }
            return (Number(a.id) || 999) - (Number(b.id) || 999);
        });
    });

    // 🛡️ REGLA v6.1.7 (FIXED): Sincronizar estado local SOLO cuando el tablero realmente cambia
    // Esto evita perder cambios locales si App.tsx se re-renderiza por otras razones.
    const lastDashboardId = React.useRef(activeDashboardId);
    React.useEffect(() => {
        // 🛡️ PROTECCIÓN v6.3.0: Si el ID actual no está en la lista (ej: es un agregado),
        // forzamos la selección del primero disponible para evitar guardar en "el vacío".
        const isValid = dashboards.some(d => String(d.id) === String(activeDashboardId));
        if (!isValid && dashboards.length > 0) {
            onDashboardSelect(dashboards[0].id);
            return;
        }

        if (lastDashboardId.current !== activeDashboardId) {
            setItems([...initialItems].sort((a, b) => {
                // 🛡️ V6.2.1: Sort by order first, then ID
                if (a.order !== undefined && b.order !== undefined) {
                    return a.order - b.order;
                }
                const numA = Number(a.id);
                const numB = Number(b.id);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return String(a.id).localeCompare(String(b.id));
            }));
            lastDashboardId.current = activeDashboardId;
        }
    }, [initialItems, activeDashboardId, dashboards, onDashboardSelect]);

    const [applyGlobally, setApplyGlobally] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    const handleRestoreFactory = () => {
        if (!defaultItems) return;
        setItems(JSON.parse(JSON.stringify(defaultItems))); // Deep copy to detach references
    };

    const handleInputChange = (id: number | string, field: keyof EditableIndicator, value: string | number | boolean | (number | string)[]) => {
        setItems(currentItems =>
            currentItems.map(item => (item.id === id ? { ...item, [field]: value } : item))
        );
    };

    const handleAddItem = () => {
        const newItem: EditableIndicator = {
            id: `new-${Date.now()}`,
            ...NEW_INDICATOR_TEMPLATE,
            order: items.length + 1 // New items go to the end
        };
        setItems(currentItems => [...currentItems, newItem]);
    };

    const handleDeleteItem = (idToDelete: number | string) => {
        setItems(currentItems => currentItems.filter(item => item.id !== idToDelete));
    };

    const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = "move";
        // e.dataTransfer.setDragImage(e.currentTarget, 20, 20); // Opcional
    };

    const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>) => {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e: React.DragEvent<HTMLTableRowElement>, dropIndex: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === dropIndex) return;

        const newItems = [...items];
        const [movedItem] = newItems.splice(draggedIndex, 1);
        newItems.splice(dropIndex, 0, movedItem);

        // 🛡️ V6.2.1: Re-assign order numbers immediately
        const reorderedItems = newItems.map((item, index) => ({
            ...item,
            order: index + 1
        }));

        setItems(reorderedItems);
        setDraggedIndex(null);
    };

    /**
     * Finalizes structural changes, recalculates internal priorities (orders),
     * and triggers the global save handler (App.tsx).
     */
    const handleSave = () => {
        const validItems = items.filter(item => item.indicator.trim() !== '');

        // 🛡️ IDENTIDAD ESTABLE (v6.2.5): Safe ID generation for hybrid string/number schemas
        let currentMaxId = items.reduce((max, it) => {
            const pid = Number(it.id);
            return (!isNaN(pid) && pid < 900000) ? Math.max(max, pid) : max;
        }, 0);

        const finalData = validItems.map((item) => {
            const { id, ...rest } = item;

            // Si el ID es temporal ("new-"), generamos uno nuevo numérico
            if (typeof id === 'string' && id.startsWith('new-')) {
                currentMaxId++;
                return { ...rest, id: currentMaxId };
            }

            // Si el ID ya existe (sea número o string real), lo preservamos CUALQUIERA que sea su tipo
            return { ...rest, id };
        });

        // 🛡️ FIX v6.2.3: Ensure we send data sorted by order explicitly
        const sortedFinalData = finalData.sort((a, b) => {
            const orderA = a.order !== undefined ? a.order : 9999;
            const orderB = b.order !== undefined ? b.order : 9999;
            return orderA - orderB;
        });

        onSaveChanges(sortedFinalData, applyGlobally);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="bg-slate-800 rounded-xl shadow-2xl ring-1 ring-white/10 w-full max-w-6xl p-6 flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 id="modal-title" className="text-xl font-bold text-slate-100">Gestionar Indicadores</h3>
                        <p className="text-sm text-slate-400">Añade, elimina o edita las propiedades de tus KPIs.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">Tablero:</span>
                        <select
                            aria-label="Seleccionar tablero activo"
                            value={activeDashboardId}
                            onChange={(e) => onDashboardSelect(e.target.value)}
                            className="bg-slate-700 border border-slate-600 rounded-md p-2 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none min-w-[200px]"
                        >
                            {dashboards.map(d => (
                                <option key={d.id} value={d.id}>{d.title}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto pr-2" style={{ maxHeight: '80vh' }}>
                    <table className="w-full text-left table-fixed">
                        <thead className="sticky top-0 bg-slate-800 z-10">
                            <tr>
                                <th scope="col" className="p-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-[60px]">ID</th>
                                <th scope="col" className="p-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-2/5">Nombre del Indicador</th>
                                <th scope="col" className="p-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-1/5">Unidad</th>
                                <th scope="col" className="p-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-1/5">Tipo de Meta</th>
                                <th scope="col" className="p-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-1/5">Cálculo</th>
                                <th scope="col" className="p-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-[120px]">Frecuencia</th>
                                <th scope="col" className="p-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-[140px]">Motor</th>
                                <th scope="col" className="p-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-[100px]">Modo</th>
                                <th scope="col" className="p-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-[80px]">Inicio</th>
                                <th scope="col" className="p-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-[60px]"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => (
                                <tr
                                    key={item.id}
                                    className={`border-b border-slate-700/50 ${draggedIndex === index ? 'opacity-50 bg-slate-700' : 'hover:bg-slate-700/30'} transition-all`}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, index)}
                                >
                                    <td className="p-2 font-mono text-xs text-slate-500 cursor-move" title={`ID: ${item.id} (Arrastra para reordenar)`}>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg opacity-50">☰</span>
                                            {String(item.id).startsWith('new-') ? '*' : (typeof item.id === 'string' && item.id.length > 8 ? item.id.substring(0, 6) + '..' : item.id)}
                                        </div>
                                    </td>
                                    <td className="p-2">
                                        <input aria-label="Nombre del indicador" type="text" value={item.indicator} onChange={(e) => handleInputChange(item.id, 'indicator', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none" />
                                    </td>
                                    <td className="p-2">
                                        <input aria-label="Unidad de medida" type="text" value={item.unit} onChange={(e) => handleInputChange(item.id, 'unit', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none" />
                                    </td>
                                    <td className="p-2">
                                        <select aria-label="Tipo de meta" value={item.goalType} onChange={(e) => handleInputChange(item.id, 'goalType', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none h-[42px]">
                                            <option value="maximize">Maximizar</option>
                                            <option value="minimize">Minimizar</option>
                                        </select>
                                    </td>
                                    <td className="p-2">
                                        <select aria-label="Tipo de cálculo" value={item.type} onChange={(e) => handleInputChange(item.id, 'type', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none h-[42px]">
                                            <option value="accumulative">Sumar</option>
                                            <option value="average">Promediar</option>
                                        </select>
                                    </td>
                                    <td className="p-2">
                                        <select aria-label="Frecuencia" value={item.frequency || 'monthly'} onChange={(e) => handleInputChange(item.id, 'frequency', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-cyan-400 font-bold text-sm focus:ring-2 focus:ring-cyan-500 outline-none h-[42px]">
                                            <option value="monthly">Mensual</option>
                                            <option value="weekly">Semanal</option>
                                        </select>
                                    </td>
                                    <td className="p-2">
                                        <div className="flex flex-col gap-1">
                                            <select
                                                aria-label="Tipo de motor de indicador"
                                                value={item.indicatorType || 'simple'}
                                                onChange={(e) => handleInputChange(item.id, 'indicatorType', e.target.value)}
                                                className={`w-full bg-slate-900 border ${item.indicatorType && item.indicatorType !== 'simple' ? 'border-amber-500/50 text-amber-400' : 'border-slate-700 text-slate-300'} rounded-md p-1.5 text-[10px] font-black uppercase outline-none transition-all`}
                                            >
                                                <option value="simple">Simple</option>
                                                <option value="compound">Agregado</option>
                                                <option value="formula">Fórmula</option>
                                            </select>

                                            {item.indicatorType === 'compound' && (
                                                <CompoundIdsInput
                                                    value={item.componentIds || []}
                                                    onChange={(ids) => handleInputChange(item.id, 'componentIds', ids)}
                                                />
                                            )}

                                            {item.indicatorType === 'formula' && (
                                                <input
                                                    type="text"
                                                    placeholder="bajas totales / altas"
                                                    value={item.formula || ''}
                                                    onChange={(e) => handleInputChange(item.id, 'formula', e.target.value)}
                                                    className="w-full bg-slate-950 border border-indigo-500/30 rounded px-2 py-1 text-[9px] text-indigo-200 placeholder:text-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.1)] focus:border-indigo-500 outline-none transition-all"
                                                />
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-2">
                                        <button
                                            aria-label={item.isActivityMode ? "Desactivar modo checklist" : "Activar modo checklist"}
                                            onClick={() => handleInputChange(item.id, 'isActivityMode', !item.isActivityMode)}
                                            className={`w-full py-2 rounded-md border text-[10px] font-black uppercase transition-all ${item.isActivityMode ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'}`}
                                        >
                                            {item.isActivityMode ? '✅ Activo' : 'Checklist'}
                                        </button>
                                    </td>
                                    <td className="p-2">
                                        <select
                                            aria-label="Inicio de semana"
                                            value={item.weekStart || 'Mon'}
                                            onChange={(e) => handleInputChange(item.id, 'weekStart', e.target.value)}
                                            disabled={item.frequency !== 'weekly'}
                                            className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white text-xs focus:ring-2 focus:ring-cyan-500 outline-none h-[42px] disabled:opacity-30"
                                        >
                                            <option value="Mon">Lun</option>
                                            <option value="Sun">Dom</option>
                                        </select>
                                    </td>
                                    <td className="p-2 text-center">
                                        <button onClick={() => handleDeleteItem(item.id)} className="text-red-500 hover:text-red-400 transition" title="Eliminar Indicador" aria-label="Eliminar indicador">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-between items-center mt-4">
                    <div className="flex gap-4 items-center">
                        <button onClick={handleAddItem} className="text-cyan-400 hover:text-cyan-300 text-sm font-semibold">+ Agregar otro indicador</button>
                        {defaultItems && (
                            <button
                                onClick={() => {
                                    if (window.confirm("¿Estás seguro? Esto reemplazará TODOS los indicadores del tablero actual (y de todos si sincronizas) con la estructura original de 14 indicadores. Se borrarán los datos de indicadores que no coincidan por nombre.")) {
                                        handleRestoreFactory();
                                    }
                                }}
                                className="text-yellow-600 hover:text-yellow-500 text-xs font-semibold underline decoration-dashed uppercase tracking-wider"
                                title="Restaurar a los 14 indicadores originales de IPS"
                            >
                                Restaurar Fábrica 2025
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-3 bg-slate-700/50 p-2 px-4 rounded-lg border border-slate-600">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={applyGlobally}
                                onChange={(e) => setApplyGlobally(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-500 text-cyan-500 focus:ring-cyan-500 bg-slate-800"
                            />
                            <span className="text-sm text-slate-200 font-medium group-hover:text-cyan-300 transition-colors">
                                Sincronizar cambios en todos los tableros
                            </span>
                        </label>
                    </div>
                </div>

                <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-slate-700">
                    <button onClick={onCancel} className="px-5 py-2 rounded-md bg-slate-600 hover:bg-slate-500 transition-colors text-sm font-semibold">Cancelar</button>
                    <button onClick={handleSave} className="px-5 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 transition-colors text-sm font-semibold text-white">Guardar Cambios</button>
                </div>
            </div>
        </div>
    );
};

/**
 * 🛡️ REGLA v6.1.8 - COMPONENTE DE INPUT DE IDs
 * Mantiene un estado de texto local para evitar que se borren las comas mientras el usuario escribe.
 */
const CompoundIdsInput = ({ value, onChange }: { value: (number | string)[], onChange: (ids: (number | string)[]) => void }) => {
    const [localValue, setLocalValue] = useState(() => value.join(', '));

    // Si el valor externo cambia (ej. cambio de dashboard), actualizamos el local
    React.useEffect(() => {
        setLocalValue(value.join(', '));
    }, [JSON.stringify(value)]);

    const handleBlur = () => {
        const ids = localValue.split(',')
            .map(v => parseInt(v.trim()))
            .filter(n => !isNaN(n));
        onChange(ids);
    };

    return (
        <input
            type="text"
            placeholder="IDs: 1, 2, 3"
            value={localValue}
            autoFocus
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
            className="w-full bg-slate-950 border border-amber-500/30 rounded px-2 py-1 text-[9px] text-amber-200 placeholder:text-amber-500/30 ring-1 ring-amber-500/20 focus:ring-amber-500/50 outline-none transition-all"
        />
    );
};