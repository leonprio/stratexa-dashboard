/**
 * Tipos e Interfaces para el módulo de Fundamentos de Estrategia (BSC / Matriz de Contribución).
 * @module StrategyTypes
 * @version v9.4.22
 */

export interface StrategicPerspective {
  id: string;
  name: string;
  order: number;
  color?: string;
  icon?: string;
}

export const DEFAULT_PERSPECTIVES: StrategicPerspective[] = [
  { id: 'FINANCIERA', name: 'Financiera', order: 1, color: '#10B981', icon: 'DollarSign' },
  { id: 'CLIENTE', name: 'Cliente', order: 2, color: '#3B82F6', icon: 'Users' },
  { id: 'PROCESOS_INTERNOS', name: 'Procesos Internos', order: 3, color: '#F59E0B', icon: 'Zap' },
  { id: 'APRENDIZAJE_CRECIMIENTO', name: 'Aprendizaje y Crecimiento', order: 4, color: '#8B5CF6', icon: 'BookOpen' }
];

export interface StrategicObjective {
  id: string;
  perspectiveId: string;
  code: string; // e.g. "OE-01"
  title: string;
  description?: string;
  order: number;
  clientId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AreaStrategyConfig {
  id: string; // Identity técnico inmutable
  areaName: string; // Nombre del área (e.g. "COMERCIAL")
  code: string; // Código de despliegue estable (e.g. "COM")
  clientId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContributionObjective {
  id: string; // Identity técnico inmutable
  areaName: string; // Área a la que pertenece (e.g. "COMERCIAL")
  areaCode: string; // Código de área asignado al momento de creación (e.g. "COM")
  sequenceNumber: number; // Consecutivo monótono independiente por área (e.g. 1, 2, 3)
  displayCode: string; // Código visible derivado estable (e.g. "COM-OC01")
  title: string;
  description?: string;
  primaryStrategicObjectiveId: string; // OE primario al que contribuye
  clientId: string;
  status?: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
}

export interface ContributionIndicatorAssignment {
  id: string;
  contributionObjectiveId: string;
  dashboardId: number | string;
  itemId: number | string;
  clientId: string;
  createdAt?: string;
}

/**
 * Deriva una sugerencia inicial de código de área a partir de su nombre.
 * ÚNICAMENTE como sugerencia previa a ser guardada por el usuario.
 */
export function deriveAreaCodeSuggestion(areaName: string): string {
  if (!areaName || !areaName.trim()) return 'AREA';
  const clean = areaName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .trim();

  const words = clean.split(/\s+/).filter(Boolean);

  if (words.length === 1) {
    return words[0].slice(0, 3);
  }

  // Si son múltiples palabras (ej. "TALENTO Y CULTURA" o "PROCESOS INTERNOS")
  const stopWords = new Set(['Y', 'DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'EN', 'PARA']);
  const meaningfulWords = words.filter(w => !stopWords.has(w));

  if (meaningfulWords.length >= 2) {
    if (meaningfulWords.length === 2) {
      return (meaningfulWords[0].slice(0, 2) + meaningfulWords[1].slice(0, 2)).slice(0, 4);
    }
    return meaningfulWords.map(w => w[0]).join('').slice(0, 4);
  }

  return words.map(w => w[0]).join('').slice(0, 4);
}

/**
 * Valida la unicidad de un código de área para un mismo cliente.
 * Retorna true si el código es único o pertenece al mismo área.
 */
export function validateAreaCodeUniqueness(
  configs: AreaStrategyConfig[],
  newCode: string,
  currentAreaName: string
): boolean {
  const normalizedNewCode = newCode.trim().toUpperCase();
  const normalizedAreaName = currentAreaName.trim().toUpperCase();

  if (!normalizedNewCode) return false;

  const existing = configs.find(
    c => c.code.trim().toUpperCase() === normalizedNewCode
  );

  if (!existing) return true;

  // Si existe pero pertenece al mismo área, es válido
  return existing.areaName.trim().toUpperCase() === normalizedAreaName;
}

/**
 * Genera el siguiente número de secuencia monótona para un área específica.
 * Garantiza que las secuencias eliminadas/inactivas NUNCA sean reutilizadas.
 */
export function generateNextOCSequence(
  existingOCs: ContributionObjective[],
  areaName: string
): number {
  const normArea = areaName.trim().toUpperCase();
  const areaOCs = existingOCs.filter(
    oc => oc.areaName.trim().toUpperCase() === normArea
  );

  if (areaOCs.length === 0) return 1;

  const maxSeq = areaOCs.reduce((max, oc) => {
    const seq = Number(oc.sequenceNumber) || 0;
    return seq > max ? seq : max;
  }, 0);

  return maxSeq + 1;
}

/**
 * Formatea el código de despliegue visible de un Objetivo de Contribución.
 * Ej: ("COM", 1) -> "COM-OC01"
 */
export function formatOCCode(areaCode: string, sequenceNumber: number): string {
  const cleanCode = (areaCode || 'AREA').trim().toUpperCase();
  const seqStr = String(sequenceNumber).padStart(2, '0');
  return `${cleanCode}-OC${seqStr}`;
}
