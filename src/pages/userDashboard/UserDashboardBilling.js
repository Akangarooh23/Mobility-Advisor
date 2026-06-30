import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getBillingAccountJson,
  postBillingAccountJson,
  postBillingCheckoutJson,
  postBillingPortalJson,
} from "../../utils/apiClient";
import { clearUserBillingCheckoutIntent, readAuthUser, readUserBillingCheckoutIntent, writeAuthUser, writeUserBillingProfile, writeUserBillingState } from "../../utils/storage";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toInputDateLabel(value, t) {
  const text = normalizeText(value);
  if (!text) {
    return t ? t("dashboard.billingNoDate") : "Sin fecha";
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

const DEFAULT_AVAILABLE_PLANS = [
  { id: "free", label: "Free" },
  { id: "plus", label: "Plus" },
];

export default function UserDashboardBilling({ panelStyle, currentUser, themeMode, isMobile = false, onPlanChange }) {
  const { t } = useTranslation();
  const planLabelMap = {
    free: "Free",
    plus: "Plus",
    // legacy IDs — map to closest equivalent
    gratis: "Free",
    bronce: "Plus",
    plata: "Plus",
    oro: "Plus",
    platino: "Plus",
  };
  const subscriptionStatusMap = {
    activo: t("dashboard.billingStatusActivo"),
    activa: t("dashboard.billingStatusActivo"),
    active: t("dashboard.billingStatusActivo"),
    trialing: t("dashboard.billingStatusActivo"),
    pendiente: t("dashboard.billingStatusPendiente"),
    past_due: t("dashboard.billingStatusPendiente"),
    unpaid: t("dashboard.billingStatusPendiente"),
    incomplete: t("dashboard.billingStatusPendiente"),
    inactivo: t("dashboard.billingStatusInactivo"),
    cancelado: t("dashboard.billingStatusCancelado"),
    canceled: t("dashboard.billingStatusCancelado"),
  };
  const invoiceStatusMap = {
    pagada: t("dashboard.billingInvoiceStatusPagada"),
    pendiente: t("dashboard.billingInvoiceStatusPendiente"),
    cancelada: t("dashboard.billingInvoiceStatusCancelada"),
  };
  const isDark = themeMode === "dark";
  const cardBg = isDark
    ? "linear-gradient(160deg, rgba(15,23,42,0.9), rgba(30,41,59,0.82))"
    : "linear-gradient(160deg, rgba(255,255,255,0.96), rgba(241,245,249,0.92))";
  const panelBorder = isDark ? "1px solid rgba(148,163,184,0.26)" : "1px solid rgba(59,130,246,0.34)";
  const cardBorder = isDark ? "1px solid rgba(148,163,184,0.24)" : "1px solid rgba(37,99,235,0.3)";
  const sectionFrame = {
    background: isDark ? "rgba(2,6,23,0.34)" : "rgba(248,250,252,0.86)",
    border: isDark ? "1px solid rgba(148,163,184,0.22)" : "1px solid rgba(148,163,184,0.24)",
    borderRadius: 14,
    boxShadow: isDark
      ? "0 14px 26px rgba(2,6,23,0.28)"
      : "0 10px 20px rgba(15,23,42,0.06)",
  };
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
    const nameParts = [normalizeText(currentUser?.name), normalizeText(currentUser?.apellidos)].filter(Boolean);
    return {
      fullName: nameParts.join(" "),
      email: resolvedUserEmail,
      phone: normalizeText(currentUser?.phone),
      companyName: "",
      taxId: "",
      billingStreet: "",
      billingPostalCode: "",
      billingProvince: "",
      billingAddress: "",
      clientType: "individual",
      iban: "",
      updatedAt: "",
    };
  }, [currentUser?.name, currentUser?.apellidos, currentUser?.phone, resolvedUserEmail]);

  const [profileForm, setProfileForm] = useState(initialProfile);
  const [billingState, setBillingState] = useState({
    planId: "free",
    planLabel: "Free",
    status: "inactivo",
    nextBillingDate: "",
    stripeCustomerId: "",
    invoices: [],
  });
  const [availablePlans, setAvailablePlans] = useState(DEFAULT_AVAILABLE_PLANS);
  const [selectedPlanId, setSelectedPlanId] = useState("plata");
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState("");
  const [billingActionLoading, setBillingActionLoading] = useState(false);
  const [billingFeedback, setBillingFeedback] = useState("");
  const [activeAccountTab, setActiveAccountTab] = useState("overview");

  // eslint-disable-next-line react-hooks/exhaustive-deps
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

        const registrationFullName = [normalizeText(currentUser?.name), normalizeText(currentUser?.apellidos)].filter(Boolean).join(" ");
        const nextProfile = {
          fullName: normalizeText(account?.profile?.fullName) || registrationFullName,
          email: normalizeText(account?.profile?.email || resolvedUserEmail).toLowerCase(),
          phone: normalizeText(account?.profile?.phone) || normalizeText(currentUser?.phone),
          companyName: normalizeText(account?.profile?.companyName),
          taxId: normalizeText(account?.profile?.taxId),
          billingStreet: normalizeText(account?.profile?.billingStreet),
          billingPostalCode: normalizeText(account?.profile?.billingPostalCode),
          billingProvince: normalizeText(account?.profile?.billingProvince),
          billingAddress: normalizeText(account?.profile?.billingAddress),
          clientType: normalizeText(account?.profile?.clientType) || "individual",
          iban: normalizeText(account?.profile?.iban),
          updatedAt: normalizeText(account?.profile?.updatedAt),
        };

        const nextBillingState = {
          planId: normalizeText(account?.billingState?.planId) || "free",
          planLabel: normalizeText(account?.billingState?.planLabel) || "Free",
          status: normalizeText(account?.billingState?.status) || "inactivo",
          nextBillingDate: normalizeText(account?.billingState?.nextBillingDate),
          stripeCustomerId: normalizeText(account?.billingState?.stripeCustomerId),
          stripeSubscriptionId: normalizeText(account?.billingState?.stripeSubscriptionId),
          cancelAtPeriodEnd: Boolean(account?.billingState?.cancelAtPeriodEnd),
          invoices: Array.isArray(account?.billingState?.invoices) ? account.billingState.invoices : [],
        };

        const nextCatalogPlans = Array.isArray(data?.billingCatalog?.plans)
          ? data.billingCatalog.plans
              .map((plan) => ({
                id: normalizeText(plan?.id).toLowerCase(),
                label: normalizeText(plan?.label) || `Plan ${normalizeText(plan?.id)}`,
                checkoutEnabled: Boolean(plan?.checkoutEnabled),
              }))
              .filter((plan) => plan.id)
          : [];

        const effectivePlans = nextCatalogPlans.length > 0 ? nextCatalogPlans : DEFAULT_AVAILABLE_PLANS;

        setProfileForm(nextProfile);
        setBillingState(nextBillingState);
        setAvailablePlans(effectivePlans);
        writeUserBillingState(nextBillingState);
        if (onPlanChange) onPlanChange(nextBillingState.planId);
        setSelectedPlanId(
          nextBillingState.planId
            || effectivePlans.find((plan) => plan.checkoutEnabled)?.id
            || effectivePlans[0]?.id
            || "plata"
        );
      } catch {
        if (!cancelled) {
          setBillingFeedback(t("dashboard.billingLoadError"));
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.name, resolvedUserEmail]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const intent = readUserBillingCheckoutIntent();

    if (!intent) {
      return;
    }

    const suggestedPlanId = normalizeText(intent?.suggestedPlanId).toLowerCase();
    const hasSuggestedPlan = availablePlans.some((plan) => plan.id === suggestedPlanId);
    const managementType = normalizeText(intent?.managementType).toLowerCase();
    const managementLabel = managementType === "valuation" ? "tasación" : "gestión";
    const estimatedPrice = normalizeText(intent?.estimatedPrice);

    setActiveAccountTab("subscription");

    if (hasSuggestedPlan) {
      setSelectedPlanId(suggestedPlanId);
    }

    setBillingFeedback(
      estimatedPrice
        ? `Has llegado desde Nueva gestión (${managementLabel}). Precio puntual estimado: ${estimatedPrice}. Puedes hacer checkout del plan sugerido.`
        : `Has llegado desde Nueva gestión (${managementLabel}). Puedes hacer checkout del plan sugerido.`
    );

    clearUserBillingCheckoutIntent();
  }, [availablePlans]);

  const invoices = Array.isArray(billingState?.invoices) ? billingState.invoices : [];
  const paidInvoicesCount = invoices.filter((invoice) => normalizeText(invoice?.status).toLowerCase() === "paid").length;
  const pendingInvoicesCount = Math.max(invoices.length - paidInvoicesCount, 0);
  const accountTabs = [
    { key: "overview", label: t("dashboard.billingTabOverview"), count: null },
    { key: "profile", label: t("dashboard.billingTabProfile"), count: null },
    { key: "subscription", label: t("dashboard.billingTabSubscription"), count: null },
    { key: "invoices", label: t("dashboard.billingTabInvoices"), count: invoices.length },
  ];

  const handleProfileChange = (field) => (event) => {
    const value = event?.target?.value || "";
    setProfileForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveProfile = () => {
    if (!resolvedUserEmail) {
      setProfileFeedback(t("dashboard.billingNeedSession"));
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
        billingStreet: normalizeText(profileForm.billingStreet),
        billingPostalCode: normalizeText(profileForm.billingPostalCode),
        billingProvince: normalizeText(profileForm.billingProvince),
        billingAddress: [profileForm.billingStreet, profileForm.billingPostalCode, profileForm.billingProvince].map(normalizeText).filter(Boolean).join(", "),
        clientType: profileForm.clientType || "individual",
        iban: normalizeText(profileForm.iban),
        updatedAt: new Date().toISOString(),
      };

      try {
        const { response, data } = await postBillingAccountJson({
          action: "update_profile",
          email: resolvedUserEmail,
          profile: nextProfile,
        });

        if (!response.ok) {
          setProfileFeedback("Error al guardar: " + (data?.error || "inténtalo de nuevo"));
          return;
        }

        const account = data?.account || null;

        if (account?.profile) {
          const savedProfile = {
            fullName: normalizeText(account.profile.fullName),
            email: normalizeText(account.profile.email).toLowerCase(),
            phone: normalizeText(account.profile.phone),
            companyName: normalizeText(account.profile.companyName),
            taxId: normalizeText(account.profile.taxId),
            billingStreet: normalizeText(account.profile.billingStreet),
            billingPostalCode: normalizeText(account.profile.billingPostalCode),
            billingProvince: normalizeText(account.profile.billingProvince),
            billingAddress: normalizeText(account.profile.billingAddress),
            clientType: normalizeText(account.profile.clientType) || "individual",
            iban: normalizeText(account.profile.iban),
            updatedAt: normalizeText(account.profile.updatedAt),
          };
          setProfileForm(savedProfile);
          writeUserBillingProfile(savedProfile);
          const existingAuth = readAuthUser();
          const nameParts = (savedProfile.fullName || "").trim().split(/\s+/).filter(Boolean);
          const firstName = nameParts[0] || existingAuth?.name || "";
          const lastName = nameParts.slice(1).join(" ") || existingAuth?.apellidos || "";
          writeAuthUser({ ...existingAuth, email: savedProfile.email || existingAuth?.email, name: firstName, apellidos: lastName, phone: savedProfile.phone });
        }

        setProfileFeedback(t("dashboard.billingDataSaved"));
      } catch {
        setProfileFeedback(t("dashboard.billingSaveError"));
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
      const planMeta = availablePlans.find((item) => item.id === selectedPlanId) || availablePlans[0] || DEFAULT_AVAILABLE_PLANS[0];
      if (planMeta?.checkoutEnabled === false) {
        setBillingFeedback("Este plan no requiere checkout de Stripe.");
        return;
      }

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

      if (Array.isArray(data?.plans) && data.plans.length > 0) {
        setAvailablePlans(
          data.plans
            .map((plan) => ({
              id: normalizeText(plan?.id).toLowerCase(),
              label: normalizeText(plan?.label) || `Plan ${normalizeText(plan?.id)}`,
              checkoutEnabled: Boolean(plan?.checkoutEnabled),
            }))
            .filter((plan) => plan.id)
        );
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

  const cancelSubscription = async () => {
    setBillingActionLoading(true);
    setBillingFeedback("");

    try {
      const { data } = await postBillingAccountJson({
        action: "cancel_subscription",
        email: normalizeText(profileForm.email || resolvedUserEmail).toLowerCase(),
        cancelMode: "end_of_period",
      });

      if (data?.account?.billingState) {
        setBillingState((prev) => ({
          ...prev,
          ...data.account.billingState,
          invoices: Array.isArray(data?.account?.billingState?.invoices)
            ? data.account.billingState.invoices
            : prev.invoices,
        }));
      }

      setBillingFeedback(normalizeText(data?.message) || "Suscripcion marcada para cancelarse al final del periodo.");
    } catch (error) {
      setBillingFeedback(error instanceof Error ? error.message : "No se pudo cancelar la suscripcion.");
    } finally {
      setBillingActionLoading(false);
    }
  };

  return (
    <section id="user-dashboard-billing" style={{ ...panelStyle, ...sectionFrame, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#2563eb", letterSpacing: "0.6px" }}>{t("dashboard.billingSectionLabel")}</div>
          <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, color: isDark ? "#f8fafc" : "#0f172a" }}>{t("dashboard.billingTitle")}</div>
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
          {planLabelMap[billingState?.planId] || billingState?.planLabel || t("dashboard.billingPlanGratis")}
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
          {t("dashboard.billingLoading")}
        </div>
      )}

      {activeAccountTab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 14 }}>
          {[
            [t("dashboard.billingCurrentPlan"), planLabelMap[billingState?.planId] || billingState?.planLabel || t("dashboard.billingPlanGratis"), "#2563eb"],
            [t("dashboard.billingStatus"), subscriptionStatusMap[billingState?.status?.toLowerCase()] || billingState?.status || t("dashboard.billingStatusInactivo"), "#0ea5e9"],
            [t("dashboard.billingPaidInvoices"), paidInvoicesCount, "#10b981"],
            [t("dashboard.billingPendingInvoices"), pendingInvoicesCount, "#f59e0b"],
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
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(260px,1fr))", gap: 12, marginBottom: 14 }}>
          {(activeAccountTab === "overview" || activeAccountTab === "profile") && (
            <div
              style={{
                background: cardBg,
                border: panelBorder,
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: isDark ? "#f8fafc" : "#0f172a", marginBottom: 8 }}>{t("dashboard.billingProfileTitle")}</div>

              {/* Toggle particular / empresa */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                {[
                  { key: "individual", label: "👤 Particular" },
                  { key: "business",   label: "🏢 Empresa" },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setProfileForm((p) => ({ ...p, clientType: key }))}
                    style={{
                      padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      border: profileForm.clientType === key
                        ? key === "business" ? "1.5px solid #f59e0b" : "1.5px solid #3b82f6"
                        : "1px solid rgba(148,163,184,0.45)",
                      background: profileForm.clientType === key
                        ? key === "business" ? "rgba(245,158,11,0.08)" : "rgba(59,130,246,0.08)"
                        : isDark ? "#0f1b2d" : "#ffffff",
                      color: profileForm.clientType === key
                        ? key === "business" ? "#d97706" : "#2563eb"
                        : isDark ? "#94a3b8" : "#64748b",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {/* Nombre o razón social según tipo */}
                {profileForm.clientType === "business" ? (
                  <input value={profileForm.companyName} onChange={handleProfileChange("companyName")} placeholder="Razón social" style={inputStyle} />
                ) : (
                  <input value={profileForm.fullName} onChange={handleProfileChange("fullName")} placeholder={t("dashboard.billingFullName")} style={inputStyle} />
                )}
                <input value={profileForm.email} onChange={handleProfileChange("email")} placeholder={t("dashboard.billingEmailBilling")} style={inputStyle} />
                <input value={profileForm.phone} onChange={handleProfileChange("phone")} placeholder={t("dashboard.billingPhone")} style={inputStyle} />
                <input value={profileForm.taxId} onChange={handleProfileChange("taxId")} placeholder={t("dashboard.billingTaxId")} style={inputStyle} />
                <input value={profileForm.billingStreet} onChange={handleProfileChange("billingStreet")} placeholder="Dirección (calle, número, piso)" style={inputStyle} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <input value={profileForm.billingPostalCode} onChange={handleProfileChange("billingPostalCode")} placeholder="Código postal" style={inputStyle} />
                  <input value={profileForm.billingProvince} onChange={handleProfileChange("billingProvince")} placeholder="Provincia" style={inputStyle} />
                </div>
                <input value={profileForm.iban} onChange={handleProfileChange("iban")} placeholder={t("dashboard.billingIban")} style={inputStyle} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                <button type="button" onClick={saveProfile} style={{ ...primaryButtonStyle, width: isMobile ? "100%" : "auto" }} disabled={savingProfile}>
                  {savingProfile ? t("dashboard.billingSaving") : t("dashboard.billingSaveData")}
                </button>
                <span style={{ fontSize: 11, color: isDark ? "#94a3b8" : "#94a3b8" }}>{profileForm.updatedAt ? t("dashboard.billingUpdated", { date: toInputDateLabel(profileForm.updatedAt, t) }) : t("dashboard.billingNotSaved")}</span>
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
              <div style={{ fontSize: 13, fontWeight: 800, color: isDark ? "#f8fafc" : "#0f172a", marginBottom: 8 }}>{t("dashboard.billingSubscriptionTitle")}</div>
              <div style={{ fontSize: 12, color: isDark ? "#cbd5e1" : "#334155", lineHeight: 1.65, marginBottom: 10 }}>
                {t("dashboard.billingStatusLabel")} <strong>{billingState?.status || "inactivo"}</strong><br />
                {t("dashboard.billingNextRenewal")} <strong>{toInputDateLabel(billingState?.nextBillingDate, t)}</strong>
                {billingState?.cancelAtPeriodEnd ? (
                  <><br />Cancelación programada: <strong>sí (fin de periodo)</strong></>
                ) : null}
              </div>

              {!(billingState?.planId === "plus" && (billingState?.status === "activa" || billingState?.status === "trialing")) && (
                <>
                  <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>{t("dashboard.billingCheckoutPlan")}</label>
                  <select value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)} style={{ ...inputStyle, marginBottom: 10 }}>
                    {availablePlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>{planLabelMap[plan.id] || plan.label}</option>
                    ))}
                  </select>
                </>
              )}

              <div style={{ display: "grid", gap: 8 }}>
                {!(billingState?.planId === "plus" && (billingState?.status === "activa" || billingState?.status === "trialing")) && (
                  <button type="button" onClick={startCheckout} disabled={billingActionLoading} style={{ ...primaryButtonStyle, width: isMobile ? "100%" : "auto" }}>
                    {billingActionLoading ? t("dashboard.billingProcessing") : t("dashboard.billingStartCheckout")}
                  </button>
                )}
                <button type="button" onClick={openCustomerPortal} disabled={billingActionLoading} style={{ ...secondaryButtonStyle, width: isMobile ? "100%" : "auto" }}>
                  {t("dashboard.billingManagePayment")}
                </button>
                <button
                  type="button"
                  onClick={cancelSubscription}
                  disabled={billingActionLoading || !normalizeText(billingState?.stripeSubscriptionId)}
                  style={{ ...secondaryButtonStyle, width: isMobile ? "100%" : "auto" }}
                >
                  Cancelar al final del periodo
                </button>
              </div>

              <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8" }}>
                {t("dashboard.billingStripeNote")}
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
          <div style={{ fontSize: 13, fontWeight: 800, color: isDark ? "#f8fafc" : "#0f172a", marginBottom: 8 }}>{t("dashboard.billingInvoicesTitle")}</div>

          {invoices.length === 0 ? (
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{t("dashboard.billingNoInvoices")}</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? 460 : 580 }}>
                <thead>
                  <tr>
                    {[
                      t("dashboard.billingTableNumber"),
                      t("dashboard.billingTableDate"),
                      t("dashboard.billingTableAmount"),
                      t("dashboard.billingTableStatus"),
                      t("dashboard.billingTableDocument"),
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
                      <td style={tableCellStyle}>{toInputDateLabel(invoice.date, t)}</td>
                      <td style={tableCellStyle}>{Number(invoice.amount || 0).toFixed(2)} EUR</td>
                      <td style={tableCellStyle}>{invoiceStatusMap[invoice.status?.toLowerCase()] || invoice.status || t("dashboard.billingInvoiceStatusPendiente")}</td>
                      <td style={tableCellStyle}>
                        {(() => {
                          const pdfHref = invoice.pdfUrl || (invoice.id && resolvedUserEmail ? `/api/invoice-pdf?id=${encodeURIComponent(invoice.id)}&email=${encodeURIComponent(resolvedUserEmail)}` : null);
                          return pdfHref ? (
                            <a href={pdfHref} target="_blank" rel="noreferrer" style={{ color: "#1d4ed8", fontWeight: 700 }}>
                              {t("dashboard.billingDownloadPdf")}
                            </a>
                          ) : (
                            <span style={{ color: isDark ? "#94a3b8" : "#64748b" }}>{t("dashboard.billingNotAvailable")}</span>
                          );
                        })()}
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

