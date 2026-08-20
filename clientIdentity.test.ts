import { generateSafeClientId } from './utils/formatters';

describe('General Client Identity Model (v9.5.2)', () => {
  it('1. "IPS DIRECCIÓN" generates a safe technical ID "IPS_DIRECCION"', () => {
    const techId = generateSafeClientId('IPS DIRECCIÓN');
    expect(techId).toBe('IPS_DIRECCION');
  });

  it('2. "ACME MÉXICO" generates a safe technical ID "ACME_MEXICO"', () => {
    const techId = generateSafeClientId('ACME MÉXICO');
    expect(techId).toBe('ACME_MEXICO');
  });

  it('3. accents/diacritics are removed from technical ID', () => {
    const techId = generateSafeClientId('ORGANIZACIÓN ÉLITE Y NUTRICIÓN');
    expect(techId).toBe('ORGANIZACION_ELITE_Y_NUTRICION');
  });

  it('4. spaces do not remain in technical ID', () => {
    const techId = generateSafeClientId('CEMENTOS  SIGMA   NORTES');
    expect(techId).not.toContain(' ');
    expect(techId).toBe('CEMENTOS_SIGMA_NORTES');
  });

  it('5. unsafe punctuation and special characters are removed', () => {
    const techId = generateSafeClientId('RED CROP + [PP]! @2026');
    expect(techId).toBe('RED_CROP_PP_2026');
  });

  it('6. collision detection prevents tenant overwrite by generating unique suffixes', () => {
    const existing = ['IPS_DIRECCION', 'IPS_DIRECCION_2'];
    const techId = generateSafeClientId('IPS DIRECCIÓN', existing);
    expect(techId).toBe('IPS_DIRECCION_3');
  });

  it('7. existing safe IDs remain unchanged when normalized', () => {
    expect(generateSafeClientId('LVP')).toBe('LVP');
    expect(generateSafeClientId('IPS')).toBe('IPS');
    expect(generateSafeClientId('REGIONES')).toBe('REGIONES');
    expect(generateSafeClientId('WELOVE')).toBe('WELOVE');
  });

  it('8. empty or whitespace inputs fallback cleanly', () => {
    expect(generateSafeClientId('')).toBe('CLIENT_NEW');
    expect(generateSafeClientId('   ')).toBe('CLIENT_NEW');
  });

  it('9. technical ID length is capped at <= 50 characters to stay within Firestore 64-char limit', () => {
    const longName = 'ESTA ES UNA ORGANIZACION CON UN NOMBRE EXTREMADAMENTE LARGO QUE EXCEDE LOS LIMITES';
    const techId = generateSafeClientId(longName);
    expect(techId.length).toBeLessThanOrEqual(50);
    expect(techId.slice(-1)).not.toBe('_');
  });
});
