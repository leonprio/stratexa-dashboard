import React, { useState, useMemo } from 'react';
import { X, Plus, Trash2, ArrowRight, AlertCircle, CheckCircle2, Compass } from 'lucide-react';
import {
  StrategicObjective,
  StrategicPerspective,
  StrategicObjectiveRelationship,
  validateObjectiveRelationship
} from '../../strategyTypes';

export interface RelationshipEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  objectives: StrategicObjective[];
  perspectives: StrategicPerspective[];
  relationships: StrategicObjectiveRelationship[];
  clientId: string;
  onSaveRelationship: (rel: { sourceStrategicObjectiveId: string; targetStrategicObjectiveId: string; description?: string }) => Promise<void>;
  onDeleteRelationship: (relationshipId: string) => Promise<void>;
}

/**
 * Modal de Administración para la Gestión de Relaciones de Causa y Efecto entre Objetivos Estratégicos.
 *
 * Flujo seguro:
 * 1. Selección de OE Origen (Causa)
 * 2. Selección de OE Destino (Efecto)
 * 3. Justificación opcional
 * 4. Validación mediante validateObjectiveRelationship
 * 5. Guardado / Eliminación determinista
 */
export const RelationshipEditorModal: React.FC<RelationshipEditorModalProps> = ({
  isOpen,
  onClose,
  objectives = [],
  perspectives = [],
  relationships = [],
  clientId,
  onSaveRelationship,
  onDeleteRelationship
}) => {
  if (!isOpen) return null;

  const [sourceId, setSourceId] = useState<string>('');
  const [targetId, setTargetId] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Ordenar objetivos por perspectiva y orden
  const sortedObjectives = useMemo(() => {
    return [...objectives].sort((a, b) => {
      if (a.perspectiveId !== b.perspectiveId) {
        return a.perspectiveId.localeCompare(b.perspectiveId);
      }
      return (a.order || 0) - (b.order || 0);
    });
  }, [objectives]);

  // Manejador para agregar nueva relación
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const validation = validateObjectiveRelationship(
      { sourceStrategicObjectiveId: sourceId, targetStrategicObjectiveId: targetId, clientId },
      relationships,
      objectives
    );

    if (!validation.valid) {
      setErrorMsg(validation.error || 'Relación no válida.');
      return;
    }

    try {
      setIsSaving(true);
      await onSaveRelationship({
        sourceStrategicObjectiveId: sourceId,
        targetStrategicObjectiveId: targetId,
        description: description.trim() || undefined
      });
      setSourceId('');
      setTargetId('');
      setDescription('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar la relación.');
    } fontFinally: {
      setIsSaving(false);
    }
  };

  // Manejador para eliminar relación
  const handleDelete = async (relId: string) => {
    try {
      setDeletingId(relId);
      await onDeleteRelationship(relId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar la relación.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabecera Modal */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 rounded-xl text-indigo-700">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Gestión de Relaciones de Causa y Efecto</h3>
              <p className="text-xs text-slate-500">Conectores direccionales entre Objetivos Estratégicos (BSC)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Mensaje de Error */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Formulario de Nueva Relación */}
          <form onSubmit={handleAdd} className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-indigo-600" />
              Nueva Relación Causal
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Selección OE Origen (Causa) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Objetivo Origen (Causa / Impulsor) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={sourceId}
                  onChange={e => setSourceId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  required
                >
                  <option value="">-- Seleccionar Origen --</option>
                  {sortedObjectives.map(oe => {
                    const persp = perspectives.find(p => p.id === oe.perspectiveId);
                    return (
                      <option key={`src_${oe.id}`} value={oe.id}>
                        [{oe.code}] {oe.title} ({persp?.name || oe.perspectiveId})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Selección OE Destino (Efecto) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Objetivo Destino (Efecto / Receptor) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={targetId}
                  onChange={e => setTargetId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  required
                >
                  <option value="">-- Seleccionar Destino --</option>
                  {sortedObjectives.map(oe => {
                    const persp = perspectives.find(p => p.id === oe.perspectiveId);
                    return (
                      <option key={`tgt_${oe.id}`} value={oe.id}>
                        [{oe.code}] {oe.title} ({persp?.name || oe.perspectiveId})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Razón/Justificación Opcional */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Justificación Estratégica (Opcional)
              </label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Ej. El desarrollo de competencias impulsa la eficiencia operativa..."
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSaving || !sourceId || !targetId}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                {isSaving ? 'Guardando...' : 'Agregar Relación'}
              </button>
            </div>
          </form>

          {/* Listado de Relaciones Existentes */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Relaciones Registradas ({relationships.length})
            </h4>

            {relationships.length > 0 ? (
              <div className="space-y-2">
                {relationships.map(rel => {
                  const srcOE = objectives.find(o => o.id === rel.sourceStrategicObjectiveId);
                  const tgtOE = objectives.find(o => o.id === rel.targetStrategicObjectiveId);

                  return (
                    <div
                      key={rel.id}
                      className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* Origen */}
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 flex-1 min-w-0">
                          <span className="font-bold text-amber-900">{srcOE?.code || 'OE?'}</span>
                          <span className="text-amber-800 truncate block">{srcOE?.title || 'Objetivo no encontrado'}</span>
                        </div>

                        <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />

                        {/* Destino */}
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 flex-1 min-w-0">
                          <span className="font-bold text-emerald-900">{tgtOE?.code || 'OE?'}</span>
                          <span className="text-emerald-800 truncate block">{tgtOE?.title || 'Objetivo no encontrado'}</span>
                        </div>
                      </div>

                      {/* Botón Eliminar */}
                      <button
                        onClick={() => handleDelete(rel.id)}
                        disabled={deletingId === rel.id}
                        className="p-2 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                        title="Eliminar relación"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-slate-50 rounded-xl p-6 border border-dashed border-slate-200 text-center text-slate-500 text-xs">
                No existen relaciones registradas. Selecciona un objetivo origen y destino arriba para crear la primera relación de causa y efecto.
              </div>
            )}
          </div>
        </div>

        {/* Pie del Modal */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors shadow-sm"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
