/** @jest-environment node */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, where, documentId } from 'firebase/firestore';

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

        // Explicit strategy grants replace legacy role-only reading.
        for (const [uid, tenants] of [['user_ips',['IPS']],['user_multi',['IPS','CLIENT_A']],['user_clientB',['CLIENT_B']],['user_xabc',['XABC']]] as const) {
          for (const tenant of tenants) await setDoc(doc(db,'tbl_userMemberships',uid+'__'+tenant), {...canonicalMembership(uid,tenant),capabilities:['strategy_reader']});
        }
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

    it('allows platform admin with explicit LEON membership to initialize its counter', async () => {
      await testEnv.withSecurityRulesDisabled(async context => {
        const db=context.firestore();
        await updateDoc(doc(db,'tbl_users','super_admin'),{clientId:'LEÓN'});
        await setDoc(doc(db,'tbl_userMemberships','super_admin__LEÓN'),canonicalMembership('super_admin','LEÓN','tenant_admin'));
      });
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

    it('allows explicit platform tenant membership to create OE01', async () => {
      await testEnv.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(),'tbl_userMemberships','super_admin__LEÓN'),canonicalMembership('super_admin','LEÓN','tenant_admin'));
      });
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

  it('allows one valid ActionPlan result review and preserves immutable review history', async () => {
    await seedTablero();
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'tbl_userMemberships', 'member_a__A'), {
        ...canonicalMembership('member_a', 'A'),
        allowedDashboardIds: ['a', 'view'],
        editableDashboardIds: ['a'],
        capabilities: ['plan_editor'],
      });
    });
    const editor = testEnv.authenticatedContext('member_a').firestore();
    const reader = testEnv.authenticatedContext('director_a').firestore();
    const wrongClient = testEnv.authenticatedContext('member_b').firestore();
    const platformWithoutMembership = testEnv.authenticatedContext('super_admin', { email: 'leon@leonprior.com' }).firestore();
    const admin = testEnv.authenticatedContext('admin_a').firestore();
    const planRef = doc(admin, 'tbl_actionPlans', 'a');
    const validReview = {
      id: 'review-1', reviewedAt: '2026-09-28T12:00:00.000Z', reviewedByUserId: 'member_a',
      reviewedByLabel: 'Member A', observedResult: 'KPI recuperó 10 puntos.',
      effect: 'FAVORABLE', decision: 'CLOSE',
    };
    const adminReview = { ...validReview, id: 'admin-review', reviewedByUserId: 'admin_a', reviewedByLabel: 'Admin A' };
    const editorPlanRef = doc(editor, 'tbl_actionPlans', 'a');
    await assertFails(updateDoc(doc(reader, 'tbl_actionPlans', 'a'), { resultReviews: [validReview] }));
    await assertFails(updateDoc(doc(wrongClient, 'tbl_actionPlans', 'a'), { resultReviews: [validReview] }));
    await assertFails(updateDoc(doc(platformWithoutMembership, 'tbl_actionPlans', 'a'), { resultReviews: [validReview] }));
    await assertFails(updateDoc(doc(editor, 'tbl_actionPlans', 'view'), { resultReviews: [validReview] }));
    await assertFails(updateDoc(planRef, { resultReviews: [{ ...adminReview, effect: 'UNKNOWN' }] }));
    await assertFails(updateDoc(planRef, { resultReviews: [{ ...adminReview, reviewedByUserId: 'someone-else' }] }));
    await assertFails(updateDoc(planRef, { resultReviews: [{ ...adminReview, planId: 'forged-plan' }] }));
    await assertFails(updateDoc(editorPlanRef, { resultReviews: [validReview], clientId: 'B' }));
    await assertFails(updateDoc(editorPlanRef, { resultReviews: [validReview], dashboardId: 'view' }));
    await assertFails(updateDoc(editorPlanRef, { resultReviews: [validReview], indicatorId: 'forged-kpi' }));
    await assertFails(updateDoc(doc(admin, 'tbl_actionPlans', 'view'), { resultReviews: [adminReview, { ...adminReview, id: 'review-2' }] }));
    await assertSucceeds(updateDoc(editorPlanRef, { resultReviews: [validReview] }));
    await assertFails(updateDoc(editorPlanRef, { resultReviews: [] }));
    await assertFails(updateDoc(editorPlanRef, { resultReviews: [{ ...validReview, reviewedAt: '2026-09-29T12:00:00.000Z' }] }));
    await assertSucceeds(updateDoc(planRef, { status: 'completed' }));
  });

  // The remote #22 RED case above remains unchanged as the budget regression.
  it.each(['plan_editor', 'editor', 'tenant_admin', 'legacy Director'])(
    'budget-equivalent ActionPlan review updates allow %s authority', async authority => {
      await seedTablero();
      await testEnv.withSecurityRulesDisabled(async context => {
        const db = context.firestore();
        if (authority === 'legacy Director') {
          await deleteDoc(doc(db, 'tbl_userMemberships', 'member_a__A'));
          await updateDoc(doc(db, 'tbl_users', 'member_a'), {
            globalRole: 'Director', directorTitle: 'OPERACIONES', dashboardAccess: {},
          });
        } else {
          await setDoc(doc(db, 'tbl_userMemberships', 'member_a__A'), {
            ...canonicalMembership('member_a', 'A', authority === 'tenant_admin' ? 'tenant_admin' : 'standard_user'),
            allowedDashboardIds: ['a'], editableDashboardIds: ['a'],
            capabilities: authority === 'tenant_admin' ? [] : [authority],
          });
        }
      });
      const db = testEnv.authenticatedContext('member_a').firestore();
      const ref = doc(db, 'tbl_actionPlans', 'a');
      const review = { id: 'budget-review', reviewedAt: '2026-10-06', reviewedByUserId: 'member_a',
        reviewedByLabel: 'Reviewer', observedResult: 'Observed', effect: 'FAVORABLE', decision: 'CONTINUE' };
      await assertSucceeds(updateDoc(ref, { resultReviews: [review] }));
      await assertSucceeds(updateDoc(ref, { status: 'in_progress' }));
      await assertSucceeds(updateDoc(ref, { resultReviews: [review, { ...review, id: 'next-review' }] }));
      await assertFails(updateDoc(ref, { resultReviews: [review] }));
      await assertFails(updateDoc(ref, { resultReviews: [{ ...review, observedResult: 'forged' }, { ...review, id: 'next-review' }] }));
    });

  it.each(['suspended', 'inactive', 'viewer', 'no editable scope', 'editor outside allowed scope',
    'other tenant', 'legacy other hierarchy', 'legacy ALL', 'legacy all'])(
    'budget-equivalent ActionPlan review updates deny %s', async scenario => {
      await seedTablero();
      await testEnv.withSecurityRulesDisabled(async context => {
        const db = context.firestore();
        const membership = { ...canonicalMembership('member_a', 'A'), allowedDashboardIds: ['a'],
          editableDashboardIds: ['a'], capabilities: ['plan_editor'] };
        if (scenario === 'suspended' || scenario === 'inactive') membership.status = scenario;
        if (scenario === 'viewer') { membership.capabilities = ['viewer']; membership.editableDashboardIds = []; }
        if (scenario === 'no editable scope') membership.editableDashboardIds = ['view'];
        if (scenario === 'editor outside allowed scope') { membership.capabilities = ['editor']; membership.allowedDashboardIds = ['view']; }
        if (scenario === 'other tenant') membership.clientId = 'B';
        await setDoc(doc(db, 'tbl_userMemberships', 'member_a__A'), membership);
        // Legacy editor-looking data must not override a canonical denial.
        await updateDoc(doc(db, 'tbl_users', 'member_a'), {
          globalRole: 'Director', directorTitle: 'OPERACIONES', dashboardAccess: { a: 'Editor' },
        });
        if (scenario.startsWith('legacy')) {
          await deleteDoc(doc(db, 'tbl_userMemberships', 'member_a__A'));
          await updateDoc(doc(db, 'tbl_users', 'member_a'), {
            directorTitle: 'OTHER', dashboardAccess: {},
            clientId: scenario === 'legacy ALL' ? 'ALL' : scenario === 'legacy all' ? 'all' : 'A',
          });
        }
      });
      const db = testEnv.authenticatedContext('member_a').firestore();
      await assertFails(updateDoc(doc(db, 'tbl_actionPlans', 'a'), { resultReviews: [{
        id: 'denied-review', reviewedAt: '2026-10-06', reviewedByUserId: 'member_a',
        reviewedByLabel: 'Reviewer', observedResult: 'Observed', effect: 'FAVORABLE', decision: 'CLOSE',
      }] }));
    });

  it.each([
    ['Admin', true], ['direct Editor', true], ['original Editor', true],
    ['Viewer', false], ['Director title', true], ['Director subgroup', true],
    ['Director supergroup', true], ['other hierarchy', false], ['other tenant', false],
    ['ALL', false], ['all', false], ['platform admin', false], ['canonical viewer', false],
    ['suspended', false], ['inactive', false], ['explicit non-editor', false],
    ['Viewer overrides original Editor', false], ['no profile', false],
  ] as [string, boolean][])('legacy dashboard/ActionPlan equivalence: %s', async (scenario, permitted) => {
    await seedTablero();
    await testEnv.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await deleteDoc(doc(db, 'tbl_userMemberships', 'member_a__A'));
      const user = { clientId: 'A', globalRole: 'Director', directorTitle: 'OPERACIONES',
        subGroups: [] as string[], superGroups: [] as string[], dashboardAccess: {} as Record<string, string> };
      if (scenario === 'Admin') user.globalRole = 'Admin';
      if (scenario === 'direct Editor') { user.globalRole = 'Member'; user.dashboardAccess = { a: 'Editor' }; }
      if (scenario === 'original Editor' || scenario === 'Viewer overrides original Editor') {
        await updateDoc(doc(db, 'tbl_dashboards', 'a'), { originalId: 'origin' });
        user.dashboardAccess = scenario === 'original Editor' ? { origin: 'Editor' } : { a: 'Viewer', origin: 'Editor' };
      }
      if (scenario === 'Viewer') user.dashboardAccess = { a: 'Viewer' };
      if (scenario === 'explicit non-editor') user.dashboardAccess = { a: 'Unknown' };
      if (scenario === 'Director subgroup') { user.directorTitle = 'OTHER'; user.subGroups = ['OPERACIONES']; }
      if (scenario === 'Director supergroup') {
        user.directorTitle = 'OTHER'; user.superGroups = ['DIRECTION'];
        await updateDoc(doc(db, 'tbl_dashboards', 'a'), { superGroup: 'DIRECTION' });
      }
      if (scenario === 'other hierarchy') user.directorTitle = 'OTHER';
      if (scenario === 'other tenant') user.clientId = 'B';
      if (scenario === 'ALL' || scenario === 'all') user.clientId = scenario;
      await updateDoc(doc(db, 'tbl_users', 'member_a'), user);
      if (scenario === 'platform admin') await setDoc(doc(db, 'tbl_platformAdmins', 'member_a'), { uid: 'member_a', status: 'active' });
      if (['canonical viewer', 'suspended', 'inactive'].includes(scenario)) {
        await setDoc(doc(db, 'tbl_userMemberships', 'member_a__A'), {
          ...canonicalMembership('member_a', 'A', 'standard_user', scenario === 'canonical viewer' ? 'active' : scenario),
          allowedDashboardIds: ['a'], editableDashboardIds: [], capabilities: ['viewer'],
        });
      }
      if (scenario === 'no profile') await deleteDoc(doc(db, 'tbl_users', 'member_a'));
    });
    const db = testEnv.authenticatedContext('member_a').firestore();
    const dashboardWrite = updateDoc(doc(db, 'tbl_dashboards', 'a', 'items', 'kpi'), { monthlyProgress: [13] });
    if (permitted) await assertSucceeds(dashboardWrite); else await assertFails(dashboardWrite);
    const planWrite = updateDoc(doc(db, 'tbl_actionPlans', 'a'), { status: 'in_progress' });
    if (permitted) await assertSucceeds(planWrite); else await assertFails(planWrite);
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
    for (const name of ['tbl_users','tbl_managedClients']) await assertSucceeds(getDocs(collection(db,name)));
    for (const name of ['tbl_dashboards','tbl_actionPlans']) await assertFails(getDocs(collection(db,name)));
    await assertFails(updateDoc(doc(db,'tbl_dashboards','b'),{title:'platform managed'}));
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
      await setDoc(doc(db, 'tbl_platformAdmins', 'platform_malformed'), { uid: 'platform_malformed' });
    });
    await assertSucceeds(getDocs(collection(testEnv.authenticatedContext('platform_canonical').firestore(), 'tbl_managedClients')));
    await assertFails(getDocs(collection(testEnv.authenticatedContext('platform_disabled').firestore(), 'tbl_managedClients')));
    await assertFails(getDocs(collection(testEnv.authenticatedContext('platform_malformed').firestore(), 'tbl_managedClients')));
  });

  it('platform email bridge is exact and token contexts without email are safe', async () => {
    await seedTablero();
    await assertFails(getDocs(collection(testEnv.authenticatedContext('no_email').firestore(), 'tbl_managedClients')));
    await assertFails(getDocs(collection(testEnv.authenticatedContext('other_email', { email: 'other@example.test' }).firestore(), 'tbl_managedClients')));
    await assertSucceeds(getDocs(collection(testEnv.authenticatedContext('bridge_email', { email: 'leon@leonprior.com' }).firestore(), 'tbl_managedClients')));
  });
  it('P1 read-only plans require an explicit scoped plan_editor grant', async () => {
    await seedTablero();
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(),'tbl_userMemberships','member_a__A'),{...canonicalMembership('member_a','A'),allowedDashboardIds:['a'],editableDashboardIds:[],capabilities:['viewer']});
    });
    const db=testEnv.authenticatedContext('member_a').firestore();
    await assertFails(getDoc(doc(db,'tbl_actionPlans','hidden')));
    await assertFails(getDocs(query(collection(db,'tbl_actionPlans'),where('clientId','==','A'))));
    await assertSucceeds(getDocs(query(collection(db,'tbl_actionPlans'),where('clientId','==','A'),where('dashboardId','==','a'))));
    await assertFails(updateDoc(doc(db,'tbl_actionPlans','a'),{status:'completed'}));
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(),'tbl_userMemberships','member_a__A'),{...canonicalMembership('member_a','A'),allowedDashboardIds:['a'],editableDashboardIds:['a'],capabilities:['plan_editor']});
    });
    await assertSucceeds(updateDoc(doc(db,'tbl_actionPlans','a'),{status:'completed'}));
    await assertFails(updateDoc(doc(db,'tbl_actionPlans','hidden'),{status:'completed'}));
    await assertFails(updateDoc(doc(db,'tbl_actionPlans','b'),{status:'completed'}));
  });
  it.each(['editor', 'viewer', 'other tenant', 'other dashboard', 'suspended'])('ActionPlan dashboard authority: %s', async scenario => {
    await seedTablero();
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'tbl_userMemberships', 'member_a__A'), {
        ...canonicalMembership('member_a', 'A', 'standard_user', scenario === 'suspended' ? 'suspended' : 'active'),
        allowedDashboardIds: ['a'], editableDashboardIds: scenario === 'other dashboard' ? ['view'] : ['a'],
        capabilities: scenario === 'viewer' ? ['viewer'] : ['editor'],
      });
    });
    const db = testEnv.authenticatedContext('member_a').firestore();
    const dashboardId = scenario === 'other tenant' ? 'b' : 'a';
    const planRef = doc(db, 'tbl_actionPlans', 'editor-contract-new');
    const creation = setDoc(planRef, { clientId: scenario === 'other tenant' ? 'B' : 'A', dashboardId, indicatorId: 'kpi', status: 'planned' });
    if (scenario === 'editor') {
      await assertSucceeds(creation);
      await assertSucceeds(updateDoc(planRef, { status: 'in_progress' }));
      await assertSucceeds(deleteDoc(planRef));
    } else {
      await assertFails(creation);
      await assertFails(updateDoc(doc(db, 'tbl_actionPlans', dashboardId), { status: 'in_progress' }));
      await assertFails(deleteDoc(doc(db, 'tbl_actionPlans', dashboardId)));
    }
  });
  it('P1 membership alone cannot read strategy; explicit strategy_reader can', async () => {
    const db=testEnv.authenticatedContext('user_ips').firestore();
    await testEnv.withSecurityRulesDisabled(async context => {
      await updateDoc(doc(context.firestore(),'tbl_userMemberships','user_ips__IPS'),{capabilities:[]});
    });
    await assertFails(getDoc(doc(db,'tbl_strategicObjectives','oe_ips')));
    await testEnv.withSecurityRulesDisabled(async context => {
      await updateDoc(doc(context.firestore(),'tbl_userMemberships','user_ips__IPS'),{capabilities:['strategy_reader']});
    });
    await assertSucceeds(getDocs(query(collection(db,'tbl_strategicObjectives'),where('clientId','==','IPS'))));
    await assertFails(getDoc(doc(db,'tbl_strategicObjectives','oe_b1')));
    await testEnv.withSecurityRulesDisabled(async context => {
      await updateDoc(doc(context.firestore(),'tbl_userMemberships','user_ips__IPS'),{scopeType:'dashboard',allowedDashboardIds:['a']});
    });
    await assertFails(getDoc(doc(db,'tbl_strategicObjectives','oe_ips')));
  });
  it('P1 platform email has no business grant, explicit membership is tenant scoped and revocable', async () => {
    await seedTablero();
    const db=testEnv.authenticatedContext('super_admin',{email:'leon@leonprior.com'}).firestore();
    await assertFails(getDoc(doc(db,'tbl_dashboards','a')));
    await assertFails(getDoc(doc(db,'tbl_strategicObjectives','oe_ips')));
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(),'tbl_userMemberships','super_admin__A'),{...canonicalMembership('super_admin','A'),allowedDashboardIds:['a'],capabilities:['viewer']});
    });
    await assertSucceeds(getDoc(doc(db,'tbl_dashboards','a')));
    await assertFails(getDoc(doc(db,'tbl_dashboards','b')));
    await assertFails(updateDoc(doc(db,'tbl_dashboards','a','items','kpi'),{monthlyProgress:[99]}));
    await testEnv.withSecurityRulesDisabled(async context => {
      await updateDoc(doc(context.firestore(),'tbl_userMemberships','super_admin__A'),{status:'suspended'});
    });
    await assertFails(getDoc(doc(db,'tbl_dashboards','a')));
  });

  describe('S01/S02 security contract', () => {
    it.each(['ALL', 'all', 'A, ALL', 'A, all'])('legacy %s never grants tenant B', async clientId => {
      await seedTablero();
      await testEnv.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), 'tbl_users', 'legacy_all'), { clientId, globalRole: 'Admin', dashboardAccess: { a: 'Editor', b: 'Editor' } });
      });
      const db = testEnv.authenticatedContext('legacy_all').firestore();
      await assertFails(getDoc(doc(db, 'tbl_dashboards', 'b')));
      await assertFails(updateDoc(doc(db, 'tbl_dashboards', 'b', 'items', 'kpi'), { activityConfig: { 0: [] } }));
      await assertFails(updateDoc(doc(db, 'tbl_actionPlans', 'b'), { status: 'completed' }));
      if (clientId.startsWith('A,')) await assertSucceeds(getDoc(doc(db, 'tbl_dashboards', 'a')));
      else await assertFails(getDoc(doc(db, 'tbl_dashboards', 'a')));
    });

    it.each(['standard_user', 'tenant_admin'] as const)('S02 requires profile even with active canonical %s membership', async role => {
      await seedTablero();
      await testEnv.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), 'tbl_userMemberships', 'no_profile__A'), {
          ...canonicalMembership('no_profile', 'A', role), allowedDashboardIds: ['a'], editableDashboardIds: ['a'], capabilities: ['viewer', 'editor', 'plan_editor', 'strategy_reader'],
        });
      });
      await testEnv.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), 'tbl_strategicObjectives', 's02_a'), { clientId: 'A' });
      });
      const db = testEnv.authenticatedContext('no_profile').firestore();
      for (const ref of [doc(db, 'tbl_dashboards', 'a'), doc(db, 'tbl_dashboards', 'a', 'items', 'kpi'), doc(db, 'tbl_actionPlans', 'a')]) {
        await assertFails(getDoc(ref));
        await assertFails(updateDoc(ref, { title: 'denied' }));
      }
      await assertFails(getDoc(doc(db, 'tbl_strategicObjectives', 's02_a')));
      await assertFails(updateDoc(doc(db, 'tbl_strategicObjectives', 's02_a'), { title: 'denied' }));
    });

    it('canonical viewer is read-only; admin stays tenant scoped; suspension revokes legacy fallback', async () => {
      await seedTablero();
      await testEnv.withSecurityRulesDisabled(async context => {
        const db = context.firestore();
        await setDoc(doc(db, 'tbl_userMemberships', 'member_a__A'), { ...canonicalMembership('member_a', 'A'), allowedDashboardIds: ['a'], capabilities: ['viewer'] });
        await setDoc(doc(db, 'tbl_userMemberships', 'admin_a__A'), canonicalMembership('admin_a', 'A', 'tenant_admin'));
        await updateDoc(doc(db, 'tbl_users', 'admin_a'), { globalRole: 'Member', clientId: 'ALL' });
      });
      const viewer = testEnv.authenticatedContext('member_a').firestore();
      await assertSucceeds(getDoc(doc(viewer, 'tbl_dashboards', 'a')));
      await assertSucceeds(getDoc(doc(viewer, 'tbl_dashboards', 'a', 'items', 'kpi')));
      await assertSucceeds(getDoc(doc(viewer, 'tbl_actionPlans', 'a')));
      await assertFails(updateDoc(doc(viewer, 'tbl_dashboards', 'a', 'items', 'kpi'), { activityConfig: { 0: [] }, monthlyProgress: [20] }));
      await assertFails(updateDoc(doc(viewer, 'tbl_actionPlans', 'a'), { status: 'completed' }));
      await assertFails(getDoc(doc(viewer, 'tbl_dashboards', 'b')));
      const admin = testEnv.authenticatedContext('admin_a').firestore();
      await assertSucceeds(updateDoc(doc(admin, 'tbl_dashboards', 'a', 'items', 'kpi'), { activityConfig: { 0: [] } }));
      await assertSucceeds(updateDoc(doc(admin, 'tbl_actionPlans', 'a'), { status: 'completed' }));
      await assertFails(updateDoc(doc(admin, 'tbl_dashboards', 'b', 'items', 'kpi'), { activityConfig: { 0: [] } }));
      await assertFails(updateDoc(doc(admin, 'tbl_actionPlans', 'b'), { status: 'completed' }));
      await testEnv.withSecurityRulesDisabled(async context => {
        await updateDoc(doc(context.firestore(), 'tbl_userMemberships', 'admin_a__A'), { status: 'suspended' });
      });
      await assertFails(getDoc(doc(admin, 'tbl_dashboards', 'a')));
      await assertFails(updateDoc(doc(admin, 'tbl_dashboards', 'a', 'items', 'kpi'), { activityConfig: {} }));
      await assertFails(updateDoc(doc(admin, 'tbl_actionPlans', 'a'), { status: 'planned' }));
    });

    it('platform email plus legacy ALL preserves catalogue authority without business grants', async () => {
      await seedTablero();
      await testEnv.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), 'tbl_users', 'platform_all'), { clientId: 'A,all', globalRole: 'Admin' });
      });
      const db = testEnv.authenticatedContext('platform_all', { email: 'leonprior@gmail.com' }).firestore();
      await assertSucceeds(getDocs(collection(db, 'tbl_managedClients')));
      for (const id of ['a', 'b']) {
        await assertFails(getDoc(doc(db, 'tbl_dashboards', id)));
        await assertFails(updateDoc(doc(db, 'tbl_dashboards', id, 'items', 'kpi'), { activityConfig: {} }));
        await assertFails(updateDoc(doc(db, 'tbl_actionPlans', id), { status: 'completed' }));
      }
    });
  });

  describe('AUD-04: ActionPlan indicatorId referential integrity', () => {
    beforeEach(async () => {
      await seedTablero();
      await testEnv.withSecurityRulesDisabled(async context => {
        const db = context.firestore();
        await setDoc(doc(db, 'tbl_userMemberships', 'admin_a__A'), {
          ...canonicalMembership('admin_a', 'A'),
          role: 'tenant_admin',
          capabilities: ['plan_editor', 'editor', 'viewer'],
        });
        await setDoc(doc(db, 'tbl_dashboards', 'a', 'items', 'kpi-valid'), { id: 'kpi-valid', monthlyProgress: [100] });
        await setDoc(doc(db, 'tbl_dashboards', 'view', 'items', 'kpi-other-board'), { id: 'kpi-other-board', monthlyProgress: [50] });
        await setDoc(doc(db, 'tbl_dashboards', 'b', 'items', 'kpi-other-tenant'), { id: 'kpi-other-tenant', monthlyProgress: [20] });
      });
    });

    it('CASE 1: allows create when indicator exists in the target dashboard', async () => {
      const admin = testEnv.authenticatedContext('admin_a').firestore();
      await assertSucceeds(setDoc(doc(admin, 'tbl_actionPlans', 'plan-valid-indicator'), {
        clientId: 'A',
        dashboardId: 'a',
        indicatorId: 'kpi-valid',
        status: 'planned',
      }));
    });

    it('CASE 2: denies create when indicator does not exist anywhere', async () => {
      const admin = testEnv.authenticatedContext('admin_a').firestore();
      await assertFails(setDoc(doc(admin, 'tbl_actionPlans', 'plan-missing-indicator'), {
        clientId: 'A',
        dashboardId: 'a',
        indicatorId: 'kpi-does-not-exist',
        status: 'planned',
      }));
    });

    it('CASE 3: denies create when indicator exists but in another dashboard of same tenant', async () => {
      const admin = testEnv.authenticatedContext('admin_a').firestore();
      await assertFails(setDoc(doc(admin, 'tbl_actionPlans', 'plan-wrong-dashboard-indicator'), {
        clientId: 'A',
        dashboardId: 'a',
        indicatorId: 'kpi-other-board',
        status: 'planned',
      }));
    });

    it('CASE 4: denies create when indicator belongs to another tenant', async () => {
      const admin = testEnv.authenticatedContext('admin_a').firestore();
      await assertFails(setDoc(doc(admin, 'tbl_actionPlans', 'plan-cross-tenant-indicator'), {
        clientId: 'A',
        dashboardId: 'a',
        indicatorId: 'kpi-other-tenant',
        status: 'planned',
      }));
    });

    it('CASE 5: confirms indicatorId mutation is denied on update', async () => {
      const admin = testEnv.authenticatedContext('admin_a').firestore();
      await testEnv.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), 'tbl_actionPlans', 'plan-immutable-check'), {
          clientId: 'A',
          dashboardId: 'a',
          indicatorId: 'kpi-valid',
          status: 'planned',
        });
      });
      await assertFails(updateDoc(doc(admin, 'tbl_actionPlans', 'plan-immutable-check'), {
        indicatorId: 'kpi-does-not-exist',
      }));
    });
  });

  describe('HOTFIX: Legacy Client Identity Casing Normalization', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        // Seed legacy users with mixed casing
        await setDoc(doc(db, 'tbl_users', 'legacy_user_lower_ips'), {
          uid: 'legacy_user_lower_ips',
          clientId: 'ips',
          globalRole: 'Member',
          dashboardAccess: {
            'board_ips_1': 'Viewer',
            'board_ips_2': 'Editor',
          },
        });

        await setDoc(doc(db, 'tbl_users', 'legacy_user_upper_ips'), {
          uid: 'legacy_user_upper_ips',
          clientId: 'IPS',
          globalRole: 'Member',
          dashboardAccess: {
            'board_ips_1': 'Viewer',
          },
        });

        await setDoc(doc(db, 'tbl_users', 'legacy_user_lower_lvp'), {
          uid: 'legacy_user_lower_lvp',
          clientId: 'lvp',
          globalRole: 'Member',
          dashboardAccess: {
            'board_lvp_1': 'Viewer',
          },
        });

        // Seed dashboards
        await setDoc(doc(db, 'tbl_dashboards', 'board_ips_1'), {
          id: 'board_ips_1',
          clientId: 'IPS',
          title: 'Board IPS 1',
          year: 2026,
        });

        await setDoc(doc(db, 'tbl_dashboards', 'board_ips_2'), {
          id: 'board_ips_2',
          clientId: 'IPS',
          title: 'Board IPS 2',
          year: 2026,
        });

        await setDoc(doc(db, 'tbl_dashboards', 'board_ips_no_access'), {
          id: 'board_ips_no_access',
          clientId: 'IPS',
          title: 'Board IPS No Access',
          year: 2026,
        });

        await setDoc(doc(db, 'tbl_dashboards', 'board_lvp_1'), {
          id: 'board_lvp_1',
          clientId: 'LVP',
          title: 'Board LVP 1',
          year: 2026,
        });

        // Seed client catalog
        await setDoc(doc(db, 'tbl_managedClients', 'IPS'), {
          id: 'IPS',
          name: 'GRUPO IPS',
        });

        await setDoc(doc(db, 'tbl_managedClients', 'LVP'), {
          id: 'LVP',
          name: 'LVP',
        });
      });
    });

    it('CASE 1: legacy user clientId = "ips" can read dashboard clientId = "IPS"', async () => {
      const userDb = testEnv.authenticatedContext('legacy_user_lower_ips').firestore();
      await assertSucceeds(getDoc(doc(userDb, 'tbl_dashboards', 'board_ips_1')));
      const q = query(
        collection(userDb, 'tbl_dashboards'),
        where('clientId', '==', 'IPS'),
        where('year', '==', 2026),
        where(documentId(), 'in', ['board_ips_1'])
      );
      await assertSucceeds(getDocs(q));
    });

    it('CASE 2: legacy user clientId = "IPS" continues reading dashboard IPS', async () => {
      const userDb = testEnv.authenticatedContext('legacy_user_upper_ips').firestore();
      await assertSucceeds(getDoc(doc(userDb, 'tbl_dashboards', 'board_ips_1')));
    });

    it('CASE 3: legacy user clientId = "ips" can read tbl_managedClients/IPS', async () => {
      const userDb = testEnv.authenticatedContext('legacy_user_lower_ips').firestore();
      await assertSucceeds(getDoc(doc(userDb, 'tbl_managedClients', 'IPS')));
    });

    it('CASE 4: legacy user clientId = "ips" CANNOT read tenant LVP', async () => {
      const userDb = testEnv.authenticatedContext('legacy_user_lower_ips').firestore();
      await assertFails(getDoc(doc(userDb, 'tbl_dashboards', 'board_lvp_1')));
      await assertFails(getDoc(doc(userDb, 'tbl_managedClients', 'LVP')));
    });

    it('CASE 5: legacy user clientId = "lvp" CANNOT read IPS', async () => {
      const userDb = testEnv.authenticatedContext('legacy_user_lower_lvp').firestore();
      await assertFails(getDoc(doc(userDb, 'tbl_dashboards', 'board_ips_1')));
      await assertFails(getDoc(doc(userDb, 'tbl_managedClients', 'IPS')));
    });

    it('CASE 6: casing normalization does NOT grant SuperAdmin / Platform privileges', async () => {
      const userDb = testEnv.authenticatedContext('legacy_user_lower_ips').firestore();
      await assertFails(getDoc(doc(userDb, 'tbl_platformAdmins', 'other_admin')));
      await assertFails(setDoc(doc(userDb, 'tbl_platformAdmins', 'legacy_user_lower_ips'), {
        uid: 'legacy_user_lower_ips',
        status: 'active',
        schemaVersion: 1,
      }));
    });

    it('CASE 7: dashboardAccess continues to be strictly enforced', async () => {
      const userDb = testEnv.authenticatedContext('legacy_user_lower_ips').firestore();
      await assertFails(getDoc(doc(userDb, 'tbl_dashboards', 'board_ips_no_access')));
    });
  });

  describe('HOTFIX: Dashboard Query Null Resource Compatibility', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        // Seed legacy user with access to board_ips_a and non-existent IDs in dashboardAccess
        await setDoc(doc(db, 'tbl_users', 'legacy_user_null_res'), {
          uid: 'legacy_user_null_res',
          clientId: 'ips',
          globalRole: 'Member',
          dashboardAccess: {
            'board_ips_a': 'Editor',
            'non_existent_b': 'Editor',
          },
        });

        // Seed authorized dashboard A
        await setDoc(doc(db, 'tbl_dashboards', 'board_ips_a'), {
          id: 'board_ips_a',
          clientId: 'IPS',
          title: 'Board IPS A',
          year: 2026,
        });

        // Seed unauthorized dashboard B of same tenant
        await setDoc(doc(db, 'tbl_dashboards', 'board_ips_unauthorized'), {
          id: 'board_ips_unauthorized',
          clientId: 'IPS',
          title: 'Board IPS Unauthorized',
          year: 2026,
        });

        // Seed dashboard of another tenant LVP
        await setDoc(doc(db, 'tbl_dashboards', 'board_lvp_other'), {
          id: 'board_lvp_other',
          clientId: 'LVP',
          title: 'Board LVP Other',
          year: 2026,
        });
      });
    });

    it('CASE 1: query with [A, NON_EXISTENT_B] succeeds when A is authorized (demonstrating RED before fix)', async () => {
      const userDb = testEnv.authenticatedContext('legacy_user_null_res').firestore();
      const q = query(
        collection(userDb, 'tbl_dashboards'),
        where('clientId', '==', 'IPS'),
        where('year', '==', 2026),
        where(documentId(), 'in', ['board_ips_a', 'non_existent_b'])
      );
      await assertSucceeds(getDocs(q));
    });

    it('CASE 2: query with only [A] succeeds', async () => {
      const userDb = testEnv.authenticatedContext('legacy_user_null_res').firestore();
      const q = query(
        collection(userDb, 'tbl_dashboards'),
        where('clientId', '==', 'IPS'),
        where('year', '==', 2026),
        where(documentId(), 'in', ['board_ips_a'])
      );
      await assertSucceeds(getDocs(q));
    });

    it('CASE 3: direct get A succeeds', async () => {
      const userDb = testEnv.authenticatedContext('legacy_user_null_res').firestore();
      await assertSucceeds(getDoc(doc(userDb, 'tbl_dashboards', 'board_ips_a')));
    });

    it('CASE 4: query with [A, EXISTING_UNAUTHORIZED_B] fails and is NOT bypassed', async () => {
      const userDb = testEnv.authenticatedContext('legacy_user_null_res').firestore();
      const q = query(
        collection(userDb, 'tbl_dashboards'),
        where('clientId', '==', 'IPS'),
        where('year', '==', 2026),
        where(documentId(), 'in', ['board_ips_a', 'board_ips_unauthorized'])
      );
      await assertFails(getDocs(q));
      await assertFails(getDoc(doc(userDb, 'tbl_dashboards', 'board_ips_unauthorized')));
    });

    it('CASE 5: legacy user IPS CANNOT read dashboard LVP', async () => {
      const userDb = testEnv.authenticatedContext('legacy_user_null_res').firestore();
      await assertFails(getDoc(doc(userDb, 'tbl_dashboards', 'board_lvp_other')));
      const q = query(
        collection(userDb, 'tbl_dashboards'),
        where('clientId', '==', 'LVP'),
        where('year', '==', 2026),
        where(documentId(), 'in', ['board_lvp_other'])
      );
      await assertFails(getDocs(q));
    });

    it('CASE 6: nonexistent IDs do NOT grant additional access', async () => {
      const userDb = testEnv.authenticatedContext('legacy_user_null_res').firestore();
      await assertFails(getDoc(doc(userDb, 'tbl_dashboards', 'non_existent_b')));
    });
  });

  describe('Contribution Objectives Permissions', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        // Usuario miembro sin capacidad estratégica
        await setDoc(doc(db, 'tbl_users', 'member_no_strat'), {
          uid: 'member_no_strat',
          clientId: 'IPS',
          globalRole: 'Member'
        });
        await setDoc(doc(db, 'tbl_userMemberships', 'member_no_strat__IPS'), {
          ...canonicalMembership('member_no_strat', 'IPS'),
          capabilities: []
        });

        // Asegurar existencia de OE y Dashboard para asignaciones
        await setDoc(doc(db, 'tbl_strategicObjectives', 'oe_test_1'), {
          id: 'oe_test_1',
          clientId: 'IPS',
          title: 'OE Test'
        });
        await setDoc(doc(db, 'tbl_contributionObjectives', 'oc_existing_1'), {
          id: 'oc_existing_1',
          clientId: 'IPS',
          title: 'OC Existente',
          primaryStrategicObjectiveId: 'oe_test_1'
        });
        await setDoc(doc(db, 'tbl_contributionIndicatorAssignments', 'asgn_existing_1'), {
          id: 'asgn_existing_1',
          clientId: 'IPS',
          contributionObjectiveId: 'oc_existing_1'
        });

        // Usuario administrador legacy con clientId en minúsculas ("ips") representativo de producción
        await setDoc(doc(db, 'tbl_users', 'admin_ips_lower'), {
          uid: 'admin_ips_lower',
          clientId: 'ips',
          globalRole: 'Admin'
        });
      });
    });

    // CASE 2B: admin con clientId legacy en minúsculas puede leer e inicializar counter de OC
    it('CASE 2B: admin con clientId legacy en minúsculas puede leer e inicializar counter de OC', async () => {
      const adminDb = testEnv.authenticatedContext('admin_ips_lower').firestore();
      const counterRef = doc(adminDb, 'tbl_strategyCounters', 'cnt_IPS_OC_ASAC');
      await assertSucceeds(getDoc(counterRef));
      await assertSucceeds(setDoc(counterRef, {
        id: 'cnt_IPS_OC_ASAC',
        clientId: 'IPS',
        scope: 'ASAC',
        lastIssuedSequence: 1
      }));
    });

    // CASE 2C: admin con clientId legacy puede ejecutar la transacción completa de creación de OC con su counter
    it('CASE 2C: admin con clientId legacy puede ejecutar la transacción completa de creación de OC con su counter', async () => {
      const adminDb = testEnv.authenticatedContext('admin_ips_lower').firestore();
      const counterRef = doc(adminDb, 'tbl_strategyCounters', 'cnt_IPS_OC_OPE');
      const ocRef = doc(adminDb, 'tbl_contributionObjectives', 'oc_tx_new');

      await assertSucceeds(adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(counterRef);
        const lastSeq = snap.exists ? (snap.data().lastIssuedSequence || 0) : 0;
        const nextSeq = lastSeq + 1;
        tx.set(counterRef, {
          id: 'cnt_IPS_OC_OPE',
          clientId: 'IPS',
          scope: 'OPE',
          lastIssuedSequence: nextSeq
        }, { merge: true });
        tx.set(ocRef, {
          id: 'oc_tx_new',
          clientId: 'IPS',
          areaName: 'OPERACIONES',
          sequenceNumber: nextSeq,
          displayCode: 'OC-OPE-01',
          title: 'OC Transaccional',
          primaryStrategicObjectiveId: 'oe_test_1'
        }, { merge: true });
      }));
    });

    // CASE 1: usuario autorizado puede listar contributionObjectives de su tenant
    it('CASE 1: usuario autorizado puede listar contributionObjectives de su tenant', async () => {
      const adminDb = testEnv.authenticatedContext('admin_ips').firestore();
      const q = query(collection(adminDb, 'tbl_contributionObjectives'), where('clientId', '==', 'IPS'));
      await assertSucceeds(getDocs(q));
    });

    // CASE 2: usuario autorizado puede crear un OC válido
    it('CASE 2: usuario autorizado puede crear un OC válido', async () => {
      const adminDb = testEnv.authenticatedContext('admin_ips').firestore();
      const ref = doc(adminDb, 'tbl_contributionObjectives', 'oc_new_valid');
      await assertSucceeds(setDoc(ref, {
        id: 'oc_new_valid',
        clientId: 'IPS',
        title: 'Nuevo OC',
        primaryStrategicObjectiveId: 'oe_test_1'
      }));
    });

    // CASE 3: usuario autorizado puede actualizar un OC de su tenant
    it('CASE 3: usuario autorizado puede actualizar un OC de su tenant', async () => {
      const adminDb = testEnv.authenticatedContext('admin_ips').firestore();
      const ref = doc(adminDb, 'tbl_contributionObjectives', 'oc_existing_1');
      await assertSucceeds(updateDoc(ref, {
        title: 'OC Actualizado'
      }));
    });

    // CASE 4: usuario autorizado puede eliminar un OC cuando no viola integridad existente
    it('CASE 4: usuario autorizado puede eliminar un OC cuando no viola integridad existente', async () => {
      const adminDb = testEnv.authenticatedContext('admin_ips').firestore();
      const ref = doc(adminDb, 'tbl_contributionObjectives', 'oc_existing_1');
      await assertSucceeds(deleteDoc(ref));
    });

    // CASE 4B: admin con clientId legacy puede eliminar OC y actualizar el counter en transacción
    it('CASE 4B: admin con clientId legacy puede eliminar OC y actualizar el counter en transacción', async () => {
      const adminDb = testEnv.authenticatedContext('admin_ips_lower').firestore();
      const counterRef = doc(adminDb, 'tbl_strategyCounters', 'cnt_IPS_OC_DEL');
      const ocRef = doc(adminDb, 'tbl_contributionObjectives', 'oc_to_delete');

      // Pre-sembrar
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'tbl_strategyCounters', 'cnt_IPS_OC_DEL'), {
          id: 'cnt_IPS_OC_DEL',
          clientId: 'IPS',
          scope: 'DEL',
          lastIssuedSequence: 2
        });
        await setDoc(doc(db, 'tbl_contributionObjectives', 'oc_to_delete'), {
          id: 'oc_to_delete',
          clientId: 'IPS',
          sequenceNumber: 2,
          primaryStrategicObjectiveId: 'oe_test_1'
        });
      });

      await assertSucceeds(adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(counterRef);
        const counter = snap.data();
        tx.set(counterRef, {
          ...counter,
          lastIssuedSequence: 1
        }, { merge: true });
        tx.delete(ocRef);
      }));
    });

    // CASE 5: usuario autorizado puede leer contributionIndicatorAssignments
    it('CASE 5: usuario autorizado puede leer contributionIndicatorAssignments', async () => {
      const adminDb = testEnv.authenticatedContext('admin_ips').firestore();
      const q = query(collection(adminDb, 'tbl_contributionIndicatorAssignments'), where('clientId', '==', 'IPS'));
      await assertSucceeds(getDocs(q));
    });

    // CASE 6: usuario autorizado puede crear KPI → OC assignment
    it('CASE 6: usuario autorizado puede crear KPI → OC assignment', async () => {
      const adminDb = testEnv.authenticatedContext('admin_ips').firestore();
      const ref = doc(adminDb, 'tbl_contributionIndicatorAssignments', 'asgn_new_valid');
      await assertSucceeds(setDoc(ref, {
        id: 'asgn_new_valid',
        clientId: 'IPS',
        contributionObjectiveId: 'oc_existing_1',
        dashboardId: '10',
        itemId: '1'
      }));
    });

    // CASE 7: usuario de otro tenant NO puede leer OCs
    it('CASE 7: usuario de otro tenant NO puede leer OCs', async () => {
      const otherDb = testEnv.authenticatedContext('user_clientB').firestore();
      const ref = doc(otherDb, 'tbl_contributionObjectives', 'oc_existing_1');
      await assertFails(getDoc(ref));
      const q = query(collection(otherDb, 'tbl_contributionObjectives'), where('clientId', '==', 'IPS'));
      await assertFails(getDocs(q));
    });

    // CASE 8: usuario de otro tenant NO puede crear OCs
    it('CASE 8: usuario de otro tenant NO puede crear OCs', async () => {
      const otherDb = testEnv.authenticatedContext('user_clientB').firestore();
      const ref = doc(otherDb, 'tbl_contributionObjectives', 'oc_cross_tenant');
      await assertFails(setDoc(ref, {
        id: 'oc_cross_tenant',
        clientId: 'IPS',
        title: 'Cross Tenant OC'
      }));
    });

    // CASE 9: Member sin capacidad estratégica NO puede administrar OCs
    it('CASE 9: Member sin capacidad estratégica NO puede administrar OCs', async () => {
      const memberDb = testEnv.authenticatedContext('member_no_strat').firestore();
      const ref = doc(memberDb, 'tbl_contributionObjectives', 'oc_member_attack');
      await assertFails(setDoc(ref, {
        id: 'oc_member_attack',
        clientId: 'IPS',
        title: 'Unauthorized Create'
      }));
      const refUpdate = doc(memberDb, 'tbl_contributionObjectives', 'oc_existing_1');
      await assertFails(updateDoc(refUpdate, { title: 'Unauthorized Update' }));
      await assertFails(deleteDoc(refUpdate));
    });

    // CASE 10: Viewer/Reader mantiene sólo lectura cuando corresponda
    it('CASE 10: Viewer/Reader mantiene sólo lectura cuando corresponda', async () => {
      const readerDb = testEnv.authenticatedContext('user_ips').firestore();
      // Reader puede leer
      const q = query(collection(readerDb, 'tbl_contributionObjectives'), where('clientId', '==', 'IPS'));
      await assertSucceeds(getDocs(q));
      const ref = doc(readerDb, 'tbl_contributionObjectives', 'oc_existing_1');
      await assertSucceeds(getDoc(ref));
      // Reader NO puede mutar (crear, actualizar, eliminar)
      await assertFails(setDoc(doc(readerDb, 'tbl_contributionObjectives', 'oc_reader_create'), {
        id: 'oc_reader_create',
        clientId: 'IPS',
        title: 'Reader Create'
      }));
      await assertFails(updateDoc(ref, { title: 'Reader Edit' }));
      await assertFails(deleteDoc(ref));
    });
  });

  describe('Contribution Objectives Read Permissions — Initial Load', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        // Usuario administrador legacy con clientId en minúsculas ("ips")
        await setDoc(doc(db, 'tbl_users', 'admin_ips_lower'), {
          uid: 'admin_ips_lower',
          clientId: 'ips',
          globalRole: 'Admin'
        });

        // Documentos de estrategia con clientId en mayúsculas ("IPS")
        await setDoc(doc(db, 'tbl_areaStrategyConfigs', 'area_cfg_asac'), {
          id: 'area_cfg_asac',
          clientId: 'IPS',
          areaName: 'ATENCIÓN Y SERVICIO AL CLIENTE',
          code: 'ASAC'
        });

        await setDoc(doc(db, 'tbl_strategicObjectives', 'oe_prod_1'), {
          id: 'oe_prod_1',
          clientId: 'IPS',
          code: 'OE01',
          title: 'OE Producción'
        });

        // Usuario de otro tenant (CLIENT_B)
        await setDoc(doc(db, 'tbl_users', 'other_tenant_user'), {
          uid: 'other_tenant_user',
          clientId: 'CLIENT_B',
          globalRole: 'Director'
        });

        // Usuario miembro de IPS sin capacidad estratégica
        await setDoc(doc(db, 'tbl_users', 'prod_member_no_strat'), {
          uid: 'prod_member_no_strat',
          clientId: 'IPS',
          globalRole: 'Member'
        });
      });
    });

    // CASE 1: admin IPS puede listar OCs IPS
    it('CASE 1: admin IPS puede listar OCs IPS', async () => {
      const adminDb = testEnv.authenticatedContext('admin_ips_lower').firestore();
      const q = query(collection(adminDb, 'tbl_contributionObjectives'), where('clientId', '==', 'IPS'));
      await assertSucceeds(getDocs(q));
    });

    // CASE 2: admin IPS puede listar assignments IPS
    it('CASE 2: admin IPS puede listar assignments IPS', async () => {
      const adminDb = testEnv.authenticatedContext('admin_ips_lower').firestore();
      const q = query(collection(adminDb, 'tbl_contributionIndicatorAssignments'), where('clientId', '==', 'IPS'));
      await assertSucceeds(getDocs(q));
    });

    // CASE 3: admin IPS puede leer area configs IPS
    it('CASE 3: admin IPS puede leer area configs IPS', async () => {
      const adminDb = testEnv.authenticatedContext('admin_ips_lower').firestore();
      const q = query(collection(adminDb, 'tbl_areaStrategyConfigs'), where('clientId', '==', 'IPS'));
      await assertSucceeds(getDocs(q));
    });

    // CASE 4: admin IPS puede leer strategic objectives IPS
    it('CASE 4: admin IPS puede leer strategic objectives IPS', async () => {
      const adminDb = testEnv.authenticatedContext('admin_ips_lower').firestore();
      const q = query(collection(adminDb, 'tbl_strategicObjectives'), where('clientId', '==', 'IPS'));
      await assertSucceeds(getDocs(q));
    });

    // CASE 5: otro tenant continúa DENY
    it('CASE 5: otro tenant continúa DENY', async () => {
      const otherDb = testEnv.authenticatedContext('other_tenant_user').firestore();
      const q = query(collection(otherDb, 'tbl_contributionObjectives'), where('clientId', '==', 'IPS'));
      await assertFails(getDocs(q));
    });

    // CASE 6: Member sin capacidad estratégica continúa DENY cuando corresponda
    it('CASE 6: Member sin capacidad estratégica continúa DENY cuando corresponda', async () => {
      const memberDb = testEnv.authenticatedContext('prod_member_no_strat').firestore();
      const q = query(collection(memberDb, 'tbl_contributionObjectives'), where('clientId', '==', 'IPS'));
      await assertFails(getDocs(q));
    });

    // CASE 7: leonprior@gmail.com (admin con clientId "LVP,IPS,all") consultando IPS e IPS_DIRECCION
    it('CASE 7: leonprior@gmail.com con email de plataforma y clientId multi-tenant', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'tbl_users', 'user_leon_gmail'), {
          uid: 'user_leon_gmail',
          email: 'leonprior@gmail.com',
          clientId: 'LVP,IPS,all',
          globalRole: 'Admin'
        });
        // Platform authority needs explicit tenant grants; legacy ALL is not authority.
        for (const clientId of ['IPS', 'IPS_DIRECCION']) {
          await setDoc(doc(db, 'tbl_userMemberships', 'user_leon_gmail__' + clientId), canonicalMembership('user_leon_gmail', clientId, 'tenant_admin'));
        }
        await setDoc(doc(db, 'tbl_areaStrategyConfigs', 'area_cfg_ips_dir'), {
          id: 'area_cfg_ips_dir',
          clientId: 'IPS_DIRECCION',
          areaName: 'OPERACIONES',
          code: 'OPE'
        });
      });
      const db = testEnv.authenticatedContext('user_leon_gmail', { email: 'leonprior@gmail.com' }).firestore();

      // Lecturas de colecciones estratégicas
      const qIps = query(collection(db, 'tbl_contributionObjectives'), where('clientId', '==', 'IPS'));
      await assertSucceeds(getDocs(qIps));
      const qIpsDir = query(collection(db, 'tbl_contributionObjectives'), where('clientId', '==', 'IPS_DIRECCION'));
      await assertSucceeds(getDocs(qIpsDir));
      const qAssignments = query(collection(db, 'tbl_contributionIndicatorAssignments'), where('clientId', '==', 'IPS'));
      await assertSucceeds(getDocs(qAssignments));
      const qAreaConfigs = query(collection(db, 'tbl_areaStrategyConfigs'), where('clientId', '==', 'IPS_DIRECCION'));
      await assertSucceeds(getDocs(qAreaConfigs));
      const qStrategic = query(collection(db, 'tbl_strategicObjectives'), where('clientId', '==', 'IPS'));
      await assertSucceeds(getDocs(qStrategic));

      // Creación, edición y eliminación de OC
      const ocRef = doc(db, 'tbl_contributionObjectives', 'oc_leon_gmail_test');
      await assertSucceeds(setDoc(ocRef, {
        id: 'oc_leon_gmail_test',
        clientId: 'IPS',
        displayCode: 'OC-TEST-01',
        title: 'OC Test Platform Admin',
        areaName: 'OPERACIONES'
      }));
      await assertSucceeds(updateDoc(ocRef, { title: 'OC Test Platform Admin Updated' }));
      await assertSucceeds(deleteDoc(ocRef));

      // Asignación de KPI a OC
      const asgnRef = doc(db, 'tbl_contributionIndicatorAssignments', 'asgn_leon_gmail_test');
      await assertSucceeds(setDoc(asgnRef, {
        id: 'asgn_leon_gmail_test',
        clientId: 'IPS',
        contributionObjectiveId: 'oc_test',
        dashboardId: 'd1',
        itemId: 'kpi1'
      }));
      await assertSucceeds(deleteDoc(asgnRef));
    });

    // CASE 8: leon@leonprior.com con membresía canónica en IPS e IPS_DIRECCION
    it('CASE 8: leon@leonprior.com con membresía canónica en IPS e IPS_DIRECCION', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'tbl_users', 'user_leon_corp'), {
          uid: 'user_leon_corp',
          email: 'leon@leonprior.com',
          clientId: 'IPS',
          globalRole: 'Admin'
        });
        await setDoc(doc(db, 'tbl_userMemberships', 'user_leon_corp__IPS'), {
          userId: 'user_leon_corp',
          clientId: 'IPS',
          role: 'tenant_admin',
          status: 'active',
          scopeType: 'tenant',
          capabilities: ['viewer', 'editor', 'metadata_editor', 'plan_editor', 'strategy_reader']
        });
        await setDoc(doc(db, 'tbl_userMemberships', 'user_leon_corp__IPS_DIRECCION'), {
          userId: 'user_leon_corp',
          clientId: 'IPS_DIRECCION',
          role: 'tenant_admin',
          status: 'active',
          scopeType: 'tenant',
          capabilities: ['viewer', 'editor', 'metadata_editor', 'plan_editor', 'strategy_reader']
        });
      });
      const db = testEnv.authenticatedContext('user_leon_corp', { email: 'leon@leonprior.com' }).firestore();
      const qIps = query(collection(db, 'tbl_contributionObjectives'), where('clientId', '==', 'IPS'));
      await assertSucceeds(getDocs(qIps));
      const qIpsDir = query(collection(db, 'tbl_contributionObjectives'), where('clientId', '==', 'IPS_DIRECCION'));
      await assertSucceeds(getDocs(qIpsDir));
      const qAssignments = query(collection(db, 'tbl_contributionIndicatorAssignments'), where('clientId', '==', 'IPS_DIRECCION'));
      await assertSucceeds(getDocs(qAssignments));
      const qAreaConfigs = query(collection(db, 'tbl_areaStrategyConfigs'), where('clientId', '==', 'IPS_DIRECCION'));
      await assertSucceeds(getDocs(qAreaConfigs));
    });
  });

  describe('Strategy Counters — Multi-Tenant & IPS_DIRECCION Permissions', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        // Admin leonprior@gmail.com con clientId multi-tenant "LVP,IPS,all"
        await setDoc(doc(db, 'tbl_users', 'user_admin_multi'), {
          uid: 'user_admin_multi',
          email: 'leonprior@gmail.com',
          clientId: 'LVP,IPS,all',
          globalRole: 'Admin'
        });
        // Platform authority needs explicit tenant grants; legacy ALL is not authority.
        for (const clientId of ['IPS', 'IPS_DIRECCION']) {
          await setDoc(doc(db, 'tbl_userMemberships', 'user_admin_multi__' + clientId), canonicalMembership('user_admin_multi', clientId, 'tenant_admin'));
        }

        // Admin con membresía canónica en IPS_DIRECCION
        await setDoc(doc(db, 'tbl_users', 'user_admin_ips_dir'), {
          uid: 'user_admin_ips_dir',
          email: 'leon@leonprior.com',
          clientId: 'IPS',
          globalRole: 'Admin'
        });
        await setDoc(doc(db, 'tbl_userMemberships', 'user_admin_ips_dir__IPS_DIRECCION'), {
          userId: 'user_admin_ips_dir',
          clientId: 'IPS_DIRECCION',
          role: 'tenant_admin',
          status: 'active',
          scopeType: 'tenant',
          capabilities: ['viewer', 'editor', 'metadata_editor', 'plan_editor', 'strategy_reader']
        });

        // Usuario de otro tenant (CLIENT_B)
        await setDoc(doc(db, 'tbl_users', 'other_tenant_user_b'), {
          uid: 'other_tenant_user_b',
          clientId: 'CLIENT_B',
          globalRole: 'Director'
        });

        // Usuario Member de IPS_DIRECCION sin rol admin ni capacidad de estrategia
        await setDoc(doc(db, 'tbl_users', 'member_ips_dir_no_strat'), {
          uid: 'member_ips_dir_no_strat',
          clientId: 'IPS_DIRECCION',
          globalRole: 'Member'
        });

        // OE para transacciones
        await setDoc(doc(db, 'tbl_strategicObjectives', 'oe_ips_dir_1'), {
          id: 'oe_ips_dir_1',
          clientId: 'IPS_DIRECCION',
          title: 'OE Dirección'
        });
      });
    });

    // CASE 1: usuario administrador autorizado para IPS_DIRECCION intenta get cnt_IPS_DIRECCION_OC_ASAC (o OPE)
    it('CASE 1: usuario administrador autorizado puede leer (get) el strategy counter no existente/existente de IPS_DIRECCION', async () => {
      const db = testEnv.authenticatedContext('user_admin_multi', { email: 'leonprior@gmail.com' }).firestore();
      const counterRef = doc(db, 'tbl_strategyCounters', 'cnt_IPS_DIRECCION_OC_ASAC');
      await assertSucceeds(getDoc(counterRef));
    });

    // CASE 2: puede inicializar el contador IPS_DIRECCION
    it('CASE 2: puede inicializar el contador IPS_DIRECCION', async () => {
      const db = testEnv.authenticatedContext('user_admin_multi', { email: 'leonprior@gmail.com' }).firestore();
      const counterRef = doc(db, 'tbl_strategyCounters', 'cnt_IPS_DIRECCION_OC_ASAC');
      await assertSucceeds(setDoc(counterRef, {
        id: 'cnt_IPS_DIRECCION_OC_ASAC',
        clientId: 'IPS_DIRECCION',
        scope: 'ASAC',
        lastIssuedSequence: 1
      }));
    });

    // CASE 3: puede actualizar el contador mediante la transacción OC
    it('CASE 3: puede actualizar el contador mediante la transacción OC', async () => {
      const db = testEnv.authenticatedContext('user_admin_multi', { email: 'leonprior@gmail.com' }).firestore();
      const counterRef = doc(db, 'tbl_strategyCounters', 'cnt_IPS_DIRECCION_OC_OPE');
      const ocRef = doc(db, 'tbl_contributionObjectives', 'oc_ips_dir_tx_1');

      await assertSucceeds(db.runTransaction(async (tx) => {
        const snap = await tx.get(counterRef);
        const lastSeq = snap.exists ? (snap.data().lastIssuedSequence || 0) : 0;
        const nextSeq = lastSeq + 1;
        tx.set(counterRef, {
          id: 'cnt_IPS_DIRECCION_OC_OPE',
          clientId: 'IPS_DIRECCION',
          scope: 'OPE',
          lastIssuedSequence: nextSeq
        }, { merge: true });
        tx.set(ocRef, {
          id: 'oc_ips_dir_tx_1',
          clientId: 'IPS_DIRECCION',
          areaName: 'OPERACIONES',
          sequenceNumber: nextSeq,
          displayCode: 'OC-OPE-01',
          title: 'OC Transaccional Dirección',
          primaryStrategicObjectiveId: 'oe_ips_dir_1'
        }, { merge: true });
      }));
    });

    // CASE 4: usuario de otro tenant NO puede leerlo
    it('CASE 4: usuario de otro tenant NO puede leerlo', async () => {
      const otherDb = testEnv.authenticatedContext('other_tenant_user_b').firestore();
      const counterRef = doc(otherDb, 'tbl_strategyCounters', 'cnt_IPS_DIRECCION_OC_ASAC');
      await assertFails(getDoc(counterRef));
    });

    // CASE 5: Member sin capacidad estratégica NO puede administrarlo
    it('CASE 5: Member sin capacidad estratégica NO puede administrarlo', async () => {
      const memberDb = testEnv.authenticatedContext('member_ips_dir_no_strat').firestore();
      const counterRef = doc(memberDb, 'tbl_strategyCounters', 'cnt_IPS_DIRECCION_OC_ASAC');
      await assertFails(getDoc(counterRef));
      await assertFails(setDoc(counterRef, {
        id: 'cnt_IPS_DIRECCION_OC_ASAC',
        clientId: 'IPS_DIRECCION',
        scope: 'ASAC',
        lastIssuedSequence: 1
      }));
    });
  });
});
