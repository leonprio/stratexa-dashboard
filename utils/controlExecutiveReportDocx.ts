import {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, PageNumber, Packer,
  Paragraph, Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType,
} from 'docx';
import type { ControlExecutiveReport } from './controlExecutiveReport';
import { controlReportColumnPercentages, createControlExecutiveReportDocumentSections } from './controlExecutiveReportDocumentModel';

const NAVY = '0F2B41';
const DARK = '0F172A';
const SLATE = '475569';
const PAGE_WIDTH = 11906;
const MARGIN = 794; // 14 mm; the grid and cell widths share the exact writable width.
const TABLE_WIDTH = PAGE_WIDTH - MARGIN * 2;

const cell = (text: string, width: number, header: boolean, stripe: boolean): TableCell => new TableCell({
  width: { size: width, type: WidthType.DXA },
  shading: { fill: header ? NAVY : stripe ? 'F5F8FB' : 'FFFFFF' },
  margins: { top: 50, bottom: 50, left: 85, right: 85 },
  children: text.split('\n').map((line) => new Paragraph({
    keepNext: header,
    keepLines: true,
    spacing: { before: 0, after: 0, line: 240 },
    children: [new TextRun({ text: line, color: header ? 'FFFFFF' : DARK, bold: header, size: header ? 16 : 17 })],
  })),
});

const buildTable = (headers: string[], rows: string[][]): Table => {
  const widths = controlReportColumnPercentages(headers).map(percent => Math.floor(TABLE_WIDTH * percent / 100));
  widths[widths.length - 1] += TABLE_WIDTH - widths.reduce((sum, width) => sum + width, 0);
  return new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'DCE3EA' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'DCE3EA' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((text, index) => cell(text, widths[index], true, false)) }),
      ...rows.map((row, rowIndex) => new TableRow({ cantSplit: true, children: row.map((text, index) => cell(text, widths[index], false, rowIndex % 2 === 1)) })),
    ],
  });
};

/** Editable A4 document; Word paginates actual content using keep and row constraints. */
export const createControlExecutiveReportDocx = (report: ControlExecutiveReport): Document => {
  const children: Array<Paragraph | Table> = [];
  createControlExecutiveReportDocumentSections(report).forEach((section, index) => {
    children.push(new Paragraph({
      text: section.title,
      heading: index === 0 ? HeadingLevel.TITLE : HeadingLevel.HEADING_1,
      keepNext: true,
      keepLines: true,
      spacing: { before: index ? 140 : 0, after: 70 },
    }));
    section.lines?.forEach(line => children.push(new Paragraph({
      children: [new TextRun({ text: line, color: SLATE, size: 19 })],
      keepLines: true,
      widowControl: true,
      spacing: { after: 50, line: 250 },
    })));
    section.tables?.forEach(entry => children.push(buildTable(entry.headers, entry.rows)));
  });
  return new Document({
    styles: {
      default: {
        document: { run: { font: 'Arial', size: 19, color: DARK }, paragraph: { spacing: { after: 0 }, widowControl: true } },
        title: { run: { font: 'Arial', size: 36, bold: true, color: DARK }, paragraph: { keepNext: true } },
        heading1: { run: { font: 'Arial', size: 22, bold: true, color: NAVY }, paragraph: { keepNext: true } },
      },
    },
    sections: [{
      properties: { page: {
        size: { width: PAGE_WIDTH, height: 16838 },
        margin: { top: 1134, bottom: 907, left: MARGIN, right: MARGIN, header: 425, footer: 425 },
      } },
      headers: { default: new Header({ children: [new Paragraph({
        children: [new TextRun({ text: 'CONTROL · Informe ejecutivo', color: NAVY, size: 16, bold: true })],
      })] }) },
      footers: { default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: `${report.cover.client} · Página `, color: SLATE, size: 16 }),
          new TextRun({ children: [PageNumber.CURRENT], color: SLATE, size: 16 }),
          new TextRun({ text: ' de ', color: SLATE, size: 16 }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], color: SLATE, size: 16 }),
        ],
      })] }) },
      children,
    }],
  });
};

export const renderControlExecutiveReportDocx = async (report: ControlExecutiveReport): Promise<Blob> =>
  Packer.toBlob(createControlExecutiveReportDocx(report));
