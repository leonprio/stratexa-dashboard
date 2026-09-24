export interface ChecklistElement {
  id: string;
  label: string;
  targetCount: number;
  completedCount: number;
}

export const CHECKLIST_IMPORT_HEADER = 'elemento';
export const CHECKLIST_IMPORT_MAX_ROWS = 500;
export const CHECKLIST_ELEMENT_MAX_LENGTH = 200;

export type ChecklistImportIssueType = 'empty' | 'duplicate' | 'existing' | 'invalid';

export interface ChecklistImportIssue {
  row: number;
  value: string;
  type: ChecklistImportIssueType;
  message: string;
}

export interface ChecklistImportPreview {
  rowsRead: number;
  valid: string[];
  duplicateCount: number;
  existingCount: number;
  rejectedCount: number;
  emptyCount: number;
  issues: ChecklistImportIssue[];
  fatalError?: string;
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

export const previewChecklistCsv = (source: string, existingLabels: string[]): ChecklistImportPreview => {
  const cleanSource = source.replace(/^\uFEFF/, '');
  if (!cleanSource.trim()) {
    return { rowsRead: 0, valid: [], duplicateCount: 0, existingCount: 0, rejectedCount: 0, emptyCount: 0, issues: [], fatalError: 'El archivo está vacío.' };
  }

  let rows: string[][];
  try {
    rows = parseCsvRows(cleanSource);
  } catch (error) {
    return { rowsRead: 0, valid: [], duplicateCount: 0, existingCount: 0, rejectedCount: 0, emptyCount: 0, issues: [], fatalError: error instanceof Error ? error.message : 'No fue posible leer el archivo.' };
  }

  const header = rows.shift();
  if (!header || header.length !== 1 || normalizeLabel(header[0]) !== CHECKLIST_IMPORT_HEADER) {
    return { rowsRead: rows.length, valid: [], duplicateCount: 0, existingCount: 0, rejectedCount: rows.length, emptyCount: 0, issues: [], fatalError: `El encabezado debe ser exactamente “${CHECKLIST_IMPORT_HEADER}”.` };
  }

  const issues: ChecklistImportIssue[] = [];
  const valid: string[] = [];
  const existing = new Set(existingLabels.map(normalizeLabel));
  const seen = new Set<string>();
  const dataRows = rows;

  dataRows.forEach((columns, index) => {
    const rowNumber = index + 2;
    const label = (columns[0] || '').trim().replace(/\s+/g, ' ');
    if (columns.length !== 1) {
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
    if (existing.has(normalized)) {
      issues.push({ row: rowNumber, value: label, type: 'existing', message: 'Ya existe en este periodo.' });
      return;
    }
    if (seen.has(normalized)) {
      issues.push({ row: rowNumber, value: label, type: 'duplicate', message: 'Está duplicado dentro del archivo.' });
      return;
    }
    seen.add(normalized);
    valid.push(label);
  });

  if (dataRows.length > CHECKLIST_IMPORT_MAX_ROWS) {
    return {
      rowsRead: dataRows.length, valid: [], duplicateCount: 0, existingCount: 0,
      rejectedCount: dataRows.length, emptyCount: 0, issues: [],
      fatalError: `El archivo excede el máximo de ${CHECKLIST_IMPORT_MAX_ROWS} filas por importación.`
    };
  }

  return {
    rowsRead: dataRows.length,
    valid,
    duplicateCount: issues.filter(issue => issue.type === 'duplicate').length,
    existingCount: issues.filter(issue => issue.type === 'existing').length,
    rejectedCount: issues.filter(issue => issue.type === 'empty' || issue.type === 'invalid').length,
    emptyCount: issues.filter(issue => issue.type === 'empty').length,
    issues,
  };
};

export const createChecklistElement = (label: string): ChecklistElement => ({
  id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  label: label.trim().replace(/\s+/g, ' '),
  targetCount: 1,
  completedCount: 0,
});

export const checklistCsvTemplate = () => '\uFEFFelemento\r\nProspecto 001\r\nProspecto 002\r\nProspecto 003\r\n';
