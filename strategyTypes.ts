/**
 * Tipos e Interfaces para el módulo de Fundamentos de Estrategia (BSC / Matriz de Contribución).
 * @module StrategyTypes
 * @version v9.4.22
 */

export interface StrategicPerspective {
  id: string; // Identificador inmutable de slot (FINANCIERA, CLIENTE, PROCESOS_INTERNOS, APRENDIZAJE_CRECIMIENTO)
  name: string; // Nombre visible configurable por el Admin
  description?: string;
  order: number;
  color?: string;
  icon?: string;
  clientId?: string;
}

export const DEFAULT_PERSPECTIVES: StrategicPerspective[] = [
  {
    id: 'FINANCIERA',
    name: 'Resultados / Financiera',
    description: 'Objetivos de desempeño financiero y generación de valor.',
    order: 1,
    color: '#10B981',
    icon: 'DollarSign'
  },
  {
    id: 'CLIENTE',
    name: 'Cliente / Grupos de interés',
    description: 'Propuesta de valor para clientes y partes interesadas.',
    order: 2,
    color: '#3B82F6',
    icon: 'Users'
  },
  {
    id: 'PROCESOS_INTERNOS',
    name: 'Procesos internos',
    description: 'Excelencia operacional e innovación de procesos.',
    order: 3,
    color: '#F59E0B',
    icon: 'Zap'
  },
  {
    id: 'APRENDIZAJE_CRECIMIENTO',
    name: 'Capacidad organizacional',
    description: 'Talento, cultura, clima y competencias clave.',
    order: 4,
    color: '#8B5CF6',
    icon: 'BookOpen'
  }
];

export interface StrategicObjective {
  id: string;
  perspectiveId: string; // Referencia inmutable a la perspectiva
  code: string; // e.g. "OE-01"
  title: string;
  description?: string;
  order: number;
  clientId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AreaStrategyConfig {
  id: string; // Identidad técnica inmutable (ej. "areacfg_IPS_COMERCIAL")
  areaName: string; // Nombre de despliegue del área (ej. "COMERCIAL")
  code: string; // Código de estrategia estable (ej. "COM")
  clientId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContributionObjective {
  id: string; // Identidad técnica inmutable
  areaConfigId?: string; // Referencia relacional inmutable a AreaStrategyConfig.id
  areaName: string; // Snapshot visible del nombre del área (ej. "COMERCIAL")
  areaCode: string; // Snapshot visible del código asignado al crearse (ej. "COM")
  sequenceNumber: number; // Consecutivo monótono atómico e independiente por área (ej. 1, 2, 3)
  displayCode: string; // Código de despliegue derivado estable (ej. "COM-OC01")
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

export interface StrategyCounter {
  id: string; // Documento de contador (ej. "cnt_IPS_areacfg_COM")
  lastIssuedSequence: number;
  areaConfigId: string;
  clientId: string;
  updatedAt?: string;
}

export interface AreaCodeReservation {
  id: string; // Documento de reserva (ej. "res_IPS_COM")
  areaConfigId: string;
  code: string;
  clientId: string;
  updatedAt?: string;
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
 * Retorna true si el código es único o pertenece a la misma configuración de área.
 */
export function validateAreaCodeUniqueness(
  configs: AreaStrategyConfig[],
  newCode: string,
  currentAreaNameOrId: string
): boolean {
  const normalizedNewCode = newCode.trim().toUpperCase();
  const normalizedKey = currentAreaNameOrId.trim().toUpperCase();

  if (!normalizedNewCode) return false;

  const existing = configs.find(
    c => c.code.trim().toUpperCase() === normalizedNewCode
  );

  if (!existing) return true;

  // Si existe pero pertenece al mismo área o mismo ID, es válido
  return (
    existing.id.trim().toUpperCase() === normalizedKey ||
    existing.areaName.trim().toUpperCase() === normalizedKey
  );
}

/**
 * Genera el siguiente número de secuencia monótona para un área específica.
 * Garantiza que las secuencias eliminadas/inactivas NUNCA sean reutilizadas.
 */
export function generateNextOCSequence(
  existingOCs: ContributionObjective[],
  areaNameOrConfigId: string
): number {
  const normKey = areaNameOrConfigId.trim().toUpperCase();
  const areaOCs = existingOCs.filter(
    oc =>
      (oc.areaConfigId && oc.areaConfigId.trim().toUpperCase() === normKey) ||
      oc.areaName.trim().toUpperCase() === normKey
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
