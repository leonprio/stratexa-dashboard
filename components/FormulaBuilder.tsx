import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { DashboardItem } from '../types';
import { evaluateFormula } from '../utils/compliance';
import { formatIndicatorValue } from '../utils/formatters';

interface FormulaBuilderProps {
  currentItem: DashboardItem | (Omit<DashboardItem, 'id'> & { id: number | string });
  allItems: (DashboardItem | (Omit<DashboardItem, 'id'> & { id: number | string }))[];
  onChangeFormula: (formula: string) => void;
  onChangeGoalMode?: (goalMode: 'DERIVED_FROM_SOURCES' | 'EXPLICIT_TARGET') => void;
  onChangeFormulaOutputMode?: (mode: 'RESULT_IS_COMPLIANCE' | 'VALUE_VS_TARGET') => void;
  onClose: () => void;
}

export const FormulaBuilder: React.FC<FormulaBuilderProps> = ({
  currentItem,
  allItems,
  onChangeFormula,
  onClose,
}) => {
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [draggedIndicatorId, setDraggedIndicatorId] = useState<string | null>(null);

  // Filtrar indicadores válidos para la fórmula (excluir autorreferencia)
  const availableItems = useMemo(() => {
    return allItems.filter(it => String(it.id) !== String(currentItem.id));
  }, [allItems, currentItem.id]);

  // Parsear la expresión actual si coincide con {idA}/{idB}, {idA}+{idB}, etc.
  const parsedExpression = useMemo(() => {
    const raw = currentItem.formula || '';
    const regex = /^\s*\{(?:id:)?([\w-]+)\}\s*([\/\*\+\-])\s*\{(?:id:)?([\w-]+)\}\s*$/;
    const match = raw.match(regex);
    if (match) {
      return {
        operandA: match[1],
        operator: match[2],
        operandB: match[3],
        isSimpleBinary: true,
      };
    }
    return {
      operandA: '',
      operator: '/',
      operandB: '',
      isSimpleBinary: false,
    };
  }, [currentItem.formula]);

  const [operandA, setOperandA] = useState<string>(parsedExpression.operandA);
  const [operator, setOperator] = useState<string>(parsedExpression.operator || '/');
  const [operandB, setOperandB] = useState<string>(parsedExpression.operandB);
  const [draftFormula, setDraftFormula] = useState<string>(currentItem.formula || '');
  const [goalMode, setGoalMode] = useState<'DERIVED_FROM_SOURCES' | 'EXPLICIT_TARGET'>(
    (currentItem as any).goalMode || 'DERIVED_FROM_SOURCES'
  );
  const [formulaOutputMode, setFormulaOutputMode] = useState<'RESULT_IS_COMPLIANCE' | 'VALUE_VS_TARGET'>(
    (currentItem as any).formulaOutputMode || 'RESULT_IS_COMPLIANCE'
  );

  React.useEffect(() => {
    if (parsedExpression.isSimpleBinary) {
      setOperandA(parsedExpression.operandA);
      setOperator(parsedExpression.operator);
      setOperandB(parsedExpression.operandB);
    }
  }, [parsedExpression]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onClose]);

  // Función interna para sincronizar el borrador de la fórmula
  const updateFormulaString = (opA: string, op: string, opB: string) => {
    if (!opA && !opB) {
      setDraftFormula('');
      return;
    }
    if (opA && opB) {
      setDraftFormula(`{id:${opA}}${op}{id:${opB}}`);
    } else if (opA) {
      setDraftFormula(`{id:${opA}}`);
    } else {
      setDraftFormula(`{id:${opB}}`);
    }
  };

  const handleSelectOperandA = (id: string) => {
    if (id === String(currentItem.id)) return;
    setOperandA(id);
    updateFormulaString(id, operator, operandB);
  };

  const handleSelectOperandB = (id: string) => {
    if (id === String(currentItem.id)) return;
    setOperandB(id);
    updateFormulaString(operandA, operator, id);
  };

  const handleSelectOperator = (op: string) => {
    setOperator(op);
    updateFormulaString(operandA, op, operandB);
  };

  const handleClearA = () => {
    setOperandA('');
    updateFormulaString('', operator, operandB);
  };

  const handleClearB = () => {
    setOperandB('');
    updateFormulaString(operandA, operator, '');
  };

  const handleApply = () => {
    onChangeFormula(draftFormula);
    if (onChangeGoalMode) {
      onChangeGoalMode(goalMode);
    }
    if (onChangeFormulaOutputMode) {
      onChangeFormulaOutputMode(formulaOutputMode);
    }
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, id: string | number) => {
    e.dataTransfer.setData('text/plain', String(id));
    setDraggedIndicatorId(String(id));
  };

  const handleDropSlotA = (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggedIndicatorId;
    if (id && id !== String(currentItem.id)) {
      handleSelectOperandA(id);
    }
    setDraggedIndicatorId(null);
  };

  const handleDropSlotB = (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggedIndicatorId;
    if (id && id !== String(currentItem.id)) {
      handleSelectOperandB(id);
    }
    setDraggedIndicatorId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Vista Previa numérico en tiempo real (Junio / mes 5)
  const previewMonthIdx = 5;
  const itemA = allItems.find(it => String(it.id) === String(operandA));
  const itemB = allItems.find(it => String(it.id) === String(operandB));

  const valA = itemA ? (itemA.monthlyProgress?.[previewMonthIdx] ?? 0) : 0;
  const valB = itemB ? (itemB.monthlyProgress?.[previewMonthIdx] ?? 0) : 0;

  const derivedValue = useMemo(() => {
    if (!draftFormula) return 0;
    return evaluateFormula(draftFormula, allItems as DashboardItem[], previewMonthIdx, 'monthlyProgress');
  }, [draftFormula, allItems]);

  const derivedGoal = useMemo(() => {
    if (!draftFormula) return 0;
    if (goalMode === 'EXPLICIT_TARGET') {
      return currentItem.monthlyGoals?.[previewMonthIdx] ?? 0;
    }
    return evaluateFormula(draftFormula, allItems as DashboardItem[], previewMonthIdx, 'monthlyGoals');
  }, [draftFormula, goalMode, currentItem.monthlyGoals, allItems]);

  const derivedCompliancePct = useMemo(() => {
    if (formulaOutputMode === 'RESULT_IS_COMPLIANCE') {
      const val = Number(derivedValue || 0);
      return val <= 1.0 ? Math.round(val * 100) : Math.round(val);
    }
    if (Number(derivedGoal) === 0) return 0;
    return Math.round((Number(derivedValue) / Number(derivedGoal)) * 100);
  }, [derivedValue, derivedGoal, formulaOutputMode]);

  const isZeroDenominator = operator === '/' && Number(valB) === 0 && Boolean(operandB);

  // 🛡️ FIX v9.4.20 (PORTAL MODAL): Montar sobre document.body para escapar el stacking
  // context del IndicatorManager. Misma causa que AggregateBuilder.
  const modalContent = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={handleCancel}
    >
      <div
        className="bg-slate-900 border border-cyan-500/40 rounded-3xl w-full max-w-[800px] max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col p-6 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* HEADER DEL MODAL DE FÓRMULAS */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-xl text-indigo-400 font-bold">
              ⚡
            </div>
            <div className="flex flex-col">
              <h3 className="text-lg font-black uppercase text-white tracking-tight">
                Editor de Fórmulas Compuestas
              </h3>
              <span className="text-xs text-indigo-400 font-medium">
                Configurando para: <strong className="text-white">{currentItem.indicator}</strong> (#{currentItem.id})
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 transition-all font-bold"
            title="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* MODO CONSTRUCTOR GUIADO PASO A PASO */}
        {!isAdvancedMode ? (
          <div className="flex flex-col gap-6">
            
            {/* SECCIÓN 1: OPERACIÓN */}
            <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl flex flex-col gap-2">
              <span className="text-xs font-black text-cyan-400 uppercase tracking-widest">
                1. ¿Qué operación matemática necesitas?
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { op: '/', label: '÷ Dividir (Razón / Porcentaje)', desc: 'Numerador ÷ Denominador' },
                  { op: '*', label: '× Multiplicar', desc: 'Operando A × Operando B' },
                  { op: '+', label: '+ Sumar', desc: 'Operando A + Operando B' },
                  { op: '-', label: '− Restar', desc: 'Operando A − Operando B' },
                ].map(({ op, label, desc }) => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => handleSelectOperator(op)}
                    className={`p-3 rounded-xl border text-left flex flex-col transition-all ${operator === op ? 'bg-indigo-600/30 border-indigo-400 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                  >
                    <span className="font-bold text-xs">{label}</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* SECCIÓN 1.5: MODO DE META Y RESULTADO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl flex flex-col gap-2">
                <span className="text-xs font-black text-cyan-400 uppercase tracking-widest">
                  1.5. Modo de Meta
                </span>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setGoalMode('DERIVED_FROM_SOURCES')}
                    className={`p-3 rounded-xl border text-left flex flex-col transition-all ${goalMode === 'DERIVED_FROM_SOURCES' ? 'bg-indigo-600/30 border-indigo-400 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                  >
                    <span className="font-bold text-xs uppercase">⚡ Meta Derivada de Fuentes</span>
                    <span className="text-[10px] text-slate-500 mt-1">Aplica la fórmula a las metas fuente (ej. 4 ÷ 8 = 50%).</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGoalMode('EXPLICIT_TARGET')}
                    className={`p-3 rounded-xl border text-left flex flex-col transition-all ${goalMode === 'EXPLICIT_TARGET' ? 'bg-indigo-600/30 border-indigo-400 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                  >
                    <span className="font-bold text-xs uppercase">🎯 Meta Independiente Explicita</span>
                    <span className="text-[10px] text-slate-500 mt-1">Meta fija definida manualmente.</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl flex flex-col gap-2">
                <span className="text-xs font-black text-cyan-400 uppercase tracking-widest">
                  1.6. Modo de Salida
                </span>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setFormulaOutputMode('RESULT_IS_COMPLIANCE')}
                    className={`p-3 rounded-xl border text-left flex flex-col transition-all ${formulaOutputMode === 'RESULT_IS_COMPLIANCE' ? 'bg-indigo-600/30 border-indigo-400 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                  >
                    <span className="font-bold text-xs uppercase">🏆 Resultado Es El Cumplimiento</span>
                    <span className="text-[10px] text-slate-500 mt-1">El resultado es el % de cumplimiento final (ej. 50%).</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormulaOutputMode('VALUE_VS_TARGET')}
                    className={`p-3 rounded-xl border text-left flex flex-col transition-all ${formulaOutputMode === 'VALUE_VS_TARGET' ? 'bg-indigo-600/30 border-indigo-400 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                  >
                    <span className="font-bold text-xs uppercase">📊 Valor A Comparar Vs Meta</span>
                    <span className="text-[10px] text-slate-500 mt-1">El resultado es un valor a comparar contra meta.</span>
                  </button>
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: SELECCIÓN DE OPERANDOS */}
            <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl flex flex-col gap-3">
              <span className="text-xs font-black text-cyan-400 uppercase tracking-widest">
                2. Selecciona los indicadores involucrados
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-7 gap-3 items-center">
                {/* OPERANDO A */}
                <div
                  onDrop={handleDropSlotA}
                  onDragOver={handleDragOver}
                  className={`sm:col-span-3 p-3.5 rounded-xl border flex flex-col gap-2 transition-all ${operandA ? 'bg-slate-900 border-indigo-500/60 shadow-md' : 'bg-slate-950 border-dashed border-slate-700'}`}
                >
                  <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                    <span>{operator === '/' ? 'Numerador (Indicador A)' : 'Operando A'}</span>
                    {operandA && (
                      <button type="button" onClick={handleClearA} className="text-rose-400 hover:text-rose-300 text-xs font-bold">
                        Limpiar ✕
                      </button>
                    )}
                  </div>
                  
                  <select
                    aria-label="Seleccionar Indicador A"
                    value={operandA}
                    onChange={(e) => handleSelectOperandA(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-cyan-500"
                  >
                    <option value="">-- Selecciona Indicador A --</option>
                    {availableItems.map(it => (
                      <option key={it.id} value={it.id}>
                        #{it.id} - {it.indicator} (Avance: {it.monthlyProgress?.[previewMonthIdx] ?? 0})
                      </option>
                    ))}
                  </select>

                  {itemA && (
                    <div className="text-xs text-cyan-300 font-semibold bg-cyan-500/10 p-2 rounded-lg border border-cyan-500/20 truncate">
                      ✓ Seleccionado: #{itemA.id} {itemA.indicator}
                    </div>
                  )}
                </div>

                {/* OPERADOR SIMBOL */}
                <div className="sm:col-span-1 flex items-center justify-center">
                  <span className="w-10 h-10 rounded-2xl bg-indigo-600 border border-indigo-400 text-white font-black text-lg flex items-center justify-center shadow-lg">
                    {operator === '*' ? '×' : operator === '/' ? '÷' : operator === '+' ? '+' : '−'}
                  </span>
                </div>

                {/* OPERANDO B */}
                <div
                  onDrop={handleDropSlotB}
                  onDragOver={handleDragOver}
                  className={`sm:col-span-3 p-3.5 rounded-xl border flex flex-col gap-2 transition-all ${operandB ? 'bg-slate-900 border-indigo-500/60 shadow-md' : 'bg-slate-950 border-dashed border-slate-700'}`}
                >
                  <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                    <span>{operator === '/' ? 'Denominador (Indicador B)' : 'Operando B'}</span>
                    {operandB && (
                      <button type="button" onClick={handleClearB} className="text-rose-400 hover:text-rose-300 text-xs font-bold">
                        Limpiar ✕
                      </button>
                    )}
                  </div>

                  <select
                    aria-label="Seleccionar Indicador B"
                    value={operandB}
                    onChange={(e) => handleSelectOperandB(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-cyan-500"
                  >
                    <option value="">-- Selecciona Indicador B --</option>
                    {availableItems.map(it => (
                      <option key={it.id} value={it.id}>
                        #{it.id} - {it.indicator} (Avance: {it.monthlyProgress?.[previewMonthIdx] ?? 0})
                      </option>
                    ))}
                  </select>

                  {itemB && (
                    <div className="text-xs text-cyan-300 font-semibold bg-cyan-500/10 p-2 rounded-lg border border-cyan-500/20 truncate">
                      ✓ Seleccionado: #{itemB.id} {itemB.indicator}
                    </div>
                  )}
                </div>
              </div>

              {/* OPCIONAL: BIBLIOTECA DRAG AND DROP */}
              <div className="mt-2 border-t border-slate-800 pt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Opcional: Arrastra un indicador directamente (Drag & Drop)
                </span>
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-1">
                  {availableItems.map(it => (
                    <div
                      key={it.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, it.id)}
                      className="bg-slate-900 hover:bg-indigo-950 border border-slate-700 hover:border-indigo-500/50 rounded-lg px-2.5 py-1 text-xs text-slate-200 cursor-grab flex items-center gap-2"
                    >
                      <span className="text-slate-500 font-mono">::</span>
                      <span className="font-bold text-cyan-400">#{it.id}</span>
                      <span className="truncate max-w-[150px]">{it.indicator}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: RESULTADO Y VISTA PREVIA */}
            <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl flex flex-col gap-3">
              <span className="text-xs font-black text-cyan-400 uppercase tracking-widest">
                3. Revisa la vista previa del cálculo resultante
              </span>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Avance Derivado</span>
                  <span className="text-xl font-black text-white mt-1">
                    {formatIndicatorValue(derivedValue, currentItem.unit || '%', 2, true)}
                  </span>
                </div>

                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Meta Derivada</span>
                  <span className="text-xl font-black text-slate-300 mt-1">
                    {formatIndicatorValue(derivedGoal, currentItem.unit || '%', 2, true)}
                  </span>
                </div>

                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Cumplimiento Resultante</span>
                  <span className={`text-xl font-black mt-1 ${isZeroDenominator ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {isZeroDenominator ? 'SIN DATOS (Denominador 0)' : `${derivedCompliancePct.toFixed(2)}%`}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 font-bold">Fórmula resultante:</span>
                <code className="text-xs text-cyan-300 font-mono font-bold bg-slate-950 px-2 py-1 rounded border border-cyan-500/20">
                  {draftFormula || '(Sin expresión)'}
                </code>
              </div>
            </div>

            {/* BOTÓN MODO AVANZADO */}
            <div className="text-right">
              <button
                type="button"
                onClick={() => setIsAdvancedMode(true)}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline font-semibold"
              >
                ¿Necesitas escribir expresiones complejas? Usar Modo Avanzado (Texto)
              </button>
            </div>
          </div>
        ) : (
          /* MODO AVANZADO TEXTUAL */
          <div className="flex flex-col gap-4 py-4">
            <label className="text-xs font-bold text-slate-300 uppercase">
              Expresión aritmética directa:
            </label>
            <input
              type="text"
              placeholder="{id:101} / {id:102}"
              value={draftFormula}
              onChange={(e) => setDraftFormula(e.target.value)}
              className="w-full bg-slate-950 border border-indigo-500/50 rounded-xl p-3 text-sm text-indigo-200 font-mono outline-none focus:border-indigo-400"
            />
            <span className="text-xs text-slate-400">
              Sintaxis permitida: <code>&#123;id:101&#125; / &#123;id:102&#125;</code> o referencias por nombre.
            </span>
            <button
              type="button"
              onClick={() => setIsAdvancedMode(false)}
              className="text-xs text-indigo-400 hover:text-indigo-300 underline font-semibold self-start mt-2"
            >
              ← Volver al Constructor Guiado
            </button>
          </div>
        )}

        {/* FOOTER DEL MODAL CON CANCELAR Y APLICAR */}
        <div className="flex justify-end gap-3 border-t border-slate-800 pt-4 mt-6">
          <button
            type="button"
            onClick={handleCancel}
            className="px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold uppercase transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg hover:scale-[1.02]"
          >
            Aplicar Fórmula
          </button>
        </div>

      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
};
