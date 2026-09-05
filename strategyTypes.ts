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
  code: string; // e.g. "OE01"; historical hyphenated values remain valid
  title: string;
  description?: string;
  order: number;
  clientId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AreaStrategyConfig {
  id: string; // Identidad técnica inmutable auto-generada (ej. "areacfg_171800..._x8z")
  areaName: string; // Nombre visible/fuente del área (ej. "COMERCIAL")
  code: string; // Código de estrategia estable (ej. "COM")
  aliases?: string[]; // Nombres históricos/alias mapeados a esta misma entidad técnica
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
  displayCode: string; // Código de despliegue derivado estable (ej. "OCV01" o "OC01")
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
  contributionObjectiveId?: string;
  strategicObjectiveId?: string;
  dashboardId: number | string;
  itemId: number | string;
  clientId: string;
  createdAt?: string;
}

export interface StrategyCounter {
  id: string; // Documento de contador (ej. "cnt_IPS_areacfg_171800...")
  lastIssuedSequence: number;
  areaConfigId?: string;
  scope?: string;
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

export interface StrategicObjectiveRelationship {
  id: string;
  clientId: string;
  sourceStrategicObjectiveId: string; // OE Causa / Origen
  targetStrategicObjectiveId: string; // OE Efecto / Destino
  description?: string;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Genera el ID canónico determinista de una relación de causa-efecto.
 * Garantiza unicidad atómica en Firestore: tenant + sourceOE + targetOE.
 */
export function getCanonicalRelationshipId(
  clientId: string,
  sourceStrategicObjectiveId: string,
  targetStrategicObjectiveId: string
): string {
  const normClient = (clientId || 'IPS').trim().toUpperCase();
  const cleanSource = (sourceStrategicObjectiveId || '').trim();
  const cleanTarget = (targetStrategicObjectiveId || '').trim();
  return `rel_${normClient}_${cleanSource}_${cleanTarget}`;
}

/**
 * Valida la creación de una relación de causa-efecto entre dos Objetivos Estratégicos.
 * Previene: auto-relaciones, relaciones duplicadas exactas, referencias a OE inexistentes.
 */
export function validateObjectiveRelationship(
  rel: { sourceStrategicObjectiveId: string; targetStrategicObjectiveId: string; clientId: string },
  existing: StrategicObjectiveRelationship[],
  objectives: StrategicObjective[]
): { valid: boolean; error?: string } {
  if (!rel.sourceStrategicObjectiveId || !rel.targetStrategicObjectiveId) {
    return { valid: false, error: 'Debe seleccionar un objetivo de origen y un objetivo de destino.' };
  }
  if (rel.sourceStrategicObjectiveId === rel.targetStrategicObjectiveId) {
    return { valid: false, error: 'Un objetivo estratégico no puede estar relacionado consigo mismo.' };
  }
  const sourceExists = objectives.some(o => o.id === rel.sourceStrategicObjectiveId);
  const targetExists = objectives.some(o => o.id === rel.targetStrategicObjectiveId);
  if (!sourceExists || !targetExists) {
    return { valid: false, error: 'El objetivo de origen o de destino no existe en el catálogo.' };
  }
  const normClient = (rel.clientId || 'IPS').trim().toUpperCase();
  const isDuplicate = existing.some(
    r =>
      (r.clientId || 'IPS').trim().toUpperCase() === normClient &&
      r.sourceStrategicObjectiveId === rel.sourceStrategicObjectiveId &&
      r.targetStrategicObjectiveId === rel.targetStrategicObjectiveId
  );
  if (isDuplicate) {
    return { valid: false, error: 'La relación entre estos dos objetivos estratégicos ya existe.' };
  }
  return { valid: true };
}

/**
 * Resuelve la entidad de configuración de estrategia de un área dada (por nombre directo o histórico de aliases).
 */
export function resolveAreaStrategyConfig(
  sourceAreaName: string,
  configs: AreaStrategyConfig[]
): AreaStrategyConfig | undefined {
  if (!sourceAreaName || !sourceAreaName.trim()) return undefined;
  const normKey = sourceAreaName.trim().toUpperCase();

  return configs.find(
    c =>
      c.areaName.trim().toUpperCase() === normKey ||
      c.id.trim().toUpperCase() === normKey ||
      (c.aliases && c.aliases.some(a => a.trim().toUpperCase() === normKey))
  );
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
 * Retorna true si el código es único o pertenece a la misma entidad de configuración de área.
 */
export function validateAreaCodeUniqueness(
  configs: AreaStrategyConfig[],
  newCode: string,
  currentConfigIdOrName: string
): boolean {
  const normalizedNewCode = newCode.trim().toUpperCase();
  const normalizedKey = currentConfigIdOrName.trim().toUpperCase();

  if (!normalizedNewCode) return false;

  const existing = configs.find(
    c => c.code.trim().toUpperCase() === normalizedNewCode
  );

  if (!existing) return true;

  const isSameId = existing.id.trim().toUpperCase() === normalizedKey;
  const isSameName = existing.areaName.trim().toUpperCase() === normalizedKey;
  const isAliasMatch = Boolean(existing.aliases && existing.aliases.some(a => a.trim().toUpperCase() === normalizedKey));

  return isSameId || isSameName || isAliasMatch;
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
 * Ej: ("V", 1) -> "OCV01"; sin área -> "OC01"
 */
export function formatOCCode(areaCode: string, sequenceNumber: number): string {
  const cleanCode = normalizeObjectiveCodeForComparison(areaCode || '').replace(/^OC/, '');
  return formatObjectiveCode(cleanCode ? `OC${cleanCode}` : 'OC', sequenceNumber);
}

/** Identidad estable para comparar un KPI sin usar su etiqueta visible. */
export const getCanonicalKpiIdentity = (
  item: { semanticKey?: string; parentDefinitionId?: string; id?: number | string },
  dashboardId: number | string,
  itemId: number | string = item.id ?? ''
): string => {
  const semantic = item.semanticKey?.trim() || item.parentDefinitionId?.trim();
  return semantic ? `semantic:${semantic}` : `physical:${dashboardId}:${itemId}`;
};

export const getPhysicalKpiKey = (dashboardId: number | string, itemId: number | string): string => `${dashboardId}:${itemId}`;

export function formatOECode(sequenceNumber: number): string {
  return formatObjectiveCode('OE', sequenceNumber);
}

/** Canonical comparison form: OE-01, OE 01, oe01 all become OE01. */
export function normalizeObjectiveCodeForComparison(code: string): string {
  return (code || '').trim().toUpperCase().replace(/[\s-]+/g, '');
}

/** Formats any supported objective prefix without visual separators. */
export function formatObjectiveCode(prefix: string, sequenceNumber: number): string {
  const cleanPrefix = normalizeObjectiveCodeForComparison(prefix);
  return `${cleanPrefix}${String(sequenceNumber).padStart(2, '0')}`;
}

/** Safely extracts the numeric sequence from OE/OC-family codes. */
export function parseObjectiveCodeSequence(code: string, expectedPrefix?: string): number | null {
  const normalized = normalizeObjectiveCodeForComparison(code);
  const match = /^([A-Z]+)(\d+)$/.exec(normalized);
  if (!match || !match[1].startsWith('OE') && !match[1].startsWith('OC')) return null;
  if (expectedPrefix && !match[1].startsWith(normalizeObjectiveCodeForComparison(expectedPrefix))) return null;
  const sequence = Number(match[2]);
  return Number.isSafeInteger(sequence) && sequence > 0 ? sequence : null;
}
