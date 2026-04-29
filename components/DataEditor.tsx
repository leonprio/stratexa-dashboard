import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import type { DashboardItem } from "../types";
import { getYearWeekMapping, getWeekNumber } from "../utils/weeklyUtils";
import { ActivityManager } from "./ActivityManager";
import { formatNumberWithCommas, parseFormattedNumber } from "../utils/formatters";

interface DataEditorProps {
  item: DashboardItem;
  onSave: (data: Partial<DashboardItem>, autoSave?: boolean) => void;
  onCancel: () => void;
  canEdit: boolean;
  year?: number;
}

/**
 * Componente DataEditor
 * 
 * Permite la edición detallada de un indicador (DashboardItem), incluyendo metas,
 * progresos y notas tanto en frecuencia mensual como semanal.
 * Soporta el "Modo Actividades" para el desglose de metas complejas.
 * 
 * @param {DataEditorProps} props - Propiedades del componente.
 * @returns {JSX.Element} El editor de datos renderizado.
 */
export const DataEditor: React.FC<DataEditorProps> = React.memo(({ item, onSave, onCancel, canEdit, year = 2025 }) => {
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
  const [focusedInputId, setFocusedInputId] = useState<string | null>(null);

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
    const n = parseFormattedNumber(val) ?? 0;
    setMonthlyGoals((prev) => {
      const copy = [...prev];
      copy[idx] = n;
      return copy;
    });
  };

  const setProgressAt = (idx: number, val: string) => {
    const n = parseFormattedNumber(val) ?? 0;
    setMonthlyProgress((prev) => {
      const copy = [...prev];
      copy[idx] = n;
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
        activityConfig,
        isActivityMode
      });
    } finally {
      setIsSaving(false);
    }
  };

  const setWeeklyVal = (field: 'goals' | 'progress', idx: number, val: string) => {
    const n = parseFormattedNumber(val);
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
  const [isActivityMode, setIsActivityMode] = useState<boolean>(item.isActivityMode || false);
  const [activeActivityPeriod, setActiveActivityPeriod] = useState<number | null>(null);

  const calculateFromActivities = useCallback((periodIdx: number, newActivities?: any[]) => {
    const raw = newActivities || activityConfig[periodIdx];
    const activities = Array.isArray(raw) ? raw : (raw ? Object.values(raw) : []);
    const totalGoal = activities.reduce((sum: number, a: any) => sum + (Number(a.targetCount) || 0), 0) as number;
    const totalReal = activities.reduce((sum: number, a: any) => sum + (Number(a.completedCount) || 0), 0) as number;

    if (isWeekly) {
      setWeeklyGoals(prev => { const c = [...prev]; c[periodIdx] = totalGoal; return c; });
      setWeeklyProgress(prev => { const c = [...prev]; c[periodIdx] = totalReal; return c; });
    } else {
      setMonthlyGoals(prev => { const c = [...prev]; c[periodIdx] = totalGoal; return c; });
      setMonthlyProgress(prev => { const c = [...prev]; c[periodIdx] = totalReal; return c; });
    }
  }, [activityConfig, isWeekly]);

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

    // 🚀 AUTO-SCROLL v8.7.2: Navegar automáticamente al periodo actual
    useEffect(() => {
    const targetId = isWeekly ? `week-card-${currentPeriod.weekIdx}` : `month-card-${currentPeriod.monthIdx}`;
    const timer = setTimeout(() => {
      const el = document.getElementById(targetId);
      if (el) {
        console.log(`🎯 [SCROLL] Navegando a ${targetId}`);
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        console.warn(`⚠️ [SCROLL] No se encontró el elemento ${targetId}`);
      }
    }, 600); // Delay robusto
    return () => clearTimeout(timer);
  }, [currentPeriod.isCurrentYear, currentPeriod.weekIdx, currentPeriod.monthIdx, isWeekly]);

  return (
    <div className="bg-slate-900/40 border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-white font-extrabold flex items-center gap-2">
          <span>Capturar Datos y Notas</span>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded border border-white/5">
            Año {year}
          </span>
          <button 
            onClick={() => {
              const newVal = !isActivityMode;
              setIsActivityMode(newVal);
              // 🛡️ nuclear save: incluir config actual para que App.tsx no la borre
              onSave({ 
                isActivityMode: newVal,
                activityConfig: activityConfig
              }, true);
            }}
            className={`ml-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${isActivityMode ? 'bg-cyan-500 text-slate-950 ring-4 ring-cyan-500/20 shadow-lg shadow-cyan-500/40' : 'bg-slate-800 text-slate-400 border border-white/5 hover:bg-slate-700 hover:text-white'}`}
          >
            MODO: {isActivityMode ? 'ACTIVIDADES' : 'MANUAL'}
          </button>
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
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 uppercase tracking-widest text-[11px] transition-all hover:scale-105 active:scale-95"
            aria-label="Confirmar y subir datos permanentemente"
          >
            {isSaving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />}
            <span aria-hidden="true">💾</span>
            {isSaving ? "GUARDANDO..." : "GUARDAR CAMBIOS"}
          </button>
        </div>
      </div>

      {!isWeekly ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {months.map((m, idx) => {
            const isToday = currentPeriod.isCurrentYear && currentPeriod.monthIdx === idx;
            const rawActs = activityConfig[idx];
            const activityCount = rawActs ? (Array.isArray(rawActs) ? rawActs.length : Object.values(rawActs).length) : 0;

            return (
              <div
                key={m}
                id={`month-card-${idx}`}
                className={`relative group/m p-5 rounded-2xl border transition-all duration-500 ${
                  isToday 
                  ? "border-cyan-500/50 bg-cyan-500/5 ring-1 ring-cyan-500/20"
                  : "border-white/5 bg-slate-900/40"
                  }`}
              >
                {isToday && (
                  <div className="absolute top-0 right-0 bg-cyan-500 text-[8px] font-black text-slate-950 px-2 py-0.5 rounded-bl-lg uppercase tracking-tighter animate-pulse z-10">
                    Mes Actual
                  </div>
                )}
                <div className="flex justify-between items-center mb-4">
                  <h3 className={`text-lg font-black uppercase tracking-tighter ${isToday ? 'text-white' : 'text-slate-400'}`}>
                    {m}
                  </h3>
                  <div className="w-8 h-8 rounded-lg bg-slate-950/50 flex items-center justify-center border border-white/5">
                    <span className="text-[10px] font-bold text-slate-500">{(idx + 1).toString().padStart(2, '0')}</span>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-cyan-500/60 uppercase tracking-widest ml-1">Meta Mensual</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={focusedInputId === `m-goal-${idx}` ? (monthlyGoals[idx] ?? '').toString() : formatNumberWithCommas(monthlyGoals[idx])}
                      onFocus={() => setFocusedInputId(`m-goal-${idx}`)}
                      onBlur={() => setFocusedInputId(null)}
                      onChange={(e) => setGoalAt(idx, e.target.value)}
                      className="w-full bg-slate-950/50 border border-white/5 rounded-xl p-2.5 text-white text-sm font-black focus:ring-1 focus:ring-cyan-500 transition-all text-center placeholder:text-slate-800 tabular-nums"
                      disabled={!canEdit || isActivityMode}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-emerald-500/60 uppercase tracking-widest ml-1">Avance Real</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={focusedInputId === `m-actual-${idx}` ? (monthlyProgress[idx] ?? '').toString() : formatNumberWithCommas(monthlyProgress[idx])}
                      onFocus={() => setFocusedInputId(`m-actual-${idx}`)}
                      onBlur={() => setFocusedInputId(null)}
                      onChange={(e) => setProgressAt(idx, e.target.value)}
                      className="w-full bg-slate-950/50 border border-white/5 rounded-xl p-2.5 text-white text-sm font-black focus:ring-1 focus:ring-emerald-500 transition-all text-center placeholder:text-slate-800 tabular-nums"
                      disabled={!canEdit || isActivityMode}
                    />
                  </div>
                </div>

                {isActivityMode && (
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
            const rawActs = activityConfig[i];
            const activityCount = rawActs ? (Array.isArray(rawActs) ? rawActs.length : Object.values(rawActs).length) : 0;

            return (
              <div
                key={i}
                id={`week-card-${i}`}
                className={`glass-card rounded-xl p-3 border relative overflow-hidden group/w transition-all duration-500 flex flex-col ${isToday
                  ? "border-indigo-500/50 bg-indigo-500/5 ring-1 ring-indigo-500/20"
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
                    <label htmlFor={`w-goal-${i}`} className="block text-[7px] font-black text-cyan-500/40 uppercase">Meta</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={focusedInputId === `w-goal-${i}` ? (weeklyGoals[i] ?? '').toString() : formatNumberWithCommas(weeklyGoals[i])}
                      onFocus={() => setFocusedInputId(`w-goal-${i}`)}
                      onBlur={() => setFocusedInputId(null)}
                      onChange={(e) => {
                        const val = e.target.value;
                        setWeeklyVal('goals', i, val);
                      }}
                      id={`w-goal-${i}`}
                      className={`w-full bg-slate-950/50 border border-white/5 rounded-lg p-1.5 text-white text-[10px] font-black text-center focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all tabular-nums ${isToday && 'ring-1 ring-indigo-500/20'}`}
                      disabled={!canEdit || isActivityMode}
                      aria-label={`Meta para la semana ${i + 1}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor={`w-actual-${i}`} className="block text-[7px] font-black text-emerald-500/40 uppercase">Real</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={focusedInputId === `w-actual-${i}` ? (weeklyProgress[i] ?? '').toString() : formatNumberWithCommas(weeklyProgress[i])}
                      onFocus={() => setFocusedInputId(`w-actual-${i}`)}
                      onBlur={() => setFocusedInputId(null)}
                      onChange={(e) => {
                        const val = e.target.value;
                        setWeeklyVal('progress', i, val);
                      }}
                      id={`w-actual-${i}`}
                      className={`w-full bg-slate-950/50 border border-white/5 rounded-lg p-1.5 text-white text-[10px] font-black text-center focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all tabular-nums ${isToday && 'ring-1 ring-emerald-500/20'}`}
                      disabled={!canEdit || isActivityMode}
                      aria-label={`Realizado para la semana ${i + 1}`}
                    />
                  </div>
                </div>

                {isActivityMode && (
                  <button
                    onClick={() => setActiveActivityPeriod(i)}
                    className={`mb-3 w-full py-1.5 rounded-lg text-[7px] font-black uppercase tracking-widest border transition-all ${activityCount > 0 ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-400 hover:bg-indigo-600' : 'bg-slate-800 border-white/10 text-slate-500 hover:text-white'}`}
                    aria-label={`Configurar actividades para la semana ${i + 1}`}
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
                    aria-label={`Análisis o nota para la semana ${i + 1}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeActivityPeriod !== null && (
        <ActivityManager
          title={item.indicator}
          subtitle={!isWeekly ? months[activeActivityPeriod] : `Semana ${activeActivityPeriod + 1}`}
          initialActivities={Array.isArray(activityConfig[activeActivityPeriod]) ? activityConfig[activeActivityPeriod] as any : (activityConfig[activeActivityPeriod] ? Object.values(activityConfig[activeActivityPeriod] || {}) : [])}
          canEdit={canEdit}
          onClose={() => setActiveActivityPeriod(null)}
          onSave={(updatedList) => {
            // 🛡️ FIX v8.7.2 (CRITICAL): Sincronización completa para evitar pérdida de datos
            const currentPeriodToUpdate = activeActivityPeriod;
            const newConfig = { ...activityConfig, [currentPeriodToUpdate]: updatedList };
            setActivityConfig(newConfig);

            const activities: any[] = Array.isArray(updatedList) ? updatedList : (updatedList ? Object.values(updatedList) : []);
            const totalGoal: number = activities.reduce((sum: number, a: any) => sum + (Number(a.targetCount) || 0), 0 as number);
            const totalReal: number = activities.reduce((sum: number, a: any) => sum + (Number(a.completedCount) || 0), 0 as number);

            let finalWeeklyGoals = [...weeklyGoals];
            let finalWeeklyProgress = [...weeklyProgress];
            let finalMonthlyGoals = [...monthlyGoals];
            let finalMonthlyProgress = [...monthlyProgress];

            if (isWeekly) {
              finalWeeklyGoals[currentPeriodToUpdate] = totalGoal;
              finalWeeklyProgress[currentPeriodToUpdate] = totalReal;
              setWeeklyGoals(finalWeeklyGoals);
              setWeeklyProgress(finalWeeklyProgress);
            } else {
              finalMonthlyGoals[currentPeriodToUpdate] = totalGoal;
              finalMonthlyProgress[currentPeriodToUpdate] = totalReal;
              setMonthlyGoals(finalMonthlyGoals);
              setMonthlyProgress(finalMonthlyProgress);
            }

            setActiveActivityPeriod(null);
            
            // 🚀 AUTO-SAVE NUCLEAR: Persistir TODO en Firebase inmediatamente
            onSave({ 
              activityConfig: newConfig,
              isActivityMode: true,
              weeklyGoals: isWeekly ? finalWeeklyGoals : weeklyGoals,
              weeklyProgress: isWeekly ? finalWeeklyProgress : weeklyProgress,
              monthlyGoals: isWeekly ? monthlyGoals : finalMonthlyGoals,
              monthlyProgress: isWeekly ? monthlyProgress : finalMonthlyProgress,
              monthlyNotes,
              weeklyNotes
            }, true);
          }}
          onCopyToAll={canEdit ? (sourceActivities) => {
            if (!sourceActivities || sourceActivities.length === 0) return;
            if (!confirm(`¿Copiar esta estructura a TODO EL AÑO?\n(Los avances se reiniciarán a 0 en los otros periodos)`)) return;

            const newTotalConfig: any = { ...activityConfig };
            const limit = isWeekly ? 53 : 12;
            for (let i = 0; i < limit; i++) {
              newTotalConfig[i] = sourceActivities.map((a: any) => ({ ...a, completedCount: 0 }));
            }
            setActivityConfig(newTotalConfig);
            
            onSave({ 
              activityConfig: newTotalConfig,
              isActivityMode: true 
            }, true);

            alert("Estructura copiada exitosamente.");
          } : undefined}
          goalType={item.goalType}
        />
      )}

      {!canEdit && (
        <div className="mt-3 text-yellow-200 bg-yellow-900/30 border border-yellow-700/40 rounded-lg p-3">
          No tienes permisos para editar.
        </div>
      )}
    </div>
  );
});
