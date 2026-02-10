import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import type { DashboardItem } from "../types";
import { getYearWeekMapping, getWeekNumber } from "../utils/weeklyUtils";
import { ActivityManager } from "./ActivityManager";

interface DataEditorProps {
  item: DashboardItem;
  onSave: (data: Partial<DashboardItem>) => void;
  onCancel: () => void;
  canEdit: boolean;
  year?: number;
}

export const DataEditor: React.FC<DataEditorProps> = ({ item, onSave, onCancel, canEdit, year = 2025 }) => {
  const [monthlyGoals, setMonthlyGoals] = useState<(number | null)[]>(
    Array.isArray(item.monthlyGoals) ? [...item.monthlyGoals] : Array(12).fill(0)
  );
  const [monthlyProgress, setMonthlyProgress] = useState<(number | null)[]>(
    Array.isArray(item.monthlyProgress) ? [...item.monthlyProgress] : Array(12).fill(0)
  );
  const [weeklyGoals, setWeeklyGoals] = useState<(number | null)[]>(
    Array.isArray(item.weeklyGoals) ? [...item.weeklyGoals] : Array(53).fill(null)
  );
  const [weeklyProgress, setWeeklyProgress] = useState<(number | null)[]>(
    Array.isArray(item.weeklyProgress) ? [...item.weeklyProgress] : Array(53).fill(null)
  );
  const [monthlyNotes, setMonthlyNotes] = useState<string[]>(
    Array.isArray(item.monthlyNotes) ? [...item.monthlyNotes] : Array(12).fill("")
  );
  const [weeklyNotes, setWeeklyNotes] = useState<string[]>(
    Array.isArray(item.weeklyNotes) ? [...item.weeklyNotes] : Array(53).fill("")
  );

  const isWeekly = item.frequency === 'weekly';

  const months = useMemo(
    () => ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
    []
  );

  const weekRanges = useMemo(() => {
    if (!isWeekly) return [];
    const startDayNumeric = item.weekStart === 'Sun' ? 0 : 1;
    return getYearWeekMapping(year, startDayNumeric);
  }, [isWeekly, year, item.weekStart]);

  const setGoalAt = (idx: number, val: string) => {
    const n = Number(val);
    setMonthlyGoals((prev) => {
      const copy = [...prev];
      copy[idx] = isNaN(n) ? 0 : n;
      return copy;
    });
  };

  const setProgressAt = (idx: number, val: string) => {
    const n = Number(val);
    setMonthlyProgress((prev) => {
      const copy = [...prev];
      copy[idx] = isNaN(n) ? 0 : n;
      return copy;
    });
  };

  const setNoteAt = (idx: number, val: string) => {
    setMonthlyNotes((prev) => {
      const copy = [...prev];
      copy[idx] = val;
      return copy;
    });
  };

  const setWeeklyNoteAt = (idx: number, val: string) => {
    setWeeklyNotes((prev) => {
      const copy = [...prev];
      copy[idx] = val;
      return copy;
    });
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 🛡️ Simulación de espera para feedback visual y permitir que el estado se propague
      await new Promise(resolve => setTimeout(resolve, 500));
      onSave({
        monthlyGoals,
        monthlyProgress,
        weeklyGoals,
        weeklyProgress,
        monthlyNotes,
        weeklyNotes,
        activityConfig
      });
    } finally {
      setIsSaving(false);
    }
  };

  const setWeeklyVal = (field: 'goals' | 'progress', idx: number, val: string) => {
    const n = val === "" ? null : Number(val);
    const setter = field === 'goals' ? setWeeklyGoals : setWeeklyProgress;
    setter(prev => {
      const copy = [...prev];
      copy[idx] = n;
      return copy;
    });
  };

  const [isDictating, setIsDictating] = useState<number | string | null>(null);
  const recognitionRef = useRef<any>(null);

  const startDictation = (idx: number, isWeeklyVar: boolean = false) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("🎙️ Error: Tu navegador no es compatible con el dictado. Prueba con Google Chrome de escritorio.");
      return;
    }

    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      alert("🎙️ Seguridad: El dictado por voz requiere una conexión segura (HTTPS).");
      return;
    }

    // Detener sesión previa si existe
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { }
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = 'es-MX';
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsDictating(isWeeklyVar ? `w-${idx}` : idx);
        console.log("🎙️ Micrófono activado...");
      };

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        if (isWeeklyVar) {
          setWeeklyNotes(prev => {
            const copy = [...prev];
            copy[idx] = (copy[idx] || "") + (copy[idx] ? " " : "") + text;
            return copy;
          });
        } else {
          setMonthlyNotes(prev => {
            const copy = [...prev];
            copy[idx] = (copy[idx] || "") + (copy[idx] ? " " : "") + text;
            return copy;
          });
        }
      };

      recognition.onerror = (event: any) => {
        console.error("🎙️ Error de dictado:", event.error);
        setIsDictating(null);
        if (event.error === 'not-allowed') {
          alert("⚠️ Micrófono bloqueado: Haz clic en el candado junto a la URL y permite el acceso al micrófono.");
        } else if (event.error === 'no-speech') {
          alert("⚠️ No se detectó voz. Por favor intenta hablar más claro o revisa tu conexión de audio.");
        } else {
          alert(`⚠️ Error de reconocimiento: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsDictating(null);
        recognitionRef.current = null;
      };

      recognition.start();
    } catch (err) {
      console.error("Critical Dictation Error:", err);
      setIsDictating(null);
    }
  };

  // 🚀 LOGICA DE ACTIVIDADES (v3.5.0)
  const [activityConfig, setActivityConfig] = useState<DashboardItem['activityConfig']>(
    item.activityConfig || {}
  );
  const [activeActivityPeriod, setActiveActivityPeriod] = useState<number | null>(null);

  const calculateFromActivities = useCallback((periodIdx: number) => {
    const activities = activityConfig[periodIdx] || [];
    const totalGoal = activities.reduce((sum, a) => sum + (Number(a.targetCount) || 0), 0);
    const totalReal = activities.reduce((sum, a) => sum + (Number(a.completedCount) || 0), 0);

    if (isWeekly) {
      setWeeklyGoals(prev => { const c = [...prev]; c[periodIdx] = totalGoal; return c; });
      setWeeklyProgress(prev => { const c = [...prev]; c[periodIdx] = totalReal; return c; });
    } else {
      setMonthlyGoals(prev => { const c = [...prev]; c[periodIdx] = totalGoal; return c; });
      setMonthlyProgress(prev => { const c = [...prev]; c[periodIdx] = totalReal; return c; });
    }
  }, [activityConfig, isWeekly]);

  // handleUpdateActivity was unused

  useEffect(() => {
    if (activeActivityPeriod !== null) {
      calculateFromActivities(activeActivityPeriod);
    }
  }, [activityConfig, activeActivityPeriod, calculateFromActivities]);

  // handleCopyActivitiesToNext was unused

  const currentPeriod = useMemo(() => {
    const today = new Date();
    const tYear = today.getFullYear();
    const tMonth = today.getMonth();
    const startDayNumeric = item.weekStart === 'Sun' ? 0 : 1;
    const tWeek = getWeekNumber(today, startDayNumeric) - 1; // 0-indexed idx

    return {
      isCurrentYear: year === tYear,
      monthIdx: tMonth,
      weekIdx: tWeek
    };
  }, [year, item.weekStart]);

  return (
    <div className="bg-slate-900/40 border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-white font-extrabold flex items-center gap-2">
          <span>Capturar Datos y Notas</span>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded border border-white/5">
            Año {year}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 font-bold"
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!canEdit || isSaving}
            className="px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 font-extrabold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {isSaving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>

      {!isWeekly ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {months.map((m, idx) => {
            const isToday = currentPeriod.isCurrentYear && currentPeriod.monthIdx === idx;
            const activityCount = activityConfig[idx]?.length || 0;

            return (
              <div
                key={m}
                className={`glass-card rounded-2xl p-4 border relative overflow-hidden group/m transition-all duration-500 flex flex-col ${isToday
                  ? "border-cyan-500/50 bg-cyan-500/5 shadow-[0_0_20px_rgba(34,211,238,0.1)] ring-1 ring-cyan-500/20"
                  : "border-white/5 bg-slate-900/40"
                  }`}
              >
                {isToday && (
                  <div className="absolute top-0 right-0 bg-cyan-500 text-[8px] font-black text-slate-950 px-2 py-0.5 rounded-bl-lg uppercase tracking-tighter animate-pulse z-10">
                    Mes Actual
                  </div>
                )}
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-sm font-black uppercase tracking-widest ${isToday ? 'text-cyan-400' : 'text-white'}`}>{m}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${isToday ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-slate-700 group-hover/m:bg-cyan-500'} transition-colors`} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[8px] font-black text-cyan-500/70 uppercase tracking-widest">Meta</label>
                    <input
                      type="number"
                      value={monthlyGoals[idx] ?? 0}
                      onChange={(e) => setGoalAt(idx, e.target.value)}
                      className={`w-full bg-slate-950/50 border border-white/5 rounded-xl p-2 text-white text-xs font-black focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all tabular-nums ${isToday && 'ring-1 ring-cyan-500/20'}`}
                      disabled={!canEdit || item.isActivityMode}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[8px] font-black text-emerald-500/70 uppercase tracking-widest">Real</label>
                    <input
                      type="number"
                      value={monthlyProgress[idx] ?? 0}
                      onChange={(e) => setProgressAt(idx, e.target.value)}
                      className={`w-full bg-slate-950/50 border border-white/5 rounded-xl p-2 text-white text-xs font-black focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all tabular-nums ${isToday && 'ring-1 ring-emerald-500/20'}`}
                      disabled={!canEdit || item.isActivityMode}
                    />
                  </div>
                </div>

                {item.isActivityMode && (
                  <button
                    onClick={() => setActiveActivityPeriod(idx)}
                    className={`mt-4 w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${activityCount > 0 ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-400 hover:bg-indigo-600/40' : 'bg-slate-800 border-white/10 text-slate-500 hover:text-white'}`}
                  >
                    📝 {activityCount > 0 ? `Detalle (${activityCount} metas)` : 'Configurar Actividades'}
                  </button>
                )}

                <div className="mt-4 pt-4 border-t border-white/5 flex-grow">
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest">Análisis / Incidencia</label>
                    {/* 🎙️ Dictado oculto (v5.3.4) */}
                  </div>
                  <textarea
                    value={monthlyNotes[idx] ?? ""}
                    onChange={(e) => setNoteAt(idx, e.target.value)}
                    className="w-full bg-slate-950/30 border border-white/5 rounded-xl p-2.5 text-slate-400 text-[10px] min-h-[50px] focus:ring-1 focus:ring-slate-500 outline-none transition-all resize-none italic"
                    placeholder={isDictating === idx ? "Escuchando..." : "Detalle de variación..."}
                    disabled={!canEdit}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: weekRanges.length || 53 }).map((_, i) => {
            const range = weekRanges[i];
            const dateLabel = range ?
              `${range.startDate.toLocaleDateString('es', { day: '2-digit', month: 'short' })} - ${range.endDate.toLocaleDateString('es', { day: '2-digit', month: 'short' })}` :
              "";

            const isToday = currentPeriod.isCurrentYear && currentPeriod.weekIdx === i;
            const activityCount = activityConfig[i]?.length || 0;

            return (
              <div
                key={i}
                className={`glass-card rounded-xl p-3 border relative overflow-hidden group/w transition-all duration-500 flex flex-col ${isToday
                  ? "border-indigo-500/50 bg-indigo-500/5 shadow-[0_0_20px_rgba(99,102,241,0.1)] ring-1 ring-indigo-500/20"
                  : "border-white/5 bg-slate-900/40"
                  }`}
              >
                {isToday && (
                  <div className="absolute top-0 right-0 bg-indigo-500 text-[7px] font-black text-white px-2 py-0.5 rounded-bl-lg uppercase tracking-tighter animate-pulse z-10">
                    Semana Actual
                  </div>
                )}
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[8px] font-black uppercase tracking-widest ${isToday ? 'text-indigo-400' : 'text-slate-500'}`}>SEM {i + 1}</span>
                  <span className={`text-[7px] font-bold tabular-nums uppercase ${isToday ? 'text-indigo-300/80' : 'text-cyan-500/60'}`}>{dateLabel}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="space-y-1">
                    <label className="block text-[7px] font-black text-cyan-500/40 uppercase">Meta</label>
                    <input
                      type="number"
                      placeholder="M"
                      value={weeklyGoals[i] ?? ""}
                      onChange={(e) => setWeeklyVal('goals', i, e.target.value)}
                      className={`w-full bg-slate-950/50 border border-white/5 rounded-lg p-1.5 text-white text-[10px] font-black text-center focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all tabular-nums ${isToday && 'ring-1 ring-indigo-500/20'}`}
                      disabled={!canEdit || item.isActivityMode}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[7px] font-black text-emerald-500/40 uppercase">Real</label>
                    <input
                      type="number"
                      placeholder="R"
                      value={weeklyProgress[i] ?? ""}
                      onChange={(e) => setWeeklyVal('progress', i, e.target.value)}
                      className={`w-full bg-slate-950/50 border border-white/5 rounded-lg p-1.5 text-white text-[10px] font-black text-center focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all tabular-nums ${isToday && 'ring-1 ring-emerald-500/20'}`}
                      disabled={!canEdit || item.isActivityMode}
                    />
                  </div>
                </div>

                {item.isActivityMode && (
                  <button
                    onClick={() => setActiveActivityPeriod(i)}
                    className={`mb-3 w-full py-1.5 rounded-lg text-[7px] font-black uppercase tracking-widest border transition-all ${activityCount > 0 ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-400 hover:bg-indigo-600' : 'bg-slate-800 border-white/10 text-slate-500 hover:text-white'}`}
                  >
                    📝 {activityCount > 0 ? `Detalle (${activityCount})` : 'Configurar'}
                  </button>
                )}

                <div className="mt-auto pt-2 border-t border-white/5">
                  <textarea
                    value={weeklyNotes[i] ?? ""}
                    onChange={(e) => setWeeklyNoteAt(i, e.target.value)}
                    className="w-full bg-slate-950/30 border border-white/5 rounded-lg p-1.5 text-slate-400 text-[10px] min-h-[40px] focus:ring-1 focus:ring-slate-500 outline-none transition-all resize-none italic"
                    placeholder="Análisis semanal..."
                    disabled={!canEdit}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Activity Modal Rendering */}
      {activeActivityPeriod !== null && (
        <ActivityManager
          periodLabel={!isWeekly ? months[activeActivityPeriod] : `Semana ${activeActivityPeriod + 1}`}
          initialActivities={activityConfig[activeActivityPeriod] || []}
          canEdit={canEdit}
          onClose={() => setActiveActivityPeriod(null)}
          onSave={(updatedList) => {
            setActivityConfig(prev => ({ ...prev, [activeActivityPeriod]: updatedList }));
            // El useEffect se encargará de recalcular meta/real
          }}
          onCopyToAll={canEdit ? () => {
            const source = activityConfig[activeActivityPeriod] || [];
            if (source.length === 0) return;
            if (!confirm(`¿Copiar la lista de ${source.length} metas a TODO EL AÑO?\n\nNota: Solo se copiará la estructura, los avances de cada mes se mantendrán en cero.`)) return;

            const newConfig: any = { ...activityConfig };
            const limit = isWeekly ? 53 : 12;
            for (let i = 0; i < limit; i++) {
              newConfig[i] = source.map(a => ({ ...a, completedCount: 0 }));
            }
            setActivityConfig(newConfig);
            alert("Estructura copiada exitosamente a todos los periodos.");
          } : undefined}
        />
      )}

      {!canEdit && (
        <div className="mt-3 text-yellow-200 bg-yellow-900/30 border border-yellow-700/40 rounded-lg p-3">
          No tienes permisos para editar.
        </div>
      )}
    </div>
  );
};
