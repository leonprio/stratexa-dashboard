import fs from 'fs';
import path from 'path';

const packageJsonPath = path.resolve('package.json');
const appTsxPath = path.resolve('App.tsx');

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const appTsxContent = fs.readFileSync(appTsxPath, 'utf8');
const indexHtmlPath = path.resolve('index.html');
const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

const versionInPackage = packageJson.version;
const versionMatch = appTsxContent.match(/const VERSION_LABEL = "v([\d\.]+).*?";/);

if (!versionMatch) {
  console.error("❌ ERROR: No se encontró VERSION_LABEL en App.tsx");
  process.exit(1);
}

const versionInApp = versionMatch[1];

console.log(`🛡️ Iniciando Auditoría de Seguridad de Despliegue...`);
console.log(`   - Versión Package.json: ${versionInPackage}`);
console.log(`   - Versión App.tsx: ${versionInApp}`);

// 1. Verificación de Integridad de Versión
if (versionInPackage !== versionInApp) {
  console.error("❌ ERROR: Discrepancia de versiones detectada. El blindaje ha fallado.");
  console.error(`   Sincroniza App.tsx (${versionInApp}) con package.json (${versionInPackage}) antes de desplegar.`);
  process.exit(1);
}

// 2. Verificación de Identidad de Aplicación (Blindaje de Target)
const expectedTitle = "Tablero Prior - Business Intelligence";
if (!indexHtmlContent.includes(expectedTitle)) {
  console.error("🚨 ALERTA CRÍTICA: El archivo index.html NO corresponde a la aplicación TABLERO.");
  console.error(`   Se esperaba el título: "${expectedTitle}"`);
  process.exit(1);
}

const appIdentityMatch = appTsxContent.includes("Stratexa Dashboard");
if (!appIdentityMatch) {
  console.error("🚨 ALERTA CRÍTICA: El código en App.tsx NO tiene la firma de identidad de 'Stratexa Dashboard'.");
  process.exit(1);
}

console.log("✅ IDENTIDAD Y VERSIÓN VERIFICADAS. Blindaje de seguridad activo.");
process.exit(0);
