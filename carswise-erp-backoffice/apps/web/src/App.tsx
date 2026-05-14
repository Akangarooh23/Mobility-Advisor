import { FormEvent, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type UserStatus = "active" | "at_risk" | "blocked";
type TicketStatus = "open" | "in_progress" | "waiting_customer" | "resolved";
type AppointmentStatus = "scheduled" | "confirmed" | "completed" | "cancelled";
type UserRole = "admin" | "support" | "operations" | "sales";
type AuthUser = { id: string; role: UserRole };
type AppTab = "users" | "tickets" | "appointments";

type ModuleTile = {
  id: string;
  label: string;
  tab?: AppTab;
};

type ModuleDirectoryItem = ModuleTile & {
  groupTitle: string;
};

type ModuleGroup = {
  title: string;
  tone: "green" | "amber" | "violet" | "slate";
  items: ModuleTile[];
};

type ModuleColumn = {
  key: string;
  label: string;
};

type ModuleScreen = {
  subtitle: string;
  actions: string[];
  rowActions: string[];
  columns: ModuleColumn[];
  rows: Array<Record<string, string>>;
};

type TableFilterMap = Record<string, string>;

type SortDirection = "asc" | "desc";

type TableSortState = {
  column: string;
  direction: SortDirection;
};

type UserRecord = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: UserStatus;
  openTickets: number;
  nextAppointmentAt: string;
  lastSeenAt: string;
};

type TicketRecord = {
  id: string;
  userId: string;
  title: string;
  status: TicketStatus;
  priority: string;
  assignee: string;
  updatedAt: string;
};

type AppointmentRecord = {
  id: string;
  userId: string;
  type: string;
  scheduledAt: string;
  status: AppointmentStatus;
  agent: string;
};

type VoOfferRecord = {
  id: string;
  sku: string;
  model: string;
  status: string;
  price: string;
};

type VoOffersTablePayload = {
  columns: string[];
  rows: Array<Record<string, unknown>>;
};

type EditableMarketTableKind = "vo" | "offers";

type EditModalState = {
  tableKind: EditableMarketTableKind;
  rowId: string;
  columns: string[];
  values: Record<string, unknown>;
};

function normalizeFilterValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).toLowerCase();
}

function matchesColumnFilters(row: Record<string, unknown>, columns: string[], filters: TableFilterMap): boolean {
  return columns.every((column) => {
    const query = (filters[column] || "").trim().toLowerCase();
    if (!query) {
      return true;
    }

    return normalizeFilterValue(row[column]).includes(query);
  });
}

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const SORT_COLLATOR = new Intl.Collator("es-ES", { numeric: true, sensitivity: "base" });
const SELECT_FILTER_KEYS = new Set([
  "status",
  "estado",
  "priority",
  "prioridad",
  "portal",
  "listing_type",
  "fuel",
  "seller_type",
  "is_active",
]);

function compareTableValues(left: unknown, right: unknown): number {
  if (left === right) {
    return 0;
  }

  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  const leftText = String(left ?? "").trim();
  const rightText = String(right ?? "").trim();
  const leftDate = Date.parse(leftText);
  const rightDate = Date.parse(rightText);

  if (Number.isFinite(leftDate) && Number.isFinite(rightDate) && /[-/:T]/.test(leftText) && /[-/:T]/.test(rightText)) {
    return leftDate - rightDate;
  }

  return SORT_COLLATOR.compare(leftText, rightText);
}

function sortTableRows<T extends Record<string, unknown>>(rows: T[], sortState?: TableSortState): T[] {
  if (!sortState?.column) {
    return rows;
  }

  const sortedRows = [...rows].sort((leftRow, rightRow) =>
    compareTableValues(leftRow[sortState.column], rightRow[sortState.column])
  );

  return sortState.direction === "desc" ? sortedRows.reverse() : sortedRows;
}

function sanitizeFileName(value: string) {
  return String(value || "export")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "export";
}

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const AUTH_TOKEN_KEY = "carswise_erp_token";

const MODULE_GROUPS: ModuleGroup[] = [
  {
    title: "CRM y Clientes",
    tone: "green",
    items: [
      { id: "clientes", label: "Clientes", tab: "users" },
      { id: "leads", label: "Leads" },
      { id: "pipeline_comercial", label: "Pipeline Comercial" },
      { id: "ofertas", label: "Ofertas" },
      { id: "contratos", label: "Contratos" },
      { id: "documentacion", label: "Documentacion" },
      { id: "comunicaciones", label: "Comunicaciones" },
      { id: "segmentos", label: "Segmentos" },
    ],
  },
  {
    title: "Marketplace y VO",
    tone: "amber",
    items: [
      { id: "ofertas_portales", label: "Ofertas Portales" },
      { id: "inventario_vo", label: "Inventario VO" },
      { id: "publicaciones", label: "Publicaciones" },
      { id: "precios_margen", label: "Precios y Margen" },
      { id: "entradas_stock", label: "Entradas de Stock" },
      { id: "reservas", label: "Reservas" },
      { id: "entregas", label: "Entregas" },
      { id: "retomas", label: "Retomas" },
      { id: "canales", label: "Canales" },
    ],
  },
  {
    title: "Postventa y Soporte",
    tone: "violet",
    items: [
      { id: "incidencias", label: "Incidencias", tab: "tickets" },
      { id: "sla_prioridades", label: "SLA y Prioridades" },
      { id: "citas_taller", label: "Citas Taller", tab: "appointments" },
      { id: "garantias", label: "Garantias" },
      { id: "siniestros", label: "Siniestros" },
      { id: "atencion_cliente", label: "Atencion Cliente" },
      { id: "nps_calidad", label: "NPS y Calidad" },
      { id: "base_conocimiento", label: "Base de Conocimiento" },
    ],
  },
  {
    title: "Operaciones y Finanzas",
    tone: "slate",
    items: [
      { id: "facturacion", label: "Facturacion" },
      { id: "cobros_pagos", label: "Cobros y Pagos" },
      { id: "conciliacion", label: "Conciliacion" },
      { id: "tesoreria", label: "Tesoreria" },
      { id: "proveedores", label: "Proveedores" },
      { id: "riesgo_compliance", label: "Riesgo y Compliance" },
      { id: "cuadro_mando", label: "Cuadro de Mando" },
      { id: "configuracion", label: "Configuracion" },
    ],
  },
];

