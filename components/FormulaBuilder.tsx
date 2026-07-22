import React, { useState, useMemo } from 'react';
import { DashboardItem } from '../types';
import { evaluateFormula } from '../utils/compliance';

interface FormulaBuilderProps {
  currentItem: DashboardItem | (Omit<DashboardItem, 'id'> & { id: number | string });
  allItems: (DashboardItem | (Omit<DashboardItem, 'id'> & { id: number | string }))[];
  onChangeFormula: (formula: string) => void;
}

export const FormulaBuilder: React.FC<FormulaBuilderProps> = ({
  currentItem,
  allItems,
  onChangeFormula,
}) => {
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [draggedIndicatorId, setDraggedIndicatorId] = useState<string | null>(null);

  // Filtrar indicadores válidos para la fórmula (excluir autorreferencia)
  const availableItems = useMemo(() => {
    return allItems.filter(it => String(it.id) !== String(currentItem.id));
  }, [allItems, currentItem.id]);

  // Parsear la expresión actual si coincide con {idA}/{idB}, {idA}+{idB}, etc.
  // Soporta formato {id:X} y {X}
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

  // Sincronizar cuando cambia la fórmula externa si no estamos en avanzado
  React.useEffect(() => {
    if (parsedExpression.isSimpleBinary) {
      setOperandA(parsedExpression.operandA);
      setOperator(parsedExpression.operator);
      setOperandB(parsedExpression.operandB);
    }
  }, [parsedExpression]);

  // Función para actualizar la fórmula generada
  const updateFormulaString = (opA: string, op: string, opB: string) => {
    if (!opA && !opB) {
      onChangeFormula('');
      return;
    }
    if (opA && opB) {
      onChangeFormula(`{id:${opA}}${op}{id:${opB}}`);
    } else if (opA) {
      onChangeFormula(`{id:${opA}}`);
    } else {
      onChangeFormula(`{id:${opB}}`);
    }
  };

  const handleSelectOperandA = (id: string) => {
    if (id === String(currentItem.id)) return; // No autorreferencia
    setOperandA(id);
    updateFormulaString(id, operator, operandB);
  };

  const handleSelectOperandB = (id: string) => {
    if (id === String(currentItem.id)) return; // No autorreferencia
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

  // Vista Previa en tiempo real para el mes 5 (o mes actual)
  const previewMonthIdx = 5; // Junio por defecto de LVP
  const itemA = allItems.find(it => String(it.id) === String(operandA));
  const itemB = allItems.find(it => String(it.id) === String(operandB));

  const valA = itemA ? (itemA.monthlyProgress?.[previewMonthIdx] ?? 0) : 0;
  const valB = itemB ? (itemB.monthlyProgress?.[previewMonthIdx] ?? 0) : 0;

  const derivedValue = useMemo(() => {
    if (!currentItem.formula) return 0;
    return evaluateFormula(currentItem.formula, allItems as DashboardItem[], previewMonthIdx, 'monthlyProgress');
  }, [currentItem.formula, allItems]);

  const derivedGoal = useMemo(() => {
    if (!currentItem.formula) return 0;
    const hasExplicit = (currentItem.monthlyGoals || []).some((g: any) => Number(g || 0) > 0);
    if (hasExplicit) return currentItem.monthlyGoals?.[previewMonthIdx] ?? 0;
    return evaluateFormula(currentItem.formula, allItems as DashboardItem[], previewMonthIdx, 'monthlyGoals');
  }, [currentItem.formula, currentItem.monthlyGoals, allItems]);

  const derivedCompliancePct = useMemo(() => {
    if (Number(derivedGoal) === 0) return 0;
    return Math.round((Number(derivedValue) / Number(derivedGoal)) * 100);
  }, [derivedValue, derivedGoal]);

  const isZeroDenominator = operator === '/' && Number(valB) === 0 && Boolean(operandB);

  return (
    <div className="flex flex-col gap-3 p-3 bg-slate-950/80 border border-indigo-500/30 rounded-xl shadow-xl">
      {/* HEADER & TOGGLE MODO AVANZADO */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs">⚡</span>
          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">
            Constructor de Fórmulas
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsAdvancedMode(!isAdvancedMode)}
          className="text-[9px] text-slate-400 hover:text-indigo-300 underline font-semibold transition-colors"
        >
          {isAdvancedMode ? '← Usar Constructor Guiado' : 'Modo Avanzado (Texto)'}
        </button>
      </div>

      {!isAdvancedMode ? (
        <>
          {/* AYUDA CONTEXTUAL FORMULA vs AGREGADO */}
          <div className="bg-indigo-950/40 border border-indigo-500/20 p-2 rounded-lg text-[9px] text-indigo-200">
            <span className="font-bold text-indigo-400">💡 FÓRMULA:</span> Combina dos indicadores del tablero mediante una operación matemática (ej. cerrados ÷ acordados).
          </div>

          {/* SLOTS DE ARRASTRE Y SELECCIÓN */}
          <div className="grid grid-cols-1 sm:grid-cols-7 gap-2 items-center">
            {/* OPERANDO A (Numerador) */}
            <div
              onDrop={handleDropSlotA}
              onDragOver={handleDragOver}
              className={`sm:col-span-3 p-2.5 rounded-lg border flex flex-col gap-1.5 transition-all ${operandA ? 'bg-slate-900 border-indigo-500/50' : 'bg-slate-950/50 border-dashed border-slate-700'}`}
            >
              <div className="flex justify-between items-center text-[9px] font-bold text-slate-400">
                <span>OPERANDO A {operator === '/' ? '(Numerador)' : ''}</span>
                {operandA && (
                  <button type="button" onClick={handleClearA} className="text-rose-400 hover:text-rose-300 font-bold">
                    ✕
                  </button>
                )}
              </div>
              
              <select
                aria-label="Seleccionar Indicador Operando A"
                value={operandA}
                onChange={(e) => handleSelectOperandA(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-indigo-500"
              >
                <option value="">-- Arrastra o Selecciona KPI --</option>
                {availableItems.map(it => (
                  <option key={it.id} value={it.id}>
                    {it.indicator} (Val: {it.monthlyProgress?.[previewMonthIdx] ?? 0})
                  </option>
                ))}
              </select>

              {itemA && (
                <div className="text-[9px] text-indigo-300 font-semibold truncate">
                  KPI #{itemA.id}: {itemA.indicator}
                </div>
              )}
            </div>

            {/* OPERADOR */}
            <div className="sm:col-span-1 flex justify-center">
              <select
                aria-label="Seleccionar Operador Matemático"
                value={operator}
                onChange={(e) => handleSelectOperator(e.target.value)}
                className="bg-indigo-600 border border-indigo-400 text-white font-black text-xs rounded-lg px-2 py-1.5 outline-none cursor-pointer hover:bg-indigo-500 shadow-md text-center"
              >
                <option value="/">÷ (División)</option>
                <option value="*">× (Multiplicación)</option>
                <option value="+">+ (Suma)</option>
                <option value="-">− (Resta)</option>
              </select>
            </div>

            {/* OPERANDO B (Denominador) */}
            <div
              onDrop={handleDropSlotB}
              onDragOver={handleDragOver}
              className={`sm:col-span-3 p-2.5 rounded-lg border flex flex-col gap-1.5 transition-all ${operandB ? 'bg-slate-900 border-indigo-500/50' : 'bg-slate-950/50 border-dashed border-slate-700'}`}
            >
              <div className="flex justify-between items-center text-[9px] font-bold text-slate-400">
                <span>OPERANDO B {operator === '/' ? '(Denominador)' : ''}</span>
                {operandB && (
                  <button type="button" onClick={handleClearB} className="text-rose-400 hover:text-rose-300 font-bold">
                    ✕
                  </button>
                )}
              </div>

              <select
                aria-label="Seleccionar Indicador Operando B"
                value={operandB}
                onChange={(e) => handleSelectOperandB(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-indigo-500"
              >
                <option value="">-- Arrastra o Selecciona KPI --</option>
                {availableItems.map(it => (
                  <option key={it.id} value={it.id}>
                    {it.indicator} (Val: {it.monthlyProgress?.[previewMonthIdx] ?? 0})
                  </option>
                ))}
              </select>

              {itemB && (
                <div className="text-[9px] text-indigo-300 font-semibold truncate">
                  KPI #{itemB.id}: {itemB.indicator}
                </div>
              )}
            </div>
          </div>

          {/* BIBLIOTECA LATERAL DE INDICADORES PARA ARRASTRE */}
          <div className="mt-1">
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Indicadores disponibles para arrastrar (Drag & Drop):
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
              {availableItems.map(it => (
                <div
                  key={it.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, it.id)}
                  className="bg-slate-900 hover:bg-indigo-900/40 border border-slate-700 hover:border-indigo-400/60 rounded px-2 py-1 text-[9px] text-slate-200 cursor-grab active:cursor-grabbing flex items-center gap-1.5 transition-all"
                  title="Arrastra este indicador al Operando A u Operando B"
                >
                  <span className="text-slate-500">::</span>
                  <span className="font-bold text-cyan-400">#{it.id}</span>
                  <span className="truncate max-w-[120px]">{it.indicator}</span>
                </div>
              ))}
            </div>
          </div>

          {/* VISTA PREVIA EN TIEMPO REAL */}
          <div className="mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 flex flex-wrap justify-between items-center gap-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] text-slate-500 uppercase font-black tracking-wider">Fórmula Expresada</span>
              <code className="text-[10px] text-cyan-300 font-mono font-bold">
                {currentItem.formula || '(Sin fórmula definida)'}
              </code>
            </div>

            <div className="flex items-center gap-4 text-right">
              {isZeroDenominator ? (
                <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                  ⚠️ SIN_DATOS (Denominador 0)
                </span>
              ) : (
                <>
                  <div className="flex flex-col">
                    <span className="text-[8px] text-slate-500 uppercase font-bold">Avance Derivado</span>
                    <span className="text-xs font-black text-white">
                      {derivedValue} {currentItem.unit || '%'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] text-slate-500 uppercase font-bold">Meta</span>
                    <span className="text-xs font-black text-slate-300">
                      {derivedGoal} {currentItem.unit || '%'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] text-slate-500 uppercase font-bold">Cumplimiento</span>
                    <span className="text-xs font-black text-emerald-400">
                      {derivedCompliancePct}%
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      ) : (
        /* MODO AVANZADO TEXTUAL */
        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-bold text-slate-400 uppercase">
            Expresión matemática directa:
          </label>
          <input
            type="text"
            placeholder="{id:101} / {id:102}"
            value={currentItem.formula || ''}
            onChange={(e) => onChangeFormula(e.target.value)}
            className="w-full bg-slate-950 border border-indigo-500/40 rounded px-2.5 py-1.5 text-xs text-indigo-200 font-mono outline-none focus:border-indigo-400"
          />
          <span className="text-[8px] text-slate-500">
            Sintaxis permitida: <code>&#123;id:101&#125; / &#123;id:102&#125;</code> ó nombres naturales de indicadores.
          </span>
        </div>
      )}
    </div>
  );
};
