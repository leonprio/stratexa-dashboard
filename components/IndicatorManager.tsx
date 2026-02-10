import React, { useState } from 'react';
import { DashboardItem } from '../types';

type EditableIndicator = Omit<DashboardItem, 'id'> & { id: number | string };

interface IndicatorManagerProps {
    key?: React.Key;
    initialItems: DashboardItem[];
    onSaveChanges: (items: DashboardItem[], applyGlobally: boolean) => void;
    onCancel: () => void;
    dashboards: { id: number | string; title: string }[];
    activeDashboardId: number | string;
    onDashboardSelect: (id: number | string) => void;
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
};

export const IndicatorManager = ({ initialItems, onSaveChanges, onCancel, dashboards, activeDashboardId, onDashboardSelect, defaultItems }: IndicatorManagerProps) => {
    const [items, setItems] = useState<EditableIndicator[]>(() => {
        return [...initialItems].sort((a, b) => (Number(a.id) || 999) - (Number(b.id) || 999));
    });
    const [applyGlobally, setApplyGlobally] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    const handleRestoreFactory = () => {
        if (!defaultItems) return;
        setItems(JSON.parse(JSON.stringify(defaultItems))); // Deep copy to detach references
    };

    const handleInputChange = (id: number | string, field: keyof EditableIndicator, value: string | number | boolean) => {
        setItems(currentItems =>
            currentItems.map(item => (item.id === id ? { ...item, [field]: value } : item))
        );
    };

    const handleAddItem = () => {
        const newItem: EditableIndicator = {
            id: `new-${Date.now()}`,
            ...NEW_INDICATOR_TEMPLATE,
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

        setItems(newItems);
        setDraggedIndex(null);
    };

    const handleSave = () => {
        const validItems = items.filter(item => item.indicator.trim() !== '');

        // 🛡️ IDENTIDAD SECUENCIAL (v3.8.5)
        // Mantenemos la estructura de 1, 2, 3... que solicitó el usuario para facilitar Excel,
        // pero aseguramos que el orden se preserve fielmente.
        const finalData = validItems.map((item, index) => {
            const { id: _, ...rest } = item;
            return {
                ...rest,
                id: index + 1
            } as DashboardItem;
        });

        onSaveChanges(finalData, applyGlobally);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={onCancel}>
            <div className="bg-slate-800 rounded-xl shadow-2xl ring-1 ring-white/10 w-full max-w-6xl p-6 flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-xl font-bold text-slate-100">Gestionar Indicadores</h3>
                        <p className="text-sm text-slate-400">Añade, elimina o edita las propiedades de tus KPIs.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">Tablero:</span>
                        <select
                            value={activeDashboardId}
                            onChange={(e) => onDashboardSelect(Number(e.target.value))}
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
                                <th className="p-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-[60px]">ID</th>
                                <th className="p-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-2/5">Nombre del Indicador</th>
                                <th className="p-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-1/5">Unidad</th>
                                <th className="p-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-1/5">Tipo de Meta</th>
                                <th className="p-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-1/5">Cálculo</th>
                                <th className="p-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-[120px]">Frecuencia</th>
                                <th className="p-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-[100px]">Modo</th>
                                <th className="p-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-[80px]">Inicio</th>
                                <th className="p-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-[60px]"></th>
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
                                    <td className="p-2 font-mono text-xs text-slate-500 cursor-move" title="Arrastra para reordenar">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg opacity-50">☰</span>
                                            {typeof item.id === 'number' ? item.id : '*'}
                                        </div>
                                    </td>
                                    <td className="p-2">
                                        <input type="text" value={item.indicator} onChange={(e) => handleInputChange(item.id, 'indicator', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none" />
                                    </td>
                                    <td className="p-2">
                                        <input type="text" value={item.unit} onChange={(e) => handleInputChange(item.id, 'unit', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none" />
                                    </td>
                                    <td className="p-2">
                                        <select value={item.goalType} onChange={(e) => handleInputChange(item.id, 'goalType', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none h-[42px]">
                                            <option value="maximize">Maximizar</option>
                                            <option value="minimize">Minimizar</option>
                                        </select>
                                    </td>
                                    <td className="p-2">
                                        <select value={item.type} onChange={(e) => handleInputChange(item.id, 'type', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none h-[42px]">
                                            <option value="accumulative">Sumar</option>
                                            <option value="average">Promediar</option>
                                        </select>
                                    </td>
                                    <td className="p-2">
                                        <select value={item.frequency || 'monthly'} onChange={(e) => handleInputChange(item.id, 'frequency', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-cyan-400 font-bold text-sm focus:ring-2 focus:ring-cyan-500 outline-none h-[42px]">
                                            <option value="monthly">Mensual</option>
                                            <option value="weekly">Semanal</option>
                                        </select>
                                    </td>
                                    <td className="p-2">
                                        <button
                                            onClick={() => handleInputChange(item.id, 'isActivityMode', !item.isActivityMode)}
                                            className={`w-full py-2 rounded-md border text-[10px] font-black uppercase transition-all ${item.isActivityMode ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'}`}
                                        >
                                            {item.isActivityMode ? '✅ Activo' : 'Checklist'}
                                        </button>
                                    </td>
                                    <td className="p-2">
                                        <select
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
                                        <button onClick={() => handleDeleteItem(item.id)} className="text-red-500 hover:text-red-400 transition" title="Eliminar Indicador">
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