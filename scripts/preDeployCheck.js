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

// 3. Guardia de Seguridad Multiapp (BLOCK_DEPLOY_IF_SITE_MISMATCH)
const firebaseConfigPath = path.resolve('firebase.json');
const firebasercPath = path.resolve('.firebaserc');

if (!fs.existsSync(firebaseConfigPath) || !fs.existsSync(firebasercPath)) {
  console.error("🚨 ERROR CRÍTICO: Falta la configuración de Firebase en el entorno de trabajo.");
  process.exit(1);
}

const firebaseJson = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
const firebaserc = JSON.parse(fs.readFileSync(firebasercPath, 'utf8'));

// Validar que el hosting target sea exactamente 'tablero' y apunte a 'build_output'
const hostingConfig = firebaseJson.hosting;
if (!hostingConfig || hostingConfig.target !== 'tablero' || hostingConfig.public !== 'build_output') {
  console.error("🚨 ERROR [BLOCK_DEPLOY_IF_SITE_MISMATCH]: Estructura de Hosting ambigua o inválida.");
  console.error("   Se esperaba target: 'tablero' y public: 'build_output'. Despliegue abortado para seguridad.");
  process.exit(1);
}

// Validar que en .firebaserc el target 'tablero' apunte exclusivamente a 'prior-01'
const activeProject = firebaserc.projects.default;
const targetsConfig = firebaserc.targets;
if (activeProject !== 'prior-01') {
  console.error(`🚨 ERROR [BLOCK_DEPLOY_IF_SITE_MISMATCH]: Proyecto activo incorrecto (${activeProject}). Se requiere 'prior-01'.`);
  process.exit(1);
}

const targetMapping = targetsConfig?.['prior-01']?.hosting?.tablero;
if (!targetMapping || targetMapping.length !== 1 || targetMapping[0] !== 'prior-01') {
  console.error("🚨 ERROR [BLOCK_DEPLOY_IF_SITE_MISMATCH]: Asociación cruzada de hosting detectada.");
  console.error("   El target 'tablero' debe mapear única y exclusivamente a 'prior-01' en .firebaserc.");
  process.exit(1);
}

console.log("✅ GUARDIA DE ASOCIACIÓN MULTIAPP: Validada (Sin discrepancias de targets/sitios).");
console.log("✅ IDENTIDAD Y VERSIÓN VERIFICADAS. Blindaje de seguridad activo.");
process.exit(0);
