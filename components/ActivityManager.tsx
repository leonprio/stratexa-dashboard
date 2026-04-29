import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Plus, Trash2, Edit2, CheckCircle2, AlertCircle, Save, ArrowLeft, ArrowRight } from 'lucide-react';
import { calculateMonthlyCompliancePercentage } from '../utils/compliance';

/**
 * Representa un elemento individual dentro de la lista de gestión detallada.
 * Puede usarse para tareas, personas, prospectos o entregables.
 */
export interface Activity {
  id: string;
  label: string;
  targetCount: number;
  completedCount: number;
}

/**
 * Propiedades del componente ActivityManager (Gestor de Elementos).
 */
export interface ActivityManagerProps {
  /** Lista inicial de actividades a gestionar */
  initialActivities: Activity[];
  /** Callback ejecutado al confirmar los cambios locales */
  onSave: (activities: Activity[]) => void;
  /** Callback ejecutado al cerrar el modal (botón X) */
  onClose: () => void;
  /** Título principal del modal (generalmente el nombre del indicador) */
  title: string;
  /** Subtítulo descriptivo u organizacional */
  subtitle?: string;
  /** Determina si el usuario tiene permisos de edición. Si es false, se muestra solo lectura */
  canEdit?: boolean;
  /** Función opcional para clonar la configuración actual a todos los periodos del año */
  onCopyToAll?: (sourceActivities: Activity[]) => void;
  /** Define la naturaleza de la meta: 'maximize' (más es mejor) o 'minimize' (menos es mejor) */
  goalType?: 'maximize' | 'minimize';
}

/**
 * Componente ActivityManager (MODO NUCLEAR v9.1.0-PRO-FINAL-SHIELDED)
 * 
 * Gestiona de forma granular elementos (actividades, prospectos, tareas) dentro de un indicador.
 * Implementa visualización de cumplimiento en tiempo real y persistencia atómica.
 * 
 * @param {ActivityManagerProps} props - Propiedades de configuración y callbacks.
 * @returns {JSX.Element} Modal de gestión de actividades.
 */
