import { strategyService } from './services/strategyService';
import {
  formatOCCode,
  formatOECode,
  normalizeObjectiveCodeForComparison,
  parseObjectiveCodeSequence
} from './strategyTypes';

const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockRunTransaction = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, name) => ({ id: name })),
  doc: jest.fn((_db, collection, id) => ({ collection, id })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: jest.fn(ref => ref),
  where: jest.fn(),
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  setDoc: jest.fn(),
  deleteDoc: jest.fn(),
  writeBatch: jest.fn()
}));

jest.mock('./firebase', () => ({ db: {} }));

const snapshot = (data?: Record<string, unknown>) => ({
  exists: () => Boolean(data),
  data: () => data
});

const docsSnapshot = (rows: Record<string, unknown>[] = []) => ({
  empty: rows.length === 0,
  docs: rows.map((row, index) => ({ id: String(row.id || index), data: () => row }))
});

const installTransaction = (objective: Record<string, unknown>, counter: Record<string, unknown>) => {
  const tx = { get: jest.fn(), set: jest.fn(), delete: jest.fn() };
  tx.get.mockResolvedValueOnce(snapshot(objective)).mockResolvedValueOnce(snapshot(counter));
  mockRunTransaction.mockImplementation(async (_db, callback) => callback(tx));
  return tx;
};

