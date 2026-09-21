import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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

    expect(screen.getByText('Tablero Único Regional')).toBeInTheDocument();
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

    expect(screen.getByText('CONSOLIDADO')).toBeInTheDocument();
    expect(screen.getByText('Operación Norte')).toBeInTheDocument();
    expect(screen.getByText('Operación Centro')).toBeInTheDocument();
    expect(screen.getByText('Operación Sur')).toBeInTheDocument();
    expect(screen.queryByText('★ RESUMEN DIRECTIVO: GENERAL')).not.toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────
  // REGLA C: VARIAS AGRUPACIONES O ÁREAS (LVP / IPS)
  // ─────────────────────────────────────────────────────────────
  test('Regla C: Múltiples agrupaciones conservan CONSOLIDADO general como síntesis multi-área y muestran cada agrupación', () => {
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

    expect(screen.getByText('CONSOLIDADO')).toBeInTheDocument();
    expect(screen.getByText('OPERACIONES')).toBeInTheDocument();
    expect(screen.getByText('COMERCIAL')).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────
  // REGLA D: UNA SOLA AGRUPACIÓN FUNCIONAL (SOMOS)
  // ─────────────────────────────────────────────────────────────
  test('Regla D (SOMOS): Una sola agrupación funcional conserva el concentrado de la agrupación y sus 3 tableros sin consolidado general redundante', () => {
    const aggSecretaria = createDashboard('agg-SECRETARIA DE INCLUSION-2026', '★ RESUMEN DIRECTIVO: SECRETARÍA DE INCLUSIÓN', 'SECRETARÍA DE INCLUSIÓN', -1, true);
    const som1 = createDashboard('SOMOS_2026_1', 'Inclusión Nacional', 'SECRETARÍA DE INCLUSIÓN', 1);
    const som2 = createDashboard('SOMOS_2026_GTO', 'Inclusión — Guanajuato', 'SECRETARÍA DE INCLUSIÓN', 2);
    const som3 = createDashboard('SOMOS_2026_QRO', 'Inclusión — Querétaro', 'SECRETARÍA DE INCLUSIÓN', 3);

    const onSelect = jest.fn();

    render(
      <HierarchySidebar
        dashboards={[aggSecretaria, som1, som2, som3]}
        selectedDashboardId={'agg-SECRETARIA DE INCLUSION-2026'}
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

    // NO debe existir un nivel CONSOLIDADO global redundante
    expect(screen.queryByText('CONSOLIDADO')).not.toBeInTheDocument();

    // Debe mostrarse la agrupación seleccionable
    const groupButton = screen.getByText('SECRETARÍA DE INCLUSIÓN');
    expect(groupButton).toBeInTheDocument();

    // Al hacer click en la agrupación, debe seleccionarse su concentrado
    fireEvent.click(groupButton);
    expect(onSelect).toHaveBeenCalledWith('agg-SECRETARIA DE INCLUSION-2026');

    // Deben mostrarse los 3 tableros operativos hijos
    expect(screen.getByText('Inclusión Nacional')).toBeInTheDocument();
    expect(screen.getByText('Inclusión — Guanajuato')).toBeInTheDocument();
    expect(screen.getByText('Inclusión — Querétaro')).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────
  // REGLA F: PERMISOS PARCIALES
  // ─────────────────────────────────────────────────────────────
  test('Regla F: Usuario con permiso parcial a 1 solo tablero en cliente multi-tablero ve solo su tablero sin consolidado', () => {
    const som2 = createDashboard('SOMOS_2026_GTO', 'Inclusión — Guanajuato', 'SECRETARÍA DE INCLUSIÓN', 2);

    const partialUser: User = {
      id: 'gto-user',
      name: 'GTO User',
      email: 'gto@somos.org',
      globalRole: GlobalUserRole.Viewer,
      clientId: 'SOMOS',
      dashboardAccess: {
        SOMOS_2026_GTO: 'Viewer' as any,
      },
    };

    render(
      <HierarchySidebar
        dashboards={[som2]}
        selectedDashboardId={'SOMOS_2026_GTO'}
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
    expect(screen.queryByText('Inclusión Nacional')).not.toBeInTheDocument();
    expect(screen.queryByText('Inclusión — Querétaro')).not.toBeInTheDocument();
    expect(screen.queryByText('CONSOLIDADO')).not.toBeInTheDocument();
  });
});
