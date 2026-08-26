import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getVehicleCatalogJson, postVehicleCatalogAdminJson } from "../../utils/apiClient";

function mapCatalogBrandsFromApi(payload = null) {
  return (Array.isArray(payload?.brands) ? payload.brands : []).reduce((acc, brandEntry) => {
    const brandName = String(brandEntry?.name || "").trim();

    if (!brandName) {
      return acc;
    }

    const models = Array.isArray(brandEntry?.models)
      ? brandEntry.models.map((modelName) => String(modelName || "").trim()).filter(Boolean)
      : [];

    acc[brandName] = models;
    return acc;
  }, {});
}

export default function UserDashboardSaved({
  themeMode,
  isMobile = false,
  savedComparisons,
  marketAlerts = [],
  marketAlertStatus = {},
  marketAlertMatches = {},
  currentUserEmail = "",
  panelStyle,
  getOfferBadgeStyle,
  formatCurrency,
  getSavedComparisonHref,
  onOpenOffer,
  onOpenMarketplaceOffer = () => {},
  onRemoveSavedComparison,
  onCreateMarketAlert = () => null,
  onRemoveMarketAlert = () => {},
  onMarkAlertSeen = () => {},
  onSendAlertEmailDigest = () => {},
  emailDigestLoading = false,
  emailDigestFeedback = "",
  onBrowseMarketplace = () => {},
  onNavigate = () => {},
}) {
  const { t } = useTranslation();
  const isDark = themeMode === "dark";
  const cardBg = isDark
    ? "linear-gradient(160deg, rgba(17,17,17,0.9), rgba(31,31,29,0.82))"
    : "linear-gradient(160deg, rgba(255,255,255,0.96), rgba(242,242,237,0.92))";
  const inputBg = isDark ? "var(--gris-900)" : "var(--blanco)";
  const inputText = isDark ? "var(--gris-50)" : "var(--gris-900)";
  const mutedText = isDark ? "var(--gris-300)" : "var(--gris-600)";
  const titleText = isDark ? "var(--gris-50)" : "var(--gris-900)";
  const panelBorder = isDark ? "1px solid rgba(150,150,143,0.26)" : "1px solid rgba(255,196,0,0.34)";
  const cardBorder = isDark ? "1px solid rgba(150,150,143,0.24)" : "1px solid rgba(255,196,0,0.3)";
  const sectionFrame = {
    background: isDark ? "rgba(5,5,5,0.34)" : "rgba(250,250,248,0.86)",
    border: isDark ? "1px solid rgba(150,150,143,0.22)" : "1px solid rgba(150,150,143,0.24)",
    borderRadius: 14,
    boxShadow: isDark
      ? "0 14px 26px rgba(5,5,5,0.28)"
      : "0 10px 20px rgba(17,17,17,0.06)",
  };

  const [showCatalogAdmin, setShowCatalogAdmin] = useState(false);
  const [activeOpportunityTab, setActiveOpportunityTab] = useState("overview");
  const [catalogAdminLoading, setCatalogAdminLoading] = useState(false);
  const [catalogAdminFeedback, setCatalogAdminFeedback] = useState("");
  const [catalogAdminForm, setCatalogAdminForm] = useState({
    brand: "",
    model: "",
    newBrand: "",
    newModel: "",
  });
  const [catalogBrandsMap, setCatalogBrandsMap] = useState({});
  const brandOptions = useMemo(() => Object.keys(catalogBrandsMap).sort((a, b) => a.localeCompare(b, "es")), [catalogBrandsMap]);
  const totalNewMatches = marketAlerts.reduce((acc, alert) => {
    const matchInfo = marketAlertMatches?.[alert.id] || { count: 0 };
    const seenCount = Number(marketAlertStatus?.[alert.id]?.seenCount || 0);
    return acc + Math.max(Number(matchInfo.count || 0) - seenCount, 0);
  }, 0);
  const opportunityTabs = [
    { key: "overview", label: t("dashboard.savedTabOverview"), count: null },
    { key: "saved", label: t("dashboard.savedTabSaved"), count: savedComparisons.length },
    { key: "marketplace", label: "Marketplace", count: totalNewMatches },
  ];

  const loadVehicleCatalog = async () => {
    try {
      const { data } = await getVehicleCatalogJson();
      const nextCatalog = mapCatalogBrandsFromApi(data);

      if (Object.keys(nextCatalog).length > 0) {
        setCatalogBrandsMap(nextCatalog);
      }
    } catch {
      // Catalog remains empty if endpoint is unavailable.
    }
  };

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const { data } = await getVehicleCatalogJson();
        const nextCatalog = mapCatalogBrandsFromApi(data);

        if (isMounted && Object.keys(nextCatalog).length > 0) {
          setCatalogBrandsMap(nextCatalog);
        }
      } catch {
        // Catalog remains empty if endpoint is unavailable.
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setCatalogAdminForm((prev) => {
      if (prev.brand && catalogBrandsMap[prev.brand]) {
        return prev;
      }

      return {
        ...prev,
        brand: "",
        model: "",
      };
    });
  }, [catalogBrandsMap]);

  const handleCatalogAdminMutation = async (action, payload = {}) => {
    setCatalogAdminLoading(true);
    setCatalogAdminFeedback("");

    try {
      const { response, data } = await postVehicleCatalogAdminJson({
        action,
        ...payload,
      });

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || t("dashboard.savedCatalogError"));
      }

      await loadVehicleCatalog();
      setCatalogAdminFeedback(t("dashboard.savedCatalogSuccess"));
      window.setTimeout(() => setCatalogAdminFeedback(""), 2200);
      setCatalogAdminForm((prev) => ({
        ...prev,
        newBrand: "",
        newModel: "",
      }));
    } catch (error) {
      setCatalogAdminFeedback(error instanceof Error ? error.message : t("dashboard.savedCatalogError"));
    } finally {
      setCatalogAdminLoading(false);
    }
  };

  return (
    <section id="user-dashboard-saved" style={{ ...panelStyle, ...sectionFrame, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--gris-400)", letterSpacing: "0.6px" }}>{t("dashboard.savedSectionLabel")}</div>
          <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, color: titleText }}>{t("dashboard.savedTitle")}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={{ ...getOfferBadgeStyle("info"), fontSize: 11 }}>{t("dashboard.savedBadge", { count: savedComparisons.length })}</span>
          <span style={{ ...getOfferBadgeStyle("success"), fontSize: 11 }}>{t("dashboard.savedNewsBadge", { count: totalNewMatches })}</span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 12,
          paddingBottom: 12,
          borderBottom: "1px solid rgba(150,150,143,0.2)",
        }}
      >
        {opportunityTabs.map((tab) => {
          const isActive = activeOpportunityTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveOpportunityTab(tab.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: isActive
                  ? "linear-gradient(135deg,var(--marca),var(--marca-oscuro))"
                  : isDark
                  ? "rgba(17,17,17,0.88)"
                  : "rgba(255,255,255,0.95)",
                border: isActive ? "none" : cardBorder,
                color: isActive ? "var(--acento-tenue)" : isDark ? "var(--gris-200)" : "var(--gris-700)",
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
                    background: isActive ? "rgba(255,255,255,0.18)" : "rgba(150,150,143,0.16)",
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

      {(activeOpportunityTab === "overview" || activeOpportunityTab === "marketplace") && (
        <div
          style={{
            marginBottom: 14,
            background: cardBg,
            border: panelBorder,
            borderRadius: 14,
            padding: 14,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
            {[
              [t("dashboard.savedStatSaved"), savedComparisons.length, "var(--gris-400)"],
              [t("dashboard.savedStatAlerts"), marketAlerts.length, "#34d399"],
              [t("dashboard.savedStatNews"), totalNewMatches, "#f59e0b"],
            ].map(([label, value, color]) => (
              <div
                key={String(label)}
                style={{
                  background: isDark ? "rgba(17,17,17,0.88)" : "rgba(255,255,255,0.95)",
                  border: cardBorder,
                  borderRadius: 12,
                  padding: "10px 11px",
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 800, color: String(color) }}>{value}</div>
                <div style={{ fontSize: 12, color: mutedText }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", width: isMobile ? "100%" : "auto" }}>
            <button
              type="button"
              onClick={() => onBrowseMarketplace()}
              style={{
                background: "linear-gradient(135deg,#10b981,#059669)",
                border: "none",
                color: "var(--blanco)",
                padding: "10px 12px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                width: isMobile ? "100%" : "auto",
              }}
            >
              {t("dashboard.savedExploreMarketplace")}
            </button>
            <button
              type="button"
              onClick={() => onNavigate("alerts")}
              style={{
                background: "rgba(255,196,0,0.14)",
                border: "1px solid rgba(255,196,0,0.24)",
                color: "var(--gris-900)",
                padding: "10px 12px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                width: isMobile ? "100%" : "auto",
              }}
            >{t("dashboard.savedManageAlerts")}</button>
          </div>
        </div>
      )}

      {(activeOpportunityTab === "overview" || activeOpportunityTab === "saved") && (savedComparisons.length > 0 ? (
        <div style={{ display: "grid", gap: 10 }}>
          {savedComparisons.map((item) => {
            const savedOfferHref = getSavedComparisonHref(item);

            return (
              <div
                key={item.id}
                style={{
                  background: cardBg,
                  border: panelBorder,
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: titleText }}>{item.title}</div>
                      {item.score > 0 && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            background: item.score >= 80 ? "rgba(5,150,105,0.12)" : item.score >= 60 ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.10)",
                            border: `1px solid ${item.score >= 80 ? "rgba(52,211,153,0.3)" : item.score >= 60 ? "rgba(252,211,77,0.3)" : "rgba(252,165,165,0.3)"}`,
                            color: item.score >= 80 ? "#059669" : item.score >= 60 ? "#d97706" : "#dc2626",
                            borderRadius: 999,
                            padding: "3px 7px",
                            letterSpacing: "0.3px",
                          }}
                        >
                          {item.score}/100
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: mutedText, marginTop: 3 }}>
                      {item.typeLabel} · {item.savedAt}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--marca)", marginTop: 3 }}>
                      {item.monthlyTotal > 0 ? `${formatCurrency(item.monthlyTotal)}/mes` : item.budgetLabel || "Sin cuota definida"}
                    </div>
                    {(item.tco > 0 || item.flexibilidad > 0 || item.riesgo > 0) && (
                      <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                        {[
                          { label: "TCO", value: item.tco, color: "var(--marca)" },
                          { label: "Flexib.", value: item.flexibilidad, color: "var(--gris-500)" },
                          { label: "Riesgo", value: item.riesgo, color: item.riesgo > 60 ? "#dc2626" : "#059669", invert: true },
                        ].filter((m) => m.value > 0).map((metric) => (
                          <div key={metric.label} style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 56 }}>
                            <div style={{ fontSize: 10, color: mutedText, letterSpacing: "0.3px" }}>{metric.label}</div>
                            <div
                              style={{
                                height: 4,
                                borderRadius: 999,
                                background: isDark ? "rgba(150,150,143,0.18)" : "rgba(150,150,143,0.28)",
                                width: 56,
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  height: "100%",
                                  width: `${Math.min(metric.value, 100)}%`,
                                  background: metric.color,
                                  borderRadius: 999,
                                }}
                              />
                            </div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: metric.color }}>{metric.value}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", width: isMobile ? "100%" : "auto" }}>
                    {savedOfferHref && (
                      <button
                        type="button"
                        onClick={() => onOpenOffer(savedOfferHref)}
                        style={{
                          background: "rgba(255,196,0,0.12)",
                          border: "1px solid rgba(255,196,0,0.2)",
                          color: "var(--gris-900)",
                          padding: "8px 10px",
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                          width: isMobile ? "100%" : "auto",
                        }}
                      >
                        Abrir oferta ↗
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onNavigate("alerts")}
                      style={{
                        background: "rgba(16,185,129,0.12)",
                        border: "1px solid rgba(110,231,183,0.2)",
                        color: "#065f46",
                        padding: "8px 10px",
                        borderRadius: 10,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        width: isMobile ? "100%" : "auto",
                      }}
                    >
                      Crear alerta
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveSavedComparison(item.id)}
                      style={{
                        background: "rgba(239,68,68,0.12)",
                        border: "1px solid rgba(248,113,113,0.18)",
                        color: "#b91c1c",
                        padding: "8px 10px",
                        borderRadius: 10,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                          width: isMobile ? "100%" : "auto",
                      }}
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "var(--gris-400)", marginBottom: 14 }}>
          {t("dashboard.savedEmpty")}
        </div>
      ))}

      {(activeOpportunityTab === "overview" || activeOpportunityTab === "marketplace") && (
      <div
        style={{
          marginTop: 14,
          background: cardBg,
          border: panelBorder,
          borderRadius: 14,
          padding: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--gris-500)", letterSpacing: "0.6px" }}>{t("dashboard.savedCatalogLabel")}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: titleText }}>{t("dashboard.savedCatalogTitle")}</div>
          </div>
          <button
            type="button"
            onClick={() => setShowCatalogAdmin((prev) => !prev)}
            style={{
              background: "rgba(94,94,89,0.16)",
              border: "1px solid rgba(207,207,200,0.24)",
              color: "var(--gris-600)",
              padding: "9px 11px",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {showCatalogAdmin ? t("dashboard.savedCatalogClose") : t("dashboard.savedManageCatalog")}
          </button>
        </div>

        {showCatalogAdmin && (
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(180px,1fr))" }}>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: "var(--gris-700)" }}>
                Marca existente
                <select
                  value={catalogAdminForm.brand}
                  onChange={(event) => setCatalogAdminForm((prev) => ({ ...prev, brand: event.target.value, model: "" }))}
                  style={{ background: inputBg, color: inputText, border: "1px solid rgba(150,150,143,0.45)", borderRadius: 10, padding: "10px 12px" }}
                >
                  <option value="">Selecciona marca</option>
                  {brandOptions.map((brand) => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: "var(--gris-700)" }}>
                Modelo existente
                <select
                  value={catalogAdminForm.model}
                  onChange={(event) => setCatalogAdminForm((prev) => ({ ...prev, model: event.target.value }))}
                  disabled={!catalogAdminForm.brand}
                  style={{ background: inputBg, color: inputText, border: "1px solid rgba(150,150,143,0.45)", borderRadius: 10, padding: "10px 12px" }}
                >
                  <option value="">Selecciona modelo</option>
                  {(catalogBrandsMap[catalogAdminForm.brand] || []).map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: "var(--gris-700)" }}>
                Nueva marca
                <input
                  value={catalogAdminForm.newBrand}
                  onChange={(event) => setCatalogAdminForm((prev) => ({ ...prev, newBrand: event.target.value }))}
                  placeholder="Ejemplo: Ford"
                  style={{ background: inputBg, color: inputText, border: "1px solid rgba(150,150,143,0.45)", borderRadius: 10, padding: "10px 12px" }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: "var(--gris-700)" }}>
                Nuevo modelo
                <input
                  value={catalogAdminForm.newModel}
                  onChange={(event) => setCatalogAdminForm((prev) => ({ ...prev, newModel: event.target.value }))}
                  placeholder="Ejemplo: Focus"
                  style={{ background: inputBg, color: inputText, border: "1px solid rgba(150,150,143,0.45)", borderRadius: 10, padding: "10px 12px" }}
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", width: isMobile ? "100%" : "auto" }}>
              <button
                type="button"
                disabled={catalogAdminLoading || !String(catalogAdminForm.newBrand || "").trim()}
                onClick={() => handleCatalogAdminMutation("upsert_brand", { brand: catalogAdminForm.newBrand })}
                style={{
                  background: "rgba(16,185,129,0.12)",
                  border: "1px solid rgba(110,231,183,0.22)",
                  color: "#065f46",
                  padding: "8px 10px",
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: catalogAdminLoading ? "progress" : "pointer",
                  width: isMobile ? "100%" : "auto",
                }}
              >{t("dashboard.savedCatalogAddBrand")}</button>
              <button
                type="button"
                disabled={catalogAdminLoading || !String(catalogAdminForm.newBrand || "").trim() || !String(catalogAdminForm.newModel || "").trim()}
                onClick={() => handleCatalogAdminMutation("upsert_model", { brand: catalogAdminForm.newBrand, model: catalogAdminForm.newModel })}
                style={{
                  background: "rgba(255,196,0,0.14)",
                  border: "1px solid rgba(255,196,0,0.24)",
                  color: "var(--gris-900)",
                  padding: "8px 10px",
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: catalogAdminLoading ? "progress" : "pointer",
                  width: isMobile ? "100%" : "auto",
                }}
              >{t("dashboard.savedCatalogAddModel")}</button>
              <button
                type="button"
                disabled={catalogAdminLoading || !catalogAdminForm.brand || !catalogAdminForm.model}
                onClick={() => handleCatalogAdminMutation("delete_model", { brand: catalogAdminForm.brand, model: catalogAdminForm.model })}
                style={{
                  background: "rgba(245,158,11,0.14)",
                  border: "1px solid rgba(251,191,36,0.22)",
                  color: "#92400e",
                  padding: "8px 10px",
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: catalogAdminLoading ? "progress" : "pointer",
                  width: isMobile ? "100%" : "auto",
                }}
              >
                Quitar modelo
              </button>
              <button
                type="button"
                disabled={catalogAdminLoading || !catalogAdminForm.brand}
                onClick={() => handleCatalogAdminMutation("delete_brand", { brand: catalogAdminForm.brand })}
                style={{
                  background: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(248,113,113,0.18)",
                  color: "#b91c1c",
                  padding: "8px 10px",
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: catalogAdminLoading ? "progress" : "pointer",
                  width: isMobile ? "100%" : "auto",
                }}
              >
                Quitar marca
              </button>
            </div>

            {catalogAdminFeedback && (
              <div style={{ fontSize: 12, color: "var(--gris-500)" }}>{catalogAdminFeedback}</div>
            )}
          </div>
        )}
      </div>
      )}

    </section>
  );
}