const MODULE_DIRECTORY: ModuleDirectoryItem[] = MODULE_GROUPS.flatMap((group) =>
  group.items.map((item) => ({ ...item, groupTitle: group.title }))
);

const MODULE_SCREENS: Record<string, ModuleScreen> = {
  leads: {
    subtitle: "Captacion y cualificacion comercial",
    actions: ["Nuevo lead", "Importar", "Asignar comercial"],
    rowActions: ["Editar", "Convertir"],
    columns: [
      { key: "lead", label: "Lead" },
      { key: "origen", label: "Origen" },
      { key: "estado", label: "Estado" },
      { key: "owner", label: "Comercial" },
    ],
    rows: [],
  },
  pipeline_comercial: {
    subtitle: "Gestion de oportunidades de venta",
    actions: ["Nueva oportunidad", "Mover etapa", "Exportar pipeline"],
    rowActions: ["Abrir", "Actualizar"],
    columns: [
      { key: "oportunidad", label: "Oportunidad" },
      { key: "cliente", label: "Cliente" },
      { key: "etapa", label: "Etapa" },
      { key: "importe", label: "Importe" },
    ],
    rows: [],
  },
  inventario_vo: {
    subtitle: "Control de stock de vehiculo de ocasion",
    actions: ["Alta VO", "Actualizar precio", "Publicar"],
    rowActions: [],
    columns: [
      { key: "sku", label: "SKU" },
      { key: "modelo", label: "Modelo" },
      { key: "estado", label: "Estado" },
      { key: "precio", label: "Precio" },
    ],
    rows: [],
  },
  ofertas_portales: {
    subtitle: "Marketplace source: market_offers",
    actions: ["Sincronizar", "Exportar", "Actualizar"],
    rowActions: [],
    columns: [],
    rows: [],
  },
  publicaciones: {
    subtitle: "Control de anuncios por canal",
    actions: ["Nueva publicacion", "Sincronizar", "Pausar anuncio"],
    rowActions: ["Ver", "Republicar"],
    columns: [
      { key: "canal", label: "Canal" },
      { key: "anuncio", label: "Anuncio" },
      { key: "estado", label: "Estado" },
      { key: "leads", label: "Leads" },
    ],
    rows: [],
  },
  facturacion: {
    subtitle: "Emision y control de facturas",
    actions: ["Nueva factura", "Emitir lote", "Exportar SII"],
    rowActions: ["Detalle", "Abonar"],
    columns: [
      { key: "factura", label: "Factura" },
      { key: "cliente", label: "Cliente" },
      { key: "vencimiento", label: "Vencimiento" },
      { key: "estado", label: "Estado" },
    ],
    rows: [],
  },
  cuadro_mando: {
    subtitle: "Seguimiento KPI del negocio",
    actions: ["Actualizar KPI", "Programar reporte", "Descargar PDF"],
    rowActions: ["Analizar", "Compartir"],
    columns: [
      { key: "kpi", label: "KPI" },
      { key: "valor", label: "Valor" },
      { key: "objetivo", label: "Objetivo" },
      { key: "variacion", label: "Variacion" },
    ],
    rows: [],
  },
};

function buildDefaultModuleScreen(module: ModuleDirectoryItem): ModuleScreen {
  return {
    subtitle: `Pantalla operativa del modulo ${module.label}`,
    actions: ["Nuevo", "Importar", "Exportar"],
    rowActions: ["Abrir", "Gestionar"],
    columns: [
      { key: "registro", label: "Registro" },
      { key: "area", label: "Area" },
      { key: "estado", label: "Estado" },
      { key: "responsable", label: "Responsable" },
    ],
    rows: [],
  };
}

