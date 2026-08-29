import fs from 'fs';

describe('uncertified feature visibility', () => {
  it('hides IA audit and PPTX entry points while preserving Excel export', () => {
    const dashboardView = fs.readFileSync('components/DashboardView.tsx', 'utf8');
    const reportCenter = fs.readFileSync('components/ReportCenter.tsx', 'utf8');
    expect(dashboardView).toContain('{false && <button');
    expect(dashboardView).toContain('{false && (isGlobalAdmin || currentUser.canExportPPT)');
    expect(reportCenter).toContain("{false && (user.globalRole === 'Admin' || user.canExportPPT)");
    expect(dashboardView).toContain('Exportar Excel');
    expect(dashboardView).toContain('handleExportExecutiveExcelJS');
  });
});
