/** @jest-environment node */
import { firebaseService } from './firebaseService';
import { buildControlCutSnapshot } from '../utils/controlCutBuilder';
import type { ControlCut } from '../types/controlCut';

jest.mock('../firebase', () => ({ db: {} }));

const mockDocuments = new Map<string, any>();

jest.mock('firebase/firestore', () => {
  return {
    collection: (_db: unknown, ...parts: string[]) => ({ path: parts.join('/') }),
    doc: (_db: unknown, ...parts: string[]) => ({ path: parts.join('/') }),
    getDoc: jest.fn(async (ref: { path: string }) => ({
      exists: () => mockDocuments.has(ref.path),
      data: () => mockDocuments.get(ref.path),
    })),
    getDocs: jest.fn(async (q: any) => {
      const docs = Array.from(mockDocuments.entries())
        .filter(([path]) => path.startsWith('tbl_controlCuts/'))
        .map(([id, data]) => ({ id, data: () => data }));
      return { docs, size: docs.length };
    }),
    query: jest.fn((col: any) => col),
    where: jest.fn(),
    setDoc: jest.fn(async (ref: { path: string }, data: any) => {
      mockDocuments.set(ref.path, data);
    }),
    runTransaction: jest.fn(async (_db: unknown, work: (tx: any) => Promise<any>) => {
      const tx = {
        get: async (ref: { path: string }) => ({
          exists: () => mockDocuments.has(ref.path),
          data: () => mockDocuments.get(ref.path),
        }),
        set: (ref: { path: string }, data: any) => {
          mockDocuments.set(ref.path, data);
        },
      };
      return await work(tx);
    }),
  };
});

describe('ControlCut Persistence Tests', () => {
  beforeEach(() => {
    mockDocuments.clear();
  });

  const testCut = buildControlCutSnapshot({
    clientId: 'IPS',
    dashboardId: 'board-1',
    periodicity: 'monthly',
    year: 2026,
    periodIndex: 3,
    capturedByUserId: 'usr-1',
    capturedByLabel: 'Editor User',
    kpis: [],
    controlSummary: {
      pendingConfigurationsCount: 0,
      pendingCapturesCount: 0,
      overdueActionsCount: 0,
      upcomingActionsCount: 0,
      activeActionsCount: 0,
      completedActionsCount: 0,
      pendingReviewsCount: 0,
      derivedAttentionCount: 0,
    },
    actionPlans: [],
  });

  it('creates a new control cut in tbl_controlCuts collection', async () => {
    const result = await firebaseService.createControlCut(testCut);
    expect(result.success).toBe(true);
    expect(result.created).toBe(true);
    expect(result.cut.cutId).toBe('IPS_board-1_M_2026_3');

    const fetched = await firebaseService.getControlCut(testCut.cutId);
    expect(fetched).not.toBeNull();
    expect(fetched?.cutId).toBe(testCut.cutId);
    expect(fetched?.schemaVersion).toBe(1);
    expect(fetched?.capturedByLabel).toBe('Editor User');
  });

  it('is idempotent: repeated creation does not duplicate or overwrite, returns existing identical cut', async () => {
    const firstResult = await firebaseService.createControlCut(testCut);
    expect(firstResult.created).toBe(true);

    // Attempt second creation with a modified object having the same cutId
    const modifiedAttempt: ControlCut = {
      ...testCut,
      capturedByLabel: 'HACKED LABEL',
    };

    const secondResult = await firebaseService.createControlCut(modifiedAttempt);
    expect(secondResult.success).toBe(true);
    expect(secondResult.created).toBe(false);
    expect(secondResult.cut.capturedByLabel).toBe('Editor User'); // Preserves original

    const stored = await firebaseService.getControlCut(testCut.cutId);
    expect(stored?.capturedByLabel).toBe('Editor User');
  });

  it('returns null when querying nonexistent cutId or empty string', async () => {
    const missing = await firebaseService.getControlCut('NON_EXISTENT');
    expect(missing).toBeNull();

    const empty = await firebaseService.getControlCut('');
    expect(empty).toBeNull();
  });

  it('lists control cuts for a given client scope', async () => {
    await firebaseService.createControlCut(testCut);
    const cuts = await firebaseService.listControlCuts('IPS');
    expect(cuts).toHaveLength(1);
    expect(cuts[0].cutId).toBe(testCut.cutId);
  });
});
