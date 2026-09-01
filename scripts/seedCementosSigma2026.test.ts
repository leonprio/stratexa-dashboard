import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(__dirname, 'seedCementosSigma2026.cjs'), 'utf8');

describe('CEMENTOS SIGMA 2026 seed contract', () => {
  it('is explicit, deterministic, and write-gated', () => {
    expect(source).toContain("const CLIENT_ID = 'CEMENTOS_SIGMA'");
    expect(source).toContain('const SOURCE_YEAR = 2025');
    expect(source).toContain('const TARGET_YEAR = 2026');
    expect(source).toContain("const execute = process.argv.includes('--execute')");
    expect(source).toContain('SIGMA_2026_NON_SCENARIO_DATA_PRESENT');
    expect(source).toContain('operational2025Writes: 0');
    expect(source).not.toMatch(/Math\.random|Date\.now\(\)/);
  });

  it('contains the certified Sigma scenario shape and KPI profiles', () => {
    expect(source).toContain("source.length !== 3");
    expect(source).toContain("!== 9");
    expect(source).toContain("['FINANCIERA'");
    expect(source).toContain("['CLIENTE'");
    expect(source).toContain("['PROCESOS_INTERNOS'");
    expect(source).toContain("['APRENDIZAJE_CRECIMIENTO'");
    expect(source).toContain('Incrementar el crecimiento rentable');
    expect(source).toContain('Fortalecer la retención');
    expect(source).toContain('Optimizar la gestión de inventarios');
    expect(source).toContain('displayCode: `OC${code}${String(seq).padStart(2, \'0\')}`');
    expect(source).toContain("['COMV'");
    expect(source).toContain("['LOGT'");
    expect(source).toContain("['OPAL'");
    expect(source).toContain("'COSTO DE FLETE POR TONELADA': [78, 82, 85, 89, 93, 96, 99, 102]");
    expect(source).toContain("'DÍAS SIN ACCIDENTES INCIDENTES': [100, 100, null, 100, 100, null, 100, 100]");
    expect(source).toContain('strategicAssignments: 0');
    expect(source).toContain('causeEffectRelationships: 0');
  });
});
