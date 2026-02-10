
export interface ComplianceThresholds {
  onTrack: number;
  atRisk: number;
}

export interface SystemSettings {
  appTitle: string;
  appSubtitle: string;
  globalScoreTitle?: string;
  groupLabel?: string; // e.g. "Dirección", "Gerencia", "Zona" (Default: "Agrupación")
  dashboardLabel?: string; // e.g. "Tablero", "UNE", "Tienda" (Default: "Tablero")
  thresholds?: ComplianceThresholds;
  decimalPrecision?: 1 | 2; // Default: 2

  // 🌟 ESTRATEGIA DE AGREGACIÓN (v3.0.0)
  aggregationStrategy?: 'equal' | 'manual' | 'indicator';
  indicatorDriver?: string; // Nombre del indicador maestro (si strategy === 'indicator')
  customWeights?: Record<string, number>; // { dashboardId: 30 } (si strategy === 'manual')
  calculationMode?: 'realTime' | 'definitive'; // Default: 'realTime'
}

export enum CalculationMode {
  RealTime = 'realTime',
  Definitive = 'definitive',
}

export interface Client {
  id: string;
  name: string;
  settings: SystemSettings;
}

export interface DashboardItem {
  id: number;
  indicator: string;
  weight: number; // Ponderación del indicador en porcentaje
  frequency?: 'monthly' | 'weekly';
  weeklyGoals?: (number | null)[]; // Up to 53 weeks
  weeklyProgress?: (number | null)[];
  weekStart?: 'Sun' | 'Mon';
  monthlyGoals: (number | null)[];
  monthlyProgress: (number | null)[];
  monthlyNotes?: string[];
  weeklyNotes?: string[];
  unit: string;
  type: 'accumulative' | 'average';
  goalType: 'maximize' | 'minimize';
  actionPlan?: string;
  pai?: {
    actions: string;
    dueDate: string;
    impact: string;
  };
  paiRows?: {
    action: string;
    date: string;
    result: string;
    impact?: 'positive' | 'low' | 'none';
  }[];
  // 🚀 INDICADORES INTELIGENTES (v6.0.0)
  indicatorType?: 'simple' | 'compound' | 'formula';
  componentIds?: (number | string)[]; // IDs de otros indicadores que alimentan este (para compound/formula)
  formula?: string; // Ecuación aritmética: e.g. "({id:101} + {id:102}) / 2"

  // 🚀 MODO ACTIVIDADES (v3.5.0)
  isActivityMode?: boolean;
  activityConfig?: {
    [periodIdx: number]: {
      id: string;
      label: string;
      targetCount: number;
      completedCount: number;
    }[];
  };
}

export interface Dashboard {
  periodicity?: 'weekly' | 'monthly';
  id: number | string;
  title: string;
  subtitle: string;
  items: DashboardItem[];
  thresholds: ComplianceThresholds;
  clientId?: string; // Para agrupar por cliente (ej: 'ips', 'demo')
  group?: string; // Para agrupar por Dirección/Gerencia (ej: 'Dirección Norte')
  year?: number; // Año de los datos (ej: 2025)
  orderNumber?: number; // Número de orden (1-14 para IPS, consecutivo para otros)
  originalId?: number; // ID original del cual se basó este tablero (para mapeo de importación)
  navigationParent?: string; // Para navegación jerárquica (v2.4.5)
  dashboardWeight?: number; // Ponderación manual para agregación (v3.0.0)
  isAggregate?: boolean; // Indica si es un tablero consolidado
  // 🏢 SISTEMA DE ÁREAS (v5.0.0)
  area?: string; // Área de negocio (ej: 'OPERACIONES', 'TALENTO Y CULTURA')
  isHierarchyRoot?: boolean; // Indica si es un grupo de nivel superior (v5.1.0)
  targetIndicatorCount?: number; // Meta manual de cuántos indicadores deben estar capturados (v5.5.3)
}


export type ComplianceStatus = "OnTrack" | "AtRisk" | "OffTrack" | "Neutral" | "InProgress";

export enum GlobalUserRole {
  Admin = 'Admin',
  Director = 'Director',
  Member = 'Member',
}

export enum DashboardRole {
  Editor = 'Editor',
  Viewer = 'Viewer',
}

export interface User {
  id: string;
  name: string;
  email: string;
  globalRole: GlobalUserRole;
  canManageKPIs?: boolean; // Permiso especial para crear/gestionar indicadores
  canExportPPT?: boolean; // 🎯 Permiso para exportar a PowerPoint (v5.0.0)
  clientId?: string; // Para agrupar por cliente
  dashboardAccess: {
    [dashboardId: string]: DashboardRole; // Editor or Viewer
  };
  directorTitle?: string; // Título personalizado para el Director (ej: "Dirección Centro")
  subGroups?: string[]; // Para "Grupos de Grupos" (v2.3.0) (ej: ["Dir Norte", "Dir Sur"])
  group?: string; // Legacy fallback
}
