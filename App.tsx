import React, { useCallback, useEffect, useMemo, useState } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signOut, User as FirebaseUser, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, deleteField } from "firebase/firestore";

import { calculateCapture } from "./components/DashboardTabs";
import { HierarchySidebar } from "./components/HierarchySidebar";
import { DashboardView } from "./components/DashboardView";
import { LoginScreen } from "./components/LoginScreen";
import { UserManager } from "./components/UserManager";
import { ThresholdEditor } from "./components/ThresholdEditor";
import { IndicatorManager } from "./components/IndicatorManager";
import { WeightManager } from "./components/WeightManager";
import { WeightControlCenter } from "./components/WeightControlCenter";
import { AdvancedDataImporter } from "./components/AdvancedDataImporter";
import { HelpCenter } from "./components/HelpCenter";
import { MasterTrafficLight } from "./components/MasterTrafficLight";

import {
  Dashboard as DashboardType,
  DashboardItem,
  DashboardRole,
  SystemSettings,
  GlobalUserRole,
  User,
} from "./types";
import { calculateAggregateDashboard } from "./utils/aggregationUtils";
import { IPS_DASHBOARDS, getIPSDashboardGroup } from "./utils/standardStructure";
import { firebaseService } from "./services/firebaseService";

import { IPS_INDICATORS } from "./utils/standardStructure";
import { exportBulkDataToCSV } from "./utils/exportUtils";
import { normalizeGroupName } from "./utils/formatters";

type AppStatus = "loading" | "no-session" | "ready" | "error";
type ViewMode = "grid" | "compact";
type AdminSection = "none" | "users" | "thresholds" | "clients" | "indicators" | "weights" | "kpiWeights" | "import" | "export" | "help" | "master";

/**
 * Componente principal de la aplicación Stratexa Dashboard.
 * Gestiona el estado global de autenticación, carga de tableros, ruteo interno y administración.
 * 
 * @version v7.8.30-NUCLEAR-ISOLATION-TABLERO
 * @architecture Platinum Ultra Shield V2 (Nuclear Isolation)
 * 
 * @returns {JSX.Element} El árbol de componentes de la aplicación.
 */
