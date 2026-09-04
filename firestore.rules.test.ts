/** @jest-environment node */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';
import { doc, getDoc, setDoc, updateDoc, getDocs, collection, query, where, documentId } from 'firebase/firestore';

const PROJECT_ID = 'demo-stratexa-rules';

let testEnv: RulesTestEnvironment;

const canonicalMembership = (userId: string, clientId: string, role: 'tenant_admin' | 'director' | 'standard_user' = 'standard_user', status = 'active') => ({
  membershipId: `${userId}__${clientId}`,
  userId,
  clientId,
  role,
  status,
  scopeType: 'tenant',
  allowedDashboardIds: [],
  hierarchyScopeKeys: [],
  capabilities: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  createdBy: 'seed',
  updatedAt: '2026-01-01T00:00:00.000Z',
  updatedBy: 'seed',
  schemaVersion: 1,
});

jest.setTimeout(30000);

describe('Firestore Security Rules — Strategy Module (v9.5.0 Foundation)', () => {
  beforeAll(async () => {
    const rulesPath = path.resolve(__dirname, 'firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');

    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules,
        host: '127.0.0.1',
        port: 8080
      }
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();

      // Sembrar datos de usuarios para pruebas RBAC/Tenancy
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        // Usuario 1: Usuario normal de IPS
        await setDoc(doc(db, 'tbl_users', 'user_ips'), {
          uid: 'user_ips',
          clientId: 'IPS',
          globalRole: 'Director'
        });

        // Usuario 2: Admin de IPS
        await setDoc(doc(db, 'tbl_users', 'admin_ips'), {
          uid: 'admin_ips',
          clientId: 'IPS',
          globalRole: 'Admin'
        });

        await setDoc(doc(db, 'tbl_users', 'admin_leon'), {
          uid: 'admin_leon',
          clientId: 'LEÓN',
          globalRole: 'Admin'
        });

        // Usuario 3: Usuario normal multi-tenant (IPS y CLIENT_A)
        await setDoc(doc(db, 'tbl_users', 'user_multi'), {
          uid: 'user_multi',
          clientId: 'IPS, CLIENT_A',
          globalRole: 'Director'
        });

        // Usuario 4: Usuario de CLIENT_B únicamente
        await setDoc(doc(db, 'tbl_users', 'user_clientB'), {
          uid: 'user_clientB',
          clientId: 'CLIENT_B',
          globalRole: 'Director'
        });

        // Usuario 5: Admin de CLIENT_B
        await setDoc(doc(db, 'tbl_users', 'admin_clientB'), {
          uid: 'admin_clientB',
          clientId: 'CLIENT_B',
          globalRole: 'Admin'
        });

        // Usuario 6: Usuario de XABC únicamente
        await setDoc(doc(db, 'tbl_users', 'user_xabc'), {
          uid: 'user_xabc',
          clientId: 'XABC',
          globalRole: 'Director'
        });

        // Usuario 7: SuperAdmin
        await setDoc(doc(db, 'tbl_users', 'super_admin'), {
          uid: 'super_admin',
          email: 'leon@leonprior.com',
          clientId: 'IPS',
          globalRole: 'Admin'
        });

        // Documentos de estrategia iniciales
        await setDoc(doc(db, 'tbl_strategicPerspectives', 'persp_ips'), {
          id: 'persp_ips',
          clientId: 'IPS',
          name: 'Financiera'
        });

        await setDoc(doc(db, 'tbl_strategicObjectives', 'oe_ips'), {
          id: 'oe_ips',
          clientId: 'IPS',
          title: 'OE IPS'
        });

        await setDoc(doc(db, 'tbl_strategicObjectives', 'oe_1'), {
          id: 'oe_1',
          clientId: 'IPS',
          title: 'OE 1'
        });

        await setDoc(doc(db, 'tbl_strategicObjectives', 'oe_2'), {
          id: 'oe_2',
          clientId: 'IPS',
          title: 'OE 2'
        });

        await setDoc(doc(db, 'tbl_strategicObjectives', 'oe_3'), {
          id: 'oe_3',
          clientId: 'IPS',
          title: 'OE 3'
        });

        await setDoc(doc(db, 'tbl_strategicObjectives', 'oe_b1'), {
          id: 'oe_b1',
          clientId: 'CLIENT_B',
          title: 'OE B1'
        });

        await setDoc(doc(db, 'tbl_strategicPerspectives', 'persp_clientA'), {
          id: 'persp_clientA',
          clientId: 'CLIENT_A',
          name: 'Cliente'
        });

        await setDoc(doc(db, 'tbl_strategicPerspectives', 'persp_clientB'), {
          id: 'persp_clientB',
          clientId: 'CLIENT_B',
          name: 'Procesos'
        });

        await setDoc(doc(db, 'tbl_strategicPerspectives', 'persp_abc'), {
          id: 'persp_abc',
          clientId: 'ABC',
          name: 'ABC'
        });

        await setDoc(doc(db, 'tbl_strategicObjectiveRelationships', 'rel_IPS_oe_1_oe_2'), {
          id: 'rel_IPS_oe_1_oe_2',
          clientId: 'IPS',
          sourceStrategicObjectiveId: 'oe_1',
          targetStrategicObjectiveId: 'oe_2'
        });
      });
    }
  });

  // 1. Unauthenticated read -> DENY
  it('1. denies unauthenticated strategic read', async () => {
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    const ref = doc(unauthDb, 'tbl_strategicPerspectives', 'persp_ips');
    await assertFails(getDoc(ref));
  });

  // 2. Same-tenant normal user read -> ALLOW
  it('2. allows same-tenant normal user read', async () => {
    const userDb = testEnv.authenticatedContext('user_ips').firestore();
    const ref = doc(userDb, 'tbl_strategicPerspectives', 'persp_ips');
    await assertSucceeds(getDoc(ref));
  });

  // 3. Wrong-tenant normal user read -> DENY
  it('3. denies wrong-tenant normal user read', async () => {
    const userClientBDb = testEnv.authenticatedContext('user_clientB').firestore();
    const ref = doc(userClientBDb, 'tbl_strategicPerspectives', 'persp_ips');
    await assertFails(getDoc(ref));
  });

  // 4. Same-tenant non-Admin strategic create -> DENY
  it('4. denies same-tenant non-Admin strategic create', async () => {
    const userDb = testEnv.authenticatedContext('user_ips').firestore();
    const ref = doc(userDb, 'tbl_strategicObjectives', 'oe_new_user');
    await assertFails(setDoc(ref, { id: 'oe_new_user', clientId: 'IPS', title: 'Test' }));
  });

  // 5. Same-tenant Admin strategic create -> ALLOW
  it('5. allows same-tenant Admin strategic create', async () => {
    const adminDb = testEnv.authenticatedContext('admin_ips').firestore();
    const ref = doc(adminDb, 'tbl_strategicObjectives', 'oe_new_admin');
    await assertSucceeds(setDoc(ref, { id: 'oe_new_admin', clientId: 'IPS', title: 'Test Admin' }));
  });

  // 6. Same-tenant non-Admin update -> DENY
  it('6. denies same-tenant non-Admin update', async () => {
    const userDb = testEnv.authenticatedContext('user_ips').firestore();
    const ref = doc(userDb, 'tbl_strategicPerspectives', 'persp_ips');
    await assertFails(updateDoc(ref, { name: 'Hack Name' }));
  });

  // 7. Same-tenant Admin update -> ALLOW
  it('7. allows same-tenant Admin update', async () => {
    const adminDb = testEnv.authenticatedContext('admin_ips').firestore();
    const ref = doc(adminDb, 'tbl_strategicPerspectives', 'persp_ips');
    await assertSucceeds(updateDoc(ref, { name: 'Financiera Editada' }));
  });

  // 8. clientId mutation tenant A -> tenant B -> DENY
  it('8. denies clientId mutation across tenants', async () => {
    const adminDb = testEnv.authenticatedContext('admin_ips').firestore();
    const ref = doc(adminDb, 'tbl_strategicPerspectives', 'persp_ips');
    await assertFails(updateDoc(ref, { clientId: 'CLIENT_B' }));
  });

  // 9. Cross-tenant read -> DENY
  it('9. denies cross-tenant read', async () => {
    const userClientBDb = testEnv.authenticatedContext('user_clientB').firestore();
    const ref = doc(userClientBDb, 'tbl_strategicObjectives', 'oe_ips');
    await assertFails(getDoc(ref));
  });

  // 10. Cross-tenant write -> DENY
  it('10. denies cross-tenant write even for Admin of another tenant', async () => {
    const adminClientBDb = testEnv.authenticatedContext('admin_clientB').firestore();
    const ref = doc(adminClientBDb, 'tbl_strategicPerspectives', 'persp_ips');
    await assertFails(updateDoc(ref, { name: 'Unauthorized Admin Update' }));
  });

  // 11. Multi-client user can access an explicitly assigned client -> ALLOW
  it('11. allows multi-client user to access explicitly assigned client (CLIENT_A)', async () => {
    const multiDb = testEnv.authenticatedContext('user_multi').firestore();
    const ref = doc(multiDb, 'tbl_strategicPerspectives', 'persp_clientA');
    await assertSucceeds(getDoc(ref));
  });

  // 12. Multi-client user cannot access an unassigned client -> DENY
  it('12. denies multi-client user access to unassigned client (CLIENT_B)', async () => {
    const multiDb = testEnv.authenticatedContext('user_multi').firestore();
    const ref = doc(multiDb, 'tbl_strategicPerspectives', 'persp_clientB');
    await assertFails(getDoc(ref));
  });

  // 13. IPS has NO universal bypass -> DENY if user has no IPS membership
  it('13. denies IPS strategy read to user without IPS membership', async () => {
    const userClientBDb = testEnv.authenticatedContext('user_clientB').firestore();
    const ref = doc(userClientBDb, 'tbl_strategicPerspectives', 'persp_ips');
    await assertFails(getDoc(ref));
  });

  // 14. Authorized IPS user -> ALLOW
  it('14. allows authorized IPS user to read IPS strategy', async () => {
    const userIpsDb = testEnv.authenticatedContext('user_ips').firestore();
    const ref = doc(userIpsDb, 'tbl_strategicPerspectives', 'persp_ips');
    await assertSucceeds(getDoc(ref));
  });

  // 15. Non-Admin direct write to tbl_strategyCounters -> DENY
  it('15. denies non-Admin direct write to tbl_strategyCounters', async () => {
    const userDb = testEnv.authenticatedContext('user_ips').firestore();
    const ref = doc(userDb, 'tbl_strategyCounters', 'cnt_ips');
    await assertFails(setDoc(ref, { id: 'cnt_ips', clientId: 'IPS', lastIssuedSequence: 99 }));
  });

  // 16. Non-Admin direct write to tbl_areaCodeReservations -> DENY
  it('16. denies non-Admin direct write to tbl_areaCodeReservations', async () => {
    const userDb = testEnv.authenticatedContext('user_ips').firestore();
    const ref = doc(userDb, 'tbl_areaCodeReservations', 'res_ips');
    await assertFails(setDoc(ref, { id: 'res_ips', clientId: 'IPS', code: 'HACK' }));
  });

  // 🛡️ NUEVAS PRUEBAS DE SEGURIDAD CONTRA INYECCIÓN REGEX (17..21)
  it('17. denies malicious clientId containing ".*"', async () => {
    const adminDb = testEnv.authenticatedContext('admin_ips').firestore();
    const ref = doc(adminDb, 'tbl_strategicObjectives', 'oe_malicious_1');
    await assertFails(setDoc(ref, { id: 'oe_malicious_1', clientId: '.*', title: 'Malicious' }));
  });

  it('18. denies malicious clientId containing "IPS|CLIENT_A"', async () => {
    const adminDb = testEnv.authenticatedContext('admin_ips').firestore();
    const ref = doc(adminDb, 'tbl_strategicObjectives', 'oe_malicious_2');
    await assertFails(setDoc(ref, { id: 'oe_malicious_2', clientId: 'IPS|CLIENT_A', title: 'Malicious' }));
  });

  it('19. denies malicious clientId containing "^IPS$"', async () => {
    const adminDb = testEnv.authenticatedContext('admin_ips').firestore();
    const ref = doc(adminDb, 'tbl_strategicObjectives', 'oe_malicious_3');
    await assertFails(setDoc(ref, { id: 'oe_malicious_3', clientId: '^IPS$', title: 'Malicious' }));
  });

  it('20. denies clientId "IPS2" for user with profile "IPS"', async () => {
    const userDb = testEnv.authenticatedContext('user_ips').firestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'tbl_strategicPerspectives', 'persp_ips2'), {
        id: 'persp_ips2',
        clientId: 'IPS2',
        name: 'IPS2'
      });
    });

    const ref = doc(userDb, 'tbl_strategicPerspectives', 'persp_ips2');
    await assertFails(getDoc(ref));
  });

  it('21. denies user with profile "XABC" from reading "ABC"', async () => {
    const userXabcDb = testEnv.authenticatedContext('user_xabc').firestore();
    const ref = doc(userXabcDb, 'tbl_strategicPerspectives', 'persp_abc');
    await assertFails(getDoc(ref));
  });

  // 🛡️ NUEVAS PRUEBAS DE SUPERADMIN Y CLIENTID ESTRUCTURAL (22..24)
  it('22. denies SuperAdmin create of strategic document with clientId=".*"', async () => {
    const superAdminDb = testEnv.authenticatedContext('super_admin', { email: 'leon@leonprior.com' }).firestore();
    const ref = doc(superAdminDb, 'tbl_strategicObjectives', 'oe_super_malicious_1');
    await assertFails(setDoc(ref, { id: 'oe_super_malicious_1', clientId: '.*', title: 'Super Malicious' }));
  });

  it('23. denies SuperAdmin create of strategic document with clientId="IPS|CLIENT_A"', async () => {
    const superAdminDb = testEnv.authenticatedContext('super_admin', { email: 'leon@leonprior.com' }).firestore();
    const ref = doc(superAdminDb, 'tbl_strategicObjectives', 'oe_super_malicious_2');
    await assertFails(setDoc(ref, { id: 'oe_super_malicious_2', clientId: 'IPS|CLIENT_A', title: 'Super Malicious' }));
  });

  it('24. denies SuperAdmin update changing valid clientId to "^IPS$"', async () => {
    const superAdminDb = testEnv.authenticatedContext('super_admin', { email: 'leon@leonprior.com' }).firestore();
    const ref = doc(superAdminDb, 'tbl_strategicPerspectives', 'persp_ips');
    await assertFails(updateDoc(ref, { clientId: '^IPS$' }));
  });

  describe('first strategy counter initialization', () => {
    const counterPayload = { id: 'cnt_LEÓN_OE', clientId: 'LEÓN', scope: 'OE', lastIssuedSequence: 1 };

    it('allows SuperAdmin get/create/update for LEON counter', async () => {
      const db = testEnv.authenticatedContext('super_admin', { email: 'leon@leonprior.com' }).firestore();
      const ref = doc(db, 'tbl_strategyCounters', 'cnt_LEÓN_OE');
      await assertSucceeds(getDoc(ref));
      await assertSucceeds(setDoc(ref, counterPayload));
      await assertSucceeds(updateDoc(ref, { lastIssuedSequence: 2 }));
    });

    it('allows LEON tenant Admin get/create for LEON counter', async () => {
      const db = testEnv.authenticatedContext('admin_leon').firestore();
      const ref = doc(db, 'tbl_strategyCounters', 'cnt_LEÓN_OE');
      await assertSucceeds(getDoc(ref));
      await assertSucceeds(setDoc(ref, counterPayload));
    });

    it('denies IPS Admin get/create for LEON counter', async () => {
      const db = testEnv.authenticatedContext('admin_ips').firestore();
      const ref = doc(db, 'tbl_strategyCounters', 'cnt_LEÓN_OE');
      await assertFails(getDoc(ref));
      await assertFails(setDoc(ref, counterPayload));
    });

    it('denies normal and anonymous users', async () => {
      const normalRef = doc(testEnv.authenticatedContext('user_ips').firestore(), 'tbl_strategyCounters', 'cnt_IPS_OE');
      const anonymousRef = doc(testEnv.unauthenticatedContext().firestore(), 'tbl_strategyCounters', 'cnt_IPS_OE');
      await assertFails(getDoc(normalRef));
      await assertFails(getDoc(anonymousRef));
    });

    it('denies invalid counter IDs', async () => {
      const db = testEnv.authenticatedContext('admin_leon').firestore();
      const ref = doc(db, 'tbl_strategyCounters', 'invalid_LEÓN');
      await assertFails(getDoc(ref));
      await assertFails(setDoc(ref, { ...counterPayload, id: 'invalid_LEÓN' }));
    });

    it('allows SuperAdmin create of automatic OE01 for accented tenant id', async () => {
      const db = testEnv.authenticatedContext('super_admin', { email: 'leon@leonprior.com' }).firestore();
      const ref = doc(db, 'tbl_strategicObjectives', 'oe_auto_1');
      await assertSucceeds(setDoc(ref, {
        id: 'oe_auto_1', clientId: 'LEÓN', perspectiveId: 'FINANCIERA', code: 'OE01',
        title: 'Maximizar el crecimiento de ventas y la rentabilidad', description: '', order: 1,
        createdAt: '2026-08-30T21:00:00.000Z', updatedAt: '2026-08-30T21:00:00.000Z'
      }));
    });
  });

  // 🛡️ PRUEBAS DE SEGURIDAD PARA RELACIONES (tbl_strategicObjectiveRelationships) (25..39)
  it('25. denies unauthenticated read of objective relationships', async () => {
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    const ref = doc(unauthDb, 'tbl_strategicObjectiveRelationships', 'rel_IPS_oe_1_oe_2');
    await assertFails(getDoc(ref));
  });

  it('26. allows same-tenant user read of objective relationships', async () => {
    const userDb = testEnv.authenticatedContext('user_ips').firestore();
    const ref = doc(userDb, 'tbl_strategicObjectiveRelationships', 'rel_IPS_oe_1_oe_2');
    await assertSucceeds(getDoc(ref));
  });

  it('27. denies wrong-tenant user read of objective relationships', async () => {
    const userClientBDb = testEnv.authenticatedContext('user_clientB').firestore();
    const ref = doc(userClientBDb, 'tbl_strategicObjectiveRelationships', 'rel_IPS_oe_1_oe_2');
    await assertFails(getDoc(ref));
  });

  it('28. denies non-Admin create of objective relationships', async () => {
    const userDb = testEnv.authenticatedContext('user_ips').firestore();
    const ref = doc(userDb, 'tbl_strategicObjectiveRelationships', 'rel_IPS_oe_1_oe_3');
    await assertFails(setDoc(ref, { id: 'rel_IPS_oe_1_oe_3', clientId: 'IPS', sourceStrategicObjectiveId: 'oe_1', targetStrategicObjectiveId: 'oe_3' }));
  });

  it('29. allows same-tenant Admin create of canonical objective relationships with valid OEs', async () => {
    const adminDb = testEnv.authenticatedContext('admin_ips').firestore();
    const ref = doc(adminDb, 'tbl_strategicObjectiveRelationships', 'rel_IPS_oe_1_oe_3');
    await assertSucceeds(setDoc(ref, { id: 'rel_IPS_oe_1_oe_3', clientId: 'IPS', sourceStrategicObjectiveId: 'oe_1', targetStrategicObjectiveId: 'oe_3' }));
  });

  it('30. denies cross-tenant write of objective relationships by Admin of another tenant', async () => {
    const adminClientBDb = testEnv.authenticatedContext('admin_clientB').firestore();
    const ref = doc(adminClientBDb, 'tbl_strategicObjectiveRelationships', 'rel_IPS_oe_1_oe_2');
    await assertFails(updateDoc(ref, { description: 'Hacked' }));
  });

  it('31. denies create of objective relationship with malicious clientId', async () => {
    const adminDb = testEnv.authenticatedContext('admin_ips').firestore();
    const ref = doc(adminDb, 'tbl_strategicObjectiveRelationships', 'rel_.*_oe_1_oe_2');
    await assertFails(setDoc(ref, { id: 'rel_.*_oe_1_oe_2', clientId: '.*', sourceStrategicObjectiveId: 'oe_1', targetStrategicObjectiveId: 'oe_2' }));
  });

  it('32. denies create of relationship using cross-tenant source OE', async () => {
    const adminDb = testEnv.authenticatedContext('admin_ips').firestore();
    const ref = doc(adminDb, 'tbl_strategicObjectiveRelationships', 'rel_IPS_oe_b1_oe_2');
    await assertFails(setDoc(ref, { id: 'rel_IPS_oe_b1_oe_2', clientId: 'IPS', sourceStrategicObjectiveId: 'oe_b1', targetStrategicObjectiveId: 'oe_2' }));
  });

  it('33. denies create of relationship using cross-tenant target OE', async () => {
    const adminDb = testEnv.authenticatedContext('admin_ips').firestore();
    const ref = doc(adminDb, 'tbl_strategicObjectiveRelationships', 'rel_IPS_oe_1_oe_b1');
    await assertFails(setDoc(ref, { id: 'rel_IPS_oe_1_oe_b1', clientId: 'IPS', sourceStrategicObjectiveId: 'oe_1', targetStrategicObjectiveId: 'oe_b1' }));
  });

  it('34. denies create of relationship with non-existent source OE', async () => {
    const adminDb = testEnv.authenticatedContext('admin_ips').firestore();
    const ref = doc(adminDb, 'tbl_strategicObjectiveRelationships', 'rel_IPS_oe_ghost_oe_2');
    await assertFails(setDoc(ref, { id: 'rel_IPS_oe_ghost_oe_2', clientId: 'IPS', sourceStrategicObjectiveId: 'oe_ghost', targetStrategicObjectiveId: 'oe_2' }));
  });

  it('35. denies create of relationship with non-existent target OE', async () => {
    const adminDb = testEnv.authenticatedContext('admin_ips').firestore();
    const ref = doc(adminDb, 'tbl_strategicObjectiveRelationships', 'rel_IPS_oe_1_oe_ghost');
    await assertFails(setDoc(ref, { id: 'rel_IPS_oe_1_oe_ghost', clientId: 'IPS', sourceStrategicObjectiveId: 'oe_1', targetStrategicObjectiveId: 'oe_ghost' }));
  });

  it('36. denies create of self relationship (source == target)', async () => {
    const adminDb = testEnv.authenticatedContext('admin_ips').firestore();
    const ref = doc(adminDb, 'tbl_strategicObjectiveRelationships', 'rel_IPS_oe_1_oe_1');
    await assertFails(setDoc(ref, { id: 'rel_IPS_oe_1_oe_1', clientId: 'IPS', sourceStrategicObjectiveId: 'oe_1', targetStrategicObjectiveId: 'oe_1' }));
  });

  it('37. denies create of relationship with non-canonical / random document ID', async () => {
    const adminDb = testEnv.authenticatedContext('admin_ips').firestore();
    const ref = doc(adminDb, 'tbl_strategicObjectiveRelationships', 'random_rel_doc_123');
    await assertFails(setDoc(ref, { id: 'random_rel_doc_123', clientId: 'IPS', sourceStrategicObjectiveId: 'oe_1', targetStrategicObjectiveId: 'oe_3' }));
  });

  it('38. denies mutation of source or target OE endpoints on existing relationship', async () => {
    const adminDb = testEnv.authenticatedContext('admin_ips').firestore();
    const ref = doc(adminDb, 'tbl_strategicObjectiveRelationships', 'rel_IPS_oe_1_oe_2');
    await assertFails(updateDoc(ref, { targetStrategicObjectiveId: 'oe_3' }));
  });

  async function seedTablero() {
    await testEnv.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      for (const [uid, clientId, globalRole, dashboardAccess] of [
        ['member_a', 'A', 'Member', { a: 'Editor', view: 'Viewer' }],
        ['admin_a', 'A', 'Admin', {}], ['member_b', 'B', 'Member', { b: 'Editor' }],
        ['director_a', 'A', 'Director', {}]
      ] as const) await setDoc(doc(db, 'tbl_users', uid), { clientId, globalRole, dashboardAccess, directorTitle: 'OPERACIONES', email: `${uid}@example.test` });
      for (const [id, clientId] of [['a','A'],['view','A'],['hidden','A'],['b','B']]) {
        await setDoc(doc(db,'tbl_dashboards',id), { clientId, group: id === 'a' ? 'OPERACIONES' : 'OTRA' });
        await setDoc(doc(db,'tbl_dashboards',id,'items','kpi'), { monthlyProgress: [10] });
        await setDoc(doc(db,'tbl_actionPlans',id), { clientId, dashboardId: id, status: 'planned' });
      }
      for (const tenant of ['A','B']) {
        await setDoc(doc(db,'tbl_managedClients',tenant), { displayName: tenant });
        await setDoc(doc(db,'tbl_systemSettings',tenant), { appTitle: tenant });
      }
      await setDoc(doc(db,'tbl_systemSettings','main'), { appTitle: 'Global defaults' });
    });
  }

  it.each(['tbl_dashboards','tbl_actionPlans'])('P0 denies cross-tenant read/write for %s', async name => {
    await seedTablero();
    const db = testEnv.authenticatedContext('member_a').firestore();
    await assertFails(getDoc(doc(db,name,'b')));
    await assertFails(updateDoc(doc(db,name,'b'), { title: 'denied' }));
    await assertFails(getDocs(collection(db,name)));
    await assertSucceeds(getDoc(doc(db,name,'a')));
  });

  it('P0 denies own role/clientId changes, others roles, unaffiliated profile creation and tenant reassignment', async () => {
    await seedTablero();
    const member = testEnv.authenticatedContext('member_a').firestore();
    const admin = testEnv.authenticatedContext('admin_a').firestore();
    for (const change of [{globalRole:'Admin'}, {clientId:'B'}, {dashboardAccess:{b:'Editor'}}])
      await assertFails(updateDoc(doc(member,'tbl_users','member_a'),change));
    await assertFails(updateDoc(doc(member,'tbl_users','member_b'),{globalRole:'Admin'}));
    await assertFails(updateDoc(doc(admin,'tbl_users','member_b'),{globalRole:'Member'}));
    await assertFails(updateDoc(doc(admin,'tbl_users','member_b'),{clientId:'A'}));
    await assertFails(setDoc(doc(testEnv.authenticatedContext('outsider').firestore(),'tbl_users','outsider'),{globalRole:'Admin',clientId:'A'}));
    await assertSucceeds(updateDoc(doc(admin,'tbl_users','member_a'),{name:'Updated'}));
  });

  it('P0 preserves scoped dashboard queries and Editor/Viewer permissions', async () => {
    await seedTablero();
    const db = testEnv.authenticatedContext('member_a').firestore();
    await assertFails(getDoc(doc(db,'tbl_dashboards','hidden')));
    await assertFails(getDoc(doc(db,'tbl_dashboards','b','items','kpi')));
    await assertSucceeds(getDocs(query(collection(db,'tbl_dashboards'),where('clientId','==','A'),where(documentId(),'in',['a','view']))));
    await assertSucceeds(updateDoc(doc(db,'tbl_dashboards','a','items','kpi'),{monthlyProgress:[11]}));
    await assertFails(updateDoc(doc(db,'tbl_dashboards','view','items','kpi'),{monthlyProgress:[11]}));
    await assertSucceeds(updateDoc(doc(db,'tbl_actionPlans','a'),{status:'in_progress'}));
    await assertSucceeds(setDoc(doc(db,'tbl_actionPlans','new-editor-plan'),{clientId:'A',dashboardId:'a',indicatorId:'kpi',status:'planned'}));
    await assertFails(updateDoc(doc(db,'tbl_actionPlans','view'),{status:'in_progress'}));
    await assertFails(setDoc(doc(db,'tbl_actionPlans','cross-reference'),{clientId:'A',dashboardId:'b',status:'planned'}));
    const admin = testEnv.authenticatedContext('admin_a').firestore();
    await assertSucceeds(getDocs(query(collection(admin,'tbl_dashboards'),where('clientId','==','A'))));
    await assertSucceeds(setDoc(doc(admin,'tbl_dashboards','new'),{clientId:'A'}));
    await assertFails(updateDoc(doc(admin,'tbl_dashboards','a'),{clientId:'B'}));
    const director = testEnv.authenticatedContext('director_a').firestore();
    await assertSucceeds(getDocs(query(collection(director,'tbl_dashboards'),where('clientId','==','A'),where('group','==','OPERACIONES'))));
    await assertSucceeds(updateDoc(doc(director,'tbl_dashboards','a','items','kpi'),{monthlyProgress:[12]}));
  });

  it('P0 scoped users, catalogue, settings and ActionPlan writes', async () => {
    await seedTablero();
    const db = testEnv.authenticatedContext('member_a').firestore();
    const admin = testEnv.authenticatedContext('admin_a').firestore();
    await assertFails(getDocs(collection(db,'tbl_managedClients')));
    await assertFails(getDoc(doc(db,'tbl_managedClients','B')));
    await assertSucceeds(getDoc(doc(db,'tbl_managedClients','A')));
    await assertSucceeds(getDoc(doc(db,'tbl_systemSettings','main')));
    await assertFails(updateDoc(doc(db,'tbl_systemSettings','main'),{appTitle:'denied'}));
    await assertFails(getDoc(doc(db,'tbl_systemSettings','B')));
    await assertSucceeds(getDocs(query(collection(admin,'tbl_users'),where('clientId','==','A'))));
    await assertFails(getDocs(collection(admin,'tbl_users')));
    await assertSucceeds(updateDoc(doc(admin,'tbl_actionPlans','a'),{status:'in_progress'}));
    await assertFails(updateDoc(doc(admin,'tbl_actionPlans','a'),{clientId:'B'}));
    await assertFails(updateDoc(doc(admin,'tbl_actionPlans','b'),{status:'completed'}));
  });

  it('P0 preserves originalId scoped queries', async () => {
    await seedTablero();
    await testEnv.withSecurityRulesDisabled(async context => {
      await updateDoc(doc(context.firestore(),'tbl_users','member_a'),{dashboardAccess:{'10':'Editor'}});
      await setDoc(doc(context.firestore(),'tbl_dashboards','clone'),{clientId:'A',originalId:10});
    });
    const db = testEnv.authenticatedContext('member_a').firestore();
    await assertSucceeds(getDocs(query(collection(db,'tbl_dashboards'),where('clientId','==','A'),where('originalId','in',[10]))));
  });

  it('P0 tbl namespace denied by default; non-tbl catch-all and shared products unchanged', async () => {
    await seedTablero();
    const db = testEnv.authenticatedContext('outsider').firestore();
    await assertFails(setDoc(doc(db,'tbl_unknown','x'),{value:1}));
    await assertFails(setDoc(doc(db,'tbl_actionPlans','x'),{clientId:'A'}));
    for (const name of ['shared_unknown','cpx_work_plans','vac_weekly_data','stx_dashboards','dashboards','weekly_data','config','clients','groups','indicators'])
      await assertSucceeds(setDoc(doc(db,name,'compatibility_fixture'),{value:1}));
  });

  it('P0 preserves platform management and business catalogue, but not tenant mutation', async () => {
    await seedTablero();
    const db = testEnv.authenticatedContext('platform',{email:'leon@leonprior.com'}).firestore();
    for (const name of ['tbl_dashboards','tbl_users','tbl_managedClients','tbl_actionPlans']) await assertSucceeds(getDocs(collection(db,name)));
    await assertSucceeds(updateDoc(doc(db,'tbl_dashboards','b'),{title:'platform managed'}));
    await assertSucceeds(updateDoc(doc(db,'tbl_users','member_b'),{name:'platform managed'}));
    await assertFails(updateDoc(doc(db,'tbl_dashboards','b'),{clientId:'A'}));
  });

  it('39. allows same-tenant Admin update of metadata (description) on existing relationship', async () => {
    const adminDb = testEnv.authenticatedContext('admin_ips').firestore();
    const ref = doc(adminDb, 'tbl_strategicObjectiveRelationships', 'rel_IPS_oe_1_oe_2');
    await assertSucceeds(updateDoc(ref, { description: 'Updated valid rationale' }));
  });

  it('canonical memberships deny self-escalation, cross-tenant administration, and inactive access', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, 'tbl_userMemberships', 'user_ips__IPS'), canonicalMembership('user_ips', 'IPS'));
      await setDoc(doc(db, 'tbl_userMemberships', 'target_b__CLIENT_B'), canonicalMembership('target_b', 'CLIENT_B'));
      await setDoc(doc(db, 'tbl_userMemberships', 'inactive_ips__IPS'), canonicalMembership('inactive_ips', 'IPS', 'standard_user', 'inactive'));
      await setDoc(doc(db, 'tbl_users', 'inactive_ips'), { clientId: 'IPS', globalRole: 'Member' });
    });
    const standard = testEnv.authenticatedContext('user_ips').firestore();
    await assertFails(getDoc(doc(standard, 'tbl_userMemberships', 'target_b__CLIENT_B')));
    await assertFails(setDoc(doc(standard, 'tbl_userMemberships', 'user_ips__IPS'), canonicalMembership('user_ips', 'IPS', 'tenant_admin')));
    const inactive = testEnv.authenticatedContext('inactive_ips').firestore();
    await assertFails(getDoc(doc(inactive, 'tbl_strategicPerspectives', 'persp_ips')));
  });

  it('canonical platform authority is explicit and disabled authority is denied', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, 'tbl_platformAdmins', 'platform_canonical'), { uid: 'platform_canonical', status: 'active', createdAt: 'seed', createdBy: 'seed', updatedAt: 'seed', updatedBy: 'seed', schemaVersion: 1 });
      await setDoc(doc(db, 'tbl_platformAdmins', 'platform_disabled'), { uid: 'platform_disabled', status: 'disabled', createdAt: 'seed', createdBy: 'seed', updatedAt: 'seed', updatedBy: 'seed', schemaVersion: 1 });
    });
    await assertSucceeds(getDocs(collection(testEnv.authenticatedContext('platform_canonical').firestore(), 'tbl_managedClients')));
    await assertFails(getDocs(collection(testEnv.authenticatedContext('platform_disabled').firestore(), 'tbl_managedClients')));
  });
});
