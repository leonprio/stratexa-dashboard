export interface ChecklistElement {
  id: string;
  label: string;
  targetCount: number;
  completedCount: number;
}

export const CHECKLIST_IMPORT_HEADER = 'elemento';
export const CHECKLIST_IMPORT_TARGET_HEADER = 'meta';
export const CHECKLIST_IMPORT_MAX_ROWS = 500;
export const CHECKLIST_ELEMENT_MAX_LENGTH = 200;
export const CHECKLIST_TARGET_MAX = Number.MAX_SAFE_INTEGER;

export type ChecklistImportIssueType = 'empty' | 'duplicate' | 'existing' | 'invalid';

export interface ChecklistImportIssue {
  row: number;
  value: string;
  type: ChecklistImportIssueType;
  message: string;
}

export interface ChecklistImportPreview {
  rowsRead: number;
  valid: ChecklistImportRow[];
  duplicateCount: number;
  existingCount: number;
  rejectedCount: number;
  emptyCount: number;
  issues: ChecklistImportIssue[];
  updates: ChecklistImportRow[];
  unchangedCount: number;
  metaDelta: number;
  fatalError?: string;
}

export interface ChecklistImportRow {
  label: string;
  targetCount: number;
  existingId?: string;
  existingTargetCount?: number;
}

const normalizeLabel = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-MX');

const parseCsvRows = (source: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',' || char === ';') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error('El archivo contiene comillas sin cerrar.');
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
};

export const previewChecklistCsv = (source: string, existingActivities: Array<string | ChecklistElement>): ChecklistImportPreview => {
  const cleanSource = source.replace(/^\uFEFF/, '');
  if (!cleanSource.trim()) {
    return { rowsRead: 0, valid: [], updates: [], unchangedCount: 0, metaDelta: 0, duplicateCount: 0, existingCount: 0, rejectedCount: 0, emptyCount: 0, issues: [], fatalError: 'El archivo está vacío.' };
  }

  let rows: string[][];
  try {
    rows = parseCsvRows(cleanSource);
  } catch (error) {
    return { rowsRead: 0, valid: [], updates: [], unchangedCount: 0, metaDelta: 0, duplicateCount: 0, existingCount: 0, rejectedCount: 0, emptyCount: 0, issues: [], fatalError: error instanceof Error ? error.message : 'No fue posible leer el archivo.' };
  }

  const header = rows.shift();
  const isLegacyFormat = header?.length === 1 && normalizeLabel(header[0]) === CHECKLIST_IMPORT_HEADER;
  const isTwoColumnFormat = header?.length === 2
    && normalizeLabel(header[0]) === CHECKLIST_IMPORT_HEADER
    && normalizeLabel(header[1]) === CHECKLIST_IMPORT_TARGET_HEADER;
  if (!header || (!isLegacyFormat && !isTwoColumnFormat)) {
    return { rowsRead: rows.length, valid: [], updates: [], unchangedCount: 0, metaDelta: 0, duplicateCount: 0, existingCount: 0, rejectedCount: rows.length, emptyCount: 0, issues: [], fatalError: `El encabezado debe ser “${CHECKLIST_IMPORT_HEADER}” o “${CHECKLIST_IMPORT_HEADER},${CHECKLIST_IMPORT_TARGET_HEADER}”.` };
  }

  const issues: ChecklistImportIssue[] = [];
  const valid: ChecklistImportRow[] = [];
  const existing = new Map(existingActivities.map(activity => {
    const item = typeof activity === 'string' ? { label: activity } : activity;
    return [normalizeLabel(item.label), item];
  }));
  const updates: ChecklistImportRow[] = [];
  let unchangedCount = 0;
  let metaDelta = 0;
  const seen = new Set<string>();
  const dataRows = rows;

  dataRows.forEach((columns, index) => {
    const rowNumber = index + 2;
    const label = (columns[0] || '').trim().replace(/\s+/g, ' ');
    if (columns.length !== (isTwoColumnFormat ? 2 : 1)) {
      issues.push({ row: rowNumber, value: label, type: 'invalid', message: 'La fila contiene columnas adicionales.' });
      return;
    }
    if (!label) {
      issues.push({ row: rowNumber, value: '', type: 'empty', message: 'El nombre del elemento está vacío.' });
      return;
    }
    if (label.length > CHECKLIST_ELEMENT_MAX_LENGTH) {
      issues.push({ row: rowNumber, value: label, type: 'invalid', message: `Supera el máximo de ${CHECKLIST_ELEMENT_MAX_LENGTH} caracteres.` });
      return;
    }
    const normalized = normalizeLabel(label);
    if (seen.has(normalized)) {
      issues.push({ row: rowNumber, value: label, type: 'duplicate', message: 'Está duplicado dentro del archivo.' });
      return;
    }
    let targetCount = 1;
    if (isTwoColumnFormat) {
      const rawTarget = (columns[1] || '').trim();
      if (!/^\d+$/.test(rawTarget)) {
        issues.push({ row: rowNumber, value: label, type: 'invalid', message: 'La meta debe ser un entero positivo.' });
        return;
      }
      targetCount = Number(rawTarget);
      if (!Number.isSafeInteger(targetCount) || targetCount < 1 || targetCount > CHECKLIST_TARGET_MAX) {
        issues.push({ row: rowNumber, value: label, type: 'invalid', message: `La meta debe estar entre 1 y ${CHECKLIST_TARGET_MAX.toLocaleString('es-MX')}.` });
        return;
      }
    }
    seen.add(normalized);
    const existingItem = existing.get(normalized);
    if (existingItem) {
      const existingTargetCount = Number(existingItem.targetCount ?? 1);
      if (isTwoColumnFormat && targetCount !== existingTargetCount) {
        updates.push({ label, targetCount, existingId: existingItem.id, existingTargetCount });
        metaDelta += targetCount - existingTargetCount;
      } else {
        unchangedCount += 1;
      }
      return;
    }
    valid.push({ label, targetCount });
  });

  if (dataRows.length > CHECKLIST_IMPORT_MAX_ROWS) {
    return {
      rowsRead: dataRows.length, valid: [], duplicateCount: 0, existingCount: 0,
      rejectedCount: dataRows.length, emptyCount: 0, issues: [], updates: [], unchangedCount: 0, metaDelta: 0,
      fatalError: `El archivo excede el máximo de ${CHECKLIST_IMPORT_MAX_ROWS} filas por importación.`
    };
  }

  return {
    rowsRead: dataRows.length,
    valid,
    updates,
    unchangedCount,
    metaDelta,
    duplicateCount: issues.filter(issue => issue.type === 'duplicate').length,
    existingCount: unchangedCount + updates.length,
    rejectedCount: issues.filter(issue => issue.type === 'empty' || issue.type === 'invalid').length,
    emptyCount: issues.filter(issue => issue.type === 'empty').length,
    issues,
  };
};

export const createChecklistElement = (label: string, targetCount = 1): ChecklistElement => ({
  id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  label: label.trim().replace(/\s+/g, ' '),
  targetCount,
  completedCount: 0,
});

export const checklistCsvTemplate = () => '\uFEFFelemento,meta\r\nProspecto ficticio 001,1\r\nProspecto ficticio 002,2\r\nProspecto ficticio 003,3\r\n';
