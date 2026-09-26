// The UMD build is shared by the browser and the repository's Jest runtime.
import { jsPDF } from 'jspdf/dist/jspdf.umd.min.js';
import type { ControlExecutiveReport } from './controlExecutiveReport';
import { controlReportColumnPercentages, createControlExecutiveReportDocumentSections } from './controlExecutiveReportDocumentModel';

const navy = [15, 43, 65] as const;
const slate = [71, 85, 105] as const;
const margin = { left: 14, right: 14, top: 20, bottom: 16 };
const lineHeight = 3.7;
const padding = 1.8;
const bodySize = 8.5;
type MeasuredRow = { cells: string[][]; height: number };

/** A4 composition measured with the actual font before choosing any page break. */
export const createControlExecutiveReportPdf = (report: ControlExecutiveReport): jsPDF => {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: false });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const width = pageW - margin.left - margin.right;
  const bottom = pageH - margin.bottom;
  let y = margin.top;
  const font = (size: number, bold = false) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
  };
  const wrap = (text: string, available: number) => pdf.splitTextToSize(text, available) as string[];
  const nextPage = () => { pdf.addPage(); y = margin.top; };
  const ensureSpace = (height: number) => {
    if (y > margin.top && y + height > bottom) nextPage();
  };
  const measure = (row: string[], widths: number[], header = false): MeasuredRow => {
    font(header ? 8 : bodySize, header);
    const cells = row.map((text, index) => wrap(text, widths[index] - padding * 2));
    return { cells, height: Math.max(1, ...cells.map(cell => cell.length)) * lineHeight + padding * 2 };
  };
  const drawRow = (row: MeasuredRow, widths: number[], header: boolean, stripe = false) => {
    if (header) pdf.setFillColor(...navy);
    else pdf.setFillColor(stripe ? 245 : 255, stripe ? 248 : 255, stripe ? 251 : 255);
    pdf.rect(margin.left, y, width, row.height, 'F');
    font(header ? 8 : bodySize, header);
    if (header) pdf.setTextColor(255, 255, 255);
    else pdf.setTextColor(15, 23, 42);
    let x = margin.left;
    row.cells.forEach((lines, index) => {
      // Explicit baselines match measurement; jsPDF's default line-height varies with font size.
      lines.forEach((line, lineIndex) => pdf.text(line, x + padding, y + padding + 2.7 + lineIndex * lineHeight));
      x += widths[index];
    });
    y += row.height;
    pdf.setDrawColor(220, 227, 234);
    pdf.line(margin.left, y, pageW - margin.right, y);
  };

  createControlExecutiveReportDocumentSections(report).forEach((section, index) => {
    const titleSize = index ? 11 : 18;
    const titleLineHeight = index ? 4.5 : 7;
    font(titleSize, true);
    const title = wrap(section.title, width);
    const titleHeight = title.length * titleLineHeight + 2;
    font(9.5);
    const paragraphs = (section.lines || []).map(line => wrap(line, width));
    const paragraphHeight = (lines: string[]) => lines.length * 4.3 + 1.5;
    const tables = (section.tables || []).map(table => {
      const widths = controlReportColumnPercentages(table.headers).map(percent => width * percent / 100);
      return { widths, header: measure(table.headers, widths, true), rows: table.rows.map(row => measure(row, widths)) };
    });
    const firstTable = tables[0];
    const immediate = paragraphs.length ? paragraphHeight(paragraphs[0]) : firstTable ? firstTable.header.height + (firstTable.rows[0]?.height || 0) : 0;
    const sectionHeight = titleHeight + paragraphs.reduce((sum, lines) => sum + paragraphHeight(lines), 0) + tables.reduce((sum, table) => sum + table.header.height + table.rows.reduce((height, row) => height + row.height, 0) + 2, 0);
    // Small sections (e.g. a plan) stay together when they fit on one page.
    ensureSpace(sectionHeight < 65 ? sectionHeight : titleHeight + immediate);
    font(titleSize, true);
    pdf.setTextColor(...navy);
    title.forEach((line, lineIndex) => pdf.text(line, margin.left, y + 4.8 + lineIndex * titleLineHeight));
    y += titleHeight;
    paragraphs.forEach(lines => {
      lines.forEach(line => {
        ensureSpace(4.3);
        font(9.5);
        pdf.setTextColor(...slate);
        pdf.text(line, margin.left, y + 3.2);
        y += 4.3;
      });
      y += 1.5;
    });
    tables.forEach(table => {
      ensureSpace(table.header.height + (table.rows[0]?.height || 0));
      drawRow(table.header, table.widths, true);
      table.rows.forEach((row, rowIndex) => {
        const capacity = bottom - margin.top - table.header.height;
        if (y + row.height > bottom && row.height <= capacity) {
          nextPage();
          drawRow(table.header, table.widths, true);
        }
        // Only a row taller than a whole writable page can split; no text is clipped or discarded.
        if (row.height > capacity) {
          let offset = 0;
          const totalLines = Math.max(...row.cells.map(cell => cell.length));
          while (offset < totalLines) {
            let availableLines = Math.floor((bottom - y - padding * 2) / lineHeight);
            if (availableLines < 1) {
              nextPage(); drawRow(table.header, table.widths, true);
              availableLines = Math.floor((bottom - y - padding * 2) / lineHeight);
            }
            const take = Math.min(availableLines, totalLines - offset);
            drawRow({ cells: row.cells.map(cell => cell.slice(offset, offset + take)), height: take * lineHeight + padding * 2 }, table.widths, false, rowIndex % 2 === 1);
            offset += take;
          }
        } else drawRow(row, table.widths, false, rowIndex % 2 === 1);
      });
      y += 2;
    });
    y += 3;
  });

  // Running furniture is added last, so page totals are accurate.
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    font(8, true);
    pdf.setTextColor(...navy);
    pdf.text('CONTROL · Informe ejecutivo', margin.left, 10);
    pdf.setDrawColor(203, 213, 225);
    pdf.line(margin.left, 13, pageW - margin.right, 13);
    font(8);
    pdf.setTextColor(...slate);
    pdf.text(wrap(report.cover.client, width - 40)[0], margin.left, pageH - 8);
    pdf.text(`Página ${page} de ${pages}`, pageW - margin.right, pageH - 8, { align: 'right' });
  }
  return pdf;
};

export const renderControlExecutiveReportPdf = (report: ControlExecutiveReport): Blob =>
  createControlExecutiveReportPdf(report).output('blob');
