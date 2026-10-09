import type { ControlCut } from '../types/controlCut';
import type { ControlCutComparisonResult } from './controlCutComparison';
import {
  createControlCutDocumentSections,
  createControlCutComparisonDocumentSections,
} from './controlCutDocumentModel';
import { renderSectionsToPdf } from './controlExecutiveReportPdf';
import { renderSectionsToDocx } from './controlExecutiveReportDocx';
import { Packer } from 'docx';

export type ControlCutExportFormat = 'pdf' | 'docx';

export const controlCutReportFilename = (
  cut: ControlCut,
  format: ControlCutExportFormat,
): string => {
  const period =
    cut.periodicity === 'monthly'
      ? `${cut.year}-${String(cut.periodIndex + 1).padStart(2, '0')}`
      : `${cut.year}-S${String(cut.periodIndex).padStart(2, '0')}`;
  const client =
    cut.clientId.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') ||
    'cliente';
  return `corte_CONTROL_${client}_${cut.dashboardId}_${period}.${format}`;
};

export const controlCutComparisonReportFilename = (
  comparison: ControlCutComparisonResult,
  format: ControlCutExportFormat,
): string => {
  const periodA =
    comparison.periodicity === 'monthly'
      ? `${comparison.cutA.year}-${String(comparison.cutA.periodIndex + 1).padStart(2, '0')}`
      : `${comparison.cutA.year}-S${String(comparison.cutA.periodIndex).padStart(2, '0')}`;
  const periodB =
    comparison.periodicity === 'monthly'
      ? `${comparison.cutB.year}-${String(comparison.cutB.periodIndex + 1).padStart(2, '0')}`
      : `${comparison.cutB.year}-S${String(comparison.cutB.periodIndex).padStart(2, '0')}`;
  const client =
    comparison.clientId.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') ||
    'cliente';
  return `comparativa_cortes_CONTROL_${client}_${comparison.dashboardId}_${periodA}_vs_${periodB}.${format}`;
};

export const exportControlCutReport = async (
  cut: ControlCut,
  format: ControlCutExportFormat,
  saveFn?: (blob: Blob, filename: string) => void,
): Promise<{ blob: Blob; filename: string }> => {
  const sections = createControlCutDocumentSections(cut);
  const filename = controlCutReportFilename(cut, format);
  let blob: Blob;

  if (format === 'pdf') {
    const pdfDoc = renderSectionsToPdf(sections, cut.clientId, 'CONTROL · Corte Histórico Certificado');
    blob = pdfDoc.output('blob');
  } else {
    const docxDoc = renderSectionsToDocx(sections, cut.clientId, 'CONTROL · Corte Histórico Certificado');
    blob = await Packer.toBlob(docxDoc);
  }

  if (saveFn) {
    saveFn(blob, filename);
  } else if (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  ) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return { blob, filename };
};

export const exportControlCutComparisonReport = async (
  comparison: ControlCutComparisonResult,
  format: ControlCutExportFormat,
  saveFn?: (blob: Blob, filename: string) => void,
): Promise<{ blob: Blob; filename: string }> => {
  const sections = createControlCutComparisonDocumentSections(comparison);
  const filename = controlCutComparisonReportFilename(comparison, format);
  let blob: Blob;

  if (format === 'pdf') {
    const pdfDoc = renderSectionsToPdf(
      sections,
      comparison.clientId,
      'CONTROL · Comparativa A/B Certificada',
    );
    blob = pdfDoc.output('blob');
  } else {
    const docxDoc = renderSectionsToDocx(
      sections,
      comparison.clientId,
      'CONTROL · Comparativa A/B Certificada',
    );
    blob = await Packer.toBlob(docxDoc);
  }

  if (saveFn) {
    saveFn(blob, filename);
  } else if (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  ) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return { blob, filename };
};
