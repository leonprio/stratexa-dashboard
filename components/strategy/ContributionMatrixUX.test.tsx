import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ContributionMatrixView } from "./ContributionMatrixView";
import {
  StrategicPerspective,
  StrategicObjective,
  AreaStrategyConfig,
  ContributionObjective,
  ContributionIndicatorAssignment,
} from "../../strategyTypes";
import { Dashboard, User, GlobalUserRole } from "../../types";
import { strategyService } from "../../services/strategyService";

// Mock strategyService
jest.mock("../../services/strategyService", () => ({
  strategyService: {
    getAssignments: jest.fn(),
    saveContributionObjective: jest.fn(),
    deleteContributionObjective: jest.fn(),
    saveAssignmentsForOC: jest.fn(),
    saveAreaConfig: jest.fn(),
    getAreaConfigs: jest.fn(),
  },
}));

const mockPerspectives: StrategicPerspective[] = [
  { id: "FIN", name: "Financiera", order: 1, color: "#3B82F6", clientId: "CLIENT_1" },
  { id: "CLI", name: "Clientes", order: 2, color: "#10B981", clientId: "CLIENT_1" },
];

const mockObjectives: StrategicObjective[] = [
  {
    id: "oe_1",
    code: "OE01",
    title: "Incrementar Rentabilidad",
    description: "Maximizar margen operativo",
    perspectiveId: "FIN",
    clientId: "CLIENT_1",
  },
  {
    id: "oe_2",
    code: "OE02",
    title: "Satisfacción del Cliente",
    description: "Fidelizar cartera",
    perspectiveId: "CLI",
    clientId: "CLIENT_1",
  },
];

const mockAreaConfigs: AreaStrategyConfig[] = [
  {
    id: "cfg_com",
    areaName: "COMERCIAL",
    code: "COM",
    clientId: "CLIENT_1",
  },
  {
    id: "cfg_ops",
    areaName: "OPERACIONES",
    code: "OPS",
    clientId: "CLIENT_1",
  },
];

const mockDashboards: Dashboard[] = [
  {
    id: "dash_1",
    title: "Tablero Comercial 2026",
    clientId: "CLIENT_1",
    area: "COMERCIAL",
    year: 2026,
    items: [
      {
        id: "item_101",
        indicator: "Ventas Totales",
        unit: "MXN",
        type: "Acumulado",
        jan_target: 100,
        jan_real: 105,
        monthlyGoals: Array(12).fill(100),
        monthlyProgress: Array(12).fill(105),
      },
      {
        id: "item_102",
        indicator: "Nuevos Clientes",
        unit: "Cant",
        type: "Acumulado",
        jan_target: 10,
        jan_real: 8,
        monthlyGoals: Array(12).fill(10),
        monthlyProgress: Array(12).fill(8),
      },
    ],
  },
  {
    id: "dash_2",
    title: "Tablero Operaciones 2026",
    clientId: "CLIENT_1",
    area: "OPERACIONES",
    year: 2026,
    items: [
      {
        id: "item_201",
        indicator: "Eficiencia de Planta",
        unit: "%",
        type: "Mensual",
        jan_target: 95,
        jan_real: 96,
        monthlyGoals: Array(12).fill(95),
        monthlyProgress: Array(12).fill(96),
      },
    ],
  },
];

const mockContributionObjectives: ContributionObjective[] = [
  {
    id: "oc_1",
    displayCode: "OC-COM-01",
    sequenceNumber: 1,
    title: "Aumentar conversión de leads",
    description: "Estrategia comercial de prospección",
    areaName: "COMERCIAL",
    areaConfigId: "cfg_com",
    primaryStrategicObjectiveId: "oe_1",
    clientId: "CLIENT_1",
  },
  {
    id: "oc_2",
    displayCode: "OC-COM-02",
    sequenceNumber: 2,
    title: "Diversificar canales de distribución",
    description: "Alianzas estratégicas",
    areaName: "COMERCIAL",
    areaConfigId: "cfg_com",
    primaryStrategicObjectiveId: "oe_1",
    clientId: "CLIENT_1",
  },
];

const mockAssignments: ContributionIndicatorAssignment[] = [
  {
    id: "asgn_1",
    contributionObjectiveId: "oc_1",
    dashboardId: "dash_1",
    itemId: "item_101",
    clientId: "CLIENT_1",
  },
];

