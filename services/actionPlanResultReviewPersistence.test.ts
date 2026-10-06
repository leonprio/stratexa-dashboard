/** @jest-environment node */
import { firebaseService } from './firebaseService';
import { readTableroScope } from './tableroReadScope';
import type { ActionPlan, ActionPlanActivity, ActionPlanResultReview, User } from '../types';
import { getDocs, query, setDoc, where } from 'firebase/firestore';

jest.mock('../firebase', () => ({ db: {} }));
jest.mock('./tableroReadScope', () => ({ readTableroScope: jest.fn() }));

const mockDocuments = new Map<string, any>();
let mockTransactionTail: Promise<void> = Promise.resolve();
let mockFailNextUpdate = false;

jest.mock('firebase/firestore', () => {
  const merge = (left: any, right: any) => ({ ...left, ...right });
  return {
    collection: (_db: unknown, ...parts: string[]) => ({ path: parts.join('/') }),
    doc: (_db: unknown, ...parts: string[]) => ({ path: parts.join('/') }),
    getDoc: jest.fn(async (ref: { path: string }) => ({
      exists: () => mockDocuments.has(ref.path),
      data: () => mockDocuments.get(ref.path),
    })),
    updateDoc: jest.fn(async (ref: { path: string }, changes: any) => {
      if (mockFailNextUpdate) { mockFailNextUpdate = false; throw new Error('write failure'); }
      mockDocuments.set(ref.path, merge(mockDocuments.get(ref.path), changes));
    }),
    setDoc: jest.fn(),
    deleteDoc: jest.fn(),
    getDocs: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    writeBatch: jest.fn(),
    runTransaction: jest.fn(async (_db: unknown, work: (tx: any) => Promise<any>) => {
      let unlock!: () => void;
      const previous = mockTransactionTail;
      mockTransactionTail = new Promise<void>((resolve) => { unlock = resolve; });
      await previous;
      const writes = new Map<string, { mode: 'update' | 'set'; value: any }>();
      const tx = {
        get: async (ref: { path: string }) => ({
          id: ref.path.split('/').at(-1),
          exists: () => mockDocuments.has(ref.path),
          data: () => mockDocuments.get(ref.path),
        }),
        update: (ref: { path: string }, value: any) => {
          if (mockFailNextUpdate) { mockFailNextUpdate = false; throw new Error('transaction write failure'); }
          writes.set(ref.path, { mode: 'update', value });
        },
        set: (ref: { path: string }, value: any) => writes.set(ref.path, { mode: 'set', value }),
      };
      try {
        const result = await work(tx);
        for (const [path, write] of writes) {
          if (write.mode === 'set') mockDocuments.set(path, write.value);
          else mockDocuments.set(path, merge(mockDocuments.get(path), write.value));
        }
        return result;
      } finally {
        unlock();
      }
    }),
  };
});

const editorProfile = (): User => ({
  id: 'editor-a', name: 'Editor A', email: 'editor-a@example.test', globalRole: 'Member' as any,
  dashboardAccess: {},
  memberships: [{
    clientId: 'A', role: 'standard_user', status: 'active', dashboardScopes: { D1: 'viewer' },
    editableDashboardIds: ['D1'], capabilities: ['plan_editor'],
  }],
});

const plan = (overrides: Partial<ActionPlan> = {}): ActionPlan => ({
  id: 'P1', indicatorId: 'K1', dashboardId: 'D1', clientId: 'A', title: 'Plan original',
  originYear: 2026, originPeriodType: 'monthly', originPeriodIndex: 8, status: 'in_progress',
  startDate: '2026-09-01', progress: 40, createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-10T00:00:00.000Z', activities: [], ...overrides,
});

const review = (id: string, overrides: Partial<ActionPlanResultReview> = {}): ActionPlanResultReview => ({
  id, reviewedAt: '2026-09-20T12:00:00.000Z', reviewedByLabel: 'Input Label',
  observedResult: 'KPI observado en 82.', effect: 'PARTIAL', decision: 'CONTINUE', ...overrides,
});

const activity = (id: string): ActionPlanActivity => ({
  id, title: `Actividad ${id}`, progress: 0, createdAt: '', updatedAt: '',
});

const successorPlan = (overrides: Partial<ActionPlan> = {}): ActionPlan => plan({
  id: 'P2', title: 'Plan sucesor', status: 'planned', progress: 0, activities: [],
  createdAt: '', updatedAt: '', ...overrides,
});

