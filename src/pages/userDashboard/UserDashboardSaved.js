import { useEffect, useMemo, useState } from "react";
import { MARKET_BRANDS } from "../../data/marketData";
import { getVehicleCatalogJson, postVehicleCatalogAdminJson } from "../../utils/apiClient";

const EMPTY_ALERT_FORM = {
  mode: "ambos",
  brand: "",
  model: "",
  maxPrice: "",
  maxMileage: "",
  fuel: "",
  location: "",
  color: "",
  notifyByEmail: false,
  email: "",
};

function buildAlertChips(alert, formatCurrency) {
  return [
    alert?.modeLabel,
    alert?.brand ? `Marca ${alert.brand}` : "",
    alert?.model ? `Modelo ${alert.model}` : "",
    alert?.maxPrice ? `Hasta ${formatCurrency(Number(alert.maxPrice))}` : "",
    alert?.maxMileage ? `Hasta ${Number(alert.maxMileage).toLocaleString("es-ES")} km` : "",
    alert?.fuel || "",
    alert?.location ? `Zona ${alert.location}` : "",
    alert?.color ? `Color ${alert.color}` : "",
    alert?.notifyByEmail && alert?.email ? `Email ${alert.email}` : "",
  ].filter(Boolean);
}

function inferAlertDraftFromSaved(item = {}) {
  const seedText = `${item?.listingTitle || item?.title || ""}`.trim();
  const [brand = "", ...modelParts] = seedText.split(" ").filter(Boolean);

  return {
    mode: String(item?.typeKey || "").includes("renting") ? "renting" : "compra",
    brand,
    model: modelParts.slice(0, 2).join(" "),
    maxPrice: item?.monthlyTotal > 0 ? String(Math.round(item.monthlyTotal)) : "",
    maxMileage: "",
    fuel: "",
    location: "",
    color: "",
    notifyByEmail: false,
    email: "",
  };
}

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
}) {
  const isDark = themeMode === "dark";
  const cardBg = isDark
    ? "linear-gradient(160deg, rgba(15,23,42,0.9), rgba(30,41,59,0.82))"
    : "linear-gradient(160deg, rgba(255,255,255,0.96), rgba(241,245,249,0.92))";
  const inputBg = isDark ? "#0f1b2d" : "#ffffff";
  const inputText = isDark ? "#f8fafc" : "#0f172a";
  const mutedText = isDark ? "#cbd5e1" : "#475569";
  const titleText = isDark ? "#f8fafc" : "#0f172a";

  const [showAlertForm, setShowAlertForm] = useState(false);
  const [alertForm, setAlertForm] = useState(EMPTY_ALERT_FORM);
  const [alertFeedback, setAlertFeedback] = useState("");
  const [showCatalogAdmin, setShowCatalogAdmin] = useState(false);
  const [catalogAdminLoading, setCatalogAdminLoading] = useState(false);
  const [catalogAdminFeedback, setCatalogAdminFeedback] = useState("");
  const [catalogAdminForm, setCatalogAdminForm] = useState({
    brand: "",
    model: "",
    newBrand: "",
    newModel: "",
  });
  const [catalogBrandsMap, setCatalogBrandsMap] = useState(MARKET_BRANDS);
  const brandOptions = useMemo(() => Object.keys(catalogBrandsMap).sort((a, b) => a.localeCompare(b, "es")), [catalogBrandsMap]);
  const modelOptions = useMemo(
    () => (alertForm.brand && Array.isArray(catalogBrandsMap[alertForm.brand]) ? catalogBrandsMap[alertForm.brand] : []),
    [alertForm.brand, catalogBrandsMap]
  );
  const selectedBrandInCatalog = Boolean(alertForm.brand && catalogBrandsMap[alertForm.brand]);
  const selectedModelInCatalog = Boolean(alertForm.model && modelOptions.includes(alertForm.model));
  const normalizedCurrentUserEmail = String(currentUserEmail || "").trim().toLowerCase();
  const emailAlertCount = useMemo(
    () => marketAlerts.filter((alert) => alert?.notifyByEmail && String(alert?.email || normalizedCurrentUserEmail || "").trim()).length,
    [marketAlerts, normalizedCurrentUserEmail]
  );
  const totalNewMatches = marketAlerts.reduce((acc, alert) => {
    const matchInfo = marketAlertMatches?.[alert.id] || { count: 0 };
    const seenCount = Number(marketAlertStatus?.[alert.id]?.seenCount || 0);
    return acc + Math.max(Number(matchInfo.count || 0) - seenCount, 0);
  }, 0);

  const loadVehicleCatalog = async () => {
    try {
      const { data } = await getVehicleCatalogJson();
      const nextCatalog = mapCatalogBrandsFromApi(data);

      if (Object.keys(nextCatalog).length > 0) {
        setCatalogBrandsMap(nextCatalog);
      }
    } catch {
      // Keep static catalog fallback if backend endpoint is unavailable.
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
        // Keep static catalog fallback if backend endpoint is unavailable.
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

  useEffect(() => {
    if (!normalizedCurrentUserEmail) {
      return;
    }

    setAlertForm((prev) => {
      if (!prev.notifyByEmail || String(prev.email || "").trim()) {
        return prev;
      }

      return {
        ...prev,
        email: normalizedCurrentUserEmail,
      };
    });
  }, [normalizedCurrentUserEmail]);

  const updateAlertField = (key, value) => {
    setAlertForm((prev) => {
      if (key === "brand") {
        const nextBrand = String(value || "");
        const nextModels = Array.isArray(catalogBrandsMap[nextBrand]) ? catalogBrandsMap[nextBrand] : [];
        const nextModel = nextModels.includes(prev.model) ? prev.model : "";

        return {
          ...prev,
          brand: nextBrand,
          model: nextModel,
        };
      }

      if (key === "notifyByEmail") {
        return {
          ...prev,
          notifyByEmail: Boolean(value),
          email: value ? String(prev.email || normalizedCurrentUserEmail || "").trim().toLowerCase() : prev.email,
        };
      }

      return { ...prev, [key]: value };
    });
  };

  const handleCreateAlert = () => {
    if (alertForm.notifyByEmail && !String(alertForm.email || normalizedCurrentUserEmail || "").trim()) {
      setAlertFeedback("Inicia sesión o indica un correo para activar el aviso por email de esta alerta.");
      return;
    }

    const createdAlert = onCreateMarketAlert(alertForm);

    if (!createdAlert) {
      setAlertFeedback("No se pudo guardar la alerta. Revisa los filtros y vuelve a intentarlo.");
      return;
    }

    setAlertFeedback(
      createdAlert.notifyByEmail && createdAlert.email
        ? `Alerta guardada con resumen por email para ${createdAlert.email}.`
        : "Alerta guardada: te avisaremos aquí cuando aparezcan ofertas nuevas que encajen."
    );
    setShowAlertForm(false);
    setAlertForm(EMPTY_ALERT_FORM);
    window.setTimeout(() => setAlertFeedback(""), 2400);
  };

  const handleSeedAlertFromSaved = (item) => {
    setAlertForm((prev) => ({
      ...prev,
      ...inferAlertDraftFromSaved(item),
    }));
    setShowAlertForm(true);
  };

  const handleCatalogAdminMutation = async (action, payload = {}) => {
    setCatalogAdminLoading(true);
    setCatalogAdminFeedback("");

    try {
      const { response, data } = await postVehicleCatalogAdminJson({
        action,
        ...payload,
      });

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo actualizar el catálogo.");
      }

      await loadVehicleCatalog();
      setCatalogAdminFeedback("Catálogo actualizado correctamente.");
      window.setTimeout(() => setCatalogAdminFeedback(""), 2200);
      setCatalogAdminForm((prev) => ({
        ...prev,
        newBrand: "",
        newModel: "",
      }));
    } catch (error) {
      setCatalogAdminFeedback(error instanceof Error ? error.message : "No se pudo actualizar el catálogo.");
    } finally {
      setCatalogAdminLoading(false);
    }
  };

  return (
    <section id="user-dashboard-saved" style={{ ...panelStyle, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#60a5fa", letterSpacing: "0.6px" }}>RECOMENDACIONES GUARDADAS</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: titleText }}>Tus comparativas, ofertas favoritas y alertas</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={{ ...getOfferBadgeStyle("info"), fontSize: 11 }}>{savedComparisons.length} guardadas</span>
          <span style={{ ...getOfferBadgeStyle("success"), fontSize: 11 }}>{marketAlerts.length} alertas activas</span>
        </div>
      </div>

      {savedComparisons.length > 0 ? (
        <div style={{ display: "grid", gap: 10 }}>
          {savedComparisons.map((item) => {
            const savedOfferHref = getSavedComparisonHref(item);

            return (
              <div
                key={item.id}
                style={{
                  background: cardBg,
                  border: "1px solid rgba(148,163,184,0.26)",
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: titleText }}>{item.title}</div>
                    <div style={{ fontSize: 11, color: mutedText, marginTop: 3 }}>
                      {item.typeLabel} · {item.savedAt}
                    </div>
                    <div style={{ fontSize: 11, color: "#2563eb", marginTop: 3 }}>
                      {item.monthlyTotal > 0 ? `${formatCurrency(item.monthlyTotal)}/mes` : item.budgetLabel || "Sin cuota definida"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {savedOfferHref && (
                      <button
                        type="button"
                        onClick={() => onOpenOffer(savedOfferHref)}
                        style={{
                          background: "rgba(37,99,235,0.12)",
                          border: "1px solid rgba(96,165,250,0.2)",
                          color: "#1e3a8a",
                          padding: "8px 10px",
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Abrir oferta ↗
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSeedAlertFromSaved(item)}
                      style={{
                        background: "rgba(16,185,129,0.12)",
                        border: "1px solid rgba(110,231,183,0.2)",
                        color: "#065f46",
                        padding: "8px 10px",
                        borderRadius: 10,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Crear alerta similar
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
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>
          Todavía no tienes recomendaciones guardadas. Cuando guardes una comparativa, aparecerá aquí.
        </div>
      )}

      <div
        style={{
          marginTop: 14,
          background: cardBg,
          border: "1px solid rgba(148,163,184,0.26)",
          borderRadius: 14,
          padding: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: "#7c3aed", letterSpacing: "0.6px" }}>CATÁLOGO DE MARCAS Y MODELOS</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: titleText }}>Gestiona el selector de marca/modelo</div>
          </div>
          <button
            type="button"
            onClick={() => setShowCatalogAdmin((prev) => !prev)}
            style={{
              background: "rgba(124,58,237,0.16)",
              border: "1px solid rgba(196,181,253,0.24)",
              color: "#5b21b6",
              padding: "9px 11px",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {showCatalogAdmin ? "Cerrar" : "Gestionar catálogo"}
          </button>
        </div>

        {showCatalogAdmin && (
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#334155" }}>
                Marca existente
                <select
                  value={catalogAdminForm.brand}
                  onChange={(event) => setCatalogAdminForm((prev) => ({ ...prev, brand: event.target.value, model: "" }))}
                  style={{ background: inputBg, color: inputText, border: "1px solid rgba(148,163,184,0.45)", borderRadius: 10, padding: "10px 12px" }}
                >
                  <option value="">Selecciona marca</option>
                  {brandOptions.map((brand) => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#334155" }}>
                Modelo existente
                <select
                  value={catalogAdminForm.model}
                  onChange={(event) => setCatalogAdminForm((prev) => ({ ...prev, model: event.target.value }))}
                  disabled={!catalogAdminForm.brand}
                  style={{ background: inputBg, color: inputText, border: "1px solid rgba(148,163,184,0.45)", borderRadius: 10, padding: "10px 12px" }}
                >
                  <option value="">Selecciona modelo</option>
                  {(catalogBrandsMap[catalogAdminForm.brand] || []).map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#334155" }}>
                Nueva marca
                <input
                  value={catalogAdminForm.newBrand}
                  onChange={(event) => setCatalogAdminForm((prev) => ({ ...prev, newBrand: event.target.value }))}
                  placeholder="Ejemplo: Ford"
                  style={{ background: inputBg, color: inputText, border: "1px solid rgba(148,163,184,0.45)", borderRadius: 10, padding: "10px 12px" }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#334155" }}>
                Nuevo modelo
                <input
                  value={catalogAdminForm.newModel}
                  onChange={(event) => setCatalogAdminForm((prev) => ({ ...prev, newModel: event.target.value }))}
                  placeholder="Ejemplo: Focus"
                  style={{ background: inputBg, color: inputText, border: "1px solid rgba(148,163,184,0.45)", borderRadius: 10, padding: "10px 12px" }}
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
                }}
              >
                Añadir marca
              </button>
              <button
                type="button"
                disabled={catalogAdminLoading || !String(catalogAdminForm.newBrand || "").trim() || !String(catalogAdminForm.newModel || "").trim()}
                onClick={() => handleCatalogAdminMutation("upsert_model", { brand: catalogAdminForm.newBrand, model: catalogAdminForm.newModel })}
                style={{
                  background: "rgba(37,99,235,0.14)",
                  border: "1px solid rgba(96,165,250,0.24)",
                  color: "#1e3a8a",
                  padding: "8px 10px",
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: catalogAdminLoading ? "progress" : "pointer",
                }}
              >
                Añadir modelo
              </button>
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
                }}
              >
                Quitar marca
              </button>
            </div>

            {catalogAdminFeedback && (
              <div style={{ fontSize: 12, color: "#6d28d9" }}>{catalogAdminFeedback}</div>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: 16,
          background: cardBg,
          border: "1px solid rgba(148,163,184,0.26)",
          borderRadius: 14,
          padding: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: "#047857", letterSpacing: "0.6px" }}>ALERTAS DE MERCADO</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: titleText }}>
              Sigue nuevas ofertas con tus filtros
            </div>
            <div style={{ fontSize: 12, color: mutedText, marginTop: 4 }}>
              Activa alertas para compra o renting por marca, modelo, precio, kilometraje, combustible, localización o color.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onSendAlertEmailDigest}
              disabled={emailAlertCount === 0 || emailDigestLoading}
              style={{
                background: emailAlertCount > 0 ? "rgba(99,102,241,0.16)" : "rgba(148,163,184,0.12)",
                border: emailAlertCount > 0 ? "1px solid rgba(165,180,252,0.24)" : "1px solid rgba(148,163,184,0.18)",
                color: emailAlertCount > 0 ? "#312e81" : "#64748b",
                padding: "10px 12px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 800,
                cursor: emailAlertCount > 0 && !emailDigestLoading ? "pointer" : "not-allowed",
                opacity: emailAlertCount > 0 || emailDigestLoading ? 1 : 0.82,
              }}
            >
              {emailDigestLoading ? "Enviando…" : "Enviar resumen por email"}
            </button>
            <button
              type="button"
              onClick={() => setShowAlertForm((prev) => !prev)}
              style={{
                background: "linear-gradient(135deg,#10b981,#059669)",
                border: "none",
                color: "white",
                padding: "10px 12px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {showAlertForm ? "Cerrar" : "Añadir alerta"}
            </button>
          </div>
        </div>

        {showAlertForm && (
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", marginBottom: 12 }}>
            <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#334155" }}>
              Tipo de oferta
              <select value={alertForm.mode} onChange={(event) => updateAlertField("mode", event.target.value)} style={{ background: inputBg, color: inputText, border: "1px solid rgba(148,163,184,0.45)", borderRadius: 10, padding: "10px 12px" }}>
                <option value="ambos">Compra o renting</option>
                <option value="compra">Compra</option>
                <option value="renting">Renting</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#334155" }}>
              Marca
              <select
                value={selectedBrandInCatalog ? alertForm.brand : ""}
                onChange={(event) => updateAlertField("brand", event.target.value)}
                style={{ background: inputBg, color: inputText, border: "1px solid rgba(148,163,184,0.45)", borderRadius: 10, padding: "10px 12px" }}
              >
                <option value="">Todas las marcas</option>
                {brandOptions.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
              {!selectedBrandInCatalog && alertForm.brand && (
                <div style={{ fontSize: 11, color: "#1d4ed8" }}>
                  Marca guardada fuera del catálogo: <strong>{alertForm.brand}</strong>
                </div>
              )}
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#334155" }}>
              Modelo
              <select
                value={selectedModelInCatalog ? alertForm.model : ""}
                onChange={(event) => updateAlertField("model", event.target.value)}
                disabled={!alertForm.brand}
                style={{ background: inputBg, color: inputText, border: "1px solid rgba(148,163,184,0.45)", borderRadius: 10, padding: "10px 12px" }}
              >
                <option value="">{alertForm.brand ? "Todos los modelos" : "Selecciona marca antes"}</option>
                {modelOptions.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
              {!selectedModelInCatalog && alertForm.model && (
                <div style={{ fontSize: 11, color: "#1d4ed8" }}>
                  Modelo guardado fuera del catálogo: <strong>{alertForm.model}</strong>
                </div>
              )}
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#334155" }}>
              Precio máximo (€)
              <input type="number" value={alertForm.maxPrice} onChange={(event) => updateAlertField("maxPrice", event.target.value)} placeholder="25000" style={{ background: inputBg, color: inputText, border: "1px solid rgba(148,163,184,0.45)", borderRadius: 10, padding: "10px 12px" }} />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#334155" }}>
              Kilometraje máximo
              <input type="number" value={alertForm.maxMileage} onChange={(event) => updateAlertField("maxMileage", event.target.value)} placeholder="60000" style={{ background: inputBg, color: inputText, border: "1px solid rgba(148,163,184,0.45)", borderRadius: 10, padding: "10px 12px" }} />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#334155" }}>
              Combustible
              <select value={alertForm.fuel} onChange={(event) => updateAlertField("fuel", event.target.value)} style={{ background: inputBg, color: inputText, border: "1px solid rgba(148,163,184,0.45)", borderRadius: 10, padding: "10px 12px" }}>
                <option value="">Cualquiera</option>
                <option value="Gasolina">Gasolina</option>
                <option value="Diésel">Diésel</option>
                <option value="Híbrido">Híbrido</option>
                <option value="PHEV">PHEV</option>
                <option value="Eléctrico">Eléctrico</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#334155" }}>
              Localización
              <input value={alertForm.location} onChange={(event) => updateAlertField("location", event.target.value)} placeholder="Madrid, Valencia, Bilbao..." style={{ background: inputBg, color: inputText, border: "1px solid rgba(148,163,184,0.45)", borderRadius: 10, padding: "10px 12px" }} />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#334155" }}>
              Color
              <input value={alertForm.color} onChange={(event) => updateAlertField("color", event.target.value)} placeholder="Blanco, gris, azul..." style={{ background: inputBg, color: inputText, border: "1px solid rgba(148,163,184,0.45)", borderRadius: 10, padding: "10px 12px" }} />
            </label>
            <label style={{ display: "grid", gap: 8, fontSize: 12, color: "#334155", alignContent: "start" }}>
              <span>Aviso por email</span>
              <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 12, color: "#334155", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={Boolean(alertForm.notifyByEmail)}
                  onChange={(event) => updateAlertField("notifyByEmail", event.target.checked)}
                />
                Enviarme también un resumen por email
              </label>
              {alertForm.notifyByEmail && (
                <>
                  {normalizedCurrentUserEmail && (
                    <div style={{ fontSize: 11, color: "#1d4ed8" }}>
                      Se enviará al email de tu cuenta: <strong>{normalizedCurrentUserEmail}</strong>
                    </div>
                  )}
                  <input
                    type="email"
                    value={alertForm.email}
                    onChange={(event) => updateAlertField("email", event.target.value)}
                    placeholder="nombre@correo.com"
                    style={{ background: inputBg, color: inputText, border: "1px solid rgba(148,163,184,0.45)", borderRadius: 10, padding: "10px 12px" }}
                  />
                </>
              )}
            </label>
          </div>
        )}

        {showAlertForm && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "#1d4ed8" }}>
              Puedes mezclar filtros de compra/renting, marca, modelo, precio, kilometraje, combustible, localización y color, y añadir un aviso por email.
            </div>
            <button
              type="button"
              onClick={handleCreateAlert}
              style={{
                background: "rgba(37,99,235,0.14)",
                border: "1px solid rgba(96,165,250,0.24)",
                color: "#1e3a8a",
                padding: "9px 12px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Guardar alerta
            </button>
          </div>
        )}

        {emailAlertCount === 0 && (
          <div style={{ marginBottom: 12, fontSize: 11, color: "#94a3b8" }}>
            Activa <strong>"Enviarme también un resumen por email"</strong> al crear una alerta para habilitar este botón aquí mismo.
            {normalizedCurrentUserEmail ? ` Usaremos tu cuenta ${normalizedCurrentUserEmail} como destinatario por defecto.` : ""}
          </div>
        )}

        {(alertFeedback || emailDigestFeedback) && (
          <div style={{ marginBottom: 12, fontSize: 12, color: "#1d4ed8" }}>
            {emailDigestFeedback || alertFeedback}
          </div>
        )}

        {totalNewMatches > 0 && (
          <div
            style={{
              marginBottom: 12,
              background: "rgba(16,185,129,0.10)",
              border: "1px solid rgba(110,231,183,0.18)",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 12,
              color: "#065f46",
              fontWeight: 700,
            }}
          >
            🔔 Tienes {totalNewMatches} {totalNewMatches === 1 ? "novedad pendiente" : "novedades pendientes"} en tus alertas de mercado.
          </div>
        )}

        {marketAlerts.length > 0 ? (
          <div style={{ display: "grid", gap: 10 }}>
            {marketAlerts.map((alert) => {
              const alertEmail = String(alert?.email || normalizedCurrentUserEmail || "").trim().toLowerCase();
              const alertChips = buildAlertChips({ ...alert, email: alertEmail }, formatCurrency);
              const alertMatchInfo = marketAlertMatches?.[alert.id] || { count: 0, matches: [] };
              const seenCount = Number(marketAlertStatus?.[alert.id]?.seenCount || 0);
              const newMatchesCount = Math.max(Number(alertMatchInfo.count || 0) - seenCount, 0);

              return (
                <div
                  key={alert.id}
                  style={{
                    background: cardBg,
                    border: "1px solid rgba(110,231,183,0.14)",
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: titleText }}>{alert.title}</div>
                      <div style={{ fontSize: 11, color: mutedText, marginTop: 3 }}>
                        {alert.createdAt} · {alert.status || "Activa"}
                      </div>
                      {alert.notifyByEmail && alertEmail && (
                        <div style={{ fontSize: 11, color: "#1d4ed8", marginTop: 4 }}>
                          📧 Resumen por email a {alertEmail}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
                        {newMatchesCount > 0 ? (
                          <span
                            style={{
                              background: "rgba(16,185,129,0.16)",
                              border: "1px solid rgba(110,231,183,0.2)",
                              color: "#065f46",
                              padding: "4px 8px",
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 800,
                            }}
                          >
                            🔔 {newMatchesCount} {newMatchesCount === 1 ? "novedad" : "novedades"}
                          </span>
                        ) : (
                          <span
                            style={{
                              background: "rgba(148,163,184,0.12)",
                              border: "1px solid rgba(148,163,184,0.18)",
                              color: "#475569",
                              padding: "4px 8px",
                              borderRadius: 999,
                              fontSize: 11,
                            }}
                          >
                            Sin novedades pendientes
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                        {alertChips.map((chip) => (
                          <span
                            key={`${alert.id}-${chip}`}
                            style={{
                              background: "rgba(37,99,235,0.10)",
                              border: "1px solid rgba(96,165,250,0.18)",
                              color: "#1e3a8a",
                              padding: "4px 8px",
                              borderRadius: 999,
                              fontSize: 11,
                            }}
                          >
                            {chip}
                          </span>
                        ))}
                      </div>

                      <div
                        style={{
                          marginTop: 10,
                          background: isDark ? "rgba(15,23,42,0.86)" : "rgba(255,255,255,0.9)",
                          border: "1px solid rgba(148,163,184,0.24)",
                          borderRadius: 10,
                          padding: 10,
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#1d4ed8", letterSpacing: "0.4px", marginBottom: 6 }}>
                          {alertMatchInfo.count === 1 ? "1 coincidencia ahora" : `${alertMatchInfo.count} coincidencias ahora`}
                        </div>
                        {alertMatchInfo.count > 0 ? (
                          <div style={{ display: "grid", gap: 8 }}>
                            {alertMatchInfo.matches.map((offer) => (
                              <div
                                key={`${alert.id}-${offer.id}`}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: 10,
                                  flexWrap: "wrap",
                                  alignItems: "center",
                                  background: isDark ? "rgba(15,23,42,0.88)" : "rgba(241,245,249,0.9)",
                                  border: isDark ? "1px solid rgba(148,163,184,0.24)" : "none",
                                  borderRadius: 10,
                                  padding: "8px 10px",
                                }}
                              >
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: titleText }}>{offer.title}</div>
                                  <div style={{ fontSize: 11, color: mutedText, marginTop: 2 }}>
                                    {alert.mode === "renting" && Number(offer.rentingMonthly || 0) > 0
                                      ? `${formatCurrency(offer.rentingMonthly)}/mes`
                                      : formatCurrency(offer.price)}
                                    {offer.location ? ` · ${offer.location}` : ""}
                                    {Number(offer.mileage || 0) > 0
                                      ? ` · ${Number(offer.mileage || 0).toLocaleString("es-ES")} km`
                                      : ""}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onMarkAlertSeen(alert.id, alertMatchInfo.count);
                                    if (offer?.id) {
                                      onOpenMarketplaceOffer(offer);
                                      return;
                                    }

                                    if (offer?.url) {
                                      onOpenOffer(offer.url);
                                      return;
                                    }

                                    onBrowseMarketplace(alert);
                                  }}
                                  style={{
                                    background: "rgba(37,99,235,0.12)",
                                    border: "1px solid rgba(96,165,250,0.2)",
                                    color: "#1e3a8a",
                                    padding: "8px 10px",
                                    borderRadius: 10,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  Ver oferta ↗
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>
                            Aún no vemos coincidencias en el marketplace VO con estos filtros. Seguimos vigilando el mercado.
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {alertMatchInfo.count > 0 && newMatchesCount > 0 && (
                        <button
                          type="button"
                          onClick={() => onMarkAlertSeen(alert.id, alertMatchInfo.count)}
                          style={{
                            background: "rgba(245,158,11,0.12)",
                            border: "1px solid rgba(251,191,36,0.18)",
                            color: "#92400e",
                            padding: "8px 10px",
                            borderRadius: 10,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Marcar como revisada
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          onMarkAlertSeen(alert.id, alertMatchInfo.count);
                          onBrowseMarketplace(alert);
                        }}
                        style={{
                          background: "rgba(16,185,129,0.12)",
                          border: "1px solid rgba(110,231,183,0.2)",
                          color: "#065f46",
                          padding: "8px 10px",
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Explorar en marketplace
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveMarketAlert(alert.id)}
                        style={{
                          background: "rgba(239,68,68,0.12)",
                          border: "1px solid rgba(248,113,113,0.18)",
                          color: "#b91c1c",
                          padding: "8px 10px",
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Eliminar alerta
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#94a3b8" }}>
            Todavía no tienes alertas activas. Crea una y deja vigilado el mercado para compra o renting con los filtros que necesites.
          </div>
        )}
      </div>
    </section>
  );
}