const ActivityManager = React.memo((props: ActivityManagerProps) => {
  const { 
    initialActivities, 
    onSave, 
    onClose,
    title,
    subtitle,
    canEdit = true,
    onCopyToAll,
    goalType = 'maximize'
  } = props;
  // 🛡️ ESTADO AISLADO v9.1.0-PRO-FINAL-SHIELDED - INMUNE A PROP-DRILLING
  const [activities, setActivities] = useState<Activity[]>(() => {
    // Clonación profunda inicial para romper referencia con el padre
    return JSON.parse(JSON.stringify(initialActivities || []));
  });
  
  const [newActivityName, setNewActivityName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // LOG DE AUDITORÍA v8.6.0
  useEffect(() => {
    console.log("🛡️ [v9.1.0-PRO-FINAL-SHIELDED] Modal Actividades Abierto. Items:", activities.length);
  }, []);

  const handleAddActivity = () => {
    const val = newActivityName.trim();
    if (!val) return;

    const newAct: Activity = {
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      label: val,
      targetCount: 1,
      completedCount: 0
    };

    setActivities(prev => [...prev, newAct]);
    setNewActivityName("");
    console.log("🛡️ [v9.1.0-PRO-FINAL-SHIELDED] Actividad añadida:", val);
  };

  const handleDelete = (id: string) => {
    setActivities(prev => prev.filter(a => a.id !== id));
    console.log("🛡️ [v9.1.0-PRO-FINAL-SHIELDED] Actividad eliminada:", id);
  };

  const handleUpdate = (id: string, updates: Partial<Activity>) => {
    setActivities(prev => prev.map(a => 
      a.id === id ? { ...a, ...updates } : a
    ));
  };

  const filtered = useMemo(() => {
    return activities.filter(a => 
      a.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [activities, searchTerm]);

  const stats = useMemo(() => {
    const total = activities.reduce((sum, a) => sum + a.targetCount, 0);
    const done = activities.reduce((sum, a) => sum + a.completedCount, 0);
    
    let globalProgress = 0;
    if (total === 0 && done === 0) {
      globalProgress = 0;
    } else if (total === 0) {
      globalProgress = goalType === 'minimize' ? (done === 0 ? 100 : 0) : (done > 0 ? 100 : 0);
    } else if (done === 0) {
      globalProgress = goalType === 'minimize' ? 100 : 0;
    } else {
      globalProgress = goalType === 'minimize' 
        ? (total / done) * 100 
        : (done / total) * 100;
    }

    return { total, done, count: activities.length, pct: globalProgress };
  }, [activities, goalType]);

  const content = (
    <div className="fixed inset-0 z-[50] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
      <div className="bg-[#0f172a] border border-slate-800 w-full max-w-4xl max-h-[90vh] rounded-[24px] flex flex-col overflow-hidden relative">
        
        {/* HEADER */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-slate-950">
          <div className="flex flex-col min-w-0">
            <h2 className="text-xl sm:text-2xl font-black text-white leading-tight mb-1 flex items-center flex-wrap gap-2">
              <span className="truncate">{title}</span>
              <span className={`text-[9px] px-2 py-0.5 rounded-full border ${goalType === 'minimize' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'} font-bold uppercase tracking-widest shrink-0`}>
                OBJETIVO: {goalType === 'minimize' ? 'Minimizar' : 'Maximizar'}
              </span>
            </h2>
            <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-500 shrink-0" />
              <span className="truncate">{subtitle || "GESTOR DE ELEMENTOS DETALLADO v9.1.0-PRO-FINAL-SHIELDED"}</span>
            </p>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-3 sm:gap-4 bg-slate-900/60 p-2 sm:p-3 rounded-2xl border border-white/5">
              <div className="text-right">
                <p className="text-[8px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-widest">IMPACTO TOTAL</p>
                <p className="text-lg sm:text-xl font-black text-white leading-none mt-1">{stats.total.toLocaleString()} / {stats.done.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-slate-800 flex items-center justify-center relative overflow-hidden ring-1 ring-white/10">
                <div 
                  className={`absolute bottom-0 left-0 w-full transition-all duration-1000 ${stats.pct >= 100 ? 'bg-emerald-500' : stats.pct >= 80 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                  style={{ height: `${Math.min(100, stats.pct)}%` }}
                />
                <span className="relative z-10 font-black text-[10px] sm:text-xs text-white drop-shadow-none">
                  {Math.round(stats.pct)}%
                </span>
              </div>
            </div>
            
            <button 
              onClick={onClose}
              className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-xl transition-all border border-rose-500/20 active:scale-90"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTROLES */}
        <div className="p-6 bg-slate-900/30 grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-800">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
            <input 
              type="text"
              placeholder="BUSCAR ELEMENTO..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white focus:border-indigo-500 outline-none transition-all font-medium"
            />
          </div>

          <div className="flex gap-2">
            <input 
              type="text"
              placeholder="NOMBRE (EJ: GENERAL, SERVICIOS...)"
              value={newActivityName}
              onChange={e => setNewActivityName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddActivity()}
              disabled={!canEdit}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-white focus:border-indigo-500 outline-none transition-all font-medium disabled:opacity-50"
            />
            <button 
              onClick={handleAddActivity}
              disabled={!canEdit}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 rounded-2xl font-black transition-all flex items-center gap-2 active:scale-95 disabled:grayscale disabled:pointer-events-none"
            >
              <Plus className="w-5 h-5" />
              AÑADIR ELEMENTO
            </button>
          </div>
        </div>

        {/* LISTADO */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar bg-slate-950/20">
          {filtered.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-3xl">
              <AlertCircle className="w-10 h-10 mb-2 opacity-20" />
              <p className="font-bold uppercase tracking-widest text-sm">No hay elementos registrados</p>
            </div>
          ) : (
            filtered.map(a => (
              <div key={a.id} className="group bg-slate-900/40 border border-slate-800/50 hover:border-indigo-500/50 rounded-2xl p-4 transition-all flex items-center justify-between gap-4">
                <div className="flex-1 flex flex-col gap-1">
                   {editingId === a.id ? (
                     <input 
                       autoFocus
                       className="bg-slate-950 border border-indigo-500 rounded px-2 py-1 text-white outline-none"
                       value={a.label}
                       onChange={e => handleUpdate(a.id, { label: e.target.value })}
                       onBlur={() => setEditingId(null)}
                       onKeyDown={e => e.key === 'Enter' && setEditingId(null)}
                     />
                   ) : (
                     <span className={`text-sm font-bold tracking-tight transition-all ${a.completedCount >= a.targetCount ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                       {a.label}
                     </span>
                   )}
                   <div className="flex items-center gap-2">
                     <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                       <div 
                         className={`h-full transition-all duration-500 ${a.completedCount >= a.targetCount ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                         style={{ width: `${Math.min(100, calculateMonthlyCompliancePercentage(a.completedCount, a.targetCount, goalType === 'minimize'))}%` }}
                       />
                     </div>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                        {a.targetCount.toLocaleString()} VS {a.completedCount.toLocaleString()} ({Math.round(
                          calculateMonthlyCompliancePercentage(a.completedCount, a.targetCount, goalType === 'minimize')
                        )}% avance)
                      </span>
                   </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {/* CONTROL META (Izquierda por consistencia) */}
                    <div className="flex flex-col items-center">
                      <span className="text-[8px] font-black text-slate-600 uppercase mb-1">META</span>
                      <div className="flex items-center gap-1 bg-slate-900/20 p-1 rounded-xl border border-slate-800/40">
                        <button 
                          onClick={() => handleUpdate(a.id, { targetCount: Math.max(0, a.targetCount - 1) })}
                          disabled={!canEdit}
                          className="w-8 h-8 flex items-center justify-center hover:bg-slate-800 rounded-lg text-slate-500 transition-colors disabled:opacity-30"
                        >-</button>
                         <input 
                           type="text" 
                           value={(a.targetCount || 0).toLocaleString()}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              handleUpdate(a.id, { targetCount: Number(val) || 0 });
                            }}
                           className="w-16 bg-transparent text-center font-bold text-indigo-400 text-sm outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                         />
                        <button 
                          onClick={() => handleUpdate(a.id, { targetCount: a.targetCount + 1 })}
                          disabled={!canEdit}
                          className="w-8 h-8 flex items-center justify-center hover:bg-slate-800 rounded-lg text-slate-500 transition-colors disabled:opacity-30"
                        >+</button>
                      </div>
                    </div>

                    <span className="text-slate-700 font-bold mt-4">/</span>

                    {/* CONTROL REALIZADO (Derecha) */}
                    <div className="flex flex-col items-center">
                      <span className="text-[8px] font-black text-slate-600 uppercase mb-1">REALIZADO</span>
                      <div className="flex items-center gap-1 bg-slate-950/50 p-1 rounded-xl border border-slate-800">
                        <button 
                          onClick={() => handleUpdate(a.id, { completedCount: Math.max(0, a.completedCount - 1) })}
                          disabled={!canEdit}
                          className="w-8 h-8 flex items-center justify-center hover:bg-slate-800 rounded-lg text-slate-500 transition-colors disabled:opacity-30"
                        >-</button>
                         <input 
                           type="text" 
                           value={(a.completedCount || 0).toLocaleString()}
                           onChange={(e) => {
                             const val = e.target.value.replace(/[^0-9]/g, '');
                             handleUpdate(a.id, { completedCount: Number(val) || 0 });
                           }}
                           className="w-16 bg-transparent text-center font-black text-white text-sm outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                         />
                        <button 
                          onClick={() => handleUpdate(a.id, { completedCount: a.completedCount + 1 })}
                          disabled={!canEdit}
                          className="w-8 h-8 flex items-center justify-center hover:bg-slate-800 rounded-lg text-slate-500 transition-colors disabled:opacity-30"
                        >+</button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 ml-4">
                    <button 
                      onClick={() => setEditingId(a.id === editingId ? null : a.id)}
                      className="p-2 text-slate-500 hover:text-indigo-400 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(a.id)}
                      className="p-2 text-slate-500 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* FOOTER */}
        <div className="p-6 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white font-bold uppercase tracking-widest text-xs transition-colors"
          >
            DESCARTAR CAMBIOS
          </button>
          
          <div className="flex gap-3">
             {onCopyToAll && (
               <button 
                  onClick={() => onCopyToAll(activities)}
                  disabled={!canEdit || activities.length === 0}
                  className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 px-6 py-3 rounded-2xl font-black transition-all flex items-center gap-3 text-xs active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                  title="Copia esta lista de elementos a todos los meses/semanas del año"
               >
                  COPIAR A TODO EL AÑO
               </button>
             )}
             <button 
                onClick={() => onSave(activities)}
                disabled={!canEdit}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-2xl font-black transition-all flex items-center gap-3 active:scale-95 disabled:grayscale disabled:pointer-events-none"
             >
                <CheckCircle2 className="w-5 h-5" />
                {canEdit ? 'CONFIRMAR LISTA' : 'VISTA DE LECTURA'}
             </button>
          </div>
        </div>

        {/* VERSIONING */}
        <div className="text-center pb-2 bg-slate-900 border-t border-slate-800/10">
            <span className="text-[8px] font-mono text-slate-600 uppercase tracking-widest opacity-30">
               ENGINE: PLATINUM-ROBUST | v9.1.0-PRO-FINAL-SHIELDED | ISOLATED-UX
            </span>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
});

ActivityManager.displayName = 'ActivityManager';

export { ActivityManager };
export default ActivityManager;
