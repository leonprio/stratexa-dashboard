import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { DashboardView } from './DashboardView';
import { CurrentPeriodFocus } from './CurrentPeriodFocus';
import { DataEditor } from './DataEditor';
import { Dashboard, DashboardItem, User, GlobalUserRole, DashboardRole } from '../types';
import * as scrollUtils from '../utils/scrollUtils';

jest.mock('../utils/ExecutiveOperationalExport', () => ({
    exportToExecutiveExcelJS: jest.fn()
}));

jest.mock('../utils/scrollUtils');

const mockScrollToTop = scrollUtils.scrollToTop as jest.MockedFunction<typeof scrollUtils.scrollToTop>;
const mockScrollToElementBelowHeader = scrollUtils.scrollToElementBelowHeader as jest.MockedFunction<typeof scrollUtils.scrollToElementBelowHeader>;
const mockScheduleScroll = scrollUtils.scheduleScroll as jest.MockedFunction<typeof scrollUtils.scheduleScroll>;

mockScheduleScroll.mockImplementation((cb) => cb());

const dummyItem: DashboardItem = {
  id: 101,
  indicator: "KPI Test Scroll UX",
  weight: 100,
  monthlyGoals: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
  monthlyProgress: [8, 9, 10, 8, 9, 10, 8, 9, 10, 8, 9, 10],
  unit: "USD",
  type: "accumulative",
  goalType: "maximize",
};

const dummyDashboard: Dashboard = {
  id: 1,
  title: "Tablero Pruebas Scroll",
  subtitle: "Subtítulo de prueba",
  thresholds: { onTrack: 95, atRisk: 85 },
  group: "Operaciones",
  items: [dummyItem, { ...dummyItem, id: 102, indicator: "KPI 2 Scroll" }],
};

const dummyUser: User = {
  id: "test-user",
  email: "test@example.com",
  name: "Test User",
  globalRole: GlobalUserRole.Admin,
  dashboardAccess: {},
};

describe("Pruebas de Scroll y UX de Indicadores (v9.4.18-INDICATOR-SCROLL-UX)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("1. Apertura de indicador desplaza gestion-detallada-focus debajo del header usando requestAnimationFrame", () => {
    render(
      <DashboardView
        dashboard={dummyDashboard}
        onUpdateItem={jest.fn()}
        userRole={DashboardRole.Editor}
        isGlobalAdmin={true}
        currentUser={dummyUser}
      />
    );

    // Hacer click en la tarjeta del indicador para abrirlo
    const itemCard = screen.getByText("KPI Test Scroll UX");
    fireEvent.click(itemCard);

    expect(mockScheduleScroll).toHaveBeenCalled();
    expect(mockScrollToElementBelowHeader).toHaveBeenCalledWith("gestion-detallada-focus");
  });

  test("2. Cierre de indicador posiciona selectedItemId en null y ejecuta scroll a top 0", () => {
    render(
      <DashboardView
        dashboard={dummyDashboard}
        onUpdateItem={jest.fn()}
        userRole={DashboardRole.Editor}
        isGlobalAdmin={true}
        currentUser={dummyUser}
      />
    );

    // Abrir indicador
    fireEvent.click(screen.getByText("KPI Test Scroll UX"));

    // Hacer click en el botón CERRAR
    const closeBtn = screen.getByTitle("Cerrar gestión detallada");
    fireEvent.click(closeBtn);

    expect(mockScheduleScroll).toHaveBeenCalled();
    expect(mockScrollToTop).toHaveBeenCalled();
  });

  test("3. Guardado mensual exitoso en CurrentPeriodFocus ejecuta onUpdateItem, luego onClose", async () => {
    const onUpdateItemMock = jest.fn().mockResolvedValue(undefined);
    const onCloseMock = jest.fn();

    render(
      <CurrentPeriodFocus
        item={dummyItem}
        globalThresholds={{ onTrack: 95, atRisk: 85 }}
        onUpdateItem={onUpdateItemMock}
        canEdit={true}
        onClose={onCloseMock}
      />
    );

    const saveBtn = screen.getByText("💾 GUARDAR MES");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onUpdateItemMock).toHaveBeenCalled();
      expect(onCloseMock).toHaveBeenCalled();
    });
  });

  test("4. Guardado mensual rechazado en CurrentPeriodFocus NO ejecuta onClose", async () => {
    const onUpdateItemMock = jest.fn().mockRejectedValue(new Error("Network Error"));
    const onCloseMock = jest.fn();

    render(
      <CurrentPeriodFocus
        item={dummyItem}
        globalThresholds={{ onTrack: 95, atRisk: 85 }}
        onUpdateItem={onUpdateItemMock}
        canEdit={true}
        onClose={onCloseMock}
      />
    );

    const saveBtn = screen.getByText("💾 GUARDAR MES");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onUpdateItemMock).toHaveBeenCalled();
    });

    expect(onCloseMock).not.toHaveBeenCalled();
  });

  test("5. Guardado en Vista Anual (DataEditor) exitoso desmonta y cierra", async () => {
    const onUpdateItemMock = jest.fn().mockResolvedValue(undefined);
    const onCloseMock = jest.fn();

    render(
      <CurrentPeriodFocus
        item={dummyItem}
        globalThresholds={{ onTrack: 95, atRisk: 85 }}
        onUpdateItem={onUpdateItemMock}
        canEdit={true}
        onClose={onCloseMock}
      />
    );

    // Abrir Vista Anual
    fireEvent.click(screen.getByText("VISTA ANUAL"));

    // Click en Guardar Cambios dentro de DataEditor
    const saveBtn = screen.getByText("Guardar Cambios");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onUpdateItemMock).toHaveBeenCalled();
      expect(onCloseMock).toHaveBeenCalled();
    });
  });

  test("6. AutoSave en DataEditor conserva el comportamiento sin cerrar el detalle", async () => {
    const onSaveMock = jest.fn().mockResolvedValue(undefined);

    render(
      <DataEditor
        item={dummyItem}
        onSave={onSaveMock}
        onCancel={jest.fn()}
        canEdit={true}
      />
    );

    const toggleActivityBtn = screen.getByText(/MODO:/);
    fireEvent.click(toggleActivityBtn);

    await waitFor(() => {
      expect(onSaveMock).toHaveBeenCalledWith(
        expect.objectContaining({ isActivityMode: true }),
        true
      );
    });
  });
});