async function requestJson<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  return payload.data as T;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("users");
  const [activeModuleId, setActiveModuleId] = useState("clientes");
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [voOffers, setVoOffers] = useState<VoOfferRecord[]>([]);
  const [portalTableColumns, setPortalTableColumns] = useState<string[]>([]);
  const [portalTableRows, setPortalTableRows] = useState<Array<Record<string, unknown>>>([]);
  const [voTableColumns, setVoTableColumns] = useState<string[]>([]);
  const [voTableRows, setVoTableRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [token, setToken] = useState("");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loginForm, setLoginForm] = useState({ email: "admin@carswise.local", password: "admin123456" });
  const [loginError, setLoginError] = useState("");
  const [tableFilters, setTableFilters] = useState<Record<string, TableFilterMap>>({});
  const [tableSorts, setTableSorts] = useState<Record<string, TableSortState>>({});
  const [tablePages, setTablePages] = useState<Record<string, number>>({});
  const [tablePageSizes, setTablePageSizes] = useState<Record<string, number>>({});
  const [editModal, setEditModal] = useState<EditModalState | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [importingVoExcel, setImportingVoExcel] = useState(false);

  const [userQuery, setUserQuery] = useState("");
  const [ticketForm, setTicketForm] = useState({ userId: "", title: "", description: "", priority: "medium" });
  const [appointmentForm, setAppointmentForm] = useState({ userId: "", scheduledAt: "", type: "inspection", agent: "" });
  const userTableColumns: ModuleColumn[] = [
    { key: "id", label: "ID" },
    { key: "name", label: "Razon social / Nombre" },
    { key: "email", label: "Email" },
    { key: "status", label: "Estado" },
    { key: "openTickets", label: "Tickets" },
  ];
  const ticketTableColumns: ModuleColumn[] = [
    { key: "id", label: "ID" },
    { key: "userId", label: "User" },
    { key: "title", label: "Titulo" },
    { key: "status", label: "Estado" },
    { key: "priority", label: "Prioridad" },
  ];
  const appointmentTableColumns: ModuleColumn[] = [
    { key: "id", label: "ID" },
    { key: "userId", label: "User" },
    { key: "type", label: "Tipo" },
    { key: "scheduledAt", label: "Fecha" },
    { key: "status", label: "Estado" },
    { key: "agent", label: "Agente" },
  ];

  const openTickets = useMemo(() => tickets.filter((item) => item.status !== "resolved").length, [tickets]);
  const pendingAppointments = useMemo(
    () => appointments.filter((item) => item.status !== "completed" && item.status !== "cancelled").length,
    [appointments]
  );
  const canResolveTicket = currentUser?.role === "admin" || currentUser?.role === "support" || currentUser?.role === "operations";
  const activeModule = useMemo(() => MODULE_DIRECTORY.find((item) => item.id === activeModuleId) || MODULE_DIRECTORY[0], [activeModuleId]);
  const staticModuleScreen = useMemo(() => {
    if (!activeModule || activeModule.tab) {
      return null;
    }
    const base = MODULE_SCREENS[activeModule.id] || buildDefaultModuleScreen(activeModule);
    if (activeModule.id === "inventario_vo") {
      return {
        ...base,
        columns: voTableColumns.map((column) => ({ key: column, label: column })),
        rowActions: [],
        rows: voTableRows.map((row) => {
          const mapped: Record<string, string> = {};
          for (const column of voTableColumns) {
            const value = row[column];
            mapped[column] = value === null || value === undefined ? "" : String(value);
          }
          return mapped;
        }),
      };
    }
    if (activeModule.id === "ofertas_portales") {
      return {
        ...base,
        columns: portalTableColumns.map((column) => ({ key: column, label: column })),
        rowActions: [],
        rows: portalTableRows.map((row) => {
          const mapped: Record<string, string> = {};
          for (const column of portalTableColumns) {
            const value = row[column];
            mapped[column] = value === null || value === undefined ? "" : String(value);
          }
          return mapped;
        }),
      };
    }
    return base;
  }, [activeModule, portalTableColumns, portalTableRows, voOffers, voTableColumns, voTableRows]);

  const visibleStaticModuleRows = useMemo(() => {
    if (!staticModuleScreen || !activeModule) {
      return [] as Array<Record<string, string>>;
    }

    return staticModuleScreen.rows.filter((row) =>
      matchesColumnFilters(
        row,
        staticModuleScreen.columns.map((column) => column.key),
        tableFilters[activeModule.id] || {}
      )
    );
  }, [activeModule, staticModuleScreen, tableFilters]);

  async function requestPublic<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...(options?.headers || {}),
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  async function restoreSession(candidateToken: string) {
    const payload = await requestPublic<{ ok: boolean; user: AuthUser }>("/auth/me", {
      headers: { authorization: `Bearer ${candidateToken}` },
    });
    setCurrentUser(payload.user);
    setToken(candidateToken);
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setLoginError("");
    try {
      const payload = await requestPublic<{ ok: boolean; token: string; user: AuthUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(loginForm),
      });

      localStorage.setItem(AUTH_TOKEN_KEY, payload.token);
      setToken(payload.token);
      setCurrentUser(payload.user);
      await loadAll(payload.token);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "No se pudo iniciar sesion");
    }
  }

  function logout() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setToken("");
    setCurrentUser(null);
    setUsers([]);
    setTickets([]);
    setAppointments([]);
  }

  async function loadAll(activeToken = token) {
    if (!activeToken) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [usersData, ticketsData, appointmentsData] = await Promise.all([
        requestJson<UserRecord[]>("/users", activeToken),
        requestJson<TicketRecord[]>("/tickets", activeToken),
        requestJson<AppointmentRecord[]>("/appointments", activeToken),
      ]);

      let voOffersData: VoOfferRecord[] = [];
      let voTableData: VoOffersTablePayload = { columns: [], rows: [] };
      let portalTableData: VoOffersTablePayload = { columns: [], rows: [] };
      try {
        voOffersData = await requestJson<VoOfferRecord[]>("/market/vo-offers?limit=80", activeToken);
      } catch {
        voOffersData = [];
      }

      try {
        voTableData = await requestJson<VoOffersTablePayload>("/market/vo-offers/table", activeToken);
      } catch {
        voTableData = { columns: [], rows: [] };
      }

      try {
        portalTableData = await requestJson<VoOffersTablePayload>("/market/offers/table", activeToken);
      } catch {
        portalTableData = { columns: [], rows: [] };
      }

      setUsers(usersData);
      setTickets(ticketsData);
      setAppointments(appointmentsData);
      setVoOffers(voOffersData);
      setPortalTableColumns(portalTableData.columns || []);
      setPortalTableRows(portalTableData.rows || []);
      setVoTableColumns(voTableData.columns || []);
      setVoTableRows(voTableData.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando datos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!saved) {
      setAuthLoading(false);
      setLoading(false);
      return;
    }

    restoreSession(saved)
      .then(() => loadAll(saved))
      .catch(() => {
        localStorage.removeItem(AUTH_TOKEN_KEY);
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, []);

  async function createTicket(event: FormEvent) {
    event.preventDefault();
    await requestJson<TicketRecord>("/tickets", token, {
      method: "POST",
      body: JSON.stringify({
        userId: ticketForm.userId,
        title: ticketForm.title,
        description: ticketForm.description,
        priority: ticketForm.priority,
        channel: "web",
      }),
    });
    setTicketForm({ userId: "", title: "", description: "", priority: "medium" });
    await loadAll();
  }

  async function createAppointment(event: FormEvent) {
    event.preventDefault();
    await requestJson<AppointmentRecord>("/appointments", token, {
      method: "POST",
      body: JSON.stringify(appointmentForm),
    });
    setAppointmentForm({ userId: "", scheduledAt: "", type: "inspection", agent: "" });
    await loadAll();
  }

  async function resolveTicket(ticketId: string) {
    await requestJson<TicketRecord>(`/tickets/${ticketId}`, token, {
      method: "PATCH",
      body: JSON.stringify({ status: "resolved", note: "Resuelto desde backoffice" }),
    });
    await loadAll();
  }

  function openModule(item: ModuleTile) {
    setActiveModuleId(item.id);
    if (item.tab) {
      setActiveTab(item.tab);
    }
  }

  function renderModuleGroup(group: ModuleGroup) {
    return (
      <article key={group.title} className={`module-group tone-${group.tone}`}>
        <header className="module-group-header">
          <h2>{group.title}</h2>
        </header>
        <div className="module-grid">
          {group.items.map((item) => (
            <button
              key={`${group.title}-${item.label}`}
              className={`module-tile${item.id === activeModuleId ? " is-active" : ""}`}
              onClick={() => openModule(item)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </article>
    );
  }

  function setColumnFilter(tableId: string, column: string, value: string) {
    setTableFilters((prev) => ({
      ...prev,
      [tableId]: {
        ...(prev[tableId] || {}),
        [column]: value,
      },
    }));
    setTablePages((prev) => ({ ...prev, [tableId]: 1 }));
  }

  function toggleColumnSort(tableId: string, column: string) {
    setTableSorts((prev) => {
      const current = prev[tableId];
      const direction: SortDirection = current?.column === column && current.direction === "asc" ? "desc" : "asc";
      return {
        ...prev,
        [tableId]: { column, direction },
      };
    });
    setTablePages((prev) => ({ ...prev, [tableId]: 1 }));
  }

  function setTablePage(tableId: string, page: number) {
    setTablePages((prev) => ({ ...prev, [tableId]: Math.max(1, page) }));
  }

  function setTablePageSize(tableId: string, pageSize: number) {
    setTablePageSizes((prev) => ({ ...prev, [tableId]: pageSize }));
    setTablePages((prev) => ({ ...prev, [tableId]: 1 }));
  }

  function getTableView<T extends Record<string, unknown>>(tableId: string, rows: T[]) {
    const sortState = tableSorts[tableId];
    const sortedRows = sortTableRows(rows, sortState);
    const pageSize = tablePageSizes[tableId] || DEFAULT_PAGE_SIZE;
    const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
    const currentPage = Math.min(tablePages[tableId] || 1, pageCount);
    const start = (currentPage - 1) * pageSize;

    return {
      rows: sortedRows.slice(start, start + pageSize),
      totalRows: sortedRows.length,
      currentPage,
      pageCount,
      pageSize,
    };
  }

  function getSelectFilterOptions(rows: Array<Record<string, unknown>>, column: string): string[] {
    const values = new Set<string>();
    for (const row of rows) {
      const value = row[column];
      if (value === null || value === undefined || value === "") {
        continue;
      }
      values.add(String(value));
    }

    return [...values].sort((left, right) => SORT_COLLATOR.compare(left, right));
  }

  function shouldUseSelectFilter(column: string, rows: Array<Record<string, unknown>>): boolean {
    if (!SELECT_FILTER_KEYS.has(column.toLowerCase())) {
      return false;
    }

    const options = getSelectFilterOptions(rows, column);
    return options.length > 0 && options.length <= 40;
  }

  function renderFilterRow(tableId: string, columns: ModuleColumn[], rows: Array<Record<string, unknown>>, includeActions = false) {
    const filters = tableFilters[tableId] || {};

    return (
      <tr className="table-filter-row">
        {columns.map((column, index) => {
          const options = getSelectFilterOptions(rows, column.key);
          const useSelect = shouldUseSelectFilter(column.key, rows);
          return (
            <th key={`${tableId}-${column.key}-filter`} className={index === 0 ? "table-sticky-col" : undefined}>
              {useSelect ? (
                <select value={filters[column.key] || ""} onChange={(e) => setColumnFilter(tableId, column.key, e.target.value)} aria-label={`Filtrar ${column.label}`}>
                  <option value="">Todos</option>
                  {options.map((option) => (
                    <option key={`${tableId}-${column.key}-${option}`} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={filters[column.key] || ""}
                  onChange={(e) => setColumnFilter(tableId, column.key, e.target.value)}
                  placeholder={`Filtrar ${column.label}`}
                  aria-label={`Filtrar ${column.label}`}
                />
              )}
            </th>
          );
        })}
        {includeActions && <th />}
      </tr>
    );
  }

  function renderSortableHeaderRow(tableId: string, columns: ModuleColumn[], includeActions = false) {
    const sortState = tableSorts[tableId];

    return (
      <tr className="table-sort-row">
        {columns.map((column) => {
          const isActive = sortState?.column === column.key;
          const indicator = !isActive ? "<>" : sortState.direction === "asc" ? "^" : "v";

          return (
            <th key={`${tableId}-${column.key}-sort`} className={columns[0]?.key === column.key ? "table-sticky-col" : undefined}>
              <button type="button" className={`table-sort-button${isActive ? " is-active" : ""}`} onClick={() => toggleColumnSort(tableId, column.key)}>
                <span>{column.label}</span>
                <span className="table-sort-indicator">{indicator}</span>
              </button>
            </th>
          );
        })}
        {includeActions && <th>Acciones</th>}
      </tr>
    );
  }

  function renderPagination(tableId: string, totalRows: number, currentPage: number, pageCount: number, pageSize: number) {
    if (totalRows === 0) {
      return null;
    }

    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalRows);

    return (
      <div className="table-pagination">
        <p className="table-pagination-summary">
          Mostrando {start}-{end} de {totalRows}
        </p>
        <div className="table-pagination-controls">
          <label>
            Filas
            <select value={pageSize} onChange={(e) => setTablePageSize(tableId, Number(e.target.value))}>
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={`${tableId}-page-size-${option}`} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => setTablePage(tableId, currentPage - 1)} disabled={currentPage <= 1}>
            Anterior
          </button>
          <span>
            Pagina {currentPage} / {pageCount}
          </span>
          <button type="button" onClick={() => setTablePage(tableId, currentPage + 1)} disabled={currentPage >= pageCount}>
            Siguiente
          </button>
        </div>
      </div>
    );
  }

  const visibleUsers = users.filter((item) => {
    const q = userQuery.trim().toLowerCase();
    const matchesSearch = !q || item.name.toLowerCase().includes(q) || item.email.toLowerCase().includes(q) || item.id.toLowerCase().includes(q);
    if (!matchesSearch) {
      return false;
    }

    return matchesColumnFilters(
      {
        id: item.id,
        name: item.name,
        email: item.email,
        status: item.status,
        openTickets: item.openTickets,
      },
      userTableColumns.map((column) => column.key),
      tableFilters.users || {}
    );
  });

  const visibleTickets = tickets.filter((ticket) =>
    matchesColumnFilters(
      {
        id: ticket.id,
        userId: ticket.userId,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
      },
      ticketTableColumns.map((column) => column.key),
      tableFilters.tickets || {}
    )
  );

  const visibleAppointments = appointments.filter((appointment) =>
    matchesColumnFilters(
      {
        id: appointment.id,
        userId: appointment.userId,
        type: appointment.type,
        scheduledAt: new Date(appointment.scheduledAt).toLocaleString(),
        status: appointment.status,
        agent: appointment.agent || "-",
      },
      appointmentTableColumns.map((column) => column.key),
      tableFilters.appointments || {}
    )
  );

  const visibleUserRows = visibleUsers.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    openTickets: user.openTickets,
  }));
  const visibleTicketRows = visibleTickets.map((ticket) => ({
    id: ticket.id,
    userId: ticket.userId,
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
  }));
  const visibleAppointmentRows = visibleAppointments.map((appointment) => ({
    id: appointment.id,
    userId: appointment.userId,
    type: appointment.type,
    scheduledAt: new Date(appointment.scheduledAt).toLocaleString(),
    status: appointment.status,
    agent: appointment.agent || "-",
  }));
  const allUserRows = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    openTickets: user.openTickets,
  }));
  const allTicketRows = tickets.map((ticket) => ({
    id: ticket.id,
    userId: ticket.userId,
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
  }));
  const allAppointmentRows = appointments.map((appointment) => ({
    id: appointment.id,
    userId: appointment.userId,
    type: appointment.type,
    scheduledAt: new Date(appointment.scheduledAt).toLocaleString(),
    status: appointment.status,
    agent: appointment.agent || "-",
  }));
  const allStaticRows = staticModuleScreen?.rows || [];

  const usersTableView = getTableView("users", visibleUserRows);
  const ticketsTableView = getTableView("tickets", visibleTicketRows);
  const appointmentsTableView = getTableView("appointments", visibleAppointmentRows);
  const staticTableView = getTableView(activeModule?.id || "static", visibleStaticModuleRows);
  const editableTableKind: EditableMarketTableKind | null =
    activeModule?.id === "inventario_vo" ? "vo" : activeModule?.id === "ofertas_portales" ? "offers" : null;

  function exportRowsToExcel(fileNameBase: string, columns: ModuleColumn[], rows: Array<Record<string, unknown>>) {
    const sortedRows = sortTableRows(rows, tableSorts[fileNameBase]);
    const exportRows = sortedRows.map((row) => {
      const mapped: Record<string, unknown> = {};
      for (const column of columns) {
        mapped[column.label] = row[column.key] ?? "";
      }
      return mapped;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Datos");
    XLSX.writeFile(workbook, `${sanitizeFileName(fileNameBase)}.xlsx`);
  }

  function openEditModal(row: Record<string, unknown>) {
    if (!editableTableKind) {
      return;
    }

    const rowId = String(row.id || "").trim();
    if (!rowId || !staticModuleScreen) {
      return;
    }

    const columns = staticModuleScreen.columns.map((column) => column.key);
    const values = { ...row };
    const nextEditValues: Record<string, string> = {};
    for (const column of columns) {
      const value = values[column];
      nextEditValues[column] = value === null || value === undefined ? "" : String(value);
    }

    setEditError("");
    setEditValues(nextEditValues);
    setEditModal({ tableKind: editableTableKind, rowId, columns, values });
  }

  function closeEditModal() {
    if (savingEdit) {
      return;
    }
    setEditModal(null);
    setEditValues({});
    setEditError("");
  }

  async function saveEditedRow() {
    if (!editModal || !token) {
      return;
    }

    const values: Record<string, unknown> = {};
    for (const column of editModal.columns) {
      if (column === "id" || column === "created_at" || column === "first_seen_at" || column === "scraped_at") {
        continue;
      }

      const baseValue = editModal.values[column];
      const rawValue = editValues[column];
      if (typeof baseValue === "boolean") {
        values[column] = rawValue === "true";
      } else if (rawValue === "") {
        values[column] = null;
      } else {
        values[column] = rawValue;
      }
    }

    setSavingEdit(true);
    setEditError("");
    try {
      await requestJson<Record<string, unknown>>("/market/table-row", token, {
        method: "PATCH",
        body: JSON.stringify({
          table: editModal.tableKind,
          id: editModal.rowId,
          values,
        }),
      });
      await loadAll();
      setEditModal(null);
      setEditValues({});
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleVoExcelImport(file: File | null) {
    if (!file || !token) {
      return;
    }

    setImportingVoExcel(true);
    setError("");
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error("El Excel no contiene hojas");
      }

      const sheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true });
      if (rows.length === 0) {
        throw new Error("El Excel no contiene filas");
      }

      const result = await requestJson<{ processed: number; inserted: number; updated: number; skipped: number }>(
        "/market/vo-offers/import",
        token,
        {
          method: "POST",
          body: JSON.stringify({ rows }),
        }
      );

      await loadAll();
      setError(`Importacion Excel completada. Procesadas: ${result.processed}, nuevas: ${result.inserted}, actualizadas: ${result.updated}, omitidas: ${result.skipped}.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo importar el Excel");
    } finally {
      setImportingVoExcel(false);
    }
  }

  if (authLoading) {
    return (
      <main className="app-shell">
        <p>Cargando sesion...</p>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className="app-shell login-shell">
        <section className="login-card">
          <h1>Carswise ERP Login</h1>
          <p>Usa un usuario interno para acceder al backoffice.</p>
          <form className="login-form" onSubmit={handleLogin}>
            <input
              type="email"
              value={loginForm.email}
              placeholder="email"
              onChange={(e) => setLoginForm((prev) => ({ ...prev, email: e.target.value }))}
            />
            <input
              type="password"
              value={loginForm.password}
              placeholder="password"
              onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
            />
            <button type="submit">Entrar</button>
          </form>
          {loginError && <p className="error-box">Error login: {loginError}</p>}
          <p className="hint">Demo: admin@carswise.local / admin123456</p>
        </section>
      </main>
    );
  }

  return (
    <main className="erp-shell">
      <header className="erp-topbar">
        <div className="erp-brand">Carswise ERP Console</div>
        <div className="erp-session">
          <span>{currentUser.id}</span>
          <span className="role-chip">{currentUser.role}</span>
        </div>
      </header>

      <section className="toolbar-row">
        <div>
          <h1>Panel Operativo</h1>
          <p className="hint">Mapa funcional Carswise con modulos comerciales, operativos y de postventa.</p>
        </div>
        <div className="topbar-actions">
          <button onClick={() => loadAll()} disabled={loading}>
            Refrescar
          </button>
          <button onClick={logout}>Salir</button>
        </div>
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <h3>Clientes</h3>
          <p>{users.length}</p>
        </article>
        <article className="stat-card">
          <h3>Tickets abiertos</h3>
          <p>{openTickets}</p>
        </article>
        <article className="stat-card">
          <h3>Citas pendientes</h3>
          <p>{pendingAppointments}</p>
        </article>
      </section>

      <section className="module-layout">{MODULE_GROUPS.map(renderModuleGroup)}</section>

      <nav className="tab-row">
        <button
          className={activeTab === "users" ? "active" : ""}
          onClick={() => {
            setActiveTab("users");
            setActiveModuleId("clientes");
          }}
        >
          Clientes
        </button>
        <button
          className={activeTab === "tickets" ? "active" : ""}
          onClick={() => {
            setActiveTab("tickets");
            setActiveModuleId("incidencias");
          }}
        >
          Tickets
        </button>
        <button
          className={activeTab === "appointments" ? "active" : ""}
          onClick={() => {
            setActiveTab("appointments");
            setActiveModuleId("citas_taller");
          }}
        >
          Citas
        </button>
      </nav>

      {error && <p className="error-box">Error: {error}</p>}
      {loading && <p>Cargando datos...</p>}

      {!loading && activeModule.tab === "users" && (
        <section className="panel">
          <div className="panel-header">
            <h2>Clientes</h2>
            <div className="module-screen-actions">
              <button type="button" onClick={() => exportRowsToExcel("users", userTableColumns, visibleUserRows)}>
                Exportar Excel
              </button>
              <input
                value={userQuery}
                onChange={(e) => {
                  setUserQuery(e.target.value);
                  setTablePages((prev) => ({ ...prev, users: 1 }));
                }}
                placeholder="Buscar por id, nombre o email"
              />
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                {renderSortableHeaderRow("users", userTableColumns)}
                {renderFilterRow("users", userTableColumns, allUserRows)}
              </thead>
              <tbody>
                {usersTableView.rows.map((user) => (
                  <tr key={String(user.id)}>
                    <td className="table-sticky-col">{user.id}</td>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td><span className={`badge ${String(user.status)}`}>{user.status}</span></td>
                    <td>{user.openTickets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {renderPagination("users", usersTableView.totalRows, usersTableView.currentPage, usersTableView.pageCount, usersTableView.pageSize)}
        </section>
      )}

      {!loading && activeModule.tab === "tickets" && (
        <section className="panel">
          <div className="panel-header">
            <h2>Incidencias</h2>
            <div className="module-screen-actions">
              <button type="button">Asignar agente</button>
              <button type="button">Escalar SLA</button>
              <button type="button" onClick={() => exportRowsToExcel("tickets", ticketTableColumns, visibleTicketRows)}>
                Exportar Excel
              </button>
            </div>
          </div>
          <form className="inline-form" onSubmit={createTicket}>
            <input required placeholder="User ID" value={ticketForm.userId} onChange={(e) => setTicketForm((prev) => ({ ...prev, userId: e.target.value }))} />
            <input required placeholder="Titulo" value={ticketForm.title} onChange={(e) => setTicketForm((prev) => ({ ...prev, title: e.target.value }))} />
            <input required placeholder="Descripcion" value={ticketForm.description} onChange={(e) => setTicketForm((prev) => ({ ...prev, description: e.target.value }))} />
            <select value={ticketForm.priority} onChange={(e) => setTicketForm((prev) => ({ ...prev, priority: e.target.value }))}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="urgent">urgent</option>
            </select>
            <button type="submit">Crear ticket</button>
          </form>

          <div className="table-scroll">
            <table>
              <thead>
                {renderSortableHeaderRow("tickets", ticketTableColumns, true)}
                {renderFilterRow("tickets", ticketTableColumns, allTicketRows, true)}
              </thead>
              <tbody>
                {ticketsTableView.rows.map((ticket) => (
                  <tr key={String(ticket.id)}>
                    <td className="table-sticky-col">{ticket.id}</td>
                    <td>{ticket.userId}</td>
                    <td>{ticket.title}</td>
                    <td>{ticket.status}</td>
                    <td>{ticket.priority}</td>
                    <td>
                      <button disabled={!canResolveTicket || ticket.status === "resolved"} onClick={() => resolveTicket(String(ticket.id))}>
                        Resolver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {renderPagination("tickets", ticketsTableView.totalRows, ticketsTableView.currentPage, ticketsTableView.pageCount, ticketsTableView.pageSize)}
        </section>
      )}

      {!loading && activeModule.tab === "appointments" && (
        <section className="panel">
          <div className="panel-header">
            <h2>Citas Taller</h2>
            <div className="module-screen-actions">
              <button type="button">Planificar ruta</button>
              <button type="button">Confirmar agenda</button>
              <button type="button" onClick={() => exportRowsToExcel("appointments", appointmentTableColumns, visibleAppointmentRows)}>
                Exportar Excel
              </button>
            </div>
          </div>
          <form className="inline-form" onSubmit={createAppointment}>
            <input required placeholder="User ID" value={appointmentForm.userId} onChange={(e) => setAppointmentForm((prev) => ({ ...prev, userId: e.target.value }))} />
            <input
              required
              type="datetime-local"
              value={appointmentForm.scheduledAt}
              onChange={(e) => setAppointmentForm((prev) => ({ ...prev, scheduledAt: e.target.value }))}
            />
            <select value={appointmentForm.type} onChange={(e) => setAppointmentForm((prev) => ({ ...prev, type: e.target.value }))}>
              <option value="inspection">inspection</option>
              <option value="delivery">delivery</option>
              <option value="follow_up">follow_up</option>
            </select>
            <input placeholder="Agente" value={appointmentForm.agent} onChange={(e) => setAppointmentForm((prev) => ({ ...prev, agent: e.target.value }))} />
            <button type="submit">Crear cita</button>
          </form>

          <div className="table-scroll">
            <table>
              <thead>
                {renderSortableHeaderRow("appointments", appointmentTableColumns)}
                {renderFilterRow("appointments", appointmentTableColumns, allAppointmentRows)}
              </thead>
              <tbody>
                {appointmentsTableView.rows.map((appointment) => (
                  <tr key={String(appointment.id)}>
                    <td className="table-sticky-col">{appointment.id}</td>
                    <td>{appointment.userId}</td>
                    <td>{appointment.type}</td>
                    <td>{appointment.scheduledAt}</td>
                    <td>{appointment.status}</td>
                    <td>{appointment.agent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {renderPagination(
            "appointments",
            appointmentsTableView.totalRows,
            appointmentsTableView.currentPage,
            appointmentsTableView.pageCount,
            appointmentsTableView.pageSize
          )}
        </section>
      )}

      {!loading && !activeModule.tab && staticModuleScreen && (
        <section className="panel">
          <div className="panel-header panel-header-stacked">
            <div>
              <h2>{activeModule.label}</h2>
              <p className="hint">{staticModuleScreen.subtitle}</p>
            </div>
            <div className="module-screen-actions">
              {staticModuleScreen.actions.map((action) => (
                <button key={action} type="button">
                  {action}
                </button>
              ))}
              <button
                type="button"
                onClick={() => exportRowsToExcel(activeModule.id, staticModuleScreen.columns, visibleStaticModuleRows as Array<Record<string, unknown>>)}
              >
                Exportar Excel
              </button>
              {activeModule.id === "inventario_vo" && (
                <label className="import-excel-label">
                  <span>{importingVoExcel ? "Importando..." : "Importar Excel"}</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    disabled={importingVoExcel}
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      void handleVoExcelImport(file);
                      event.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                {renderSortableHeaderRow(activeModule.id, staticModuleScreen.columns, staticModuleScreen.rowActions.length > 0)}
                {renderFilterRow(activeModule.id, staticModuleScreen.columns, allStaticRows, staticModuleScreen.rowActions.length > 0)}
              </thead>
              <tbody>
                {staticTableView.totalRows === 0 && (
                  <tr>
                    <td colSpan={staticModuleScreen.columns.length + (staticModuleScreen.rowActions.length > 0 ? 1 : 0)}>
                      Sin datos reales disponibles para este modulo.
                    </td>
                  </tr>
                )}
                {staticTableView.rows.map((row, index) => (
                  <tr
                    key={`${activeModule.id}-${index}`}
                    className={editableTableKind ? "table-row-editable" : undefined}
                    onClick={() => openEditModal(row as Record<string, unknown>)}
                  >
                    {staticModuleScreen.columns.map((column, columnIndex) => (
                      <td key={`${activeModule.id}-${index}-${column.key}`} className={columnIndex === 0 ? "table-sticky-col" : undefined}>
                        {(row as Record<string, string>)[column.key] || ""}
                      </td>
                    ))}
                    {staticModuleScreen.rowActions.length > 0 && (
                      <td>
                        {staticModuleScreen.rowActions.map((action) => (
                          <button key={`${activeModule.id}-${index}-${action}`} type="button">
                            {action}
                          </button>
                        ))}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {renderPagination(
            activeModule.id,
            staticTableView.totalRows,
            staticTableView.currentPage,
            staticTableView.pageCount,
            staticTableView.pageSize
          )}
        </section>
      )}

      {editModal && (
        <div className="modal-backdrop" onClick={closeEditModal}>
          <section className="modal-card" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <h3>Editar fila: {editModal.rowId}</h3>
              <button type="button" onClick={closeEditModal} disabled={savingEdit}>
                Cerrar
              </button>
            </header>
            <div className="modal-form-grid">
              {editModal.columns.map((column) => {
                const baseValue = editModal.values[column];
                const readOnly = column === "id" || column === "created_at" || column === "first_seen_at" || column === "scraped_at";
                const isBoolean = typeof baseValue === "boolean";

                return (
                  <label key={`edit-${column}`}>
                    <span>{column}</span>
                    {isBoolean ? (
                      <select
                        value={editValues[column] || "false"}
                        disabled={readOnly || savingEdit}
                        onChange={(event) => setEditValues((prev) => ({ ...prev, [column]: event.target.value }))}
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : (
                      <input
                        value={editValues[column] || ""}
                        readOnly={readOnly}
                        disabled={savingEdit}
                        onChange={(event) => setEditValues((prev) => ({ ...prev, [column]: event.target.value }))}
                      />
                    )}
                  </label>
                );
              })}
            </div>
            {editError && <p className="error-box">Error guardando: {editError}</p>}
            <div className="modal-actions">
              <button type="button" onClick={closeEditModal} disabled={savingEdit}>
                Cancelar
              </button>
              <button type="button" onClick={saveEditedRow} disabled={savingEdit}>
                {savingEdit ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
