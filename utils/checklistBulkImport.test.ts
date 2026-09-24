import {
  CHECKLIST_IMPORT_MAX_ROWS,
  createChecklistElement,
  previewChecklistCsv,
} from './checklistBulkImport';

describe('importación masiva de checklist', () => {
  it('acepta un elemento y conserva caracteres habituales', () => {
    const result = previewChecklistCsv('\uFEFFelemento\r\nJosé Álvarez & Asociados\r\n', []);
    expect(result.fatalError).toBeUndefined();
    expect(result.valid).toEqual(['José Álvarez & Asociados']);
  });

  it.each([70, 500])('acepta %i elementos', count => {
    const csv = ['elemento', ...Array.from({ length: count }, (_, index) => `Prospecto ${index + 1}`)].join('\n');
    const result = previewChecklistCsv(csv, []);
    expect(result.rowsRead).toBe(count);
    expect(result.valid).toHaveLength(count);
  });

  it('clasifica duplicados internos, existentes, vacíos e inválidos', () => {
    const result = previewChecklistCsv('elemento\nNuevo\nnuevo\nExistente\n\nValor,Extra', [' existente ']);
    expect(result.valid).toEqual(['Nuevo']);
    expect(result.duplicateCount).toBe(1);
    expect(result.existingCount).toBe(1);
    expect(result.emptyCount).toBe(1);
    expect(result.rejectedCount).toBe(2);
  });

  it('rechaza archivos vacíos, encabezados inválidos y más de 500 filas', () => {
    expect(previewChecklistCsv('', []).fatalError).toMatch(/vacío/i);
    expect(previewChecklistCsv('nombre\nUno', []).fatalError).toMatch(/encabezado/i);
    const oversized = ['elemento', ...Array.from({ length: CHECKLIST_IMPORT_MAX_ROWS + 1 }, (_, index) => `E${index}`)].join('\n');
    expect(previewChecklistCsv(oversized, []).fatalError).toMatch(/excede/i);
  });

  it('crea el mismo modelo canónico de la captura individual', () => {
    const element = createChecklistElement(' Prospecto 001 ');
    expect(element).toEqual(expect.objectContaining({ label: 'Prospecto 001', targetCount: 1, completedCount: 0 }));
    expect(element.id).toMatch(/^act-/);
  });

  it('una segunda importación detecta todos los elementos como existentes', () => {
    const csv = 'elemento\nUno\nDos';
    const first = previewChecklistCsv(csv, []);
    const second = previewChecklistCsv(csv, first.valid);
    expect(second.valid).toHaveLength(0);
    expect(second.existingCount).toBe(2);
  });
});