export default function App() {
  const [status, setStatus] = useState<AppStatus>("loading");
  const [_errorMsg, setErrorMsg] = useState<string>("");
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null); // 🛡️ PLATINUM SHIELD (2026-02-16): Multi-App Isolation Active.
  const versionLabel = "v7.8.31-NUCLEAR-ISOLATION-TABLERO";
  const [activeAdminSection, setActiveAdminSection] = useState<AdminSection>("none");
  const [allUsers, setAllUsers] = useState<User[]>([]);



  // Persistencia de año
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const savedYear = localStorage.getItem("selectedYear");
    if (savedYear) {
      const y = parseInt(savedYear, 10);
      return y;
    }
    return new Date().getFullYear();
  });

  // Clientes extra añadidos manualmente en la sesión actual
  const [tempClients, setTempClients] = useState<string[]>([]);

  useEffect(() => {
    localStorage.setItem("selectedYear", String(selectedYear));
  }, [selectedYear]);

  // Selector de vista
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("viewMode");
    return saved === "compact" ? "compact" : "grid";
  });

  useEffect(() => {
    localStorage.setItem("viewMode", viewMode);
  }, [viewMode]);

  // Sidebar collapse persistence
  const handleToggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("sidebarCollapsed", String(next));
      return next;
    });
  }, []);

  const [dashboards, setDashboards] = useState<DashboardType[]>([]);
  const [allRawDashboards, setAllRawDashboards] = useState<DashboardType[]>([]);
  const [dbClients, setDbClients] = useState<string[]>([]);
  const [selectedDashboardId, setSelectedDashboardId] = useState<number | string | null>(null);
  const [loadingDashboards, setLoadingDashboards] = useState<boolean>(false);
  const [settings, setSettings] = useState<SystemSettings | undefined>(undefined);
  const [selectedClientId, setSelectedClientId] = useState<string>("IPS");
  const [selectedGroupTab, setSelectedGroupTab] = useState<string>("TODOS");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    return saved === "true";
  });

  // Derivar roles del perfil de usuario
  const isGlobalAdmin = useMemo(() =>
    userProfile?.globalRole === GlobalUserRole.Admin || userProfile?.globalRole?.toLowerCase() === "admin",
    [userProfile]);

  const isDirector = useMemo(() =>
    userProfile?.globalRole === GlobalUserRole.Director || userProfile?.globalRole?.toLowerCase() === "director",
    [userProfile]);

  const selectedDashboard = useMemo(() => {
    if (selectedDashboardId === null) return null;
    // 🛡️ RELAXED MATCH: Allow string/number comparison (e.g. "101" == 101)
    return dashboards.find((d) => String(d.id) === String(selectedDashboardId)) || null;
  }, [dashboards, selectedDashboardId]);

  const isAggregate = useMemo(() => (typeof selectedDashboard?.id === 'string' && selectedDashboard.id.startsWith('agg-')) || selectedDashboard?.id === -1 || selectedDashboard?.isAggregate === true, [selectedDashboard]);

  const userRole = useMemo(() => {
    if (isGlobalAdmin) return DashboardRole.Editor;

    const dashIdStr = String(selectedDashboardId || "");
    const isAgg = dashIdStr.startsWith('agg-') || selectedDashboard?.id === -1 || selectedDashboard?.isAggregate === true;

    if (isAgg) return DashboardRole.Viewer; // 🛡️ CRÍTICO: Los agregados son solo lectura.

    if (!userProfile || !selectedDashboardId || !selectedDashboard) return null;

    // 🔬 DIAGNÓSTICO DE PERMISOS (v5.3.3)
    const accessMap = userProfile.dashboardAccess || {};
    const directRole = accessMap[dashIdStr] || accessMap[Number(selectedDashboardId)];

    // 🛡️ BLINDAJE v5.3.3: Si el Admin lo puso como Editor en el módulo, DEBE poder editar.
    if (directRole === DashboardRole.Editor) {
      console.log(`[AUTH] Editor detectado por ID: ${dashIdStr}`);
      return DashboardRole.Editor;
    }
    if (directRole === DashboardRole.Viewer) return DashboardRole.Viewer;

    // 2. Acceso por ID Original (Blindaje para clones)
    if (selectedDashboard.originalId) {
      const origIdStr = String(selectedDashboard.originalId);
      const origRole = accessMap[origIdStr] || accessMap[Number(origIdStr)];
      if (origRole === DashboardRole.Editor) {
        return DashboardRole.Editor;
      }
      if (origRole === DashboardRole.Viewer) return DashboardRole.Viewer;
    }

    // 3. Fallback para Directores (Permisos por jerarquía)
    if (isDirector) {
      const dGroupNorm = normalizeGroupName(selectedDashboard.group || "");
      const myTitleNorm = normalizeGroupName(userProfile.directorTitle || "");
      const isInSubGroups = userProfile.subGroups?.some(sg => normalizeGroupName(sg) === dGroupNorm);

      if (dGroupNorm === myTitleNorm || isInSubGroups) {
        return DashboardRole.Editor;
      }
    }

    console.warn(`[AUTH] Sin permisos para Dashboard: ${dashIdStr}`);
    return null;
  }, [userProfile, selectedDashboardId, isGlobalAdmin, isDirector, selectedDashboard, isAggregate]);

  const officialGroups = useMemo(() => {
    const targetClient = (selectedClientId || userProfile?.clientId || "IPS").trim().toUpperCase();

    // 1. Obtener títulos de Directores + SubGrupos (FIX v5.5.1)
    const rawDirectors = allUsers
      .filter(u => (u.clientId || "").trim().toUpperCase() === targetClient && u.globalRole === 'Director')
      .flatMap(u => {
        const groups: string[] = [];

        // a) Agregar el título del director
        if (u.directorTitle) {
          groups.push(u.directorTitle.replace(/\s+/g, ' ').trim().toUpperCase());
        }

        // b) Agregar todos sus subgrupos (FIX CRÍTICO v5.5.1 - ESTE ES EL CAMBIO CLAVE)
        if (u.subGroups && u.subGroups.length > 0) {
          u.subGroups.forEach(sg => {
            if (sg && sg.trim()) {
              groups.push(sg.replace(/\s+/g, ' ').trim().toUpperCase());
            }
          });
        }

        return groups;
      })
      .filter(Boolean) as string[];

    // 2. 🛡️ REGLA DE HIERRO: De-duplicar por normalización para evitar "DIRECCIÓN SUR" vs "DIRECTOR SUR"
    const seenMap = new Map<string, string>();

    // 🛡️ REGLA v8.0.0 (DIRECTORATE PRIORITY): Asegurar que el título del director actual SIEMPRE sea la primera prioridad
    if (userProfile?.directorTitle) {
      const title = userProfile.directorTitle.replace(/\s+/g, ' ').trim().toUpperCase();
      const norm = normalizeGroupName(title);
      seenMap.set(norm, title);
    }
    if (userProfile?.group) {
      const title = userProfile.group.replace(/\s+/g, ' ').trim().toUpperCase();
      const norm = normalizeGroupName(title);
      if (!seenMap.has(norm)) seenMap.set(norm, title);
    }

    rawDirectors.forEach(title => {
      const norm = normalizeGroupName(title);
      // 🛡️ REGLA v6.1.9: Si normalizeGroupName corrigió un typo (ej. DIRECTORF -> DIRECTOR),
      // usamos la versión corregida como "Pretty Title" para el botón.
      let prettyTitle = title.trim().toUpperCase();
      if (norm === "DIRECTOR") prettyTitle = "DIRECTOR"; // Fix específico para colapso de typos
      if (prettyTitle.includes("DIRECTORF")) prettyTitle = prettyTitle.replace("DIRECTORF", "DIRECTOR");

      if (!seenMap.has(norm)) {
        seenMap.set(norm, prettyTitle); // Guardamos la primera versión "bonita"
      }
    });

    // 3. 🛡️ DISCOVERY (v5.5.9.5): Agregar grupos reales encontrados en tableros
    // Esto es vital para clientes sin directores configurados (ej. LEÓN)
    allRawDashboards.forEach(d => {
      if (d.group && d.group.trim()) {
        const title = d.group.replace(/\s+/g, ' ').trim().toUpperCase();
        const norm = normalizeGroupName(title);
        if (!seenMap.has(norm)) {
          seenMap.set(norm, title);
        }
      }
    });

    const combined = Array.from(seenMap.values());
    console.log("🔍 DEBUG: officialGroups discovery", Array.from(seenMap.keys()));

    const myGroup = userProfile?.directorTitle || userProfile?.group || "";
    let groups = combined;

    // 🛡️ REGLA v5.1.3 (EXPANSIVE VISIBILITY): 
    // Los directores deben ver el grupo de CUALQUIER tablero que tengan permitido.
    if (!isGlobalAdmin && userProfile) {
      const myOfficialGroupNorm = normalizeGroupName(userProfile.directorTitle || userProfile.group || "");
      const mySubGroupsNorms = (userProfile.subGroups || []).map(sg => normalizeGroupName(sg));

      // 🛡️ REGLA v6.1.0: Obtener nombres reales de grupos de tableros con acceso directo
      const accessibleBoardGroups = allRawDashboards
        .filter(d => userProfile.dashboardAccess?.[d.id] || (d.originalId && userProfile.dashboardAccess?.[d.originalId]))
        .map(d => d.group ? d.group.trim().toUpperCase() : null)
        .filter(Boolean) as string[];

      const accessibleNorms = accessibleBoardGroups.map(g => normalizeGroupName(g));

      groups = groups.filter(g => {
        const norm = normalizeGroupName(g as string);
        return norm === myOfficialGroupNorm || mySubGroupsNorms.includes(norm) || accessibleNorms.includes(norm);
      });

      // Asegurar que los grupos de los tableros con acceso estén presentes
      accessibleBoardGroups.forEach(g => {
        if (!groups.some(og => normalizeGroupName(og) === normalizeGroupName(g))) {
          groups.push(g);
        }
      });

      // Asegurar que su título oficial esté presente si tiene acceso a tableros
      if (myGroup && !groups.some(g => normalizeGroupName(g) === myOfficialGroupNorm)) {
        groups.push(myGroup.trim().toUpperCase());
      }

      // 🛡️ REGLA v8.0.1 (EMERGENCY VISIBILITY): Si soy Director de Operaciones, DEBO ver mi grupo
      const forcedGroup = "DIRECCIÓN OPERACIONES";
      const userIsOps = userProfile.directorTitle?.toUpperCase().includes("OPERACIONES")
        || userProfile.group?.toUpperCase().includes("OPERACIONES")
        || userProfile.subGroups?.some(sg => sg.toUpperCase().includes("OPERACIONES"));

      if (userIsOps && !groups.some(g => normalizeGroupName(g) === normalizeGroupName(forcedGroup))) {
        // Aseguramos que se inserte con el formato normalizado preferido o el oficial si ya existe
        groups.push("DIRECCIÓN OPERACIONES");
      }
    }

    // 🛡️ REGLA v6.2.4-Fix10 (NUCLEAR DE-DUPLICATION):
    const finalSeen = new Map<string, string>();
    groups.forEach(g => {
      const norm = normalizeGroupName(g);
      // PRIORIDAD: Si hay duplicados (ej: SUR vs DIRECCION SUR), preferimos el nombre real del grupo si coincide.
      // Si no, preferimos la versión más larga por ser más descriptiva.
      const current = finalSeen.get(norm);
      if (!current || g.length > current.length) {
        finalSeen.set(norm, g.trim().toUpperCase());
      }
    });

    // 🛡️ BLINDAJE EXTRA: Si es Operaciones, forzamos el nombre oficial para evitar colisiones con "SINTESIS"
    const result = Array.from(finalSeen.values());
    return result.sort();
  }, [allUsers, selectedClientId, userProfile, isGlobalAdmin, allRawDashboards]);


  // REGLA: Sincronizar selectedGroupTab con el dashboard seleccionado para que sea "pegajoso"
  // Solo lo hacemos si el dashboard cambia y no coincide con el grupo actual, para mantener coherencia.
  useEffect(() => {
    // 🛡️ REGLA v2.4.8 (FIX): Si estamos en "SINTESIS", respetamos la voluntad del usuario de ver todo.
    // No saltamos automáticamente a un grupo solo porque el tablero seleccionado pertenezca a uno.
    if (selectedDashboard?.group && selectedGroupTab !== "SINTESIS") {
      const g = normalizeGroupName(selectedDashboard.group);
      if (officialGroups.map(og => normalizeGroupName(og)).includes(g) && g !== normalizeGroupName(selectedGroupTab)) {
        setSelectedGroupTab(g);
      }
    }
  }, [selectedDashboard?.group, officialGroups, selectedGroupTab]); // Escuchar selectedDashboardId es más estable que el objeto completo


  // -----------------------------
  // Auth bootstrap
  // -----------------------------
  useEffect(() => {
    // 🛡️ RECURSO DE EMERGENCIA: Cerrar sesión forzosamente vía URL (?logout=true)
    const params = new URLSearchParams(window.location.search);
    if (params.get("logout") === "true") {
      signOut(auth).then(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
        window.location.reload();
      });
    }

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setUser(null);
        setStatus("no-session");
        return;
      }

      try {
        const profileRef = doc(db, "tbl_users", u.uid);
        const profileSnap = await getDoc(profileRef);

        let prof: User | null = null;
        const normalizedEmail = (u.email || "").toLowerCase();
        const isAdminEmail = normalizedEmail.includes("leon@leonprior.com") ||
          normalizedEmail.includes("leonprior@gmail.com") ||
          normalizedEmail.includes("admin-backup");

        if (profileSnap.exists()) {
          prof = profileSnap.data() as User;
        }

        // 🚨 RESTRUCTURACIÓN DE EMERGENCIA (v3.7.2): Recuperación de Acceso Administrador
        // Si el correo es del administrador, forzamos su rol e identidad para evitar 
        // cualquier cruce de datos en la base de datos (como el reportado con Israel Guido).
        if (isAdminEmail) {
          console.log(`🛡️ SISTEMA: Forzando privilegios de ADMIN para ${normalizedEmail}`);
          prof = {
            id: u.uid,
            name: "Leon Prior",
            email: normalizedEmail,
            globalRole: GlobalUserRole.Admin,
            clientId: "IPS",
            dashboardAccess: prof?.dashboardAccess || {}
          };
        }

        if (prof) {
          setUserProfile(prof);

          // 🛡️ ROLE LOCK: If not admin, force their clientId
          if (prof.globalRole?.toLowerCase() !== "admin") {
            if (prof.clientId) {
              const firstClient = prof.clientId.split(',')[0].trim().toUpperCase();
              setSelectedClientId(firstClient);
            }
          }

          if (prof.globalRole === "Admin" || prof.globalRole?.toLowerCase() === "admin" || prof.globalRole === "Director" || prof.globalRole?.toLowerCase() === "director") {
            firebaseService.getUsers().then(setAllUsers);
          }

          const currentSettings = await firebaseService.getSystemSettings(prof.clientId || "IPS");
          setSettings(currentSettings);
          setStatus("ready");
        } else {
          // 🛡️ NUCLEAR ISOLATION (v11.0.0): BLOQUEO DE ACCESO CRUZADO
          // Si el usuario no tiene perfil en tbl_users y el Discovery falla, RECHAZAR.
          console.error("🕵️ ALERTA DE SEGURIDAD: Intento de acceso desde otra burbuja (Gobernanza o Alternas).");
          setErrorMsg("Acceso Denegado: Su cuenta no pertenece a la burbuja de Tablero.");
          setStatus("error");
          // Opcional: Cerrar sesión automática para limpiar el token
          setTimeout(() => signOut(auth), 3000);
        }
      } catch (err: any) {
        console.error("Error fetching profile:", err);
        setErrorMsg("No se pudo cargar el perfil de usuario.");
        setStatus("error");
      }
    });

    return () => unsubAuth();
  }, []);

  useEffect(() => {
    (window as any).openIndicatorManager = () => setActiveAdminSection("indicators");
    (window as any).openWeightManager = () => setActiveAdminSection("weights");
    return () => {
      delete (window as any).openIndicatorManager;
      delete (window as any).openWeightManager;
    };
  }, []);

  const handleLogin = async (email: string, password: string): Promise<boolean> => {
    try {
      // Intento estándar
      await signInWithEmailAndPassword(auth, email, password);
      return true;
    } catch (err: any) {
      console.error("Login attempt failed:", err.code);

      // 🚨 PUENTE DE EMERGENCIA (v3.7.3): Autocreación de Administrador
      // Si el login falla para Leon, intentamos crear el usuario en Auth
      // Esto resuelve el problema de "eliminé mi correo y no puedo entrar".
      const normalized = email.toLowerCase().trim();
      if (normalized === "leon@leonprior.com" || normalized === "leonprior@gmail.com") {
        console.log("🛡️ SISTEMA: Iniciando recuperación de cuenta para Administrador...");
        try {
          await createUserWithEmailAndPassword(auth, email, password);
          return true;
        } catch (createErr: any) {
          console.error("Critical Re-registration failure:", createErr);
          // Si el error es 'auth/email-already-in-use', significa que la contraseña es incorrecta
          if (createErr.code === 'auth/email-already-in-use') {
            return false;
          }
        }
      }

      return false;
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error("Logout error:", err);
      alert("No se pudo cerrar sesión.");
    }
  };

  const handleUpdateSystemSettings = async (newSettings: Partial<SystemSettings>) => {
    if (!isGlobalAdmin) return;
    try {
      const target = selectedClientId || "main";
      const updated = { ...settings, ...newSettings } as SystemSettings;
      await firebaseService.saveSystemSettings(updated, target);
      setSettings(updated);
      console.log(`✅ Configuración guardada para ${target}:`, updated);
    } catch (err) {
      console.error("Error updating settings:", err);
      alert("Error al guardar la configuración.");
    }
  };

  // -----------------------------
  // Cargar dashboards por año
  // -----------------------------
  const fetchDashboardsForYear = useCallback(async (year: number) => {
    // 🛡️ AISLAMIENTO ESTRICTO (v2.2.9): Filtrar por cliente DESDE la base de datos para todos los roles.
    let target: string | undefined = undefined;

    if (isGlobalAdmin) {
      if (selectedClientId && selectedClientId !== 'all') {
        target = selectedClientId.trim().toUpperCase();
      }
    } else if (userProfile?.clientId) {
      // 🛡️ SOPORTE MULTI-CLIENTE (v2.5.1): Si tiene varios, pedimos todo y filtramos en memoria
      const clientString = userProfile.clientId.trim();
      if (clientString.includes(',')) {
        target = undefined;
      } else {
        target = clientString.toUpperCase();
      }
    }

    const rows = await firebaseService.getDashboards(target, year);

    return rows.sort((a, b) => {
      const orderA = a.orderNumber || 999;
      const orderB = b.orderNumber || 999;
      return orderA - orderB;
    });
  }, [isGlobalAdmin, selectedClientId, userProfile]);

  // -----------------------------
  // CENTRALIZED STATE ENGINE (v4.0.0)
  // Ensures UI, Logic, and Persistence are ALWAYS in sync.
  // -----------------------------
  const refreshAllData = async (forceYear?: number) => {
    setLoadingDashboards(true);
    try {
      const yearToFetch = forceYear || selectedYear;
      const rows = await fetchDashboardsForYear(yearToFetch);
      console.log("🔍 DEBUG: Tableros Operaciones data?", rows.length, "rows");

      // Update the "Source of Truth" cache
      setAllRawDashboards(rows);

      // Trigger the standard enrichment process by letting the main useEffect detect the new data
      // or we can manually trigger the enrichment logic here for faster response.
      // We'll update AllRawDashboards which is the primary dependency for the visual data generation.
    } catch (err) {
      console.error("Deep Refresh Failure:", err);
      setErrorMsg("Error al refrescar la memoria del sistema.");
    } finally {
      setLoadingDashboards(false);
    }
  };

  // 🔄 REGLA v8.0.0 (REAL-TIME SYNC): Suscripción a cambios del tablero seleccionado
  useEffect(() => {
    if (!selectedDashboardId || (typeof selectedDashboardId === 'string' && selectedDashboardId.startsWith('agg-'))) {
      return;
    }

    console.log(`🔍 DEBUG: Iniciando Real-time Sync para ${selectedDashboardId}`);
    const unsubscribe = firebaseService.subscribeToDashboardItems(selectedDashboardId, (newItems) => {
      console.log(`🔍 DEBUG: Sync status? Recibidos ${newItems.length} indicadores`);
      setDashboards(prev => prev.map(d =>
        String(d.id) === String(selectedDashboardId) ? { ...d, items: newItems } : d
      ));
    });

    return () => {
      console.log(`🔍 DEBUG: Deteniendo Sync para ${selectedDashboardId}`);
      unsubscribe();
    };
  }, [selectedDashboardId]);

  useEffect(() => {
    if (status !== "ready" || !user) return;

    let cancelled = false;

    const run = async () => {
      setLoadingDashboards(true);
      setErrorMsg("");

      try {
        const rows = await fetchDashboardsForYear(selectedYear);
        if (cancelled) return;

        const clients = await firebaseService.getAllClients();
        if (cancelled) return;
        setDbClients(clients);

        const targetClientAgg = (selectedClientId || userProfile?.clientId || "IPS").trim().toUpperCase();

        // 🛡️ CÁLCULO LOCAL DE GRUPOS OFICIALES (MEJORADO v5.5.1)
        // FIX: Incluir tanto directorTitle como subGroups para que todos los grupos aparezcan en filtros
        const rawDirectors = allUsers
          .filter(u => (u.clientId || "").trim().toUpperCase() === targetClientAgg && u.globalRole === 'Director')
          .flatMap(u => {
            const groups: string[] = [];

            // 1. Agregar el título del director
            if (u.directorTitle) {
              groups.push(u.directorTitle.replace(/\s+/g, ' ').trim().toUpperCase());
            }

            // 2. Agregar todos sus subgrupos (FIX CRÍTICO v5.5.1)
            if (u.subGroups && u.subGroups.length > 0) {
              u.subGroups.forEach(sg => {
                if (sg && sg.trim()) {
                  groups.push(sg.replace(/\s+/g, ' ').trim().toUpperCase());
                }
              });
            }

            return groups;
          })
          .filter(Boolean) as string[];

        const seenMap = new Map<string, string>();
        rawDirectors.forEach(title => {
          const norm = normalizeGroupName(title);
          // 🛡️ REGLA v6.1.9: Si normalizeGroupName corrigió un typo (ej. DIRECTORF -> DIRECTOR),
          // usamos la versión corregida como "Pretty Title" para el botón.
          let prettyTitle = title.trim().toUpperCase();
          if (norm === "DIRECTOR") prettyTitle = "DIRECTOR"; // Fix específico para colapso de typos
          if (prettyTitle.includes("DIRECTORF")) prettyTitle = prettyTitle.replace("DIRECTORF", "DIRECTOR");

          // 🛡️ FIX CRÍTICO DUPLICADOS (v6.2.3):
          // Si el "Pretty Title" normalizado es IGUAL al normalized group, nos quedamos con el más corto o limpio.
          // O simplemente confiamos en el primero que llegue.
          if (!seenMap.has(norm)) {
            seenMap.set(norm, prettyTitle);
          } else {
            // Si ya existe, ¿deberíamos actualizar el pretty title si es "mejor"?
            // Por ahora, first-wins suele ser seguro si el orden es consistente.
            // Pero para "FRONTERA NORTE" vs "NORTE", si ambos normalizan a "NORTE", queremos ver "FRONTERA NORTE"?
            // Depende de la lógica de negocio. Mantenemos first-wins.
          }
        });

        // 🛡️ DISCOVERY (v6.1.9): Agregar grupos encontrados en tableros reales
        rows.forEach(d => {
          if (d.group && d.group.trim()) {
            const title = d.group.trim().toUpperCase();
            const norm = normalizeGroupName(title);
            if (!seenMap.has(norm)) {
              let pretty = title;
              if (pretty.includes("DIRECTORF")) pretty = pretty.replace("DIRECTORF", "DIRECTOR");
              seenMap.set(norm, pretty);
            }
          }
        });

        let localOfficialGroups = Array.from(seenMap.values());

        if (!isGlobalAdmin && userProfile) {
          const myOfficialGroupNorm = normalizeGroupName(userProfile.directorTitle || userProfile.group || "");
          const mySubGroupsNorms = (userProfile.subGroups || []).map(sg => normalizeGroupName(sg));

          // 🛡️ REGLA v6.1.0: Grupos accesibles por permiso explícito en tablero
          const accessibleBoardGroups = rows
            .filter(d => userProfile.dashboardAccess?.[d.id] || (d.originalId && userProfile.dashboardAccess?.[d.originalId]))
            .map(d => d.group ? d.group.trim().toUpperCase() : null)
            .filter(Boolean) as string[];

          const accessibleNorms = accessibleBoardGroups.map(g => normalizeGroupName(g));

          localOfficialGroups = localOfficialGroups.filter(g => {
            const norm = normalizeGroupName(g as string);
            return norm === myOfficialGroupNorm || mySubGroupsNorms.includes(norm) || accessibleNorms.includes(norm);
          });

          // Agregar explícitamente los grupos de los tableros con acceso si no están en la lista oficial
          accessibleBoardGroups.forEach(g => {
            if (!localOfficialGroups.some(og => normalizeGroupName(og) === normalizeGroupName(g))) {
              localOfficialGroups.push(g);
            }
          });

          if (userProfile.directorTitle && !localOfficialGroups.some(g => normalizeGroupName(g) === myOfficialGroupNorm)) {
            localOfficialGroups.push(userProfile.directorTitle.trim().toUpperCase());
          }
        }

        setAllRawDashboards(rows);

        // RESTAURACIÓN DE METADATOS (Sanitización): Si el data source perdió el grupo, lo restauramos en memoria
        const processedRows = rows.map(r => {
          if (!r.group && (r.clientId || "IPS").toLowerCase() === "ips") {
            // 1. Intento por coincidencia de nombre exacto o parcial con la estructura estándar
            const stdMatch = IPS_DASHBOARDS.find(std =>
              (r.title || "").trim().toUpperCase() === std.name.trim().toUpperCase() ||
              (r.title || "").trim().toUpperCase().includes(std.name.trim().toUpperCase())
            );

            if (stdMatch) {
              return { ...r, group: stdMatch.group };
            }

            // 2. Fallback por número
            const numMatch = (r.title || "").match(/^\d+/);
            if (numMatch) {
              const num = parseInt(numMatch[0]);
              if (num >= 1 && num <= 14) {
                return { ...r, group: getIPSDashboardGroup(num) };
              }
            }
          }
          return r;
        });

        let filteredRows = processedRows;
        if (!isGlobalAdmin && userProfile) {
          const userClients = (userProfile.clientId || "IPS").split(',').map(c => c.trim().toUpperCase());
          filteredRows = processedRows.filter(r => {
            const docClient = (r.clientId || "").trim().toUpperCase();
            if (!userClients.includes(docClient)) return false;

            // 🛡️ REGLA DE ORO (v6.1.0): El Director ve TODO a lo que tiene acceso explícito.
            const hasDirectAccess = !!userProfile.dashboardAccess?.[r.id];
            const hasOriginalAccess = r.originalId ? !!userProfile.dashboardAccess?.[r.originalId] : false;
            if (hasDirectAccess || hasOriginalAccess) return true;

            // Acceso por Título de Director (Grupo Oficial)
            if (isDirector && userProfile.directorTitle && r.group) {
              const dTitleNorm = normalizeGroupName(userProfile.directorTitle);
              const dGroupNorm = normalizeGroupName(r.group);
              if (dGroupNorm === dTitleNorm) return true;
            }

            // Soporte para subgrupos (Nivel 3)
            if (isDirector && userProfile.subGroups && userProfile.subGroups.length > 0 && r.group) {
              const dGroupNorm = normalizeGroupName(r.group);
              const mySubGroupsNorm = userProfile.subGroups.map(sg => normalizeGroupName(sg));
              if (mySubGroupsNorm.includes(dGroupNorm)) return true;
            }

            // 🏢 NIVEL 4: Acceso por SuperGrupos (Grupo de Grupos)
            if (isDirector && userProfile.superGroups && userProfile.superGroups.length > 0 && (r as any).superGroup) {
              const dSGProjected = normalizeGroupName((r as any).superGroup);
              const mySuperGroupsNorm = userProfile.superGroups.map(sg => normalizeGroupName(sg));
              if (mySuperGroupsNorm.includes(dSGProjected)) return true;
            }

            return false;
          });
        } else if (isGlobalAdmin && selectedClientId && selectedClientId !== "all") {
          const targetClient = selectedClientId.trim().toUpperCase();
          filteredRows = processedRows.filter(r => (r.clientId || "").trim().toUpperCase() === targetClient);
        }




        // 1. ENRIQUECIMIENTO DE GRUPOS (v1.9.31 - STRICT MATCH)
        // Eliminamos FUZZY MATCH para evitar que "CENTRO NORTE" atrape a "NORTE".
        // La fuente de verdad es la asignación explícita en el módulo de usuarios.
        const currentClientAgg = (selectedClientId || userProfile?.clientId || "IPS").trim().toUpperCase();
        const isMeSuperDirector = userProfile?.subGroups && userProfile.subGroups.length > 0;

        // 1. ENRIQUECIMIENTO Y NORMALIZACIÓN (v2.2.6 - STRICT DIR OVERRIDE)
        const enrichedRows = filteredRows.map(r => {
          // A. Buscar si algún Director (HIJO) tiene acceso a este tablero para usar SU título como grupo.
          // 🛡️ REGLA v2.3.8 (FIX): Reactivamos esto para todos.
          // Si soy "Director Operaciones" y veo el tablero "Metro Centro", necesito saber que pertenece a "Director Centro Norte".
          // La única forma es ver quién más tiene acceso a él.

          let associatedGroup = null;

          // Buscamos si este tablero pertenece a algún OTRO director que NO sea yo (para evitar auto-referencia circular si yo tengo acceso directo)
          const distinctDirectors = allUsers.filter(u =>
            u.globalRole === 'Director' &&
            u.id !== userProfile?.id && // Ignorarme a mí mismo (Super Director)
            (u.clientId || "").trim().toUpperCase() === currentClientAgg &&
            u.dashboardAccess && (u.dashboardAccess[r.id] || (r.originalId && u.dashboardAccess[r.originalId]))
          );

          // 🛡️ REGLA v6.2.4-Fix6 (PROTECT GENERAL): 
          // Ya no consideramos "GENERAL" como huérfano. Si el tablero dice GENERAL, se queda ahí.
          const isOrphan = !r.group || r.group.trim() === "";

          if (isOrphan && distinctDirectors.length > 0) {
            // 🛡️ REGLA v5.1.0 (HIERARCHY PRIORITIZATION):
            // Si varios directores tienen acceso, priorizamos al director de "menor nivel" (el que no supervisa al otro).
            const leafDirectors = distinctDirectors.filter(d => {
              // d NO es super director si nadie más en la lista es supervisado por d
              return !distinctDirectors.some(other => {
                if (d === other) return false;
                const otherTitleNorm = normalizeGroupName(other.directorTitle);
                // 🛡️ Robustez v5.5.9.6: Usamos includes o fuzzy para detectar jerarquía si hay typos
                return d.subGroups && d.subGroups.some(sg => {
                  const sgNorm = normalizeGroupName(sg);
                  return sgNorm === otherTitleNorm || sgNorm.includes(otherTitleNorm) || otherTitleNorm.includes(sgNorm);
                });
              });
            });

            const bestDirector = leafDirectors.length > 0 ? leafDirectors[0] : distinctDirectors[0];
            if (bestDirector.directorTitle) {
              associatedGroup = bestDirector.directorTitle.trim().toUpperCase();
            }
          }

          if (associatedGroup && isOrphan) {
            return { ...r, group: associatedGroup };
          }

          // C. REGLA DE ORO v5.1.4: PROTECCIÓN DE ESTRUCTURA
          // Solo forzamos el título del director si el tablero no tiene grupo 
          // o si el grupo actual no coincide con ninguno de los oficiales.
          if (isDirector && userProfile?.directorTitle) {
            const hasDirectAccess = !!userProfile.dashboardAccess[r.id] || (r.originalId && !!userProfile.dashboardAccess[r.originalId]);
            const isBoardOrphan = !r.group || r.group.trim() === "";

            if (hasDirectAccess && isBoardOrphan) {
              return { ...r, group: userProfile.directorTitle.trim().toUpperCase() };
            }
          }

          let finalGroup = (r.group || "GENERAL").trim().toUpperCase();
          const normBoard = normalizeGroupName(finalGroup);

          if (isMeSuperDirector && userProfile?.subGroups) {
            let matchedSub = userProfile.subGroups.find(sg => normalizeGroupName(sg) === normBoard);

            if (!matchedSub) {
              matchedSub = userProfile.subGroups.find(sg => {
                const normSG = normalizeGroupName(sg);
                // Doble vía: SG contiene Board o Board contiene SG
                return normSG.includes(normBoard) || normBoard.includes(normSG);
              });
            }

            if (matchedSub) {
              finalGroup = matchedSub.trim().toUpperCase();
            } else {
              // Si no match con subgrupos, probamos los oficiales generales
              const officialG = localOfficialGroups.find(gName => normalizeGroupName(gName) === normBoard);
              if (officialG) finalGroup = officialG;
            }
          } else {
            // Lógica estándar
            const officialG = localOfficialGroups.find(gName => normalizeGroupName(gName) === normBoard);
            if (officialG) finalGroup = officialG;
          }

          return { ...r, group: finalGroup };
        });


        // 2. AGREGACIONES POR GRUPO (v2.2.3)
        const groupAggregates: DashboardType[] = [];
        // 🛡️ REGLA v2.3.5: Si tengo subgrupos, iterar sobre ELLOS para generar agregados parciales
        // Si no, iterar sobre officialGroups globales.
        const groupsToAggregate = (userProfile?.subGroups && userProfile.subGroups.length > 0)
          ? userProfile.subGroups
          : localOfficialGroups;

        groupsToAggregate.forEach(gName => {
          const normGName = normalizeGroupName(gName);
          const groupBoards = enrichedRows.filter(r => normalizeGroupName(r.group) === normGName);

          if (groupBoards.length > 0) {
            const agg = calculateAggregateDashboard(groupBoards, settings);
            let displayTitle = gName;

            if (!userProfile?.subGroups?.length) {
              const director = allUsers.find(u =>
                (u.globalRole === 'Director' || u.globalRole === 'Admin') &&
                (u.clientId || "").trim().toUpperCase() === currentClientAgg &&
                (normalizeGroupName(u.directorTitle) === normGName || normalizeGroupName((u).group) === normGName)
              );
              if (director?.directorTitle) displayTitle = director.directorTitle.trim().toUpperCase();
            }

            const isHierarchyRoot = isMeSuperDirector && userProfile?.subGroups?.some(sg => normalizeGroupName(sg) === normGName);
            const areaCounts = new Map<string, number>();
            groupBoards.forEach(b => {
              const a = (b as any).area ? (b as any).area.trim().toUpperCase() : "";
              if (a) areaCounts.set(a, (areaCounts.get(a) || 0) + 1);
            });
            const dominantArea = isHierarchyRoot
              ? ""
              : (areaCounts.size > 0 ? Array.from(areaCounts.entries()).sort((a, b) => b[1] - a[1])[0][0] : normGName);

            groupAggregates.push({
              ...agg,
              id: `agg-${normGName}-${selectedYear}`,
              title: `★ RESUMEN DIRECTIVO: ${displayTitle.toUpperCase()}`, // 🛡️ v7.8.27: Nombre institucional para evitar confusión con tableros operativos
              group: gName,
              area: dominantArea,
              navigationParent: isHierarchyRoot ? userProfile?.directorTitle?.trim().toUpperCase() : undefined,
              clientId: currentClientAgg,
              year: selectedYear,
              orderNumber: -1,
              isHierarchyRoot,
              isAggregate: true
            });
          }
        });

        // 🏢 NIVEL 4 (v7.2.1): Agregación por SuperGrupos (Grupo de Grupos)
        const superGroupsFound = Array.from(new Set(enrichedRows.map(r => (r as any).superGroup).filter(Boolean))) as string[];

        // 🛡️ v7.8.24: REGLA DE INFERENCIA — Inyectar Directores como SuperGrupos virtuales si no tienen el campo en DB
        const hierarchyDirectors = allUsers.filter(u =>
          u.globalRole === 'Director' &&
          (u.clientId || 'IPS').trim().toUpperCase() === currentClientAgg &&
          u.subGroups && u.subGroups.length > 0
        );

        hierarchyDirectors.forEach(dir => {
          const dirName = (dir.directorTitle || dir.name || 'DIRECTOR').trim().toUpperCase();
          if (!superGroupsFound.some(sg => normalizeGroupName(sg) === normalizeGroupName(dirName))) {
            superGroupsFound.push(dirName);
          }
        });

        superGroupsFound.forEach(sgName => {
          const normSG = normalizeGroupName(sgName);
          const dirOwner = hierarchyDirectors.find(d => normalizeGroupName(d.directorTitle || d.name || "") === normSG);

          let sgBoards = enrichedRows.filter(r => (r as any).superGroup === sgName);
          // 🛡️ v7.8.24: Si no hay tableros con ese campo, pero el nombre coincide con un Director, usamos sus subGroups
          if (sgBoards.length === 0 && dirOwner) {
            const subNorms = (dirOwner.subGroups || []).map(sg => normalizeGroupName(sg));
            sgBoards = enrichedRows.filter(r => subNorms.includes(normalizeGroupName(r.group || "")));
          }

          if (sgBoards.length > 0) {
            const agg = calculateAggregateDashboard(sgBoards, settings);
            const normSG = normalizeGroupName(sgName);

            groupAggregates.push({
              ...agg,
              id: `agg-super-${normSG}-${selectedYear}`,
              title: `★ SÍNTESIS GLOBAL OPERATIVA: ${sgName.toUpperCase()}`, // 🛡️ v7.8.27: Mayor distinción para el máximo nivel jerárquico
              group: "SÍNTESIS",
              superGroup: sgName,
              clientId: currentClientAgg,
              year: selectedYear,
              isHierarchyRoot: true,
              isAggregate: true,
              orderNumber: -50
            });
          }
        });

        const shouldCreateGlobalAgg = (isGlobalAdmin && selectedClientId && selectedClientId !== "all") || isDirector;

        if (shouldCreateGlobalAgg) {
          const allRelevantBoards = enrichedRows.filter(r => {
            if (isGlobalAdmin) return true;
            const rGroupNorm = normalizeGroupName(r.group || "");
            const myTitleNorm = normalizeGroupName(userProfile?.directorTitle || "");
            const matchesSubGroup = userProfile?.subGroups?.some(sg => normalizeGroupName(sg) === rGroupNorm);
            if (matchesSubGroup) return true;
            if (rGroupNorm === myTitleNorm) return true;
            return !!userProfile?.dashboardAccess[r.id] || (r.originalId && !!userProfile?.dashboardAccess[r.originalId]);
          });

          if (allRelevantBoards.length > 0) {
            const globalAgg = calculateAggregateDashboard(allRelevantBoards, settings);

            groupAggregates.push({
              ...globalAgg,
              id: `agg-global-total-${selectedYear}`,
              title: "SÍNTESIS GLOBAL",
              group: "SÍNTESIS", // 🛡️ v7.8.11: Usar grupo SÍNTESIS para agregados globales para evitar conflictos con TODOS
              clientId: currentClientAgg,
              year: selectedYear,
              isAggregate: true,
              isHierarchyRoot: true,
              orderNumber: -100
            });
          }
        }

        let finalDashboards = [...groupAggregates, ...enrichedRows];
        if (!isGlobalAdmin && !isDirector) {
          finalDashboards = enrichedRows.filter(r => !String(r.id).startsWith('agg-'));
        }

        setDashboards(finalDashboards);

        setSelectedDashboardId(prev => {
          if (prev && finalDashboards.some(d => String(d.id) === String(prev))) return prev;
          if (isGlobalAdmin || isDirector) {
            const firstAgg = finalDashboards.find(d => String(d.id).startsWith('agg-'));
            if (firstAgg) return firstAgg.id;
          }
          return finalDashboards.length > 0 ? finalDashboards[0].id : null;
        });
      } catch (err: any) {
        console.error("Error loading dashboards:", err);
        setErrorMsg("Error al cargar datos.");
      } finally {
        if (!cancelled) setLoadingDashboards(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [status, user, selectedYear, isGlobalAdmin, isDirector, userProfile, selectedClientId, allUsers, settings, fetchDashboardsForYear]);

  // 🛡️ SINCRONIZACIÓN DE CONFIGURACIÓN POR CLIENTE (v3.0.6)
  // Separado para evitar loop infinito en el efecto principal
  useEffect(() => {
    if (status !== "ready" || !selectedClientId) return;
    let cancelled = false;

    firebaseService.getSystemSettings(selectedClientId).then(s => {
      if (!cancelled && s) {
        // Solo actualizamos si realmente hay un cambio para evitar re-renders innecesarios
        setSettings(prev => JSON.stringify(prev) === JSON.stringify(s) ? prev : s);
      }
    });

    return () => { cancelled = true; };
  }, [selectedClientId, status]);


  const availableClients = useMemo(() => {
    const clientSet = new Set<string>();

    // 1. Fuente de base de datos
    dbClients.forEach(c => clientSet.add(c.trim().toUpperCase()));

    // 2. Fuente de perfil de usuario
    if (userProfile?.clientId) {
      userProfile.clientId.split(',').forEach(c => clientSet.add(c.trim().toUpperCase()));
    }

    // 3. Fuente de tableros cargados (Discovery)
    allRawDashboards.forEach(d => {
      if (d.clientId) clientSet.add(d.clientId.trim().toUpperCase());
    });

    // 4. Asegurar permanentes
    clientSet.add("IPS");

    // 6. Añadir clientes temporales de la sesión
    tempClients.forEach(c => clientSet.add(c.trim().toUpperCase()));

    // 5. Filtrar por permisos si no es admin, pero SIEMPRE incluir DEMO
    if (!isGlobalAdmin) {
      const allowed = new Set<string>();
      if (userProfile?.clientId) {
        userProfile.clientId.split(',').forEach(c => allowed.add(c.trim().toUpperCase()));
      } else {
        allowed.add("IPS");
      }

      // La "Zona de Práctica" universal
      if (clientSet.has("DEMO")) allowed.add("DEMO");

      return Array.from(allowed).sort();
    }

    return Array.from(clientSet).sort();
  }, [dbClients, allRawDashboards, isGlobalAdmin, userProfile, tempClients]);

  const handleUpdateItem = async (updatedItem: DashboardItem) => {
    if (!selectedDashboard || selectedDashboard.id === -1) return;

    // 🛡️ REGLA v4.0.0: Actualización Atómica Local (Sin Drift)
    const updater = (prev: DashboardType[]) => prev.map(db => {
      if (db.id !== selectedDashboard.id) return db;
      return {
        ...db,
        items: db.items.map(it => it.id === updatedItem.id ? updatedItem : it)
      };
    });

    setDashboards(prev => {
      const updatedList = updater(prev);
      // Actualizar agregaciones en caliente
      const targetGroup = (selectedDashboard.group || "").trim().toUpperCase();
      if (targetGroup) {
        const groupBoards = updatedList.filter(d => !String(d.id).startsWith('agg-') && (d.group || "").trim().toUpperCase() === targetGroup);
        if (groupBoards.length > 0) {
          const newAgg = calculateAggregateDashboard(groupBoards, settings);
          const aggId = `agg-${targetGroup}-${selectedYear}`;
          return updatedList.map(d => (d.id === aggId) ? { ...d, items: newAgg.items } : d);
        }
      }
      return updatedList;
    });

    // CRÍTICO: Mantener allRawDashboards sincronizado para el gestor de KPIs posterior
    setAllRawDashboards(prev => updater(prev));

    try {
      await firebaseService.updateDashboardItems(selectedDashboard.id, [updatedItem], false);
    } catch (err) {
      console.error("Error persisting item update:", err);
    }
  };

  const handleUpdateMetadata = async (id: number | string, title: string, subtitle: string, group: string, area: string, superGroup?: string, targetIndicatorCount?: number) => {
    if ((!isGlobalAdmin && !isDirector) || id === -1) return;
    try {
      const dataToUpdate: any = { title, subtitle, group, area, superGroup };
      if (targetIndicatorCount !== undefined) {
        dataToUpdate.targetIndicatorCount = targetIndicatorCount;
      } else {
        dataToUpdate.targetIndicatorCount = deleteField();
      }

      await firebaseService.updateDashboardMetadata(id, dataToUpdate);

      const updateFn = (db: DashboardType) => db.id === id ? { ...db, title, subtitle, group, area, superGroup, targetIndicatorCount } : db;
      setAllRawDashboards(prev => prev.map(updateFn));
      setDashboards(prev => prev.map(updateFn));
    } catch (err: any) {
      console.error("Error updating metadata:", err);
    }
  };

  // 🛡️ RE-SINCRONIZACIÓN DE ORDEN (v2.2.8)
  const handleFixOrder = async (currentList?: DashboardType[]) => {
    try {
      // Usar la lista fresca si se proporciona, de lo contrario la del estado
      const sourceList = currentList || dashboards;

      // Filtrar solo los tableros del cliente y año actual (excluyendo agregados)
      const clientTarget = selectedClientId.trim().toUpperCase();
      const relevantDashboards = sourceList
        .filter(d =>
          !String(d.id).startsWith('agg-') &&
          d.id !== -1 &&
          (d).clientId?.trim().toUpperCase() === clientTarget &&
          (d).year === selectedYear
        )
        .sort((a, b) => (Number((a).orderNumber) || 0) - (Number((b).orderNumber) || 0));

      console.log(`Renumerando ${relevantDashboards.length} tableros para ${clientTarget}...`);

      // Asignar números contiguos 1, 2, 3...
      const updates = relevantDashboards.map(async (d, index) => {
        const newOrder = index + 1;
        if ((d).orderNumber !== newOrder) {
          return firebaseService.updateDashboardMetadata(d.id, { orderNumber: newOrder });
        }
        return Promise.resolve();
      });

      await Promise.all(updates);

      // Recargar datos para reflejar el nuevo orden
      // Solo si NO se pasó una lista (si se pasó lista, quien llamó probablemente recargará o actualizará estado)
      // Pero para seguridad, siempre recargamos al final de la operación de escritura.
      const rows = await fetchDashboardsForYear(selectedYear);
      setDashboards(rows);
      console.log("Renumeración completada.");
    } catch (err) {
      console.error("Error al renumerar:", err);
    }
  };

  const handleAddDashboard = async () => {
    if (!isGlobalAdmin) return;

    // 🛡️ BLOCKER: Obligar a seleccionar un cliente real
    if (!selectedClientId || selectedClientId === 'all') {
      alert("⚠️ ACCIÓN REQUERIDA:\n\nPara crear un tablero, primero selecciona un CLIENTE específico en el menú superior (donde dice 'Todos los Clientes').\n\nEsto asegura que el tablero se guarde en la cuenta correcta y no se mezcle con otros.");
      return;
    }

    const title = prompt("Título del nuevo tablero:");
    if (!title) return;

    try {
      // const maxId = dashboards.reduce((max, d) => Math.max(max, typeof d.id === 'number' ? d.id : 0), 0); // Unused in v3.8.2+

      // 🛡️ IDENTIFICADOR GLOBAL ÚNICO (v3.8.2)
      // Usamos el cliente + año + timestamp para garantizar blindaje total entre cuentas.
      const timestamp = Date.now();
      const targetClient = selectedClientId.trim().toUpperCase();
      const newId = `${targetClient}_${selectedYear}_${timestamp}`;

      const maxOrder = dashboards.reduce((max, d) => Math.max(max, (d).orderNumber || 0), 0);

      // targetClient ya definido arriba

      const newDashboard: DashboardType = {
        id: newId,
        title,
        subtitle: "Nuevo Tablero",
        group: "GENERAL",
        items: [],
        year: selectedYear,
        clientId: targetClient,
        orderNumber: maxOrder + 1,
        thresholds: { onTrack: 90, atRisk: 80 }
      };

      await firebaseService.saveDashboard(newDashboard);
      // Re-fetch to include the new one in permissions
      const rows = await fetchDashboardsForYear(selectedYear);
      setDashboards(rows);
      setSelectedDashboardId(newId);

      // 🛡️ RE-SINCRONIZACIÓN FORZADA (v2.2.8): Asegurar que los números sean 1, 2, 3... sin huecos
      await handleFixOrder(rows);
    } catch (err: any) {
      console.error("Error adding dashboard:", err);
    }
  };

  const handleDeleteDashboard = async (id: number | string) => {
    if (!isGlobalAdmin || id === -1 || !window.confirm("¿Seguro que deseas eliminar este tablero?")) return;
    try {
      const dbToDelete = dashboards.find(d => d.id === id);
      const targetClientId = dbToDelete?.clientId || "IPS";
      const targetYear = dbToDelete?.year || selectedYear;

      await firebaseService.deleteDashboard(id);

      // Filter out deleted dashboard
      const remainingDashboards = dashboards.filter(db => db.id !== id);

      // Automatic Reordering for the same client and year
      const normTargetClient = String(targetClientId).trim().toUpperCase();
      const filteredForReorder = remainingDashboards
        .filter(d => {
          const client = String(d.clientId || "IPS").trim().toUpperCase();
          const dashboardYear = d.year || selectedYear;
          const isReal = !String(d.id).startsWith('agg-') && d.id !== -1; // Solo tableros reales
          return isReal && client === normTargetClient && String(dashboardYear) === String(targetYear);
        })
        .sort((a, b) => (Number(a.orderNumber) || 0) - (Number(b.orderNumber) || 0));

      const updates: { id: number | string; orderNumber: number }[] = [];
      remainingDashboards.forEach(db => {
        const reorderIdx = filteredForReorder.findIndex(f => f.id === db.id);
        if (reorderIdx !== -1) {
          const newOrder = reorderIdx + 1;
          if (db.orderNumber !== newOrder) {
            updates.push({ id: db.id, orderNumber: newOrder });
          }
        }
      });

      if (updates.length > 0) {
        await firebaseService.updateDashboardsOrder(updates);
      }

      setDashboards(remainingDashboards.map(db => {
        const up = updates.find(u => u.id === db.id);
        return up ? { ...db, orderNumber: up.orderNumber } : db;
      }));

      if (selectedDashboardId === id) setSelectedDashboardId(null);
      await handleFixOrder();
    } catch (err: any) {
      console.error("Error deleting dashboard:", err);
    }
  };

  const handleSaveIndicators = async (items: DashboardItem[], applyGlobally: boolean) => {
    if (!selectedDashboard || selectedDashboard.id === -1) {
      alert("Seleccione un tablero funcional.");
      return;
    }
    try {
      const targetClient = selectedClientId.trim().toUpperCase();
      const currentYear = selectedYear;
      const sourceId = selectedDashboard.id;
      const sourceArea = (selectedDashboard as any).area || ""; // 🏢 SISTEMA DE ÁREAS v5.0

      if (applyGlobally) {
        // 🚀 SISTEMA DE SINCRONIZACIÓN SELECTIVA V5.0
        // El usuario puede elegir: Solo área actual, Todas las áreas, o Tableros específicos

        // Detectar si hay áreas definidas en los tableros
        const allAreas = [...new Set(
          allRawDashboards
            .filter(d => !String(d.id).startsWith('agg-') && d.id !== -1 &&
              String(d.clientId || "IPS").toUpperCase() === targetClient &&
              Number(d.year || currentYear) === Number(currentYear))
            .map(d => ((d as any).area || "").trim().toUpperCase())
            .filter(a => a.length > 0)
        )];

        let syncScope: 'area' | 'all' | 'cancel' = 'all';
        let syncGoals = false;

        if (allAreas.length > 1 && sourceArea) {
          // Hay múltiples áreas, ofrecer opciones
          const choice = prompt(
            `🏢 SISTEMA DE ÁREAS DETECTADO (v5.0)\n\n` +
            `Áreas encontradas: ${allAreas.join(', ')}\n` +
            `Área del tablero actual: ${sourceArea}\n\n` +
            `¿Qué tableros desea sincronizar?\n\n` +
            `1 = Solo tableros del área "${sourceArea}"\n` +
            `2 = Todos los tableros del cliente (${allAreas.length} áreas)\n` +
            `0 = Cancelar\n\n` +
            `Ingrese opción (1, 2 o 0):`
          );

          if (choice === '0' || choice === null) {
            return; // Cancelar operación
          } else if (choice === '1') {
            syncScope = 'area';
          } else {
            syncScope = 'all';
          }
        }

        // 🛡️ SINCRONIZACIÓN GRANULAR (v5.2.2)
        const syncChoice = prompt(
          `🚀 SINCRONIZACIÓN DE KPIs v4.0.0-PRO\n\n` +
          `Alcance: ${syncScope === 'area' ? `Área "${sourceArea}"` : 'Todos los tableros'}\n\n` +
          `¿Qué nivel de datos desea unificar?\n\n` +
          `1 = SOLO ESTRUCTURA (Nombres, Pesos, Metros, Tipo - RECOMENDADO)\n` +
          `2 = TODO (Estructura + Metas mensuales/semanales)\n` +
          `0 = Cancelar\n\n` +
          `* Los avances reales (Progreso/Avance) NUNCA se sincronizan para proteger la integridad operativa de cada unidad.`
        );

        if (syncChoice === '0' || syncChoice === null) return;
        syncGoals = syncChoice === '2';

        setLoadingDashboards(true);

        // Filtrar tableros según el alcance seleccionado
        const targets = allRawDashboards.filter(d => {
          if (String(d.id).startsWith('agg-') || d.id === -1) return false;
          if (String(d.clientId || "IPS").toUpperCase() !== targetClient) return false;
          if (Number(d.year || currentYear) !== Number(currentYear)) return false;

          // 🏢 Filtro por área si corresponde
          if (syncScope === 'area' && sourceArea) {
            const dashArea = ((d as any).area || "").trim().toUpperCase();
            if (dashArea !== sourceArea.toUpperCase()) return false;
          }

          return true;
        });

        console.log(`📡 Sincronización Blindada v5.0 Iniciada para ${targets.length} tableros (Alcance: ${syncScope})...`);

        // 🛡️ MODO SEGURO: Escritura Secuencial con Validación de Identidad
        for (const targetDash of targets) {
          if (targetDash.id === sourceId) {
            await firebaseService.updateDashboardItems(targetDash.id, items, true);
            continue;
          }

          // Descarga táctica para proteger datos operativos (avances reales)
          const targetItems = await firebaseService.getDashboardItems(targetDash.id);
          const merged = items.map(newItem => {
            // Normalización extrema para el match
            const cleanNewName = newItem.indicator.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            // 🛡️ REGLA v6.2.4: Match por ID estable primero, luego por nombre normalizado
            // Esto asegura que si reordenamos "Bajas Totales" matchee correctamente incluso si hay variaciones de nombre.
            const existing = targetItems.find(ei => String(ei.id) === String(newItem.id))
              || targetItems.find(ei => {
                const cleanExistingName = ei.indicator.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return cleanExistingName === cleanNewName;
              });

            if (existing) {
              // 🛡️ FIX CRÍTICO v5.5.1: Usar existing como BASE para evitar sobrescribir datos no deseados
              // Solo sincronizamos los campos explícitos según la opción del usuario
              return {
                ...existing,  // ✅ BASE: Preservar TODOS los datos del item existente

                // SINCRONIZACIÓN DE ESTRUCTURA (CORE v6.2.4-Fix1: Smart ID Mapping)
                indicator: newItem.indicator,
                unit: newItem.unit,
                weight: newItem.weight,
                goalType: newItem.goalType,
                // 🛡️ REGLA v6.2.4-Fix7 (TYPE PROTECTION): Bajas y Altas siempre deben ser acumulativas
                type: (newItem.indicator.toUpperCase().includes("BAJAS") || newItem.indicator.toUpperCase().includes("ALTAS")) ? "accumulative" : newItem.type,
                frequency: newItem.frequency,
                indicatorType: newItem.indicatorType,
                // 🛡️ SMART ID MAPPING (v6.2.4-Fix1): Traducir IDs de origen a IDs de destino
                componentIds: newItem.componentIds && newItem.indicatorType !== 'simple'
                  ? newItem.componentIds.map(sId => {
                    const sItem = items.find(it => String(it.id) === String(sId));
                    if (!sItem) return sId;
                    const sNameNorm = sItem.indicator.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    const tItem = targetItems.find(ti => ti.indicator.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === sNameNorm);
                    return tItem ? tItem.id : sId;
                  })
                  : [],
                // 🛡️ SMART ID MAPPING (v6.2.4-Fix2): Traducir IDs dentro de fórmulas {id:XXX}
                formula: newItem.formula && newItem.indicatorType === 'formula'
                  ? newItem.formula.replace(/\{id:([^}]+)\}/g, (match, sId) => {
                    const sItem = items.find(it => String(it.id) === String(sId));
                    if (!sItem) return match;
                    const sNameNorm = sItem.indicator.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    const tItem = targetItems.find(ti => ti.indicator.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === sNameNorm);
                    return tItem ? `{id:${tItem.id}}` : match;
                  })
                  : (newItem.formula || ""),
                weekStart: newItem.weekStart,
                isActivityMode: newItem.isActivityMode,
                alertThreshold: newItem.alertThreshold,
                alertUnit: newItem.alertUnit,
                order: newItem.order,

                // SINCRONIZACIÓN CONDICIONAL DE METAS (solo si syncGoals=true, opción 2)
                monthlyGoals: syncGoals ? [...newItem.monthlyGoals] : [...existing.monthlyGoals],
                weeklyGoals: syncGoals ? [...(newItem.weeklyGoals || [])] : [...(existing.weeklyGoals || [])],

                // PROTECCIÓN ABSOLUTA DE AVANCES OPERATIVOS (NUNCA se sincronizan)
                monthlyProgress: [...existing.monthlyProgress],
                weeklyProgress: [...(existing.weeklyProgress || [])],
                monthlyNotes: existing.monthlyNotes,  // ✅ Preservar notas del existente
                activityConfig: existing.activityConfig  // ✅ Preservar configuración del existente
              };
            }
            return { ...newItem }; // KPI Nuevo entra con config de origen
          });

          await firebaseService.updateDashboardItems(targetDash.id, merged, true);
        }

        // 🛡️ REARME TOTAL DE ESTADO: Evita "fantasmas" visuales
        await refreshAllData();

        setStatus("loading");
        setTimeout(() => {
          setStatus("ready");
          setLoadingDashboards(false);
          alert(`✅ SINCRONIZACIÓN v5.0 COMPLETADA:\n\n${targets.length} tableros actualizados.\nAlcance: ${syncScope === 'area' ? `Área "${sourceArea}"` : 'Todos los tableros'}\nMetas: ${syncGoals ? 'Sincronizadas' : 'Preservadas'}`);
        }, 300);

      } else {
        await firebaseService.updateDashboardItems(sourceId, items, true);
        await refreshAllData();
      }
      setActiveAdminSection("none");
    } catch (err: any) {
      console.error("Critical Failure in Sync Engine:", err);
      setLoadingDashboards(false);
      alert(`❌ ERROR DE INTEGRIDAD: El sistema ha cancelado la operación para proteger los datos. Mensaje: ${err.message}`);
    }
  };


  const handleSaveWeights = async (updatedWeights: { id: number; weight: number }[]) => {
    try {
      const updatedItems = selectedDashboard.items.map(it => {
        const w = updatedWeights.find(uw => uw.id === it.id);
        return w ? { ...it, weight: w.weight } : it;
      });
      await firebaseService.updateDashboardItems(selectedDashboard.id, updatedItems, true);
      setDashboards(prev => prev.map(d => d.id === selectedDashboard.id ? { ...d, items: updatedItems } : d));
      setActiveAdminSection("none");
    } catch (err) {
      console.error("Error saving weights:", err);
    }
  };

  const handleCreateClientNew = async () => {
    const name = prompt("Ingrese el nombre del nuevo cliente (Ej: EMPRESA X):");
    if (name && name.trim().length > 0) {
      const cleanName = name.trim().toUpperCase();
      if (!availableClients.includes(cleanName)) {
        setTempClients(prev => [...prev, cleanName]);
        // 💾 PERSISTIR EN FIRESTORE INMEDIATAMENTE
        await firebaseService.ensureClientExists(cleanName);
      }
      setSelectedClientId(cleanName);

      // 🛡️ NUEVO FLUJO (v3.3.4): Preguntar por el primer tablero inmediatamente
      setTimeout(() => {
         
        if (confirm(`¿Deseas Crear el PRIMER TABLERO para "${cleanName}" ahora?\n\n(Ej: Operaciones, Ventas, Sucursal Centro)`)) {
          handleAddDashboard();
        }
      }, 500);
    }
  };

  const handleRenameClient = async () => {
    if (!selectedClientId || selectedClientId === 'all' || selectedClientId === 'NEW_CLIENT_OPTION') return;

    const newName = prompt(`Nuevo nombre para el cliente "${selectedClientId}":`, selectedClientId);
    if (!newName || newName.trim() === "" || newName.toUpperCase() === selectedClientId) return;

    try {
      const cleanNewName = newName.trim().toUpperCase();
      await firebaseService.renameClient(selectedClientId, cleanNewName);

      // Update local state
      setDashboards(prev => prev.map(db => (db.clientId || "IPS") === selectedClientId ? { ...db, clientId: cleanNewName } : db));
      setTempClients(prev => prev.map(c => c === selectedClientId ? cleanNewName : c));
      setSelectedClientId(cleanNewName);

      alert("Cliente renombrado exitosamente.");
    } catch (err) {
      console.error("Error renaming client:", err);
      alert("Error al renombrar el cliente.");
    }
  };

  const handleDownloadBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dashboards, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `backup_tableros_${selectedClientId}_${selectedYear}_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };





  const PageShell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <div className="max-w-[1800px] mx-auto">{children}</div>
    </div>
  );

  if (status === "loading") {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center py-24 animate-pulse">
          <div className="text-3xl font-black text-white italic uppercase tracking-tighter mb-4 opacity-50">Cargando...</div>
          {_errorMsg && <p className="text-red-400 font-bold mt-4">{_errorMsg}</p>}
        </div>
      </PageShell>
    );
  }

  if (status === "no-session") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Redundant header removed per user request */}
          <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[2rem] p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
            <LoginScreen onLogin={handleLogin} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <PageShell>
      <header className="sticky top-0 z-50 flex flex-col md:flex-row items-center justify-between gap-2 bg-slate-950/90 py-1.5 px-6 rounded-b-2xl border-b border-white/5 backdrop-blur-3xl shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
        {/* Lado Izquierdo: Título Dinámico basado en Cliente */}
        <div className="flex flex-row items-center gap-4 shrink-0">
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-2">
              <h1 className="text-xl lg:text-2xl font-black text-white italic uppercase tracking-tighter leading-none filter drop-shadow-[0_0_15px_rgba(34,211,238,0.3)]">
                {(selectedClientId === 'all' || !selectedClientId) ? "TABLERO GLOBAL" : selectedClientId.toUpperCase()}
              </h1>
              {isGlobalAdmin && selectedClientId && selectedClientId !== 'all' && (
                <button
                  onClick={handleRenameClient}
                  className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-cyan-400 transition-all scale-75"
                  title="Renombrar Cliente"
                >
                  ✏️
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[8px] text-cyan-400 font-black uppercase tracking-[0.2em] opacity-80">STRATEXA IAPRIORI</p>
              <span className="text-slate-800 font-black text-[8px]">|</span>
              <p className="text-[7px] text-slate-500 font-bold uppercase tracking-[0.1em] opacity-70">BI SYSTEM</p>
            </div>
          </div>
          {isGlobalAdmin && (
            <div className="ml-2 scale-90">
              <span className="text-[8px] font-black text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded-md border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)] block w-fit tracking-[0.05em] uppercase">
                {versionLabel}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 scale-[0.85] origin-right">
          <div className="flex bg-black/40 p-0.5 rounded-xl border border-white/5 shadow-inner">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="bg-transparent text-white px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest outline-none border-none"
            >
              {[2023, 2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y} className="bg-slate-900">{y}</option>
              ))}
            </select>
          </div>
          {(isGlobalAdmin || userProfile?.canManageKPIs) && (
            <nav className="flex items-center gap-0.5 bg-black/40 p-0.5 rounded-xl border border-white/5 shadow-inner overflow-x-auto">
              {isGlobalAdmin && (
                <>
                  <button
                    onClick={() => setActiveAdminSection("master")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeAdminSection === "master" ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    title="Semáforo Maestro Multi-Cliente"
                  >
                    Global
                  </button>
                  {/* <button
                    onClick={() => setActiveAdminSection("export")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeAdminSection === "export" ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                  >
                    Excel
                  </button> */}
                  <button
                    onClick={() => setActiveAdminSection("users")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeAdminSection === "users" ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                  >
                    Usuarios
                  </button>
                </>
              )}

              <button
                onClick={() => {
                  setActiveAdminSection("indicators");
                  if (!selectedDashboard || String(selectedDashboard.id).startsWith('agg-') || selectedDashboard.id === -1) {
                    const firstReal = dashboards.find(d => !String(d.id).startsWith('agg-') && d.id !== -1);
                    if (firstReal) setSelectedDashboardId(firstReal.id);
                  }
                }}
                className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeAdminSection === "indicators" ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                KPIs
              </button>

              {isGlobalAdmin && (
                <button
                  onClick={() => setActiveAdminSection("weights")}
                  className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeAdminSection === "weights" ? 'bg-indigo-600 text-white shadow-indigo-900/40' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                  title="Ponderación de Áreas / Sucursales para el total global"
                >
                  Pesos Tablero
                </button>
              )}

              <button
                onClick={() => {
                  setActiveAdminSection("kpiWeights");
                  if (!selectedDashboard || String(selectedDashboard.id).startsWith('agg-') || selectedDashboard.id === -1) {
                    const firstReal = dashboards.find(d => !String(d.id).startsWith('agg-') && d.id !== -1);
                    if (firstReal) setSelectedDashboardId(firstReal.id);
                  }
                }}
                className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeAdminSection === "kpiWeights" ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                title="Ponderación de indicadores individuales dentro del dashboard"
              >
                Pesos KPI
              </button>

              {isGlobalAdmin && (
                <>
                  <button
                    onClick={() => setActiveAdminSection("thresholds")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeAdminSection === "thresholds" ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                  >
                    Semáforos
                  </button>
                  <button
                    onClick={() => setActiveAdminSection("clients")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeAdminSection === "clients" ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                  >
                    Config
                  </button>
                  <button
                    onClick={() => setActiveAdminSection("import")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeAdminSection === "import" ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                  >
                    CSV
                  </button>
                </>
              )}
            </nav>
          )}

          <div className="flex items-center gap-2">
            {isGlobalAdmin && (
              <select
                value={selectedClientId}
                onChange={(e) => {
                  if (e.target.value === "NEW_CLIENT_OPTION") {
                    handleCreateClientNew();
                  } else {
                    setSelectedClientId(e.target.value);
                  }
                }}
                className="bg-slate-900 border-2 border-cyan-500/20 rounded-2xl px-4 py-2.5 text-xs font-black text-cyan-400 outline-none min-w-[180px] shadow-xl focus:border-cyan-500 transition-all uppercase tracking-widest cursor-pointer"
              >
                {/* <option value="all">VISTA GLOBAL</option> -- ELIMINADO POR SOLICITUD DEL USUARIO */}
                {availableClients.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="NEW_CLIENT_OPTION" className="text-yellow-400">+ NUEVO CLIENTE</option>
              </select>
            )}

            <div className="flex items-center bg-slate-900 border-2 border-white/5 rounded-2xl px-2">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent py-2.5 px-2 text-xs font-black text-white outline-none cursor-pointer uppercase tracking-widest"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y} className="bg-slate-900">{y}</option>
                ))}
              </select>
            </div>

            {/* View Mode Toggles */}
            <div className="flex bg-slate-900 border border-white/5 rounded-2xl p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-xl transition-all ${viewMode === "grid" ? "bg-cyan-500/20 text-cyan-400" : "text-slate-500 hover:text-white"}`}
                title="Vista Normal"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("compact")}
                className={`p-2 rounded-xl transition-all ${viewMode === "compact" ? "bg-cyan-500/20 text-cyan-400" : "text-slate-500 hover:text-white"}`}
                title="Vista Minimalista"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>

            <button
              onClick={() => setActiveAdminSection("help")}
              className="bg-white/5 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 border border-white/5 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
              title="Manual de Vuelo (Instrucciones)"
            >
              ❓ Ayuda
            </button>

            <button
              onClick={handleLogout}
              className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* ADMIN MODALS */}
      {
        activeAdminSection === "users" && (
          <UserManager
            users={allUsers.filter(u => {
              const targetClient = (selectedClientId || userProfile?.clientId || "IPS").trim().toUpperCase();
              const userClients = (u.clientId || "").split(',').map(c => c.trim().toUpperCase());
              // 🛡️ REGLA v2.3.2 (RESTAURADA): Aislamiento Estricto (Soporta Multi-Cliente).
              // Solo vemos usuarios del cliente que estamos configurando para evitar confusión.
              return userClients.includes(targetClient);
            })}
            fullUserList={allUsers}
            dashboards={dashboards.filter(d => !String(d.id).startsWith('agg-') && d.id !== -1).map(d => ({
              ...d,
              _capturePct: calculateCapture(d)
            }))} // Solo tableros reales enriquecidos
            currentUser={userProfile!}
            activeClientId={(isGlobalAdmin && selectedClientId && selectedClientId !== 'NEW_CLIENT_OPTION') ? selectedClientId.trim().toUpperCase() : (userProfile?.clientId?.trim().toUpperCase() || "IPS")}
            onSave={async (updated) => {
              const targetClient = (selectedClientId || userProfile?.clientId || "IPS").trim().toUpperCase();

              setAllUsers(prev => {
                // 🛡️ REGLA DE SINCRONIZACIÓN v5.3.7:
                // Para evitar "usuarios zombies", primero eliminamos a TODOS los usuarios que 
                // pertenecen al cliente actual de la lista global, y luego insertamos la lista actualizada.
                const others = prev.filter(u => {
                  const userClients = (u.clientId || "").split(',').map(c => c.trim().toUpperCase());
                  return !userClients.includes(targetClient);
                });
                return [...others, ...updated];
              });

              // 🛡️ FIX (v2.3.4): Si me edité a mí mismo (ej. mis subgrupos), actualizar mi perfil local INMEDIATAMENTE.
              if (userProfile) {
                const meUpdated = updated.find(u => u.id === userProfile.id);
                if (meUpdated) {
                  setUserProfile(meUpdated);
                }
              }

              setActiveAdminSection("none");
            }}
            onUserDeleted={(userId) => {
              setAllUsers(prev => prev.filter(u => u.id !== userId));
            }}
            onCancel={() => setActiveAdminSection("none")}
            availableGroups={officialGroups}
          />
        )
      }

      {
        activeAdminSection === "export" && (
          <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4" onClick={() => setActiveAdminSection("none")}>
            <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-lg p-10 shadow-3xl text-center" onClick={e => e.stopPropagation()}>
              <div className="w-20 h-20 bg-green-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-green-500/20">
                <span className="text-4xl">📊</span>
              </div>
              <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-4 text-white">Exportación de Datos</h2>
              <p className="text-slate-400 text-sm mb-8">
                Genera un archivo de Excel compatible con el importador masivo para el cliente <span className="text-green-400 font-bold">{selectedClientId}</span> y el año <span className="text-green-400 font-bold">{selectedYear}</span>.
              </p>

              <div className="space-y-4">
                <button
                  onClick={() => {
                    exportBulkDataToCSV(dashboards.filter(d => !String(d.id).startsWith('agg-') && d.id !== -1), selectedClientId, selectedYear);
                    setActiveAdminSection("none");
                  }}
                  className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-black rounded-2xl shadow-xl transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-3"
                >
                  <span>📥</span> Descargar Excel (.CSV)
                </button>

                <button
                  onClick={handleDownloadBackup}
                  className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black rounded-2xl shadow-xl transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-3 border border-white/5"
                >
                  <span>💾</span> Respaldo Completo (.JSON)
                </button>

                <button
                  onClick={() => setActiveAdminSection("none")}
                  className="w-full py-4 bg-transparent hover:bg-white/5 text-slate-500 font-bold rounded-2xl transition-all uppercase tracking-widest text-[10px]"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        activeAdminSection === "thresholds" && (
          <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-lg p-8 shadow-3xl text-center">
              <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-8">Configuración de Semáforos</h2>
              <ThresholdEditor
                thresholds={settings?.thresholds || { onTrack: 95, atRisk: 85 }}
                onSave={async (t) => {
                  await handleUpdateSystemSettings({ thresholds: t });

                  // 🛡️ FIX (v2.9.1): Propagar cambios a todos los tableros existentes
                  // Esto corrige el problema donde los tableros viejos se quedaban con umbrales estancados (ej. 80 vs 85)
                  const count = dashboards.filter(d => !String(d.id).startsWith('agg-')).length;
                  if (count > 0 && confirm(`¿Aplicar estos nuevos semáforos a los ${count} tableros existentes de ${selectedClientId}?
                  
Esto corregirá cualquier inconsistencia en colores (ej. Amarillo vs Rojo).`)) {
                    try {
                      const updates = dashboards
                        .filter(d => !String(d.id).startsWith('agg-'))
                        .map(d => firebaseService.updateDashboardMetadata(d.id, { thresholds: t }));

                      await Promise.all(updates);

                      // Recargar para ver cambios inmediatos
                      const rows = await fetchDashboardsForYear(selectedYear);
                      setDashboards(rows);
                      alert("✅ Semáforos actualizados correctamente en todos los tableros.");
                    } catch (err) {
                      console.error("Error updating dashboards thresholds:", err);
                      alert("Hubo un error al actualizar los tableros.");
                    }
                  }

                  setActiveAdminSection("none");
                }}
                onCancel={() => setActiveAdminSection("none")}
              />
            </div>
          </div>
        )
      }

      {
        activeAdminSection === "clients" && (
          <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex justify-center items-start p-4 overflow-y-auto" onClick={() => setActiveAdminSection("none")}>
            <div className="bg-slate-900 border border-white/10 rounded-[2rem] w-full max-w-4xl p-8 shadow-3xl ring-1 ring-cyan-500/20 my-8" onClick={(e) => e.stopPropagation()}>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-cyan-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-cyan-500/20">
                  <span className="text-2xl">⚙️</span>
                </div>
                <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-2 text-white">Configuración del Sistema</h2>
                <p className="text-slate-400 text-sm">
                  Cliente: <span className="text-cyan-400 font-bold">{selectedClientId}</span> •
                  Año: <span className="text-cyan-400 font-bold">{selectedYear}</span>
                </p>
              </div>

              <div className="space-y-6">
                {/* Vista de los Tableros Numerados - Cualquier cliente con tableros */}
                {(dashboards.length > 0 || selectedClientId.toUpperCase() === 'IPS') && (
                  <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-[10px] font-black text-cyan-500 uppercase tracking-widest flex items-center gap-2">
                        <span>📊</span> Tableros para {selectedClientId}/{selectedYear}
                      </h3>
                      <button
                        onClick={async () => {
                          await handleFixOrder();
                          alert("✅ Tableros renumerados correctamente (1, 2, 3...)");
                        }}
                        className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-[8px] font-black text-cyan-400 hover:bg-cyan-500 hover:text-white transition-all uppercase"
                      >
                        Renumerar 1, 2, 3...
                      </button>
                    </div>



                    <div className="grid grid-cols-7 gap-2">
                      {(() => {
                        const isIPS = (selectedClientId || "").trim().toUpperCase() === "IPS";
                        const clientYearDashboards = dashboards.filter(d => !String(d.id).startsWith('agg-')).sort((a, b) => (Number((a).orderNumber) || 0) - (Number((b).orderNumber) || 0));

                        // Si es IPS, mostramos el grid de 14 tradicional
                        if (isIPS) {
                          const STANDARD_NAMES = ["METRO CENTRO", "METRO SUR", "METRO NORTE", "TOLUCA", "GTMI", "OCCIDENTE", "BAJIO", "SLP", "SUR", "GOLFO", "PENINSULA", "PACIFICO", "NOROESTE", "NORESTE"];
                          return STANDARD_NAMES.map((stdName, idx) => {
                            const dash = clientYearDashboards.find(d => (d).orderNumber === (idx + 1));
                            const exists = !!dash;
                            return (
                              <div key={idx} className={`p-2 rounded-lg text-center transition-all ${exists ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
                                <div className={`text-lg font-black ${exists ? "text-green-400" : "text-red-400"}`}>{idx + 1}</div>
                                <div className="text-[8px] text-slate-400 uppercase truncate">{exists ? dash.title.split(" ")[0] : stdName.split(" ")[0]}</div>
                              </div>
                            );
                          });
                        }

                        // Si es cualquier otro cliente, mostramos cuadrícula dinámica de lo que realmente existe
                        return clientYearDashboards.map((dash, idx) => (
                          <div key={dash.id} className="p-2 rounded-lg text-center bg-cyan-500/10 border border-cyan-500/20 hover:border-cyan-500/50 transition-all">
                            <div className="text-lg font-black text-cyan-400">{(dash).orderNumber || (idx + 1)}</div>
                            <div className="text-[8px] text-slate-400 uppercase truncate">{dash.title}</div>
                          </div>
                        ));
                      })()}
                    </div>
                    <p className="text-[9px] text-slate-500 mt-3 text-center">
                      <span className="text-green-400">■</span> Existe • <span className="text-red-400">■</span> Falta •
                      Total: {dashboards.filter(d => Number(d.id) > 0).length} tableros
                    </p>
                  </div>
                )}

                {/* Respaldo de Seguridad */}
                <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-6">
                  <h3 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span>💾</span> Respaldo de Seguridad (Garantía de Datos)
                  </h3>
                  <p className="text-xs text-slate-300 mb-4">Descarga una copia completa de todos los tableros, indicadores e información capturada para este cliente y año en formato JSON. Puedes usar este archivo como respaldo antes de realizar cambios masivos.</p>
                  <button
                    onClick={handleDownloadBackup}
                    className="w-full py-3 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-400 border border-cyan-500/30 font-black rounded-xl shadow-lg transition-all uppercase tracking-widest text-[10px] mb-3"
                  >
                    Descargar Respaldo Completo (.JSON)
                  </button>
                  <button
                    onClick={() => exportBulkDataToCSV(dashboards.filter(d => !String(d.id).startsWith('agg-')), selectedClientId, selectedYear)}
                    className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-black rounded-xl shadow-lg transition-all uppercase tracking-widest text-[10px]"
                    title="Exporta un archivo CSV compatible con el Importador Avanzado para realizar ediciones masivas."
                  >
                    Exportar Datos Masivos (Excel / CSV)
                  </button>
                </div>

                {/* Opciones de Restablecimiento - SOLO PARA IPS */}
                {(selectedClientId.toUpperCase() === 'IPS') && (
                  <div className="bg-slate-800/40 border border-amber-500/20 rounded-2xl p-6">
                    <h3 className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <span>🔄</span> Restablecer Estructura Estándar IPS
                    </h3>

                    <div className="grid grid-cols-1 gap-4">
                      <button
                        onClick={async () => {
                          const ok = confirm(`¿Restablecer SOLO los nombres de los tableros IPS?

Año: ${selectedYear}

✅ Esto corregirá los títulos a la estructura estándar.
✅ MANTIENE todos los indicadores y datos intactos.`);
                          if (ok) {
                            try {
                              const result = await firebaseService.resetDashboardNamesOnly(selectedClientId, selectedYear);
                              alert(`✅ ${result.updatedCount} tableros actualizados.`);
                              window.location.reload();
                            } catch (err: any) {
                              alert(`❌ Error: ${err.message}`);
                            }
                          }
                        }}
                        className="p-4 bg-slate-950 border border-amber-500/30 rounded-xl text-left hover:border-amber-500 transition-all group"
                      >
                        <div className="text-amber-400 font-black text-sm mb-1 group-hover:text-amber-300">
                          Corregir Solo Nombres
                        </div>
                        <p className="text-[10px] text-slate-400">Restablece los nombres a la estructura estándar IPS. Mantiene indicadores y datos.</p>
                      </button>
                    </div>
                  </div>
                )}

                {/* 🛡️ LIMPIEZA NUCLEAR (v5.2.2) */}
                <div className="bg-red-950/20 border border-red-500/30 rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12 scale-150">☣️</div>
                  <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span>☢️</span> Zona de Riesgo: Limpieza Nuclear
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                      onClick={async () => {
                        const ok = confirm(`⚠️ ⚛️ LIMPIEZA OPERATIVA (AVANCES)\n\n¿Seguro que deseas BORRAR TODOS LOS AVANCES de ${selectedClientId} para el año ${selectedYear}?\n\n- Los nombres, metas y pesos NO se tocan.\n- El ahorro/progreso de cada mes va a 0.\n\nEscribe 'ELIMINAR' para confirmar:`);
                        if (ok && prompt("Confirmación de seguridad:") === "ELIMINAR") {
                          setLoadingDashboards(true);
                          try {
                            await firebaseService.resetDashboardDataOnly(selectedClientId, selectedYear);
                            alert("✅ Datos operativos borrados. Reiniciando...");
                            window.location.reload();
                          } catch (err: any) { alert("❌ Error: " + err.message); }
                          finally { setLoadingDashboards(false); }
                        }
                      }}
                      className="p-4 bg-slate-950/80 border border-rose-500/40 rounded-xl text-left hover:border-rose-400 transition-all group"
                    >
                      <div className="text-rose-400 font-black text-xs mb-1 group-hover:text-rose-300 uppercase">Borrar Avances</div>
                      <p className="text-[9px] text-slate-500">Limpia el progreso real del año.</p>
                    </button>

                    <button
                      onClick={async () => {
                        const ok = confirm(`⚠️ ⚛️ LIMPIEZA DE METAS (PLANIFICACIÓN)\n\n¿Seguro que deseas BORRAR TODAS LAS METAS de ${selectedClientId} para el año ${selectedYear}?\n\n- Los indicadores y avances se mantienen.\n- Las metas de todos los meses irán a 0.\n\nEscribe 'METAS' para confirmar:`);
                        if (ok && prompt("Confirmación de seguridad:") === "METAS") {
                          setLoadingDashboards(true);
                          try {
                            await firebaseService.resetDashboardGoalsOnly(selectedClientId, selectedYear);
                            alert("✅ Metas borradas satisfactoriamente. Reiniciando...");
                            window.location.reload();
                          } catch (err: any) { alert("❌ Error: " + err.message); }
                          finally { setLoadingDashboards(false); }
                        }
                      }}
                      className="p-4 bg-slate-950/80 border border-amber-500/40 rounded-xl text-left hover:border-amber-400 transition-all group"
                    >
                      <div className="text-amber-400 font-black text-xs mb-1 group-hover:text-amber-300 uppercase">Borrar Metas</div>
                      <p className="text-[9px] text-slate-500">Limpia objetivos mensuales y semanales.</p>
                    </button>

                    <button
                      onClick={async () => {
                        const ok = confirm(`🚨 ⚛️ ELIMINACIÓN TOTAL (NUCLEAR)\n\n¿Seguro que deseas ELIMINAR COMPLETAMENTE todos los tableros de ${selectedClientId} para el año ${selectedYear}?\n\nSe borrará: ESTRUCTURA, METAS Y AVANCES.\n\nEscribe 'NUCLEAR' para confirmar:`);
                        if (ok && prompt("Confirmación de seguridad:") === "NUCLEAR") {
                          setLoadingDashboards(true);
                          try {
                            await firebaseService.deleteClientYearData(selectedClientId, selectedYear);
                            alert("✅ Estructura eliminada satisfactoriamente.");
                            window.location.reload();
                          } catch (err: any) { alert("❌ Error: " + err.message); }
                          finally { setLoadingDashboards(false); }
                        }
                      }}
                      className="p-4 bg-red-900/10 border border-red-500/50 rounded-xl text-left hover:bg-red-900/20 transition-all group md:col-span-full xl:col-span-1"
                    >
                      <div className="text-red-500 font-black text-xs mb-1 group-hover:text-red-400 uppercase">Borrado Nuclear Total</div>
                      <p className="text-[9px] text-rose-400/70 font-bold">⚠️ Irreversible: Borra el año completo del cliente.</p>
                    </button>
                  </div>
                </div>

                {/* Generación de Nuevo Año */}
                <div className="bg-slate-800/40 border border-cyan-500/20 rounded-2xl p-6">
                  <h3 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span>📅</span> Generar Nuevo Año
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Copiar desde año anterior */}
                    <button
                      onClick={async () => {
                        if (!selectedClientId || selectedClientId === 'all') {
                          alert("Selecciona un cliente específico primero.");
                          return;
                        }
                        const fromYear = selectedYear - 1;
                        const toYear = selectedYear;
                        const ok = confirm(`¿Generar ${toYear} copiando estructura de ${fromYear}?

Cliente: ${selectedClientId}
Origen: ${fromYear}
Destino: ${toYear}

Se copiarán los 14 tableros con todos sus indicadores, pero con metas=0 y progreso=0.`);
                        if (ok) {
                          try {
                            const result = await firebaseService.generateYearForClient(selectedClientId, fromYear, toYear);
                            alert(`✅ ¡Año ${toYear} generado!

• ${result.createdDashboards} tableros creados
• ${result.indicatorsPerDashboard} indicadores por tablero
• ${result.totalIndicators} indicadores totales
• Todos con metas y progreso en 0`);
                            window.location.reload();
                          } catch (err: any) {
                            alert(`❌ Error: ${err.message}`);
                          }
                        }
                      }}
                      className="p-4 bg-slate-950 border border-cyan-500/30 rounded-xl text-left hover:border-cyan-500 transition-all group"
                    >
                      <div className="text-cyan-400 font-black text-sm mb-1 group-hover:text-cyan-300">
                        Copiar desde {selectedYear - 1}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Crea {selectedYear} con la misma estructura que {selectedYear - 1}, datos vacíos.
                      </p>
                    </button>

                    {/* Crear estructura - DIFERENTE para IPS vs otros clientes */}
                    {selectedClientId.toUpperCase() === 'IPS' ? (
                      <button
                        onClick={async () => {
                          const ok = confirm(`¿Crear estructura IPS estándar desde CERO?

Cliente: IPS
Año: ${selectedYear}

Se crearán los 14 tableros IPS (Metro Centro, Toluca, etc.) con los 14 indicadores estándar, todos con datos vacíos.`);
                          if (ok) {
                            try {
                              const result = await firebaseService.createIPSStructure(selectedYear);
                              alert(`✅ ¡Estructura IPS creada!

• ${result.createdDashboards} tableros creados
• ${result.indicatorsPerDashboard} indicadores por tablero
• ${result.totalIndicators} indicadores totales`);
                              window.location.reload();
                            } catch (err: any) {
                              alert(`❌ Error: ${err.message}`);
                            }
                          }
                        }}
                        className="p-4 bg-slate-950 border border-green-500/30 rounded-xl text-left hover:border-green-500 transition-all group"
                      >
                        <div className="text-green-400 font-black text-sm mb-1 group-hover:text-green-300">
                          Crear Estructura IPS
                        </div>
                        <p className="text-[10px] text-slate-400">
                          Crea 14 tableros IPS con 14 indicadores estándar (solo para IPS).
                        </p>
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          if (!selectedClientId || selectedClientId === 'all') {
                            alert("Selecciona un cliente específico primero.");
                            return;
                          }
                          const countStr = prompt(`¿Cuántos tableros vacíos deseas crear para ${selectedClientId}/${selectedYear}?

Ingresa un número (ej: 5, 10, 14):`, "5");
                          if (!countStr) return;
                          const count = parseInt(countStr, 10);
                          if (isNaN(count) || count < 1 || count > 50) {
                            alert("Ingresa un número válido entre 1 y 50.");
                            return;
                          }
                          const ok = confirm(`¿Crear ${count} tableros VACÍOS?

Cliente: ${selectedClientId}
Año: ${selectedYear}

Los tableros se crearán sin indicadores. Podrás agregar indicadores manualmente después.`);
                          if (ok) {
                            try {
                              const result = await firebaseService.createMultipleEmptyDashboards(selectedClientId, selectedYear, count);
                              alert(`✅ ¡Tableros creados!

• ${result.createdDashboards} tableros vacíos creados
• Sin indicadores (agrégalos manualmente)`);
                              window.location.reload();
                            } catch (err: any) {
                              alert(`❌ Error: ${err.message}`);
                            }
                          }
                        }}
                        className="p-4 bg-slate-950 border border-green-500/30 rounded-xl text-left hover:border-green-500 transition-all group"
                      >
                        <div className="text-green-400 font-black text-sm mb-1 group-hover:text-green-300">
                          Crear Tableros Vacíos
                        </div>
                        <p className="text-[10px] text-slate-400">
                          Crea tableros sin indicadores para {selectedClientId} (los configuras tú).
                        </p>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Zona Peligrosa */}
              <div className="bg-slate-800/40 border border-red-500/20 rounded-2xl p-6">
                <h3 className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span>⚠️</span> Zona Peligrosa
                </h3>
                <button
                  onClick={async () => {
                    if (!selectedClientId || selectedClientId === 'all') {
                      alert("Selecciona un cliente específico primero.");
                      return;
                    }
                    const ok = confirm(`⚠️ ELIMINAR TODOS LOS DATOS ⚠️

Cliente: ${selectedClientId}
Año: ${selectedYear}

Esta acción eliminará PERMANENTEMENTE todos los tableros e indicadores de ${selectedClientId}/${selectedYear}.

¿Estás ABSOLUTAMENTE seguro?`);
                    if (ok) {
                      const ok2 = confirm("ÚLTIMA ADVERTENCIA: No hay forma de recuperar estos datos. ¿Proceder con la eliminación?");
                      if (ok2) {
                        try {
                          const result = await firebaseService.deleteClientYearData(selectedClientId, selectedYear);
                          alert(`✅ Eliminados ${result.deletedCount} tableros de ${selectedClientId}/${selectedYear}.`);
                          window.location.reload();
                        } catch (err: any) {
                          alert(`❌ Error: ${err.message}`);
                        }
                      }
                    }
                  }}
                  className="w-full p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-left hover:bg-red-500/20 transition-all group"
                >
                  <div className="text-red-400 font-black text-sm mb-1">Eliminar TODO ({selectedClientId}/{selectedYear})</div>
                  <p className="text-[10px] text-slate-400">Borra todos los tableros del cliente y año seleccionado. IRREVERSIBLE.</p>
                </button>

                <button
                  onClick={async () => {
                    if (!selectedClientId || selectedClientId === 'all') {
                      alert("Selecciona un cliente específico primero.");
                      return;
                    }
                    const ok = confirm(`🚨 ELIMINACIÓN GLOBAL DE CLIENTE 🚨

Eliminarás: "${selectedClientId}" de TODOS los años (2025, 2026, etc.).

Esta acción es DEFINITIVA y borrará absolutamente todos sus tableros e historial del sistema.

¿Deseas proceder?`);
                    if (ok) {
                      const safetyCheck = prompt(`Escribe el nombre del cliente "${selectedClientId}" para confirmar la eliminación total:`);
                      if (safetyCheck?.toUpperCase() === selectedClientId.toUpperCase()) {
                        try {
                          const result = await firebaseService.deleteClientGlobally(selectedClientId);
                          alert(`✅ Cliente eliminado globalmente. Se borraron ${result.deletedCount} tableros en total.`);
                          window.location.reload();
                        } catch (err: any) {
                          alert(`❌ Error: ${err.message}`);
                        }
                      } else {
                        alert("Confirmación incorrecta. Operación cancelada.");
                      }
                    }
                  }}
                  className="w-full mt-4 p-4 bg-red-950/40 border border-red-500/50 rounded-xl text-left hover:bg-red-900/40 transition-all group"
                >
                  <div className="text-red-500 font-black text-sm mb-1">🔥 ELIMINAR CLIENTE GLOBALMENTE</div>
                  <p className="text-[10px] text-slate-400">Elimina el historial completo (todos los años) de este cliente. Solo para administradores.</p>
                </button>

              </div>

              {/* Gestión de Datos Operativos */}
              <div className="mt-6">
                <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-6 mb-6">
                  <h3 className="text-[10px] font-black text-cyan-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span>🛠️</span> Gestión de Datos Operativos
                  </h3>

                  <div className="grid gap-4">
                    <button
                      onClick={async () => {
                        const targetClient = selectedClientId.trim().toUpperCase();
                        const allAreas = [...new Set(
                          allRawDashboards
                            .filter(d => !String(d.id).startsWith('agg-') && d.id !== -1 &&
                              String(d.clientId || "IPS").toUpperCase() === targetClient &&
                              Number(d.year || selectedYear) === Number(selectedYear))
                            .map(d => ((d as any).area || "").trim().toUpperCase())
                            .filter(a => a.length > 0)
                        )];

                        let selectedArea: string | undefined = undefined;

                        if (allAreas.length > 0) {
                          const choice = prompt(
                            `🏢 SISTEMA DE ÁREAS (v5.5.3)\n\n` +
                            `Áreas disponibles: ${allAreas.join(', ')}\n\n` +
                            `Escribe el nombre del ÁREA para limpiar solo es tableros, o 'TODOS' para limpiar todo el cliente.`
                          );
                          if (!choice) return;
                          if (choice.trim().toUpperCase() === 'TODOS') selectedArea = undefined;
                          else {
                            const match = allAreas.find(a => a === choice.trim().toUpperCase());
                            selectedArea = match || choice.trim().toUpperCase();
                          }
                        }

                        const ok = confirm(`¿⚠️ LIMPIAR DATOS DE OPERACIÓN?
                            
  Cliente: ${selectedClientId}
  ${selectedArea ? `Área: ${selectedArea}` : ''}
  
  Esto borrará los avances mensuales cargados. Útil para reiniciar captura.`);
                        if (ok) {
                          const result = await firebaseService.resetDashboardDataOnly(selectedClientId, selectedYear, selectedArea);
                          alert(`Limpieza realizada en ${result.resetDashboards} tableros.`);
                          window.location.reload();
                        }
                      }}
                      className="p-4 bg-red-900/20 border border-red-500/30 rounded-xl text-left hover:bg-red-900/40 transition-all"
                    >
                      <h4 className="text-red-400 font-bold text-xs uppercase mb-1">🧹 Limpiar Datos Operativos</h4>
                      <p className="text-[10px] text-slate-400">Reinicia los valores de avance a cero. No borra indicadores.</p>
                    </button>
                  </div>
                </div>



                {/* Terminología Personalizada */}
                <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-6">
                  <h3 className="text-[10px] font-black text-cyan-500 uppercase tracking-widest mb-4">🏷️ Terminología Personalizada</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Nombre de Grupos</label>
                      <input
                        defaultValue={settings?.groupLabel}
                        onBlur={(e) => handleUpdateSystemSettings({ groupLabel: e.target.value })}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-white"
                        placeholder="Ej: Dirección"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Nombre de Tableros</label>
                      <input
                        defaultValue={settings?.dashboardLabel}
                        onBlur={(e) => handleUpdateSystemSettings({ dashboardLabel: e.target.value })}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-white"
                        placeholder="Ej: UNE"
                      />
                    </div>
                  </div>
                </div>

              </div>

              <div className="mt-8">
                <button
                  onClick={() => setActiveAdminSection("none")}
                  className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-cyan-900/20 active:scale-[0.98]"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        activeAdminSection === "indicators" && (
          <IndicatorManager
            key={selectedDashboard?.id} // 🛡️ CRITICAL FIX: Force remount on dashboard change to prevent stale state
            initialItems={selectedDashboard?.items || []}
            dashboards={dashboards.filter(d => !String(d.id).startsWith('agg-') && d.id !== -1)}
            activeDashboardId={selectedDashboard?.id}
            onDashboardSelect={(id) => setSelectedDashboardId(id)}
            onSaveChanges={handleSaveIndicators}
            onCancel={() => setActiveAdminSection("none")}
            defaultItems={selectedClientId.trim().toUpperCase() === 'IPS' ? (IPS_INDICATORS as any) : undefined}
          />
        )
      }

      {
        activeAdminSection === "kpiWeights" && (
          <WeightManager
            key={selectedDashboard?.id} // 🛡️ CRITICAL FIX: Force remount
            items={selectedDashboard?.items || []}
            dashboards={dashboards.filter(d => !String(d.id).startsWith('agg-') && d.id !== -1)}
            activeDashboardId={selectedDashboard?.id}
            onDashboardSelect={(id) => setSelectedDashboardId(id)}
            onSave={handleSaveWeights}
            onCancel={() => setActiveAdminSection("none")}
          />
        )
      }

      {
        activeAdminSection === "weights" && (
          <WeightControlCenter
            settings={settings}
            dashboards={dashboards.filter(d => !String(d.id).startsWith('agg-'))}
            onSave={async (newSettings) => {
              await handleUpdateSystemSettings(newSettings);
              setActiveAdminSection("none");
            }}
            onCancel={() => setActiveAdminSection("none")}
            isLoading={loadingDashboards}
          />
        )
      }

      {
        activeAdminSection === "import" && (
          <AdvancedDataImporter
            dashboards={dashboards}
            availableClients={availableClients}
            selectedClientId={selectedClientId === 'all' ? (availableClients[0] || 'IPS') : selectedClientId}
            selectedYear={selectedYear}
            onClientChange={(c) => setSelectedClientId(c.trim().toUpperCase())}
            onYearChange={(y) => setSelectedYear(y)}
            onImportComplete={() => {
              window.location.reload();
            }}
            onClose={() => setActiveAdminSection("none")}
          />
        )
      }

      {
        activeAdminSection === "help" && (
          <HelpCenter
            userRole={userProfile?.globalRole || 'Member'}
            onClose={() => setActiveAdminSection("none")}
          />
        )
      }

      {
        activeAdminSection === "master" && isGlobalAdmin && (
          <MasterTrafficLight
            allDashboards={allRawDashboards}
            clients={availableClients}
            year={selectedYear}
            onClose={() => setActiveAdminSection("none")}
            onSelectClient={(cid) => {
              setSelectedClientId(cid);
              setActiveAdminSection("none");
            }}
          />
        )
      }

      {
        loadingDashboards ? (
          <div className="py-24 text-center">
            <div className="inline-block w-8 h-8 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Sincronizando Datos {selectedYear}...</p>
          </div>
        ) : dashboards.length === 0 ? (
          <div className="py-24 text-center bg-slate-900/20 border-2 border-dashed border-white/5 rounded-[3rem] p-12">
            <div className="text-6xl mb-6">📂</div>
            <h2 className="text-2xl font-bold text-white mb-2">Sin tableros en {selectedYear}</h2>
            <p className="text-slate-500 max-w-md mx-auto mb-10 font-medium">No se encontraron registros para este periodo. Puedes inicializarlo basado en el año anterior o crear uno nuevo.</p>

            {isGlobalAdmin && (
              <div className="flex flex-col items-center gap-4">
                <button
                  onClick={handleAddDashboard}
                  className="group relative px-10 py-5 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-3xl shadow-3xl shadow-cyan-900/40 transition-all active:scale-[0.98] border border-white/20 overflow-hidden w-full max-w-md"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  <div className="flex items-center gap-3 justify-center">
                    <span className="text-xl">➕</span>
                    <span className="uppercase tracking-widest text-sm">Crear mi Primer Tablero</span>
                  </div>
                </button>

                <div className="flex items-center gap-4 w-full max-w-md py-2">
                  <div className="h-px bg-white/5 flex-grow"></div>
                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Otras opciones</span>
                  <div className="h-px bg-white/5 flex-grow"></div>
                </div>

                <button
                  onClick={() => setActiveAdminSection("clients")}
                  className="group relative px-10 py-4 bg-slate-900 hover:bg-slate-800 text-slate-400 font-bold rounded-2xl border border-white/5 transition-all active:scale-[0.98] w-full max-w-md"
                >
                  <div className="flex items-center gap-3 justify-center">
                    <span className="text-sm opacity-50">⚙️</span>
                    <span className="uppercase tracking-widest text-[10px]">Configuración Avanzada (Estructura Masiva)</span>
                  </div>
                </button>

                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-4">
                  Define el nombre de tu departamento o sucursal inmediatamente
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-0 overflow-hidden min-h-[calc(100vh-120px)]">
            {/* 🏗️ SIDEBAR JERÁRQUICO (v7.3.1) */}
            <HierarchySidebar
              dashboards={dashboards}
              selectedDashboardId={selectedDashboardId}
              onSelectDashboard={setSelectedDashboardId}
              settings={settings}
              isGlobalAdmin={isGlobalAdmin}
              isDirector={isDirector}
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={handleToggleSidebar}
              onAddDashboard={isGlobalAdmin ? handleAddDashboard : undefined}
              onDeleteDashboard={isGlobalAdmin ? handleDeleteDashboard : undefined}
              allUsers={allUsers}
              userProfile={userProfile}
              selectedClientId={selectedClientId}
            />

            {/* 📊 CONTENIDO PRINCIPAL */}
            <main className="flex-grow min-w-0 px-4 lg:px-8 py-1 overflow-y-auto">
              {selectedDashboard && (
                <div className="flex items-center gap-2 mb-2 text-[8px] font-black uppercase tracking-[0.15em] text-slate-500 overflow-x-auto whitespace-nowrap scrollbar-hide py-1.5 px-4 bg-slate-900/40 rounded-xl border border-white/5 shadow-lg backdrop-blur-md">
                  <span className="text-cyan-500/50 shrink-0 font-black">NAVEGACIÓN</span>
                  <span className="text-slate-800 font-black px-1">|</span>

                  {/* 🛡️ NIVEL 4 (SUPERGRUPO): Solo visible para Admin o jerarquía superior */}
                  {(isGlobalAdmin || (isDirector && (userProfile?.superGroups?.length || 0) > 0)) && (selectedDashboard as any).superGroup && (
                    <>
                      <span className="text-rose-500/80 font-black">{(selectedDashboard as any).superGroup}</span>
                      <span className="text-slate-700 mx-2 text-xs">/</span>
                    </>
                  )}

                  {/* 🛡️ NIVEL 3 (GRUPO): Solo si no es redundante con el título */}
                  {selectedDashboard.group && selectedDashboard.group !== 'SINTESIS' && selectedDashboard.group !== 'GENERAL' && (
                    <>
                      {(() => {
                        const cleanTitle = selectedDashboard.title.replace(/^★\s*RESUMEN DIRECTIVO:\s*/i, "").replace(/^★\s*SÍNTESIS GLOBAL OPERATIVA:\s*/i, "");
                        if (normalizeGroupName(selectedDashboard.group) !== normalizeGroupName(cleanTitle)) {
                          return (
                            <>
                              <span className="text-cyan-400 font-black">{selectedDashboard.group}</span>
                              <span className="text-slate-700 mx-2 text-xs">/</span>
                            </>
                          );
                        }
                        return null;
                      })()}
                    </>
                  )}

                  {/* 🛡️ NIVEL ACTUAL */}
                  <span className="text-white border-b-2 border-cyan-500/80 pb-0.5 font-black tracking-tight drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]">
                    {selectedDashboard.title}
                  </span>
                </div>
              )}

              {selectedDashboard ? (
                <DashboardView
                  dashboard={selectedDashboard}
                  onUpdateItem={handleUpdateItem}
                  userRole={userRole}
                  isGlobalAdmin={isGlobalAdmin}
                  currentUser={userProfile!}
                  existingGroups={[...new Set(dashboards.map((d) => d.group).filter(Boolean))] as string[]}
                  settings={settings}
                  layout={viewMode}
                  year={selectedYear}
                  allDashboards={dashboards}
                  onUpdateMetadata={(isGlobalAdmin || isDirector) ? handleUpdateMetadata : undefined as any}
                  isDirector={isDirector}
                  onOpenWeights={() => setActiveAdminSection("weights")}
                />
              ) : (
                <div className="py-24 text-center text-slate-500 font-bold uppercase tracking-widest text-xs border border-white/5 rounded-[2rem] bg-slate-900/20">
                  ← Seleccione un elemento del panel de navegación
                </div>
              )}
            </main>
          </div>
        )
      }

      {/* Welcome Message at the bottom */}
      <div className="mt-12 flex justify-center pb-12">
        {userProfile && (
          <div className="flex items-center gap-4 bg-slate-900/50 px-6 py-4 rounded-[2rem] border border-white/5 shadow-2xl">
            <div className="w-12 h-12 bg-cyan-500/20 rounded-2xl flex items-center justify-center text-xl">👤</div>
            <div>
              <p className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.2em] mb-0.5">Bienvenido</p>
              <h4 className="text-xl font-black text-white italic truncate max-w-[200px]">{userProfile.name}</h4>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                {userProfile.globalRole === 'Admin' ? 'Super Administrador' : (userProfile.directorTitle || userProfile.globalRole)}
                {userProfile.canManageKPIs && <span className="text-cyan-400 ml-2">🛠️ Gestión KPI Habilitada</span>}
                <span className="text-slate-600 ml-4 border-l border-white/5 pl-4 inline-flex items-center gap-1">
                  {versionLabel} • MULTI-APP ISOLATION {isGlobalAdmin && <span className="text-[8px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded ml-1 animate-pulse border border-cyan-500/30">SHIELD-TBL ACTIVE (DB LOCK)</span>}
                </span>
              </p>
            </div>
          </div>
        )}
      </div>
    </PageShell >
  );
};
