/** @jest-environment node */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'demo-stratexa-rules';

let testEnv: RulesTestEnvironment;

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
});
