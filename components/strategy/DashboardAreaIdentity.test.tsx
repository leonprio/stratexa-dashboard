import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ContributionMatrixView } from './ContributionMatrixView';
import { StrategyConfigModal } from './StrategyConfigModal';
import { HierarchySidebar } from '../HierarchySidebar';
import {
  CreateDashboardModal,
  NEW_AREA_VALUE,
  NEW_GROUP_VALUE,
  SAME_AS_AREA_VALUE,
  normalizeAreaName,
} from '../CreateDashboardModal';
import { Dashboard as DashboardType, GlobalUserRole, User } from '../../types';
import { strategyService } from '../../services/strategyService';

jest.mock('../../services/strategyService', () => ({
  strategyService: {
    getAssignments: jest.fn().mockResolvedValue([]),
    saveAssignmentsForOC: jest.fn().mockResolvedValue(true),
    saveContributionObjective: jest.fn().mockResolvedValue(true),
    saveAreaStrategyConfig: jest.fn().mockResolvedValue(true),
  },
}));

describe('Dashboard Area & Group Hierarchy Hotfix (v9.7.0 Phase 7)', () => {
  const adminUser: User = {
    id: 'admin-1',
    name: 'Admin User',
    email: 'admin@somos.org',
    globalRole: GlobalUserRole.Admin,
    clientId: 'IPS',
    dashboardAccess: {},
  };

  const createDashboard = (
    id: string | number,
    title: string,
    area?: string,
    group: string = 'GENERAL',
  ): DashboardType =>
    ({
      id,
      title,
      subtitle: 'Sub',
      group,
      area,
      clientId: 'IPS',
      year: 2026,
      items: [],
      orderNumber: 1,
      isAggregate: false,
    } as any);

  describe('CASE 1: Seleccionar área existente guarda correctamente area', () => {
    test('permite elegir un área existente de la lista y la asigna al confirmar', async () => {
      const onConfirm = jest.fn();
      render(
        <CreateDashboardModal
          isOpen={true}
          onClose={jest.fn()}
          onConfirm={onConfirm}
          availableAreas={['FINANZAS', 'OPERACIONES']}
          availableGroups={['DIRECCIÓN CENTRO']}
        />
      );

      fireEvent.change(screen.getByLabelText(/1\. Nombre del Tablero/i), {
        target: { value: 'METRO SUR' },
      });

      // Seleccionar explícitamente OPERACIONES en el select
      fireEvent.change(screen.getByLabelText(/2\. Área Organizacional/i), {
        target: { value: 'OPERACIONES' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Crear Tablero/i }));

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledWith({
          title: 'METRO SUR',
          area: 'OPERACIONES',
          group: 'OPERACIONES', // Al ser SAME_AS_AREA_VALUE
        });
      });
    });
  });

  describe('CASE 2: Seleccionar grupo existente guarda correctamente group', () => {
    test('permite seleccionar un grupo existente de la lista diferente al área', async () => {
      const onConfirm = jest.fn();
      render(
        <CreateDashboardModal
          isOpen={true}
          onClose={jest.fn()}
          onConfirm={onConfirm}
          availableAreas={['OPERACIONES']}
          availableGroups={['DIRECCIÓN CENTRO', 'DIRECCIÓN SUR']}
        />
      );

      fireEvent.change(screen.getByLabelText(/1\. Nombre del Tablero/i), {
        target: { value: 'METRO CENTRO' },
      });

      // Cambiar grupo a DIRECCIÓN CENTRO
      fireEvent.change(screen.getByLabelText(/3\. Grupo Operativo/i), {
        target: { value: 'DIRECCIÓN CENTRO' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Crear Tablero/i }));

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledWith({
          title: 'METRO CENTRO',
          area: 'OPERACIONES',
          group: 'DIRECCIÓN CENTRO',
        });
      });
    });
  });

  describe('CASE 3: Crear nueva área guarda identidad nueva normalizada', () => {
    test('muestra input de texto para nueva área y la normaliza a mayúsculas', async () => {
      const onConfirm = jest.fn();
      render(
        <CreateDashboardModal
          isOpen={true}
          onClose={jest.fn()}
          onConfirm={onConfirm}
          availableAreas={['OPERACIONES']}
          availableGroups={[]}
        />
      );

      fireEvent.change(screen.getByLabelText(/1\. Nombre del Tablero/i), {
        target: { value: 'Inclusión Nacional' },
      });

      // Seleccionar opción de nueva área
      fireEvent.change(screen.getByLabelText(/2\. Área Organizacional/i), {
        target: { value: NEW_AREA_VALUE },
      });

      // Escribir nueva área
      const newAreaInput = screen.getByPlaceholderText(/Nombre de la nueva área/i);
      fireEvent.change(newAreaInput, {
        target: { value: '  Secretaría de Inclusión  ' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Crear Tablero/i }));

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledWith({
          title: 'Inclusión Nacional',
          area: 'SECRETARÍA DE INCLUSIÓN',
          group: 'SECRETARÍA DE INCLUSIÓN',
        });
      });
    });
  });

  describe('CASE 4: Varios dashboards pueden compartir la misma área (Caso SOMOS)', () => {
    test('Guanajuato y Querétaro comparten la misma área SECRETARÍA DE INCLUSIÓN en HierarchySidebar', () => {
      const somosDashboards = [
        createDashboard('SOMOS_1', 'Inclusión Nacional', 'SECRETARÍA DE INCLUSIÓN', 'SECRETARÍA DE INCLUSIÓN'),
        createDashboard('SOMOS_GTO', 'Inclusión — Guanajuato', 'SECRETARÍA DE INCLUSIÓN', 'SECRETARÍA DE INCLUSIÓN'),
        createDashboard('SOMOS_QRO', 'Inclusión — Querétaro', 'SECRETARÍA DE INCLUSIÓN', 'SECRETARÍA DE INCLUSIÓN'),
      ];

      render(
        <HierarchySidebar
          dashboards={somosDashboards}
          selectedDashboardId={'SOMOS_1'}
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

      // 3 tableros pero 1 sola área
      expect(screen.getByText(/3 Tableros · 1 Áreas/i)).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /SECRETARÍA DE INCLUSIÓN/i })[0]).toBeInTheDocument();
    });
  });

  describe('CASE 5: Varios dashboards dentro del mismo group producen una sola agrupación', () => {
    test('HierarchySidebar agrupa los tableros del mismo group en un solo nodo de grupo', () => {
      const groupDashboards = [
        createDashboard('1', 'METRO CENTRO', 'OPERACIONES', 'Dirección Centro'),
        createDashboard('2', 'METRO SUR', 'OPERACIONES', 'Dirección Centro'),
        createDashboard('3', 'METRO NORTE', 'OPERACIONES', 'Dirección Centro'),
      ];

      render(
        <HierarchySidebar
          dashboards={groupDashboards}
          selectedDashboardId={'1'}
          onSelectDashboard={jest.fn()}
          isGlobalAdmin={true}
          isDirector={false}
          isCollapsed={false}
          onToggleCollapse={jest.fn()}
          allUsers={[adminUser]}
          userProfile={adminUser}
          selectedClientId="IPS"
        />
      );

      // El grupo DIRECCIÓN CENTRO aparece como nodo contenedor de los 3
      expect(screen.getByText(/DIRECCIÓN CENTRO/i)).toBeInTheDocument();
    });
  });

  describe('CASE 6: Dashboard con area OPERACIONES y group DIRECCIÓN CENTRO conserva ambos niveles', () => {
    test('ambos campos son independientes y persisten fielmente', async () => {
      const onConfirm = jest.fn();
      render(
        <CreateDashboardModal
          isOpen={true}
          onClose={jest.fn()}
          onConfirm={onConfirm}
          availableAreas={['OPERACIONES']}
          availableGroups={['DIRECCIÓN CENTRO']}
        />
      );

      fireEvent.change(screen.getByLabelText(/1\. Nombre del Tablero/i), {
        target: { value: 'TOLUCA' },
      });

      fireEvent.change(screen.getByLabelText(/3\. Grupo Operativo/i), {
        target: { value: 'DIRECCIÓN CENTRO' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Crear Tablero/i }));

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledWith({
          title: 'TOLUCA',
          area: 'OPERACIONES',
          group: 'DIRECCIÓN CENTRO',
        });
      });
    });
  });

  describe('CASE 7: Creación no permite área vacía ni nombre vacío', () => {
    test('rechaza envío si el nombre está en blanco o solo contiene espacios', async () => {
      const onConfirm = jest.fn();
      render(
        <CreateDashboardModal
          isOpen={true}
          onClose={jest.fn()}
          onConfirm={onConfirm}
          availableAreas={['OPERACIONES']}
          availableGroups={[]}
        />
      );

      fireEvent.change(screen.getByLabelText(/1\. Nombre del Tablero/i), {
        target: { value: '   ' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Crear Tablero/i }));

      expect(onConfirm).not.toHaveBeenCalled();
      expect(screen.getByText(/El nombre del tablero es obligatorio/i)).toBeInTheDocument();
    });

    test('rechaza envío si se selecciona nueva área y se deja vacía', async () => {
      const onConfirm = jest.fn();
      render(
        <CreateDashboardModal
          isOpen={true}
          onClose={jest.fn()}
          onConfirm={onConfirm}
          availableAreas={[]}
          availableGroups={[]}
        />
      );

      fireEvent.change(screen.getByLabelText(/1\. Nombre del Tablero/i), {
        target: { value: 'Nuevo Tablero' },
      });

      // Como no hay áreas, se inicializa en NEW_AREA_VALUE
      const newAreaInput = screen.getByPlaceholderText(/Nombre de la nueva área/i);
      fireEvent.change(newAreaInput, { target: { value: '   ' } });

      fireEvent.click(screen.getByRole('button', { name: /Crear Tablero/i }));

      expect(onConfirm).not.toHaveBeenCalled();
      expect(screen.getByText(/El área organizacional es obligatoria/i)).toBeInTheDocument();
    });
  });

  describe('CASE 8: ContributionMatrixView no muestra áreas ficticias y presenta estado honesto', () => {
    const defaultPerspectives = [
      { id: 'FINANCIERA', name: 'Financiera', order: 1 },
    ];
    const defaultObjectives = [
      { id: 'oe1', perspectiveId: 'FINANCIERA', code: 'OE01', title: 'Rentabilidad', order: 1, clientId: 'IPS' },
    ];

    test('NO muestra OPERACIONES / COMERCIAL / FINANZAS ficticios cuando d.area está vacío y muestra estado vacío honesto', () => {
      const dashboardsWithoutArea = [
        createDashboard('1', 'Tablero Sin Área 1'),
        createDashboard('2', 'Tablero Sin Área 2'),
      ];

      render(
        <ContributionMatrixView
          perspectives={defaultPerspectives as any}
          objectives={defaultObjectives as any}
          areaConfigs={[]}
          contributionObjectives={[]}
          assignments={[]}
          dashboards={dashboardsWithoutArea}
          selectedClientId="IPS"
          currentUser={adminUser}
          onRefreshData={jest.fn()}
        />
      );

      // Subvista Matriz de Contribución
      fireEvent.click(screen.getByRole('button', { name: /Matriz de Contribución/i }));

      // Verificar que NO existen las columnas ficticias
      expect(screen.queryByText('OPERACIONES')).not.toBeInTheDocument();
      expect(screen.queryByText('COMERCIAL')).not.toBeInTheDocument();

      // Verificar que se muestra el estado vacío honesto
      expect(screen.getByText('No hay Áreas Organizacionales Registradas')).toBeInTheDocument();
      expect(
        screen.getByText(/Los tableros operativos de esta cuenta no cuentan con un área asignada/i)
      ).toBeInTheDocument();
    });
  });

  describe('CASE 9: Al seleccionar un área, sólo aparecen grupos asociados a esa área', () => {
    test('para OPERACIONES sólo se listan sus grupos asociados (DIRECCIÓN CENTRO, DIRECCIÓN SUR, etc.)', () => {
      const mockDashboards = [
        createDashboard('1', 'METRO CENTRO', 'OPERACIONES', 'DIRECCIÓN CENTRO'),
        createDashboard('2', 'METRO SUR', 'OPERACIONES', 'DIRECCIÓN SUR'),
        createDashboard('3', 'TESORERÍA GRAL', 'FINANZAS', 'TESORERÍA'),
        createDashboard('4', 'VENTAS ZONA', 'COMERCIAL', 'VENTAS'),
      ];

      render(
        <CreateDashboardModal
          isOpen={true}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
          availableAreas={['OPERACIONES', 'FINANZAS', 'COMERCIAL']}
          dashboards={mockDashboards}
        />
      );

      // Seleccionar explícitamente OPERACIONES
      fireEvent.change(screen.getByLabelText(/2\. Área Organizacional/i), {
        target: { value: 'OPERACIONES' },
      });

      const groupSelect = screen.getByLabelText(/3\. Grupo Operativo/i) as HTMLSelectElement;
      const optionTexts = Array.from(groupSelect.options).map((opt) => opt.textContent || '');

      // Deben aparecer los grupos de OPERACIONES
      expect(optionTexts.some((t) => t.includes('DIRECCIÓN CENTRO'))).toBe(true);
      expect(optionTexts.some((t) => t.includes('DIRECCIÓN SUR'))).toBe(true);

      // NO deben aparecer grupos de FINANZAS ni COMERCIAL
      expect(optionTexts.some((t) => t.includes('TESORERÍA'))).toBe(false);
      expect(optionTexts.some((t) => t.includes('VENTAS'))).toBe(false);
    });
  });

  describe('CASE 10: Grupos de otra área NO aparecen', () => {
    test('al seleccionar FINANZAS, no aparecen DIRECCIÓN CENTRO ni COMERCIAL', () => {
      const mockDashboards = [
        createDashboard('1', 'METRO CENTRO', 'OPERACIONES', 'DIRECCIÓN CENTRO'),
        createDashboard('2', 'TESORERÍA GRAL', 'FINANZAS', 'TESORERÍA'),
        createDashboard('3', 'VENTAS', 'COMERCIAL', 'CANAL DIRECTO'),
      ];

      render(
        <CreateDashboardModal
          isOpen={true}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
          availableAreas={['OPERACIONES', 'FINANZAS', 'COMERCIAL']}
          dashboards={mockDashboards}
        />
      );

      // Cambiar área a FINANZAS
      fireEvent.change(screen.getByLabelText(/2\. Área Organizacional/i), {
        target: { value: 'FINANZAS' },
      });

      const groupSelect = screen.getByLabelText(/3\. Grupo Operativo/i) as HTMLSelectElement;
      const optionTexts = Array.from(groupSelect.options).map((opt) => opt.textContent || '');

      expect(optionTexts.some((t) => t.includes('TESORERÍA'))).toBe(true);
      expect(optionTexts.some((t) => t.includes('DIRECCIÓN CENTRO'))).toBe(false);
      expect(optionTexts.some((t) => t.includes('CANAL DIRECTO'))).toBe(false);
    });
  });

  describe('CASE 11: Cambiar de área invalida/resetea un grupo previamente seleccionado que ya no pertenece al área', () => {
    test('si se selecciona Área A con Grupo A1 y se cambia a Área B, el grupo se resetea a Igual al Área', async () => {
      const onConfirm = jest.fn();
      const mockDashboards = [
        createDashboard('1', 'METRO CENTRO', 'OPERACIONES', 'DIRECCIÓN CENTRO'),
        createDashboard('2', 'TESORERÍA GRAL', 'FINANZAS', 'TESORERÍA'),
      ];

      render(
        <CreateDashboardModal
          isOpen={true}
          onClose={jest.fn()}
          onConfirm={onConfirm}
          availableAreas={['OPERACIONES', 'FINANZAS']}
          dashboards={mockDashboards}
        />
      );

      // 1. Área inicial = FINANZAS (orden alfabético F < O)
      // Seleccionar área OPERACIONES
      fireEvent.change(screen.getByLabelText(/2\. Área Organizacional/i), {
        target: { value: 'OPERACIONES' },
      });

      // 2. Seleccionar grupo DIRECCIÓN CENTRO
      fireEvent.change(screen.getByLabelText(/3\. Grupo Operativo/i), {
        target: { value: 'DIRECCIÓN CENTRO' },
      });

      // 3. Cambiar a Área FINANZAS
      fireEvent.change(screen.getByLabelText(/2\. Área Organizacional/i), {
        target: { value: 'FINANZAS' },
      });

      // Rellenar nombre del tablero
      fireEvent.change(screen.getByLabelText(/1\. Nombre del Tablero/i), {
        target: { value: 'Contabilidad Central' },
      });

      // Enviar formulario
      fireEvent.click(screen.getByRole('button', { name: /Crear Tablero/i }));

      // DIRECCIÓN CENTRO ya no debe persistirse, debe resetearse a la nueva área (FINANZAS)
      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledWith({
          title: 'Contabilidad Central',
          area: 'FINANZAS',
          group: 'FINANZAS',
        });
      });
    });
  });

  describe('CASE 12: Nueva área no hereda grupos de áreas existentes', () => {
    test('al seleccionar + NUEVA ÁREA, sólo se ofrecen Igual al Área, GENERAL y + NUEVO GRUPO', () => {
      const mockDashboards = [
        createDashboard('1', 'METRO CENTRO', 'OPERACIONES', 'DIRECCIÓN CENTRO'),
        createDashboard('2', 'METRO SUR', 'OPERACIONES', 'DIRECCIÓN SUR'),
        createDashboard('3', 'TESORERÍA', 'FINANZAS', 'TESORERÍA'),
      ];

      render(
        <CreateDashboardModal
          isOpen={true}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
          availableAreas={['OPERACIONES', 'FINANZAS']}
          dashboards={mockDashboards}
        />
      );

      // Seleccionar + NUEVA ÁREA...
      fireEvent.change(screen.getByLabelText(/2\. Área Organizacional/i), {
        target: { value: NEW_AREA_VALUE },
      });

      const groupSelect = screen.getByLabelText(/3\. Grupo Operativo/i) as HTMLSelectElement;
      const optionTexts = Array.from(groupSelect.options).map((opt) => opt.textContent || '');

      // NO debe tener grupos de OPERACIONES ni de FINANZAS
      expect(optionTexts.some((t) => t.includes('DIRECCIÓN CENTRO'))).toBe(false);
      expect(optionTexts.some((t) => t.includes('DIRECCIÓN SUR'))).toBe(false);
      expect(optionTexts.some((t) => t.includes('TESORERÍA'))).toBe(false);

      // Solo opciones estándar: Igual al Área, GENERAL, NUEVO GRUPO
      expect(optionTexts.some((t) => t.includes('Igual al Área'))).toBe(true);
      expect(optionTexts.some((t) => t.includes('GENERAL'))).toBe(true);
      expect(optionTexts.some((t) => t.includes('NUEVO GRUPO / SUBDIRECCIÓN'))).toBe(true);
    });
  });

  describe('CASE 13: Objeto enviado a saveDashboard() usa nombres canónicos correctos', () => {
    test('creación de tablero produce el contrato canónico exacto: id, title, clientId, year, area, group, orderNumber, items, thresholds', async () => {
      // Simulador de la función handleConfirmCreateDashboard canónica de App.tsx
      const createdDashboards: DashboardType[] = [];
      const mockSaveDashboard = jest.fn(async (d: DashboardType) => {
        createdDashboards.push(d);
        return true;
      });

      const selectedClientId = 'SOMOS';
      const selectedYear = 2026;
      const existingDashboards: DashboardType[] = [
        createDashboard('SOMOS_2026_1', 'Inclusión 1', 'SECRETARÍA DE INCLUSIÓN', 'SECRETARÍA DE INCLUSIÓN'),
      ];

      const handleConfirmCreateDashboardSimulation = async (data: { title: string; area: string; group: string }) => {
        const timestamp = Date.now();
        const targetClient = selectedClientId.trim().toUpperCase();
        const newId = `${targetClient}_${selectedYear}_${timestamp}`;

        const maxOrder = existingDashboards.reduce(
          (max, d) => Math.max(max, d.orderNumber || 0),
          0,
        );

        const newDashboard: DashboardType = {
          id: newId,
          title: data.title,
          subtitle: 'Nuevo Tablero',
          group: data.group,
          area: data.area,
          items: [],
          year: selectedYear,
          clientId: targetClient,
          orderNumber: maxOrder + 1,
          thresholds: { onTrack: 90, atRisk: 80 },
        };

        await mockSaveDashboard(newDashboard);
      };

      render(
        <CreateDashboardModal
          isOpen={true}
          onClose={jest.fn()}
          onConfirm={handleConfirmCreateDashboardSimulation}
          availableAreas={['SECRETARÍA DE INCLUSIÓN']}
          dashboards={existingDashboards}
        />
      );

      fireEvent.change(screen.getByLabelText(/1\. Nombre del Tablero/i), {
        target: { value: 'Inclusión — Querétaro' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Crear Tablero/i }));

      await waitFor(() => {
        expect(mockSaveDashboard).toHaveBeenCalledTimes(1);
      });

      const savedObj = mockSaveDashboard.mock.calls[0][0];

      // Verificación canónica estricta
      expect(savedObj).toHaveProperty('id');
      expect(typeof savedObj.id).toBe('string');
      expect(savedObj.id).toContain('SOMOS_2026_');

      expect(savedObj).toHaveProperty('title', 'Inclusión — Querétaro');
      expect(savedObj).not.toHaveProperty('name'); // Blindaje: NO debe usar 'name'

      expect(savedObj).toHaveProperty('clientId', 'SOMOS');
      expect(savedObj).not.toHaveProperty('client'); // Blindaje: NO debe usar 'client'

      expect(savedObj).toHaveProperty('year', 2026);
      expect(savedObj).toHaveProperty('area', 'SECRETARÍA DE INCLUSIÓN');
      expect(savedObj).toHaveProperty('group', 'SECRETARÍA DE INCLUSIÓN');
      expect(savedObj).toHaveProperty('orderNumber', 2);
      expect(savedObj).toHaveProperty('items', []);
      expect(savedObj).toHaveProperty('thresholds', { onTrack: 90, atRisk: 80 });
      expect(savedObj).toHaveProperty('subtitle', 'Nuevo Tablero');
    });
  });
});