const mockAdminUser: User = {
  id: "u_admin",
  email: "admin@empresa.com",
  name: "Admin User",
  globalRole: GlobalUserRole.Admin,
  clientId: "CLIENT_1",
};

const mockViewerUser: User = {
  id: "u_viewer",
  email: "viewer@empresa.com",
  name: "Viewer User",
  globalRole: GlobalUserRole.Viewer,
  clientId: "CLIENT_1",
};

describe("ContributionMatrixView - UX and Cell Objective Management", () => {
  const onRefreshDataMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (strategyService.getAssignments as jest.Mock).mockResolvedValue(mockAssignments);
    (strategyService.getAreaConfigs as jest.Mock).mockResolvedValue(mockAreaConfigs);
    (strategyService.saveContributionObjective as jest.Mock).mockResolvedValue({
      id: "oc_new_1",
      displayCode: "OC-OPS-01",
      sequenceNumber: 1,
      title: "Optimizar tiempos de ciclo",
      description: "Mejora continua",
      areaName: "OPERACIONES",
      areaConfigId: "cfg_ops",
      primaryStrategicObjectiveId: "oe_1",
      clientId: "CLIENT_1",
    });
    (strategyService.saveAssignmentsForOC as jest.Mock).mockResolvedValue(undefined);
    (strategyService.deleteContributionObjective as jest.Mock).mockResolvedValue(true);
  });

  it("CASE 1: renders the matrix view with perspectives, strategic objectives and area columns", () => {
    render(
      <ContributionMatrixView
        perspectives={mockPerspectives}
        objectives={mockObjectives}
        areaConfigs={mockAreaConfigs}
        contributionObjectives={mockContributionObjectives}
        assignments={mockAssignments}
        dashboards={mockDashboards}
        selectedClientId="CLIENT_1"
        currentUser={mockAdminUser}
        onRefreshData={onRefreshDataMock}
      />
    );

    // Switch to matrix tab
    const matrixTabBtn = screen.getByRole("button", { name: /Matriz de Contribución/i });
    fireEvent.click(matrixTabBtn);

    // Assert headers
    expect(screen.getByText("COMERCIAL")).toBeInTheDocument();
    expect(screen.getByText("OPERACIONES")).toBeInTheDocument();
    expect(screen.getByText("COM")).toBeInTheDocument();
    expect(screen.getByText("OPS")).toBeInTheDocument();

    // Assert objectives
    expect(screen.getByText("Incrementar Rentabilidad")).toBeInTheDocument();
    expect(screen.getByText("Satisfacción del Cliente")).toBeInTheDocument();
    expect(screen.getByText("OE01")).toBeInTheDocument();
    expect(screen.getByText("OE02")).toBeInTheDocument();
  });

  it("CASE 2: displays multiple Contribution Objectives in the same cell without combining them into a single string", () => {
    render(
      <ContributionMatrixView
        perspectives={mockPerspectives}
        objectives={mockObjectives}
        areaConfigs={mockAreaConfigs}
        contributionObjectives={mockContributionObjectives}
        assignments={mockAssignments}
        dashboards={mockDashboards}
        selectedClientId="CLIENT_1"
        currentUser={mockAdminUser}
        onRefreshData={onRefreshDataMock}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Matriz de Contribución/i }));

    // In cell (COMERCIAL, OE01), both OC1 and OC2 must be present as distinct items
    expect(screen.getByText("Aumentar conversión de leads")).toBeInTheDocument();
    expect(screen.getByText("Diversificar canales de distribución")).toBeInTheDocument();
    expect(screen.getByText("OC-COM-01")).toBeInTheDocument();
    expect(screen.getByText("OC-COM-02")).toBeInTheDocument();
  });

  it("CASE 3: allows Admin to open Cell Manager Modal from an empty cell to create a new OC", async () => {
    render(
      <ContributionMatrixView
        perspectives={mockPerspectives}
        objectives={mockObjectives}
        areaConfigs={mockAreaConfigs}
        contributionObjectives={mockContributionObjectives}
        assignments={mockAssignments}
        dashboards={mockDashboards}
        selectedClientId="CLIENT_1"
        currentUser={mockAdminUser}
        onRefreshData={onRefreshDataMock}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Matriz de Contribución/i }));

    // Find the add button on empty cell (OPERACIONES, OE01)
    const addButtons = screen.getAllByRole("button", { name: /\+ Agregar objetivo/i });
    expect(addButtons.length).toBeGreaterThan(0);
    fireEvent.click(addButtons[0]);

    // Check modal opens with context locked
    await waitFor(() => {
      expect(screen.getByText(/Objetivos de Contribución:/i)).toBeInTheDocument();
      expect(screen.getAllByText(/OE01/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/OPERACIONES/i).length).toBeGreaterThan(0);
    });
  });

  it("CASE 4: Admin creates a new OC for a cell and links a KPI", async () => {
    render(
      <ContributionMatrixView
        perspectives={mockPerspectives}
        objectives={mockObjectives}
        areaConfigs={mockAreaConfigs}
        contributionObjectives={mockContributionObjectives}
        assignments={mockAssignments}
        dashboards={mockDashboards}
        selectedClientId="CLIENT_1"
        currentUser={mockAdminUser}
        onRefreshData={onRefreshDataMock}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Matriz de Contribución/i }));

    const addButtons = screen.getAllByRole("button", { name: /\+ Agregar objetivo/i });
    fireEvent.click(addButtons[0]);

    // Fill the title and description
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Título del objetivo de contribución/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/Título del objetivo de contribución/i), {
      target: { value: "Optimizar tiempos de ciclo" },
    });

    // Check KPI checkbox for Eficiencia de Planta if visible
    const kpiCheckbox = screen.getByRole("checkbox");
    fireEvent.click(kpiCheckbox);

    // Save
    const saveBtn = screen.getByRole("button", { name: /Guardar Objetivo/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(strategyService.saveContributionObjective).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Optimizar tiempos de ciclo",
          primaryStrategicObjectiveId: "oe_1",
          areaName: "OPERACIONES",
          clientId: "CLIENT_1",
        })
      );
      expect(strategyService.saveAssignmentsForOC).toHaveBeenCalled();
      expect(onRefreshDataMock).toHaveBeenCalled();
    });
  });

  it("CASE 5: Admin can edit an existing OC directly from the cell modal", async () => {
    render(
      <ContributionMatrixView
        perspectives={mockPerspectives}
        objectives={mockObjectives}
        areaConfigs={mockAreaConfigs}
        contributionObjectives={mockContributionObjectives}
        assignments={mockAssignments}
        dashboards={mockDashboards}
        selectedClientId="CLIENT_1"
        currentUser={mockAdminUser}
        onRefreshData={onRefreshDataMock}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Matriz de Contribución/i }));

    // Click on existing OC card
    fireEvent.click(screen.getByText("Aumentar conversión de leads"));

    await waitFor(() => {
      expect(screen.getByText(/Editar Objetivo de Contribución/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue("Aumentar conversión de leads")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByDisplayValue("Aumentar conversión de leads"), {
      target: { value: "Aumentar conversión de leads calificados" },
    });

    const updateBtn = screen.getByRole("button", { name: /Actualizar Objetivo/i });
    fireEvent.click(updateBtn);

    await waitFor(() => {
      expect(strategyService.saveContributionObjective).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "oc_1",
          title: "Aumentar conversión de leads calificados",
        })
      );
      expect(onRefreshDataMock).toHaveBeenCalled();
    });
  });

  it("CASE 6: Admin can delete an OC with confirmation", async () => {
    render(
      <ContributionMatrixView
        perspectives={mockPerspectives}
        objectives={mockObjectives}
        areaConfigs={mockAreaConfigs}
        contributionObjectives={mockContributionObjectives}
        assignments={mockAssignments}
        dashboards={mockDashboards}
        selectedClientId="CLIENT_1"
        currentUser={mockAdminUser}
        onRefreshData={onRefreshDataMock}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Matriz de Contribución/i }));

    // Click on existing OC card
    fireEvent.click(screen.getByText("Diversificar canales de distribución"));

    await waitFor(() => {
      const deleteButtons = screen.getAllByRole("button", { name: /Eliminar/i });
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    const deleteButtons = screen.getAllByRole("button", { name: /Eliminar/i });
    fireEvent.click(deleteButtons[1] || deleteButtons[0]);

    // Confirm elimination
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Eliminar Definitivamente/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Eliminar Definitivamente/i }));

    await waitFor(() => {
      expect(strategyService.deleteContributionObjective).toHaveBeenCalledWith(
        expect.stringMatching(/oc_1|oc_2/),
        "CLIENT_1"
      );
      expect(onRefreshDataMock).toHaveBeenCalled();
    });
  });

  it("CASE 7: Non-admin (Viewer) sees read-only cell content and cannot create/edit OCs", async () => {
    render(
      <ContributionMatrixView
        perspectives={mockPerspectives}
        objectives={mockObjectives}
        areaConfigs={mockAreaConfigs}
        contributionObjectives={mockContributionObjectives}
        assignments={mockAssignments}
        dashboards={mockDashboards}
        selectedClientId="CLIENT_1"
        currentUser={mockViewerUser}
        onRefreshData={onRefreshDataMock}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Matriz de Contribución/i }));

    // Empty cells should say "No contribuye" without "+" action button
    expect(screen.queryByRole("button", { name: /\+ Agregar objetivo/i })).not.toBeInTheDocument();

    // Clicking an existing OC opens the read-only detail modal
    fireEvent.click(screen.getByText("Aumentar conversión de leads"));

    await waitFor(() => {
      expect(screen.getByText(/Indicadores Operativos Asociados/i)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Eliminar/i })).not.toBeInTheDocument();
    });
  });

  it("CASE 8: Filtering matrix by Area shows only the selected Area column", () => {
    render(
      <ContributionMatrixView
        perspectives={mockPerspectives}
        objectives={mockObjectives}
        areaConfigs={mockAreaConfigs}
        contributionObjectives={mockContributionObjectives}
        assignments={mockAssignments}
        dashboards={mockDashboards}
        selectedClientId="CLIENT_1"
        currentUser={mockAdminUser}
        onRefreshData={onRefreshDataMock}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Matriz de Contribución/i }));

    const areaSelect = screen.getByRole("combobox");
    fireEvent.change(areaSelect, { target: { value: "OPERACIONES" } });

    // Assert that OPERACIONES is shown and COMERCIAL header is not
    expect(screen.getByText("OPERACIONES")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /COMERCIAL/i })).not.toBeInTheDocument();
  });

  it("CASE 9: displays compliance percentage for single KPI without averaging", () => {
    render(
      <ContributionMatrixView
        perspectives={mockPerspectives}
        objectives={mockObjectives}
        areaConfigs={mockAreaConfigs}
        contributionObjectives={mockContributionObjectives}
        assignments={mockAssignments}
        dashboards={mockDashboards}
        selectedClientId="CLIENT_1"
        currentUser={mockAdminUser}
        onRefreshData={onRefreshDataMock}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Matriz de Contribución/i }));

    // OC 1 has 1 KPI with 105% compliance
    expect(screen.getByText("105.0%")).toBeInTheDocument();
    expect(screen.getByText("1 KPI")).toBeInTheDocument();
  });

  it("CASE 10: displays status distribution for multiple KPIs without arithmetic average corruption", () => {
    const multiAssignments: ContributionIndicatorAssignment[] = [
      {
        id: "asgn_1",
        contributionObjectiveId: "oc_1",
        dashboardId: "dash_1",
        itemId: "item_101", // jan_target: 100, jan_real: 105 (105% -> on track)
        clientId: "CLIENT_1",
      },
      {
        id: "asgn_2",
        contributionObjectiveId: "oc_1",
        dashboardId: "dash_1",
        itemId: "item_102", // jan_target: 10, jan_real: 8 (80% -> off track)
        clientId: "CLIENT_1",
      },
    ];

    render(
      <ContributionMatrixView
        perspectives={mockPerspectives}
        objectives={mockObjectives}
        areaConfigs={mockAreaConfigs}
        contributionObjectives={mockContributionObjectives}
        assignments={multiAssignments}
        dashboards={mockDashboards}
        selectedClientId="CLIENT_1"
        currentUser={mockAdminUser}
        onRefreshData={onRefreshDataMock}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Matriz de Contribución/i }));

    expect(screen.getByText("2 KPIs")).toBeInTheDocument();
    expect(screen.getByText(/1 Al día/i)).toBeInTheDocument();
    expect(screen.getByText(/1 Fuera/i)).toBeInTheDocument();
  });

  it("CASE 11: resolves Area Strategy Config aliases correctly for columns", () => {
    const aliasedAreaConfigs: AreaStrategyConfig[] = [
      {
        id: "cfg_com",
        areaName: "VENTAS Y COMERCIO",
        code: "COM",
        aliases: ["COMERCIAL"],
        clientId: "CLIENT_1",
      },
      {
        id: "cfg_ops",
        areaName: "OPERACIONES Y LOGISTICA",
        code: "OPS",
        aliases: ["OPERACIONES"],
        clientId: "CLIENT_1",
      },
    ];

    render(
      <ContributionMatrixView
        perspectives={mockPerspectives}
        objectives={mockObjectives}
        areaConfigs={aliasedAreaConfigs}
        contributionObjectives={mockContributionObjectives}
        assignments={mockAssignments}
        dashboards={mockDashboards}
        selectedClientId="CLIENT_1"
        currentUser={mockAdminUser}
        onRefreshData={onRefreshDataMock}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Matriz de Contribución/i }));

    // Should resolve COM and OPS code badges via alias
    expect(screen.getByText("COM")).toBeInTheDocument();
    expect(screen.getByText("OPS")).toBeInTheDocument();
  });

  it("CASE 12: handles error gracefully when saving an OC fails", async () => {
    (strategyService.saveContributionObjective as jest.Mock).mockRejectedValueOnce(
      new Error("Error de validación en base de datos")
    );

    render(
      <ContributionMatrixView
        perspectives={mockPerspectives}
        objectives={mockObjectives}
        areaConfigs={mockAreaConfigs}
        contributionObjectives={mockContributionObjectives}
        assignments={mockAssignments}
        dashboards={mockDashboards}
        selectedClientId="CLIENT_1"
        currentUser={mockAdminUser}
        onRefreshData={onRefreshDataMock}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Matriz de Contribución/i }));

    const addButtons = screen.getAllByRole("button", { name: /\+ Agregar objetivo/i });
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Título del objetivo de contribución/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/Título del objetivo de contribución/i), {
      target: { value: "Objetivo Inválido" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Guardar Objetivo/i }));

    await waitFor(() => {
      expect(screen.getByText(/Error de validación en base de datos/i)).toBeInTheDocument();
    });
  });

  it("CASE 13: cancelling form in CellContributionModal resets the form state", async () => {
    render(
      <ContributionMatrixView
        perspectives={mockPerspectives}
        objectives={mockObjectives}
        areaConfigs={mockAreaConfigs}
        contributionObjectives={mockContributionObjectives}
        assignments={mockAssignments}
        dashboards={mockDashboards}
        selectedClientId="CLIENT_1"
        currentUser={mockAdminUser}
        onRefreshData={onRefreshDataMock}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Matriz de Contribución/i }));

    // Click to edit an OC
    fireEvent.click(screen.getByText("Aumentar conversión de leads"));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Aumentar conversión de leads")).toBeInTheDocument();
    });

    // Cancel
    const cancelButtons = screen.getAllByRole("button", { name: /Cancelar/i });
    fireEvent.click(cancelButtons[0]);

    // Form should be closed and "Nuevo Objetivo de Contribución" button visible
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Nuevo Objetivo de Contribución/i })).toBeInTheDocument();
    });
  });

  it("CASE 14: preserves direct OE assignments alongside contribution objectives", () => {
    const directAndContributionAssignments: ContributionIndicatorAssignment[] = [
      {
        id: "asgn_direct",
        strategicObjectiveId: "oe_1",
        dashboardId: "dash_1",
        itemId: "item_101",
        clientId: "CLIENT_1",
      },
      {
        id: "asgn_oc",
        contributionObjectiveId: "oc_2",
        dashboardId: "dash_1",
        itemId: "item_102",
        clientId: "CLIENT_1",
      },
    ];

    render(
      <ContributionMatrixView
        perspectives={mockPerspectives}
        objectives={mockObjectives}
        areaConfigs={mockAreaConfigs}
        contributionObjectives={mockContributionObjectives}
        assignments={directAndContributionAssignments}
        dashboards={mockDashboards}
        selectedClientId="CLIENT_1"
        currentUser={mockAdminUser}
        onRefreshData={onRefreshDataMock}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Matriz de Contribución/i }));

    expect(screen.getByText("Diversificar canales de distribución")).toBeInTheDocument();
    expect(screen.getByText("Aumentar conversión de leads")).toBeInTheDocument();
  });

  it("CASE 15: renders an 8x8 scale matrix (IPS readiness) with 3 OCs in OPERACIONES x OE07 without collision", () => {
    const scalePerspectives: StrategicPerspective[] = [
      { id: "FIN", name: "Financiera", order: 1, color: "#3B82F6", clientId: "CLIENT_1" },
      { id: "CLI", name: "Clientes", order: 2, color: "#10B981", clientId: "CLIENT_1" },
      { id: "INT", name: "Procesos Internos", order: 3, color: "#F59E0B", clientId: "CLIENT_1" },
      { id: "CAP", name: "Capacidad", order: 4, color: "#8B5CF6", clientId: "CLIENT_1" },
    ];

    const scaleObjectives: StrategicObjective[] = Array.from({ length: 8 }, (_, i) => ({
      id: `oe_${i + 1}`,
      code: `OE0${i + 1}`,
      title: `Objetivo Estratégico ${i + 1}`,
      description: `Descripción OE 0${i + 1}`,
      perspectiveId: i < 2 ? "FIN" : i < 4 ? "CLI" : i < 6 ? "INT" : "CAP",
      clientId: "CLIENT_1",
    }));

    const scaleAreaNames = [
      "OPERACIONES",
      "COMERCIAL",
      "TALENTO",
      "FINANZAS",
      "LOGISTICA",
      "TECNOLOGIA",
      "CALIDAD",
      "MANTENIMIENTO",
    ];

    const scaleAreaConfigs: AreaStrategyConfig[] = scaleAreaNames.map((area, i) => ({
      id: `cfg_${area.toLowerCase()}`,
      areaName: area,
      code: area.substring(0, 3).toUpperCase(),
      clientId: "CLIENT_1",
    }));

    const scaleDashboards: Dashboard[] = scaleAreaNames.map((area, i) => ({
      id: `dash_${i + 1}`,
      title: `Tablero ${area}`,
      clientId: "CLIENT_1",
      area: area,
      year: 2026,
      items: [
        {
          id: `item_${i}_1`,
          indicator: `KPI ${area} 1`,
          unit: "%",
          type: "Mensual",
          monthlyGoals: Array(12).fill(100),
          monthlyProgress: Array(12).fill(95),
        },
      ],
    }));

    const scaleContributionObjectives: ContributionObjective[] = [
      {
        id: "oc_scale_1",
        displayCode: "OC-OPE-01",
        sequenceNumber: 1,
        title: "Optimización de Turnos de Planta",
        description: "Eficiencia en líneas críticas",
        areaName: "OPERACIONES",
        areaConfigId: "cfg_operaciones",
        primaryStrategicObjectiveId: "oe_7",
        clientId: "CLIENT_1",
      },
      {
        id: "oc_scale_2",
        displayCode: "OC-OPE-02",
        sequenceNumber: 2,
        title: "Reducción de Merma de Molienda",
        description: "Control de calidad en molienda",
        areaName: "OPERACIONES",
        areaConfigId: "cfg_operaciones",
        primaryStrategicObjectiveId: "oe_7",
        clientId: "CLIENT_1",
      },
      {
        id: "oc_scale_3",
        displayCode: "OC-OPE-03",
        sequenceNumber: 3,
        title: "Mantenimiento Autónomo Nivel 1",
        description: "Capacitación a operadores",
        areaName: "OPERACIONES",
        areaConfigId: "cfg_operaciones",
        primaryStrategicObjectiveId: "oe_7",
        clientId: "CLIENT_1",
      },
    ];

    render(
      <ContributionMatrixView
        perspectives={scalePerspectives}
        objectives={scaleObjectives}
        areaConfigs={scaleAreaConfigs}
        contributionObjectives={scaleContributionObjectives}
        assignments={[]}
        dashboards={scaleDashboards}
        selectedClientId="CLIENT_1"
        currentUser={mockAdminUser}
        onRefreshData={onRefreshDataMock}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Matriz de Contribución/i }));

    // Verify all 8 areas are rendered in the header
    scaleAreaNames.forEach((area) => {
      expect(screen.getByText(area)).toBeInTheDocument();
    });

    // Verify all 8 OEs are rendered
    scaleObjectives.forEach((oe) => {
      expect(screen.getByText(oe.code)).toBeInTheDocument();
      expect(screen.getByText(oe.title)).toBeInTheDocument();
    });

    // Verify the cell with 3 OCs contains all 3 distinct items
    expect(screen.getByText("Optimización de Turnos de Planta")).toBeInTheDocument();
    expect(screen.getByText("Reducción de Merma de Molienda")).toBeInTheDocument();
    expect(screen.getByText("Mantenimiento Autónomo Nivel 1")).toBeInTheDocument();
    expect(screen.getByText("OC-OPE-01")).toBeInTheDocument();
    expect(screen.getByText("OC-OPE-02")).toBeInTheDocument();
    expect(screen.getByText("OC-OPE-03")).toBeInTheDocument();
  });
});


