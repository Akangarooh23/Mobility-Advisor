import { useEffect, useMemo, useState } from "react";
import {
  getBillingAccountJson,
  postBillingAccountJson,
  postBillingCheckoutJson,
  postBillingPortalJson,
} from "../../utils/apiClient";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toInputDateLabel(value) {
  const text = normalizeText(value);
  if (!text) {
    return "Sin fecha";
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return text;
  }

  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const AVAILABLE_PLANS = [
  { id: "gratis", label: "Plan Gratis" },
  { id: "bronce", label: "Plan Bronce" },
  { id: "plata", label: "Plan Plata" },
  { id: "oro", label: "Plan Oro" },
  { id: "platino", label: "Plan Platino" },
];

export default function UserDashboardBilling({ panelStyle, currentUser, themeMode }) {
  const isDark = themeMode === "dark";
  const cardBg = isDark
    ? "linear-gradient(160deg, rgba(15,23,42,0.9), rgba(30,41,59,0.82))"
    : "linear-gradient(160deg, rgba(255,255,255,0.96), rgba(241,245,249,0.92))";
  const panelBorder = isDark ? "1px solid rgba(148,163,184,0.26)" : "1px solid rgba(59,130,246,0.34)";
  const cardBorder = isDark ? "1px solid rgba(148,163,184,0.24)" : "1px solid rgba(37,99,235,0.3)";
  const inputStyle = {
    width: "100%",
    background: isDark ? "#0f1b2d" : "#ffffff",
    border: "1px solid rgba(148,163,184,0.45)",
    borderRadius: 8,
    color: isDark ? "#f8fafc" : "#0f172a",
    padding: "8px 10px",
    fontSize: 12,
    boxSizing: "border-box",
  };
  const secondaryButtonStyle = {
    background: isDark ? "rgba(15,23,42,0.88)" : "rgba(255,255,255,0.95)",
    border: cardBorder,
    color: isDark ? "#e2e8f0" : "#334155",
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 700,
    padding: "10px 12px",
    cursor: "pointer",
  };
  const tableCellStyle = {
    padding: "8px",
    fontSize: 12,
    color: isDark ? "#cbd5e1" : "#334155",
    borderBottom: "1px solid rgba(148,163,184,0.2)",
  };
  const resolvedUserEmail = useMemo(
    () => normalizeText(currentUser?.email).toLowerCase(),
    [currentUser?.email]
  );

  const initialProfile = useMemo(() => {
    return {
      fullName: normalizeText(currentUser?.name),
      email: resolvedUserEmail,
      phone: "",
      companyName: "",
      taxId: "",
      billingAddress: "",
      iban: "",
      updatedAt: "",
    };
  }, [currentUser?.name, resolvedUserEmail]);

  const [profileForm, setProfileForm] = useState(initialProfile);
  const [billingState, setBillingState] = useState({
    planId: "gratis",
    planLabel: "Plan Gratis",
    status: "inactivo",
    nextBillingDate: "",
    stripeCustomerId: "",
    invoices: [],
  });
  const [selectedPlanId, setSelectedPlanId] = useState("plata");
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState("");
  const [billingActionLoading, setBillingActionLoading] = useState(false);
  const [billingFeedback, setBillingFeedback] = useState("");
  const [activeAccountTab, setActiveAccountTab] = useState("overview");

  useEffect(() => {
    if (!resolvedUserEmail) {
      return;
    }

    let cancelled = false;

    const loadAccount = async () => {
      setLoadingAccount(true);

      try {
        const { data } = await getBillingAccountJson(resolvedUserEmail);
        const account = data?.account || null;

        if (cancelled || !account) {
          return;
        }

        const nextProfile = {
          fullName: normalizeText(account?.profile?.fullName || currentUser?.name),
          email: normalizeText(account?.profile?.email || resolvedUserEmail).toLowerCase(),
          phone: normalizeText(account?.profile?.phone),
          companyName: normalizeText(account?.profile?.companyName),
          taxId: normalizeText(account?.profile?.taxId),
          billingAddress: normalizeText(account?.profile?.billingAddress),
          iban: normalizeText(account?.profile?.iban),
          updatedAt: normalizeText(account?.profile?.updatedAt),
        };

        const nextBillingState = {
          planId: normalizeText(account?.billingState?.planId) || "gratis",
          planLabel: normalizeText(account?.billingState?.planLabel) || "Plan Gratis",
          status: normalizeText(account?.billingState?.status) || "inactivo",
          nextBillingDate: normalizeText(account?.billingState?.nextBillingDate),
          stripeCustomerId: normalizeText(account?.billingState?.stripeCustomerId),
          invoices: Array.isArray(account?.billingState?.invoices) ? account.billingState.invoices : [],
        };

        setProfileForm(nextProfile);
        setBillingState(nextBillingState);
        setSelectedPlanId(nextBillingState.planId || "plata");
      } catch {
        if (!cancelled) {
          setBillingFeedback("No se pudo cargar la cuenta de facturacion. Mostrando estado local.");
        }
      } finally {
        if (!cancelled) {
          setLoadingAccount(false);
        }
      }
    };

    loadAccount();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.name, resolvedUserEmail]);

  const invoices = Array.isArray(billingState?.invoices) ? billingState.invoices : [];
  const paidInvoicesCount = invoices.filter((invoice) => normalizeText(invoice?.status).toLowerCase() === "paid").length;
  const pendingInvoicesCount = Math.max(invoices.length - paidInvoicesCount, 0);
  const accountTabs = [
    { key: "overview", label: "Resumen", count: null },
    { key: "profile", label: "Perfil", count: null },
    { key: "subscription", label: "Suscripción", count: null },
    { key: "invoices", label: "Facturas", count: invoices.length },
  ];

  const handleProfileChange = (field) => (event) => {
    const value = event?.target?.value || "";
    setProfileForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveProfile = () => {
    if (!resolvedUserEmail) {
      setProfileFeedback("Necesitas una sesion activa para guardar los datos.");
      return;
    }

    setSavingProfile(true);
    setProfileFeedback("");

    const persist = async () => {
      const nextProfile = {
        ...profileForm,
        fullName: normalizeText(profileForm.fullName),
        email: normalizeText(profileForm.email || resolvedUserEmail).toLowerCase(),
        phone: normalizeText(profileForm.phone),
        companyName: normalizeText(profileForm.companyName),
        taxId: normalizeText(profileForm.taxId),
        billingAddress: normalizeText(profileForm.billingAddress),
        iban: normalizeText(profileForm.iban),
        updatedAt: new Date().toISOString(),
      };

      try {
        const { data } = await postBillingAccountJson({
          action: "update_profile",
          email: resolvedUserEmail,
          profile: nextProfile,
        });

        const account = data?.account || null;

        if (account?.profile) {
          setProfileForm({
            fullName: normalizeText(account.profile.fullName),
            email: normalizeText(account.profile.email).toLowerCase(),
            phone: normalizeText(account.profile.phone),
            companyName: normalizeText(account.profile.companyName),
            taxId: normalizeText(account.profile.taxId),
            billingAddress: normalizeText(account.profile.billingAddress),
            iban: normalizeText(account.profile.iban),
            updatedAt: normalizeText(account.profile.updatedAt),
          });
        }

        setProfileFeedback("Datos guardados correctamente.");
      } catch {
        setProfileFeedback("No se pudieron guardar los datos. Vuelve a intentarlo.");
      } finally {
        setSavingProfile(false);
      }
    };

    persist();
  };

  const startCheckout = async () => {
    setBillingActionLoading(true);
    setBillingFeedback("");

    try {
      const planMeta = AVAILABLE_PLANS.find((item) => item.id === selectedPlanId) || AVAILABLE_PLANS[0];
      const { data } = await postBillingCheckoutJson({
        planId: planMeta.id,
        customerEmail: normalizeText(profileForm.email || resolvedUserEmail).toLowerCase(),
      });

      if (data?.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      }

      if (data?.account?.billingState) {
        setBillingState((prev) => ({
          ...prev,
          ...data.account.billingState,
          invoices: Array.isArray(data?.account?.billingState?.invoices)
            ? data.account.billingState.invoices
            : prev.invoices,
        }));
      }

      setBillingFeedback(normalizeText(data?.message) || "Checkout preparado.");
    } catch (error) {
      setBillingFeedback(error instanceof Error ? error.message : "No se pudo iniciar el checkout.");
    } finally {
      setBillingActionLoading(false);
    }
  };

  const openCustomerPortal = async () => {
    setBillingActionLoading(true);
    setBillingFeedback("");

    try {
      const { data } = await postBillingPortalJson({
        customerEmail: normalizeText(profileForm.email || resolvedUserEmail).toLowerCase(),
      });

      if (data?.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      }

      setBillingFeedback(normalizeText(data?.message) || "Portal de cliente preparado.");
    } catch (error) {
      setBillingFeedback(error instanceof Error ? error.message : "No se pudo abrir el portal de cliente.");
    } finally {
      setBillingActionLoading(false);
    }
  };

  return (
    <section id="user-dashboard-billing" style={{ ...panelStyle, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#2563eb", letterSpacing: "0.6px" }}>MI CUENTA Y FACTURACION</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: isDark ? "#f8fafc" : "#0f172a" }}>Hub de cuenta y facturación</div>
        </div>
        <span
          style={{
            background: "rgba(37,99,235,0.16)",
            border: "1px solid rgba(96,165,250,0.24)",
            borderRadius: 999,
            padding: "5px 9px",
            fontSize: 11,
            fontWeight: 700,
            color: "#1e3a8a",
          }}
        >
          {billingState?.planLabel || "Plan Gratis"}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 12,
          paddingBottom: 12,
          borderBottom: "1px solid rgba(148,163,184,0.2)",
        }}
      >
        {accountTabs.map((tab) => {
          const isActive = activeAccountTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveAccountTab(tab.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: isActive
                  ? "linear-gradient(135deg,#2563eb,#1d4ed8)"
                  : isDark
                  ? "rgba(15,23,42,0.88)"
                  : "rgba(255,255,255,0.95)",
                border: isActive ? "none" : cardBorder,
                color: isActive ? "#eff6ff" : isDark ? "#e2e8f0" : "#334155",
                borderRadius: 999,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span
                  style={{
                    background: isActive ? "rgba(255,255,255,0.16)" : "rgba(148,163,184,0.14)",
                    borderRadius: 999,
                    padding: "2px 7px",
                    fontSize: 11,
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loadingAccount && (
        <div style={{ fontSize: 12, color: "#2563eb", marginBottom: 10 }}>
          Cargando datos de cuenta...
        </div>
      )}

      {activeAccountTab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 14 }}>
          {[
            ["Plan actual", billingState?.planLabel || "Plan Gratis", "#2563eb"],
            ["Estado", billingState?.status || "inactivo", "#0ea5e9"],
            ["Facturas pagadas", paidInvoicesCount, "#10b981"],
            ["Facturas pendientes", pendingInvoicesCount, "#f59e0b"],
          ].map(([label, value, color]) => (
            <div
              key={String(label)}
              style={{
                background: cardBg,
                border: panelBorder,
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800, color: String(color) }}>{value}</div>
              <div style={{ fontSize: 12, color: isDark ? "#cbd5e1" : "#334155", marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {(activeAccountTab === "overview" || activeAccountTab === "profile" || activeAccountTab === "subscription") && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12, marginBottom: 14 }}>
          {(activeAccountTab === "overview" || activeAccountTab === "profile") && (
            <div
              style={{
                background: cardBg,
                border: panelBorder,
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: isDark ? "#f8fafc" : "#0f172a", marginBottom: 8 }}>Datos personales y fiscales</div>
              <div style={{ display: "grid", gap: 8 }}>
                <input value={profileForm.fullName} onChange={handleProfileChange("fullName")} placeholder="Nombre completo" style={inputStyle} />
                <input value={profileForm.email} onChange={handleProfileChange("email")} placeholder="Email de facturacion" style={inputStyle} />
                <input value={profileForm.phone} onChange={handleProfileChange("phone")} placeholder="Telefono" style={inputStyle} />
                <input value={profileForm.companyName} onChange={handleProfileChange("companyName")} placeholder="Empresa (opcional)" style={inputStyle} />
                <input value={profileForm.taxId} onChange={handleProfileChange("taxId")} placeholder="NIF/CIF" style={inputStyle} />
                <textarea value={profileForm.billingAddress} onChange={handleProfileChange("billingAddress")} placeholder="Direccion fiscal" rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                <input value={profileForm.iban} onChange={handleProfileChange("iban")} placeholder="IBAN (opcional)" style={inputStyle} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginTop: 10 }}>
                <button type="button" onClick={saveProfile} style={primaryButtonStyle} disabled={savingProfile}>
                  {savingProfile ? "Guardando..." : "Guardar datos"}
                </button>
                <span style={{ fontSize: 11, color: isDark ? "#94a3b8" : "#94a3b8" }}>{profileForm.updatedAt ? `Actualizado: ${toInputDateLabel(profileForm.updatedAt)}` : "Sin guardar"}</span>
              </div>
              {profileFeedback && <div style={{ marginTop: 8, fontSize: 12, color: "#1d4ed8" }}>{profileFeedback}</div>}
            </div>
          )}

          {(activeAccountTab === "overview" || activeAccountTab === "subscription") && (
            <div
              style={{
                background: cardBg,
                border: panelBorder,
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: isDark ? "#f8fafc" : "#0f172a", marginBottom: 8 }}>Suscripcion y pagos</div>
              <div style={{ fontSize: 12, color: isDark ? "#cbd5e1" : "#334155", lineHeight: 1.65, marginBottom: 10 }}>
                Estado: <strong>{billingState?.status || "inactivo"}</strong><br />
                Proxima renovacion: <strong>{toInputDateLabel(billingState?.nextBillingDate)}</strong>
              </div>

              <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Plan para checkout</label>
              <select value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)} style={{ ...inputStyle, marginBottom: 10 }}>
                {AVAILABLE_PLANS.map((plan) => (
                  <option key={plan.id} value={plan.id}>{plan.label}</option>
                ))}
              </select>

              <div style={{ display: "grid", gap: 8 }}>
                <button type="button" onClick={startCheckout} disabled={billingActionLoading} style={primaryButtonStyle}>
                  {billingActionLoading ? "Procesando..." : "Iniciar checkout"}
                </button>
                <button type="button" onClick={openCustomerPortal} disabled={billingActionLoading} style={secondaryButtonStyle}>
                  Gestionar metodo de pago
                </button>
              </div>

              <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8" }}>
                Integracion preparada para Stripe. Si no hay claves configuradas, se ejecuta en modo simulado.
              </div>
              {billingFeedback && <div style={{ marginTop: 8, fontSize: 12, color: "#1d4ed8" }}>{billingFeedback}</div>}
            </div>
          )}
        </div>
      )}

      {(activeAccountTab === "overview" || activeAccountTab === "invoices") && (
        <div
          style={{
            background: cardBg,
            border: panelBorder,
            borderRadius: 12,
            padding: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: isDark ? "#f8fafc" : "#0f172a", marginBottom: 8 }}>Facturas</div>

          {invoices.length === 0 ? (
            <div style={{ fontSize: 12, color: "#94a3b8" }}>Todavia no hay facturas registradas en tu cuenta.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 580 }}>
                <thead>
                  <tr>
                    {[
                      "Numero",
                      "Fecha",
                      "Importe",
                      "Estado",
                      "Documento",
                    ].map((cell) => (
                      <th
                        key={cell}
                        style={{
                          textAlign: "left",
                          fontSize: 11,
                          color: "#1d4ed8",
                          padding: "7px 8px",
                          borderBottom: "1px solid rgba(148,163,184,0.18)",
                        }}
                      >
                        {cell}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id || invoice.number}>
                      <td style={tableCellStyle}>{invoice.number || "-"}</td>
                      <td style={tableCellStyle}>{toInputDateLabel(invoice.date)}</td>
                      <td style={tableCellStyle}>{Number(invoice.amount || 0).toFixed(2)} EUR</td>
                      <td style={tableCellStyle}>{invoice.status || "Pendiente"}</td>
                      <td style={tableCellStyle}>
                        {invoice.pdfUrl ? (
                          <a href={invoice.pdfUrl} target="_blank" rel="noreferrer" style={{ color: "#1d4ed8", fontWeight: 700 }}>
                            Descargar PDF
                          </a>
                        ) : (
                          <span style={{ color: isDark ? "#94a3b8" : "#64748b" }}>No disponible</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

const primaryButtonStyle = {
  background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
  border: "none",
  color: "#ffffff",
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 700,
  padding: "10px 12px",
  cursor: "pointer",
};

