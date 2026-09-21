import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HierarchySidebar } from '../components/HierarchySidebar';
import { Dashboard as DashboardType, User, GlobalUserRole } from '../types';

describe('Universal Navigation & Hierarchy Rules (v9.6.10)', () => {
  const adminUser: User = {
    id: 'admin-1',
    name: 'Admin User',
    email: 'admin@somos.org',
    globalRole: GlobalUserRole.Admin,
    clientId: 'SOMOS',
    dashboardAccess: {},
  };

  const createDashboard = (
    id: string | number,
    title: string,
    group: string = 'GENERAL',
    orderNumber: number = 0,
    isAggregate: boolean = false,
  ): DashboardType => ({
    id,
    title,
    group,
    clientId: 'SOMOS',
    year: 2026,
    items: [],
    orderNumber,
    isAggregate,
  } as any);

  // ─────────────────────────────────────────────────────────────
  // REGLA A: UN ÚNICO TABLERO
  // ─────────────────────────────────────────────────────────────
  test('Regla A: Cliente con un único tablero muestra directamente el tablero sin consolidado', () => {
    const singleBoard = createDashboard('B1', 'Tablero Único Regional', 'REGIONAL');
    const onSelect = jest.fn();

    render(
      <HierarchySidebar
        dashboards={[singleBoard]}
        selectedDashboardId={'B1'}
        onSelectDashboard={onSelect}
        isGlobalAdmin={true}
        isDirector={false}
        isCollapsed={false}
        onToggleCollapse={jest.fn()}
        allUsers={[adminUser]}
        userProfile={adminUser}
        selectedClientId="SOMOS"
      />
    );

    // Debe mostrarse el tablero
    expect(screen.getByText('Tablero Único Regional')).toBeInTheDocument();
    // NO debe existir un nodo CONSOLIDADO
    expect(screen.queryByText('CONSOLIDADO')).not.toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────
  // REGLA B: VARIOS TABLEROS INDEPENDIENTES (GENERAL)
  // ─────────────────────────────────────────────────────────────
  test('Regla B: Varios tableros independientes en GENERAL conservan CONSOLIDADO y aplanan los tableros', () => {
    const b1 = createDashboard('B1', 'Operación Norte', 'GENERAL', 1);
    const b2 = createDashboard('B2', 'Operación Centro', 'GENERAL', 2);
    const b3 = createDashboard('B3', 'Operación Sur', 'GENERAL', 3);
    const globalAgg = createDashboard('agg-global-total-2026', 'SÍNTESIS GLOBAL', 'SÍNTESIS', -100, true);

    const onSelect = jest.fn();

    render(
      <HierarchySidebar
        dashboards={[globalAgg, b1, b2, b3]}
        selectedDashboardId={'agg-global-total-2026'}
        onSelectDashboard={onSelect}
        isGlobalAdmin={true}
        isDirector={false}
        isCollapsed={false}
        onToggleCollapse={jest.fn()}
        allUsers={[adminUser]}
        userProfile={adminUser}
        selectedClientId="SOMOS"
      />
    );

    // Debe existir CONSOLIDADO
    expect(screen.getByText('CONSOLIDADO')).toBeInTheDocument();
    // Y los 3 tableros independientes
    expect(screen.getByText('Operación Norte')).toBeInTheDocument();
    expect(screen.getByText('Operación Centro')).toBeInTheDocument();
    expect(screen.getByText('Operación Sur')).toBeInTheDocument();
    // NO debe existir una carpeta GENERAL redundante compitiendo con CONSOLIDADO
    expect(screen.queryByText('★ RESUMEN DIRECTIVO: GENERAL')).not.toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────
  // REGLA C: VARIAS AGRUPACIONES O ÁREAS (LVP / IPS)
  // ─────────────────────────────────────────────────────────────
  test('Regla C: Múltiples agrupaciones conservan CONSOLIDADO general como síntesis multi-área', () => {
    const op1 = createDashboard('OP1', 'Planta Norte', 'OPERACIONES', 1);
    const op2 = createDashboard('OP2', 'Planta Sur', 'OPERACIONES', 2);
    const com1 = createDashboard('COM1', 'Ventas Retail', 'COMERCIAL', 1);
    const com2 = createDashboard('COM2', 'Ventas Mayoreo', 'COMERCIAL', 2);
    const globalAgg = createDashboard('agg-global-total-2026', 'SÍNTESIS GLOBAL', 'SÍNTESIS', -100, true);
    const aggOp = createDashboard('agg-OPERACIONES-2026', '★ RESUMEN DIRECTIVO: OPERACIONES', 'OPERACIONES', -1, true);
    const aggCom = createDashboard('agg-COMERCIAL-2026', '★ RESUMEN DIRECTIVO: COMERCIAL', 'COMERCIAL', -1, true);

    render(
      <HierarchySidebar
        dashboards={[globalAgg, aggOp, aggCom, op1, op2, com1, com2]}
        selectedDashboardId={'agg-global-total-2026'}
        onSelectDashboard={jest.fn()}
        isGlobalAdmin={true}
        isDirector={false}
        isCollapsed={false}
        onToggleCollapse={jest.fn()}
        allUsers={[adminUser]}
        userProfile={adminUser}
        selectedClientId="LVP"
      />
    );

    // Debe existir CONSOLIDADO multi-grupo
    expect(screen.getByText('CONSOLIDADO')).toBeInTheDocument();
    // Deben existir las dos agrupaciones
    expect(screen.getByText('OPERACIONES')).toBeInTheDocument();
    expect(screen.getByText('COMERCIAL')).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────
  // REGLA D: UNA SOLA AGRUPACIÓN FUNCIONAL (SOMOS)
  // ─────────────────────────────────────────────────────────────
  test('Regla D (SOMOS): Una sola agrupación funcional no crea consolidado redundante y lista los 3 tableros directamente', () => {
    const som1 = createDashboard('SOMOS_2026_1', 'SECRETARÍA DE INCLUSIÓN', 'SECRETARÍA DE INCLUSIÓN', 1);
    const som2 = createDashboard('SOMOS_2026_2', 'Inclusión — Guanajuato', 'SECRETARÍA DE INCLUSIÓN', 2);
    const som3 = createDashboard('SOMOS_2026_3', 'Inclusión — Querétaro', 'SECRETARÍA DE INCLUSIÓN', 3);

    render(
      <HierarchySidebar
        dashboards={[som1, som2, som3]}
        selectedDashboardId={'SOMOS_2026_1'}
        onSelectDashboard={jest.fn()}
        isGlobalAdmin={true}
        isDirector={false}
        isCollapsed={false}
        onToggleCollapse={jest.fn()}
        allUsers={[adminUser]}
        userProfile={adminUser}
        selectedClientId="SOMOS"
      />
    );

    // NO debe existir un nivel CONSOLIDADO redundante
    expect(screen.queryByText('CONSOLIDADO')).not.toBeInTheDocument();
    // Deben estar exactamente y directamente los 3 tableros
    expect(screen.getByText('SECRETARÍA DE INCLUSIÓN')).toBeInTheDocument();
    expect(screen.getByText('Inclusión — Guanajuato')).toBeInTheDocument();
    expect(screen.getByText('Inclusión — Querétaro')).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────
  // REGLA F: PERMISOS PARCIALES
  // ─────────────────────────────────────────────────────────────
  test('Regla F: Usuario con permiso parcial a 1 solo tablero en cliente multi-tablero ve solo su tablero', () => {
    const som2 = createDashboard('SOMOS_2026_2', 'Inclusión — Guanajuato', 'SECRETARÍA DE INCLUSIÓN', 2);

    const partialUser: User = {
      id: 'gto-user',
      name: 'GTO User',
      email: 'gto@somos.org',
      globalRole: GlobalUserRole.Viewer,
      clientId: 'SOMOS',
      dashboardAccess: {
        SOMOS_2026_2: 'Viewer' as any,
      },
    };

    render(
      <HierarchySidebar
        dashboards={[som2]}
        selectedDashboardId={'SOMOS_2026_2'}
        onSelectDashboard={jest.fn()}
        isGlobalAdmin={false}
        isDirector={false}
        isCollapsed={false}
        onToggleCollapse={jest.fn()}
        allUsers={[partialUser]}
        userProfile={partialUser}
        selectedClientId="SOMOS"
      />
    );

    expect(screen.getByText('Inclusión — Guanajuato')).toBeInTheDocument();
    expect(screen.queryByText('SECRETARÍA DE INCLUSIÓN')).not.toBeInTheDocument();
    expect(screen.queryByText('Inclusión — Querétaro')).not.toBeInTheDocument();
    expect(screen.queryByText('CONSOLIDADO')).not.toBeInTheDocument();
  });
});