describe('strategy counter safe rollback', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['OE01', 'OE01'],
    ['OE 01', 'OE01'],
    ['oe-01', 'OE01'],
    ['OC01', 'OC01'],
    ['OCV01', 'OCV01'],
    ['OCF01', 'OCF01']
  ])('canonicalizes %s and %s to one logical code', (legacy, canonical) => {
    expect(normalizeObjectiveCodeForComparison(legacy)).toBe(canonical);
    expect(parseObjectiveCodeSequence(legacy)).toBe(1);
  });

  it('always emits canonical no-hyphen objective codes', () => {
    expect(formatOECode(1)).toBe('OE01');
    expect(formatOCCode('', 1)).toBe('OC01');
    expect(formatOCCode('V', 1)).toBe('OCV01');
    expect(formatOCCode('F', 1)).toBe('OCF01');
  });

  it('atomically deletes the last OE and decrements its counter', async () => {
    mockGetDoc.mockResolvedValue(snapshot({ id: 'oe3', clientId: 'LEÓN', code: 'OE03' }));
    mockGetDocs.mockResolvedValueOnce(docsSnapshot()).mockResolvedValueOnce(docsSnapshot());
    const tx = installTransaction(
      { id: 'oe3', clientId: 'LEÓN', code: 'OE03' },
      { id: 'cnt_LEÓN_OE', clientId: 'LEÓN', lastIssuedSequence: 3 }
    );

    await strategyService.deleteStrategicObjective('oe3', 'LEÓN');

    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cnt_LEÓN_OE' }),
      expect.objectContaining({ lastIssuedSequence: 2 }),
      { merge: true }
    );
    expect(tx.delete).toHaveBeenCalledWith(expect.objectContaining({ id: 'oe3' }));
  });

  it('deletes an intermediate OE without changing the counter', async () => {
    mockGetDoc.mockResolvedValue(snapshot({ id: 'oe2', clientId: 'LEÓN', code: 'OE02' }));
    mockGetDocs.mockResolvedValueOnce(docsSnapshot()).mockResolvedValueOnce(docsSnapshot());
    const tx = installTransaction(
      { id: 'oe2', clientId: 'LEÓN', code: 'OE02' },
      { lastIssuedSequence: 3 }
    );

    await strategyService.deleteStrategicObjective('oe2', 'LEÓN');

    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.delete).toHaveBeenCalledTimes(1);
  });

  it('reuses the released last OE sequence on the next creation without duplicating a code', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    const tx = { get: jest.fn().mockResolvedValue(snapshot({ lastIssuedSequence: 2 })), set: jest.fn(), delete: jest.fn() };
    mockRunTransaction.mockImplementation(async (_db, callback) => callback(tx));

    const created = await strategyService.saveStrategicObjective({
      clientId: 'LEÓN',
      perspectiveId: 'FINANCIERA',
      code: '',
      title: 'Nuevo objetivo',
      order: 3
    });

    expect(created.code).toBe('OE03');
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cnt_LEÓN_OE' }),
      expect.objectContaining({ lastIssuedSequence: 3 }),
      { merge: true }
    );
  });

  it('skips a legacy OE-01 even when the counter is absent or stale', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'legacy', data: () => ({ id: 'legacy', clientId: 'LEÓN', code: 'OE-01', perspectiveId: 'FIN' }) }]
    });
    const tx = { get: jest.fn().mockResolvedValue({ exists: () => false }), set: jest.fn(), delete: jest.fn() };
    mockRunTransaction.mockImplementation(async (_db, callback) => callback(tx));

    const created = await strategyService.saveStrategicObjective({
      clientId: 'LEÓN', perspectiveId: 'FIN', code: '', title: 'Siguiente', order: 2
    });

    expect(created.code).toBe('OE02');
  });

  it('blocks OE deletion when a contribution objective depends on it', async () => {
    mockGetDoc.mockResolvedValue(snapshot({ id: 'oe3', clientId: 'LEÓN', code: 'OE03' }));
    mockGetDocs
      .mockResolvedValueOnce(docsSnapshot())
      .mockResolvedValueOnce(docsSnapshot([{ primaryStrategicObjectiveId: 'oe3' }]));

    await expect(strategyService.deleteStrategicObjective('oe3', 'LEÓN'))
      .rejects.toThrow('objetivos de contribución vinculados');
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it('returns the first general OC sequence to zero', async () => {
    mockGetDoc.mockResolvedValue(snapshot({
      id: 'oc1', clientId: 'LEÓN', sequenceNumber: 1, areaName: 'GENERAL'
    }));
    mockGetDocs.mockResolvedValue(docsSnapshot());
    const tx = installTransaction(
      { id: 'oc1', clientId: 'LEÓN', sequenceNumber: 1, areaName: 'GENERAL' },
      { lastIssuedSequence: 1 }
    );

    await strategyService.deleteContributionObjective('oc1', 'LEÓN');

    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cnt_LEÓN_OC_GENERAL' }),
      expect.objectContaining({ lastIssuedSequence: 0 }),
      { merge: true }
    );
  });

  it('uses the independent area counter when deleting an area OC', async () => {
    mockGetDoc.mockResolvedValue(snapshot({
      id: 'ocv2', clientId: 'LEÓN', sequenceNumber: 2, areaConfigId: 'ventas'
    }));
    mockGetDocs.mockResolvedValue(docsSnapshot());
    const tx = installTransaction(
      { id: 'ocv2', clientId: 'LEÓN', sequenceNumber: 2, areaConfigId: 'ventas' },
      { lastIssuedSequence: 2 }
    );

    await strategyService.deleteContributionObjective('ocv2', 'LEÓN');

    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cnt_LEÓN_OC_ventas' }),
      expect.objectContaining({ lastIssuedSequence: 1 }),
      { merge: true }
    );
  });

  it('blocks OC deletion and counter release while assignments exist', async () => {
    mockGetDoc.mockResolvedValue(snapshot({ id: 'oc1', clientId: 'LEÓN', sequenceNumber: 1 }));
    mockGetDocs.mockResolvedValue(docsSnapshot([{ contributionObjectiveId: 'oc1' }]));

    await expect(strategyService.deleteContributionObjective('oc1', 'LEÓN'))
      .rejects.toThrow('indicadores asignados');
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it('repairs only the dependency-free latest OE and preserves its document id', async () => {
    mockGetDocs
      .mockResolvedValueOnce(docsSnapshot([
        { id: 'oe1', clientId: 'LEÓN', code: 'OE01' },
        { id: 'oe3', clientId: 'LEÓN', code: 'OE03' }
      ]))
      .mockResolvedValueOnce(docsSnapshot())
      .mockResolvedValueOnce(docsSnapshot());
    const tx = installTransaction(
      { id: 'oe3', clientId: 'LEÓN', code: 'OE03', title: 'Último' },
      { id: 'cnt_LEÓN_OE', clientId: 'LEÓN', lastIssuedSequence: 3 }
    );

    const repaired = await strategyService.repairLatestStrategicObjectiveGap('oe3', 3, 2, 'LEÓN');

    expect(repaired).toEqual(expect.objectContaining({ id: 'oe3', code: 'OE02' }));
    expect(tx.set).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: 'oe3' }),
      expect.objectContaining({ id: 'oe3', code: 'OE02' }),
      { merge: true }
    );
    expect(tx.set).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: 'cnt_LEÓN_OE' }),
      expect.objectContaining({ lastIssuedSequence: 2 }),
      { merge: true }
    );
  });

  it('assigns OE03 to a distinct OE-01 legacy record while preserving its identity and counter', async () => {
    mockGetDocs
      .mockResolvedValueOnce(docsSnapshot([
        { id: 'oe1', clientId: 'LEÓN', code: 'OE01', title: 'Primero' },
        { id: 'oe2', clientId: 'LEÓN', code: 'OE02', title: 'Segundo' },
        { id: 'legacy-id', clientId: 'LEÓN', code: 'OE-01', title: 'Optimizar embudo', createdAt: '2026-01-03' }
      ]));
    const tx = { get: jest.fn().mockResolvedValue(snapshot({ lastIssuedSequence: 2 })), set: jest.fn(), delete: jest.fn() };
    mockGetDocs.mockResolvedValueOnce(docsSnapshot()).mockResolvedValueOnce(docsSnapshot());
    mockRunTransaction.mockImplementation(async (_db, callback) => callback(tx));

    const result = await strategyService.repairLegacyStrategicObjectiveCodes('LEÓN');

    expect(result.codes).toEqual({ 'legacy-id': 'OE03' });
    expect(result.counter).toBe(3);
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'legacy-id' }),
      expect.objectContaining({ id: 'legacy-id', code: 'OE03', title: 'Optimizar embudo' }),
      { merge: true }
    );
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cnt_LEÓN_OE' }),
      expect.objectContaining({ lastIssuedSequence: 3 }),
      { merge: true }
    );
  });
});
