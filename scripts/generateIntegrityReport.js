// generateIntegrityReport.js
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run(command) {
    try {
        return execSync(command, { stdio: 'pipe', encoding: 'utf-8' });
    } catch (e) {
        return (e.stdout || '') + '\n' + (e.stderr || '');
    }
}

const reportLines = [];
reportLines.push('# Informe de Integridad');
reportLines.push('');

// Lint
reportLines.push('## Lint');
const lintOutput = run('npx eslint .');
reportLines.push('```');
reportLines.push(lintOutput.trim() || 'No errors found');
reportLines.push('```');
reportLines.push('');

// TypeScript check
reportLines.push('## TypeScript Check');
const tsOutput = run('npx tsc --noEmit');
reportLines.push('```');
reportLines.push(tsOutput.trim() || 'No type errors found');
reportLines.push('```');
reportLines.push('');

// Tests with coverage
reportLines.push('## Pruebas Unitarias');
const testOutput = run('npm test -- --coverage');
reportLines.push('```');
reportLines.push(testOutput.trim() || 'No tests run or errors');
reportLines.push('```');
reportLines.push('');

// Manual Logic Verification (from ANALISIS_INTEGRIDAD_2026.md)
reportLines.push('## Verificación de Lógica (Manual Check)');
const appPath = path.resolve(__dirname, '..', 'App.tsx');
const importerPath = path.resolve(__dirname, '..', 'components/DataImporter.tsx');

if (fs.existsSync(appPath) && fs.existsSync(importerPath)) {
    const appContent = fs.readFileSync(appPath, 'utf-8');
    const importerContent = fs.readFileSync(importerPath, 'utf-8');

    const checks = [
        { name: 'Selected Year is Dynamic', pass: appContent.includes('new Date().getFullYear()') },
        { name: 'Importer validates Year', pass: importerContent.includes('selectedYear') && importerContent.includes('.year') },
        { name: 'New Dashboards assign Year', pass: appContent.includes('year: selectedYear') }
    ];

    checks.forEach(check => {
        reportLines.push(`- [${check.pass ? 'x' : ' '}] ${check.name}: ${check.pass ? '✅' : '❌'}`);
    });
} else {
    reportLines.push('⚠️ No se encontraron los archivos críticos para la validación manual.');
}
reportLines.push('');

// Write report
const reportPath = path.resolve(__dirname, '..', 'integrity_report.md');
fs.writeFileSync(reportPath, reportLines.join('\n'));
console.log('Informe generado en', reportPath);