const setProfile = (profile: User) => (readTableroScope as jest.Mock).mockResolvedValue({ profile, tenants: ['A'], platform: false });

describe('firebaseService.createActionPlan creation regression', () => {
  afterEach(() => jest.restoreAllMocks());

  it('writes the new plan once with a generated identity, timestamps and unchanged period', async () => {
    jest.spyOn(firebaseService, 'getDashboards').mockResolvedValue([{ id: 'D1', clientId: 'A', items: [{ id: 'K1' }] }] as any);
    (setDoc as jest.Mock).mockImplementation(async (ref: { path: string }, value: ActionPlan) => {
      mockDocuments.set(ref.path, value);
    });
    const created = await firebaseService.createActionPlan(plan({ id: '', createdAt: '', updatedAt: '' }));
    expect(created.id).toBeTruthy();
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(mockDocuments.get(`tbl_actionPlans/${created.id}`)).toEqual(created);
    expect(created).toMatchObject({ clientId: 'A', dashboardId: 'D1', indicatorId: 'K1', originYear: 2026, originPeriodType: 'monthly', originPeriodIndex: 8 });
    expect(Number.isNaN(Date.parse(created.createdAt))).toBe(false);
    expect(Number.isNaN(Date.parse(created.updatedAt))).toBe(false);
  });

  it.each([{ clientId: 'B' }, { dashboardId: 'D2' }])('rejects creation outside assigned scope: %j', async overrides => {
    await expect(firebaseService.createActionPlan(plan(overrides))).rejects.toThrow(/plan_editor/);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('rejects an indicator absent from the physical dashboard before writing', async () => {
    jest.spyOn(firebaseService, 'getDashboards').mockResolvedValue([{ id: 'D1', clientId: 'A', items: [{ id: 'OTHER' }] }] as any);
    await expect(firebaseService.createActionPlan(plan())).rejects.toThrow(/indicador.*existir/);
    expect(setDoc).not.toHaveBeenCalled();
  });
});

test('getActionPlansForIndicator finds existing string IDs for a numeric KPI and dashboard', async () => {
  const stored = plan({ id: 'legacy-string-ids', dashboardId: '10', indicatorId: '2' });
  jest.spyOn(firebaseService, 'getDashboards').mockResolvedValue([{ id: 10, clientId: 'A', items: [{ id: 2 }] }] as any);
  (where as jest.Mock).mockImplementation((field: string, op: string, value: unknown) => ({ field, op, value }));
  (query as jest.Mock).mockImplementation((...constraints: any[]) => constraints);
  (getDocs as jest.Mock).mockImplementation(async (constraints: any[]) => {
    const matches = constraints.slice(1).every(({ field, value }) =>
      typeof value === typeof (stored as any)[field] && value === (stored as any)[field],
    );
    return { docs: matches ? [{ id: stored.id, data: () => stored }] : [] };
  });

  await expect(firebaseService.getActionPlansForIndicator(2, 'A')).resolves.toEqual([stored]);
});

beforeEach(() => {
  mockDocuments.clear();
  mockTransactionTail = Promise.resolve();
  mockFailNextUpdate = false;
  mockDocuments.set('tbl_actionPlans/P1', plan());
  setProfile(editorProfile());
  jest.clearAllMocks();
});

describe('firebaseService.recordActionPlanResultReview', () => {
  it('atomically appends a valid review while retaining prior reviews and plan identity', async () => {
    const prior = review('R0', { reviewedAt: '2026-09-10T12:00:00.000Z' });
    mockDocuments.set('tbl_actionPlans/P1', plan({ resultReviews: [prior] }));
    const result = await firebaseService.recordActionPlanResultReview('P1', review('R1'));
    expect(result.resultReviews).toHaveLength(2);
    expect(mockDocuments.get('tbl_actionPlans/P1')).toMatchObject({
      clientId: 'A', dashboardId: 'D1', indicatorId: 'K1', originYear: 2026, originPeriodType: 'monthly', originPeriodIndex: 8,
      resultReviews: [{ id: 'R0' }, { id: 'R1', reviewedByUserId: 'editor-a', reviewedByLabel: 'Editor A' }],
    });
    expect(result.resultReviews?.[1].reviewedByUserId).toBe('editor-a');
    expect(mockDocuments.get('tbl_actionPlans/P1').activities).toEqual([]);
  });

  it('serializes concurrent review writes so both reviews survive', async () => {
    await Promise.all([
      firebaseService.recordActionPlanResultReview('P1', review('R1')),
      firebaseService.recordActionPlanResultReview('P1', review('R2')),
    ]);
    expect(mockDocuments.get('tbl_actionPlans/P1').resultReviews.map((item: ActionPlanResultReview) => item.id).sort()).toEqual(['R1', 'R2']);
  });

  it('is idempotent for the same review id and payload, but rejects a conflicting duplicate', async () => {
    await firebaseService.recordActionPlanResultReview('P1', review('R1'));
    await expect(firebaseService.recordActionPlanResultReview('P1', review('R1'))).resolves.toMatchObject({ resultReviews: [{ id: 'R1' }] });
    await expect(firebaseService.recordActionPlanResultReview('P1', review('R1', { observedResult: 'distinto' })))
      .rejects.toThrow(/contenido distinto/);
    expect(mockDocuments.get('tbl_actionPlans/P1').resultReviews).toHaveLength(1);
  });

  it('rejects a missing plan and invalid reviews before any write', async () => {
    await expect(firebaseService.recordActionPlanResultReview('missing', review('R1'))).rejects.toThrow(/no encontrado/);
    await expect(firebaseService.recordActionPlanResultReview('P1', review('R2', { observedResult: '  ' }))).rejects.toThrow(/no es válida/);
    await expect(firebaseService.recordActionPlanResultReview('P1', review('R3', { effect: 'NOT_EVALUATED' as any }))).rejects.toThrow(/no es válida/);
    await expect(firebaseService.recordActionPlanResultReview('P1', { ...review('R4'), planId: 'forged' } as any)).rejects.toThrow(/no es válida/);
    expect(mockDocuments.get('tbl_actionPlans/P1').resultReviews).toBeUndefined();
  });

  it('creates an activity successor and its link in the same transaction', async () => {
    const existing = { ...activity('existing'), progress: 100 };
    mockDocuments.set('tbl_actionPlans/P1', plan({ status: 'completed', progress: 100, activities: [existing] }));
    await firebaseService.recordActionPlanResultReview('P1', review('R1'), { type: 'activity', activity: activity('A1') });
    expect(mockDocuments.get('tbl_actionPlans/P1')).toMatchObject({
      activities: [{ id: 'existing' }, { id: 'A1', createdAt: expect.any(String), updatedAt: expect.any(String) }],
      resultReviews: [{ id: 'R1', nextCommitmentActivityId: 'A1' }],
      progress: 50,
      status: 'in_progress',
    });
  });

  it('retries an activity successor without duplicating the activity or review', async () => {
    const successor = activity('A1');
    await firebaseService.recordActionPlanResultReview('P1', review('R1'), { type: 'activity', activity: successor });
    await firebaseService.recordActionPlanResultReview('P1', review('R1'), { type: 'activity', activity: successor });
    expect(mockDocuments.get('tbl_actionPlans/P1').activities).toHaveLength(1);
    expect(mockDocuments.get('tbl_actionPlans/P1').resultReviews).toHaveLength(1);
  });

  it('does not leave an activity or review behind when the transaction write fails', async () => {
    mockFailNextUpdate = true;
    await expect(firebaseService.recordActionPlanResultReview('P1', review('R1'), { type: 'activity', activity: activity('A1') }))
      .rejects.toThrow(/transaction write failure/);
    expect(mockDocuments.get('tbl_actionPlans/P1').activities).toEqual([]);
    expect(mockDocuments.get('tbl_actionPlans/P1').resultReviews).toBeUndefined();
  });

  it('creates a linked plan successor atomically and a retry does not duplicate it', async () => {
    const successor = successorPlan();
    await firebaseService.recordActionPlanResultReview('P1', review('R1'), { type: 'plan', plan: successor });
    await firebaseService.recordActionPlanResultReview('P1', review('R1'), { type: 'plan', plan: successor });
    expect(mockDocuments.get('tbl_actionPlans/P1').resultReviews).toMatchObject([{ id: 'R1', nextCommitmentPlanId: 'P2' }]);
    expect(mockDocuments.get('tbl_actionPlans/P2')).toMatchObject({ id: 'P2', clientId: 'A', dashboardId: 'D1', indicatorId: 'K1', originYear: 2026 });
    expect([...mockDocuments.keys()].filter((key) => key === 'tbl_actionPlans/P2')).toHaveLength(1);
  });

  it('does not leave a successor plan behind if writing the review fails', async () => {
    mockFailNextUpdate = true;
    await expect(firebaseService.recordActionPlanResultReview('P1', review('R1'), { type: 'plan', plan: successorPlan() }))
      .rejects.toThrow(/transaction write failure/);
    expect(mockDocuments.has('tbl_actionPlans/P2')).toBe(false);
    expect(mockDocuments.get('tbl_actionPlans/P1').resultReviews).toBeUndefined();
  });

  it('rejects a successor outside the original client, dashboard, or KPI scope', async () => {
    await expect(firebaseService.recordActionPlanResultReview('P1', review('R1'), { type: 'plan', plan: successorPlan({ clientId: 'B' }) }))
      .rejects.toThrow(/conservar cliente, tablero e indicador/);
    await expect(firebaseService.recordActionPlanResultReview('P1', review('R2'), { type: 'plan', plan: successorPlan({ dashboardId: 'D2' }) }))
      .rejects.toThrow(/conservar cliente, tablero e indicador/);
    await expect(firebaseService.recordActionPlanResultReview('P1', review('R3'), { type: 'plan', plan: successorPlan({ indicatorId: 'K2' }) }))
      .rejects.toThrow(/conservar cliente, tablero e indicador/);
    expect(mockDocuments.has('tbl_actionPlans/P2')).toBe(false);
  });

  it('rejects a successor when either plan lacks a valid indicator identity', async () => {
    mockDocuments.set('tbl_actionPlans/P1', plan({ indicatorId: '' }));
    await expect(firebaseService.recordActionPlanResultReview('P1', review('R1'), { type: 'plan', plan: successorPlan({ indicatorId: '' }) }))
      .rejects.toThrow(/conservar cliente, tablero e indicador/);
    expect(mockDocuments.has('tbl_actionPlans/P2')).toBe(false);
  });

  it('prevents stale general plan updates from erasing a concurrently recorded review', async () => {
    const staleDraft = plan({ activities: [activity('A1')], resultReviews: [] });
    await Promise.all([
      firebaseService.updateActionPlan('P1', staleDraft),
      firebaseService.recordActionPlanResultReview('P1', review('R1')),
    ]);
    expect(mockDocuments.get('tbl_actionPlans/P1').resultReviews).toMatchObject([{ id: 'R1' }]);
    expect(mockDocuments.get('tbl_actionPlans/P1').activities).toMatchObject([{ id: 'A1' }]);
  });

  it.each([
    ['reader', { ...editorProfile(), memberships: [{ ...editorProfile().memberships![0], capabilities: ['viewer'], editableDashboardIds: ['D1'] }] }],
    ['plan editor without board scope', { ...editorProfile(), memberships: [{ ...editorProfile().memberships![0], editableDashboardIds: ['D2'] }] }],
    ['different tenant', { ...editorProfile(), memberships: [{ ...editorProfile().memberships![0], clientId: 'B' }] }],
    ['blind platform admin', { ...editorProfile(), globalRole: 'SuperAdmin' as any, memberships: [] }],
  ])('denies %s and leaves the plan unchanged', async (_label, profile) => {
    setProfile(profile as User);
    await expect(firebaseService.recordActionPlanResultReview('P1', review('R1'))).rejects.toThrow(/plan_editor/);
    expect(mockDocuments.get('tbl_actionPlans/P1').resultReviews).toBeUndefined();
  });

  it('allows a canonical plan editor whose membership covers the source dashboard', async () => {
    setProfile(editorProfile());
    await expect(firebaseService.recordActionPlanResultReview('P1', review('R1'))).resolves.toMatchObject({ resultReviews: [{ id: 'R1' }] });
  });

  it('uses the authenticated profile identity instead of a caller-supplied reviewer id or label', async () => {
    const result = await firebaseService.recordActionPlanResultReview('P1', review('R1', {
      reviewedByUserId: 'forged-user', reviewedByLabel: 'Forged label',
    }));
    expect(result.resultReviews?.[0]).toMatchObject({ reviewedByUserId: 'editor-a', reviewedByLabel: 'Editor A' });
  });
});
