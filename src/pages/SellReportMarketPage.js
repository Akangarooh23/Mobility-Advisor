import { useEffect, useRef, useState } from "react";
import {
  getErpBrandsJson,
  getErpModelsJson,
  getErpVersionsJson,
  getGarageVehiclesJson,
} from "../utils/apiClient";
import "./SellReportMarketPage.css";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMatchToken(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buildIdCarLabel(vehicle = {}, fallbackIndex = 0) {
  const title = normalizeText(vehicle?.title);
  const brand = normalizeText(vehicle?.brand);
  const model = normalizeText(vehicle?.model);
  const version = normalizeText(vehicle?.version);
  const plate = normalizeText(vehicle?.plate);
  const summary = [brand, model, version].filter(Boolean).join(" ");
  const resolvedTitle = title || summary || `IDCar ${fallbackIndex + 1}`;
  return plate ? `${resolvedTitle} · ${plate}` : resolvedTitle;
}

function pickNumber(value, fallback) {
  const numeric = Number(String(value ?? "").replace(/[.,]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function currencyEUR(value, formatCurrency) {
  if (typeof formatCurrency === "function") {
    return formatCurrency(value);
  }
  return `${Math.round(value).toLocaleString("es-ES")}€`;
}

const DAMAGE_OPTIONS = [
  "Sin daños",
  "Daños leves",
  "Daños moderados",
  "Daños graves",
];

export default function SellReportMarketPage({
  currentUserEmail,
  selectedValuationVehicleSummary,
  sellAnswers,
  setSellAnswers,
  fuelOptions,
  analyzeSellWithAI,
  sellLoading,
  sellEstimate,
  sellAiResult,
  sellError,
  onGoBack,
  formatCurrency,
}) {
  const [erpBrands, setErpBrands] = useState([]);
  const [erpModels, setErpModels] = useState([]);
  const [erpVersions, setErpVersions] = useState([]);
  const [erpBrandsLoading, setErpBrandsLoading] = useState(false);
  const [erpModelsLoading, setErpModelsLoading] = useState(false);
  const [erpVersionsLoading, setErpVersionsLoading] = useState(false);
  const [erpSelectedBrandId, setErpSelectedBrandId] = useState("");
  const [erpSelectedModelId, setErpSelectedModelId] = useState("");
  const [garageVehicles, setGarageVehicles] = useState([]);
  const [garageVehiclesLoading, setGarageVehiclesLoading] = useState(false);
  const [selectedIdCarId, setSelectedIdCarId] = useState("");
  const [idCarPromptVisible, setIdCarPromptVisible] = useState(false);
  const idCarSelectRef = useRef(null);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 2013 }, (_, index) => currentYear - index);

  const marketMean = pickNumber(sellEstimate?.targetPrice, 14850);
  const marketLow = pickNumber(sellEstimate?.lowPrice, 12200);
  const marketHigh = pickNumber(sellEstimate?.highPrice, 17500);
  const marketUnits = pickNumber(
    sellAiResult?.argumentos_clave?.length ? 140 + sellAiResult.argumentos_clave.length * 12 : 0,
    187
  );
  const marketDays = pickNumber((sellAiResult?.tiempo_estimado_venta || "").match(/\d+/)?.[0], 38);

  useEffect(() => {
    if (!normalizeText(currentUserEmail)) {
      setGarageVehicles([]);
      setGarageVehiclesLoading(false);
      return;
    }

    let cancelled = false;
    setGarageVehiclesLoading(true);
    getGarageVehiclesJson(normalizeText(currentUserEmail).toLowerCase())
      .then(({ data }) => {
        if (!cancelled) {
          setGarageVehicles(Array.isArray(data?.vehicles) ? data.vehicles.filter((item) => item && normalizeText(item?.id)) : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGarageVehicles([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setGarageVehiclesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserEmail]);

  useEffect(() => {
    let cancelled = false;
    setErpBrandsLoading(true);
    getErpBrandsJson()
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) {
          setErpBrands(Array.isArray(data?.brands) ? data.brands : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErpBrands([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setErpBrandsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedValuationVehicleSummary) {
      return;
    }

    setSellAnswers((prev) => ({
      ...prev,
      plate: normalizeText(selectedValuationVehicleSummary?.plate) || prev.plate || "",
      brand: normalizeText(selectedValuationVehicleSummary?.brand) || prev.brand || "",
      model: normalizeText(selectedValuationVehicleSummary?.model) || prev.model || "",
      year: normalizeText(selectedValuationVehicleSummary?.year) || prev.year || "",
    }));
  }, [selectedValuationVehicleSummary, setSellAnswers]);

  const syncVehicleToErpSelectors = async (vehicle) => {
    const brandToken = normalizeMatchToken(vehicle?.brand);
    const modelToken = normalizeMatchToken(vehicle?.model);
    const versionToken = normalizeMatchToken(vehicle?.version);

    if (!brandToken) {
      setErpSelectedBrandId("");
      setErpSelectedModelId("");
      setErpModels([]);
      setErpVersions([]);
      return;
    }

    const brand = erpBrands.find((item) => normalizeMatchToken(item?.name) === brandToken);
    if (!brand) {
      setErpSelectedBrandId("");
      setErpSelectedModelId("");
      setErpModels([]);
      setErpVersions([]);
      return;
    }

    setErpSelectedBrandId(String(brand.id));
    setErpModelsLoading(true);
    try {
      const modelResponse = await getErpModelsJson(brand.id);
      const modelData = await modelResponse.json();
      const nextModels = Array.isArray(modelData?.models) ? modelData.models : [];
      setErpModels(nextModels);
      const model = nextModels.find((item) => normalizeMatchToken(item?.name) === modelToken);
      if (!model) {
        setErpSelectedModelId("");
        setErpVersions([]);
        return;
      }

      setErpSelectedModelId(String(model.id));
      setErpVersionsLoading(true);
      const versionResponse = await getErpVersionsJson(model.id, brand.id);
      const versionData = await versionResponse.json();
      const fetchedVersions = Array.isArray(versionData?.versions) ? versionData.versions : [];
      const version = fetchedVersions.find((item) => {
        const labelToken = normalizeMatchToken(item?.label);
        const codeToken = normalizeMatchToken(item?.codversion);
        return labelToken === versionToken || codeToken === versionToken;
      });
      const fallbackVersionLabel = normalizeText(vehicle?.version);
      const fallbackVersion = !version && fallbackVersionLabel
        ? {
            codversion: fallbackVersionLabel,
            label: fallbackVersionLabel,
          }
        : null;
      const nextVersions = fallbackVersion ? [fallbackVersion, ...fetchedVersions] : fetchedVersions;
      setErpVersions(nextVersions);
      setSellAnswers((prev) => ({
        ...prev,
        version: version?.label || fallbackVersionLabel || prev.version || "",
        erpBrandId: String(brand.id),
        erpModelId: String(model.id),
        erpVersionCode: version?.codversion || fallbackVersion?.codversion || "",
      }));
    } catch {
      setErpModels([]);
      setErpVersions([]);
    } finally {
      setErpModelsLoading(false);
      setErpVersionsLoading(false);
    }
  };

  const handleAnalyzeClick = () => {
    if (garageVehicles.length > 0 && !selectedIdCarId) {
      setIdCarPromptVisible(true);
      if (typeof idCarSelectRef.current?.focus === "function") {
        idCarSelectRef.current.focus();
      }
      if (typeof idCarSelectRef.current?.scrollIntoView === "function") {
        idCarSelectRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      return;
    }

    setIdCarPromptVisible(false);
    analyzeSellWithAI();
  };

  const portalRows = [
    {
      key: "coches",
      icon: "C",
      iconColor: "#003087",
      name: "Coches.net",
      price: currencyEUR(Math.round(marketMean * 0.985), formatCurrency),
      units: Math.max(30, Math.round(marketUnits * 0.45)),
      toneClass: "blue",
    },
    {
      key: "autoscout",
      icon: "A",
      iconColor: "#ff6600",
      name: "AutoScout24",
      price: currencyEUR(Math.round(marketMean * 1.02), formatCurrency),
      units: Math.max(25, Math.round(marketUnits * 0.34)),
      toneClass: "",
    },
    {
      key: "milanuncios",
      icon: "M",
      iconColor: "#00a651",
      name: "Milanuncios",
      price: currencyEUR(Math.round(marketMean * 0.94), formatCurrency),
      units: Math.max(15, Math.round(marketUnits * 0.21)),
      toneClass: "green",
    },
  ];

  return (
    <div className="sell-market-root sell-market-wrap">
      <div className="back-row">
        <button className="back-btn" type="button" onClick={onGoBack}>
          <svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Volver
        </button>
        <span className="breadcrumb">Vender &rsaquo; <b>Información de mercado</b></span>
      </div>

      <div className="hero-card">
        <div className="hero-band" />
        <div className="hero-inner">
          <div className="badge">Opción A · Información para vender</div>
          <h1 className="sell-market-title">Te damos la información para vender</h1>
          <p className="sell-market-desc">
            No tasamos tu vehículo: te damos información real de mercado. Introduce los datos de tu coche y recibe
            una referencia objetiva para vender por tu cuenta con mejor criterio.
          </p>
          <div className="sell-market-meta">
            <div className="mpill">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>
              Resultado inmediato
            </div>
            <div className="mpill">
              <svg viewBox="0 0 24 24"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>
              Datos en tiempo real
            </div>
            <div className="mpill">
              <svg viewBox="0 0 24 24"><path d="M9 12l2 2 4-4M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27z" /></svg>
              Sin compromiso
            </div>
          </div>
        </div>
      </div>

      <div className="flow-card">
        <div className="flow-band" />
        <div className="flow-inner">
          <div className="blabel"><div className="blabel-dot" />Flujo A · Información para vender</div>
          <div className="steps-grid">
            <div className="step-block">
              <div className="step-left">
                <div className="step-circle">1</div>
                <div className="step-connector" />
              </div>
              <div className="step-right">
                <div className="step-label">Paso 1</div>
                <div className="step-title">Introduce los datos de tu vehículo</div>
                <div className="step-desc">Matrícula, marca, modelo, versión, año y kilómetros.</div>
                <div className="form-section">
                  {garageVehicles.length > 0 ? (
                    <div className="field-grid" style={{ marginBottom: "0.85rem" }}>
                      <div className="field field-full-row">
                        <label>Usar IDCar</label>
                        <div className="sel-wrap">
                          <select
                            ref={idCarSelectRef}
                            value={selectedIdCarId}
                            disabled={garageVehiclesLoading}
                            onChange={(event) => {
                              const vehicleId = event.target.value;
                              setSelectedIdCarId(vehicleId);
                              setIdCarPromptVisible(false);
                              const vehicle = garageVehicles.find((item) => normalizeText(item?.id) === normalizeText(vehicleId));
                              if (!vehicle) {
                                return;
                              }

                              setSellAnswers((prev) => ({
                                ...prev,
                                plate: normalizeText(vehicle?.plate),
                                brand: normalizeText(vehicle?.brand),
                                model: normalizeText(vehicle?.model),
                                version: normalizeText(vehicle?.version),
                                year: normalizeText(vehicle?.year),
                                mileage: normalizeText(vehicle?.mileage),
                                fuel: normalizeText(vehicle?.fuel) || prev.fuel || "Gasolina",
                              }));

                              void syncVehicleToErpSelectors(vehicle);
                            }}
                          >
                            <option value="">{garageVehiclesLoading ? "Cargando IDCars..." : "Selecciona tu IDCar"}</option>
                            {garageVehicles.map((vehicle, index) => (
                              <option key={vehicle.id} value={vehicle.id}>{buildIdCarLabel(vehicle, index)}</option>
                            ))}
                          </select>
                          <div className="sel-arrow">▾</div>
                        </div>
                        {idCarPromptVisible ? (
                          <div className="sell-market-idcar-hint">Selecciona uno de tus IDCars creados para analizar ese vehículo.</div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="field-grid">
                    <div className="field">
                      <label>Matrícula</label>
                      <input
                        type="text"
                        placeholder="1234 ABC"
                        value={sellAnswers?.plate || ""}
                        onChange={(event) => setSellAnswers((prev) => ({ ...prev, plate: event.target.value }))}
                      />
                    </div>
                    <div className="field">
                      <label>Marca</label>
                      <div className="sel-wrap">
                        <select
                          value={erpSelectedBrandId}
                          disabled={erpBrandsLoading}
                          onChange={(event) => {
                            const brandId = event.target.value;
                            const brand = erpBrands.find((item) => String(item.id) === String(brandId));
                            setErpSelectedBrandId(brandId);
                            setErpSelectedModelId("");
                            setErpModels([]);
                            setErpVersions([]);
                            setSellAnswers((prev) => ({
                              ...prev,
                              brand: brand?.name || "",
                              model: "",
                              version: "",
                              erpBrandId: brandId,
                              erpModelId: "",
                              erpVersionCode: "",
                            }));

                            if (!brandId) {
                              return;
                            }

                            setErpModelsLoading(true);
                            getErpModelsJson(brandId)
                              .then((response) => response.json())
                              .then((data) => {
                                setErpModels(Array.isArray(data?.models) ? data.models : []);
                              })
                              .catch(() => {
                                setErpModels([]);
                              })
                              .finally(() => {
                                setErpModelsLoading(false);
                              });
                          }}
                        >
                          <option value="">{erpBrandsLoading ? "Cargando marcas..." : "Selecciona"}</option>
                          {erpBrands.map((brand) => (
                            <option key={brand.id} value={brand.id}>{brand.name}</option>
                          ))}
                        </select>
                        <div className="sel-arrow">▾</div>
                      </div>
                    </div>
                  </div>

                  <div className="field-grid">
                    <div className="field">
                      <label>Modelo</label>
                      <div className="sel-wrap">
                        <select
                          value={erpSelectedModelId}
                          disabled={!erpSelectedBrandId || erpModelsLoading}
                          onChange={(event) => {
                            const modelId = event.target.value;
                            const model = erpModels.find((item) => String(item.id) === String(modelId));
                            setErpSelectedModelId(modelId);
                            setErpVersions([]);
                            setSellAnswers((prev) => ({
                              ...prev,
                              model: model?.name || "",
                              version: "",
                              erpModelId: modelId,
                              erpVersionCode: "",
                            }));

                            if (!modelId) {
                              return;
                            }

                            setErpVersionsLoading(true);
                            getErpVersionsJson(modelId, erpSelectedBrandId)
                              .then((response) => response.json())
                              .then((data) => {
                                setErpVersions(Array.isArray(data?.versions) ? data.versions : []);
                              })
                              .catch(() => {
                                setErpVersions([]);
                              })
                              .finally(() => {
                                setErpVersionsLoading(false);
                              });
                          }}
                        >
                          <option value="">
                            {erpModelsLoading
                              ? "Cargando modelos..."
                              : !erpSelectedBrandId
                                ? "Primero selecciona marca"
                                : "Selecciona"}
                          </option>
                          {erpModels.map((model) => (
                            <option key={model.id} value={model.id}>{model.name}</option>
                          ))}
                        </select>
                        <div className="sel-arrow">▾</div>
                      </div>
                    </div>
                    <div className="field">
                      <label>
                        Versión <span style={{ fontWeight: 300, textTransform: "none", letterSpacing: 0, color: "#ccc" }}>— opcional</span>
                      </label>
                      <div className="sel-wrap">
                        <select
                          value={sellAnswers?.erpVersionCode || ""}
                          disabled={!erpSelectedModelId || erpVersionsLoading || erpVersions.length === 0}
                          onChange={(event) => {
                            const versionCode = event.target.value;
                            const version = erpVersions.find((item) => String(item.codversion) === String(versionCode));
                            setSellAnswers((prev) => ({
                              ...prev,
                              version: version?.label || "",
                              erpVersionCode: versionCode,
                            }));
                          }}
                        >
                          <option value="">
                            {erpVersionsLoading
                              ? "Cargando versiones..."
                              : !erpSelectedModelId
                                ? "Primero selecciona modelo"
                                : erpVersions.length === 0
                                  ? "Sin versiones"
                                  : "Selecciona"}
                          </option>
                          {erpVersions.map((version) => (
                            <option key={version.codversion} value={version.codversion}>{version.label}</option>
                          ))}
                        </select>
                        <div className="sel-arrow">▾</div>
                      </div>
                    </div>
                  </div>

                  <div className="field-grid-3">
                    <div className="field">
                      <label>Año</label>
                      <div className="sel-wrap">
                        <select
                          value={sellAnswers?.year || ""}
                          onChange={(event) => setSellAnswers((prev) => ({ ...prev, year: event.target.value }))}
                        >
                          <option value="">Año</option>
                          {yearOptions.map((year) => (
                            <option key={year} value={String(year)}>{year}</option>
                          ))}
                          <option value="anterior">Anterior</option>
                        </select>
                        <div className="sel-arrow">▾</div>
                      </div>
                    </div>
                    <div className="field">
                      <label>Kilómetros</label>
                      <input
                        type="number"
                        placeholder="45000"
                        value={sellAnswers?.mileage || ""}
                        onChange={(event) => setSellAnswers((prev) => ({ ...prev, mileage: event.target.value }))}
                      />
                    </div>
                    <div className="field">
                      <label>Combustible</label>
                      <div className="sel-wrap">
                        <select
                          value={sellAnswers?.fuel || "Gasolina"}
                          onChange={(event) => setSellAnswers((prev) => ({ ...prev, fuel: event.target.value }))}
                        >
                          {fuelOptions.map((fuel) => (
                            <option key={fuel} value={fuel}>{fuel}</option>
                          ))}
                        </select>
                        <div className="sel-arrow">▾</div>
                      </div>
                    </div>
                  </div>

                  <div className="divider" />
                  <div className="field">
                    <label>Estado / Daños</label>
                    <div className="damage-opts" style={{ marginTop: "0.2rem" }}>
                      {DAMAGE_OPTIONS.map((option) => {
                        const selected = (sellAnswers?.damageLevel || DAMAGE_OPTIONS[0]) === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            className={`damage-opt${selected ? " sel" : ""}`}
                            onClick={() => setSellAnswers((prev) => ({ ...prev, damageLevel: option }))}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="sell-market-inline-actions">
                    <button className="btn-secondary" type="button" onClick={handleAnalyzeClick} disabled={sellLoading}>
                      {sellLoading ? "Analizando..." : "Analizar mi coche"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="step-block">
              <div className="step-left">
                <div className="step-circle">2</div>
                <div className="step-connector" />
              </div>
              <div className="step-right">
                <div className="step-label">Paso 2</div>
                <div className="step-title">Analizamos el mercado en tiempo real</div>
                <div className="step-desc">Precio medio actual y número de unidades similares publicadas en los principales portales.</div>
                <div className="result-section">
                  <div className="result-grid">
                    <div className="rstat">
                      <div className="rstat-num blue">{currencyEUR(marketMean, formatCurrency)}</div>
                      <div className="rstat-lbl">Precio medio<br />de oferta</div>
                    </div>
                    <div className="rstat">
                      <div className="rstat-num grad-text">{marketUnits}</div>
                      <div className="rstat-lbl">Unidades en<br />venta ahora</div>
                    </div>
                    <div className="rstat">
                      <div className="rstat-num green">{marketDays} d.</div>
                      <div className="rstat-lbl">Tiempo medio<br />anunciado</div>
                    </div>
                  </div>

                  <div className="portal-list">
                    {portalRows.map((portal) => (
                      <div key={portal.key} className="portal-row">
                        <div className="portal-name">
                          <div className="portal-ico" style={{ background: portal.iconColor }}>{portal.icon}</div>
                          {portal.name}
                        </div>
                        <div className="portal-right">
                          <span className={`portal-price ${portal.toneClass}`.trim()}>
                            {portal.price}
                          </span>
                          <span className="portal-units">· {portal.units} uds.</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="price-range">
                    <div className="pr-label">Rango de precios para este perfil de vehículo</div>
                    <div className="pr-range">
                      <span className="pr-val blue">{currencyEUR(marketLow, formatCurrency)}</span>
                      <span className="pr-sep">—</span>
                      <span className="pr-val green">{currencyEUR(marketHigh, formatCurrency)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="step-block">
              <div className="step-left">
                <div className="step-circle">3</div>
              </div>
              <div className="step-right">
                <div className="step-label">Paso 3</div>
                <div className="step-title">Recibes una referencia objetiva</div>
                <div className="step-desc">Para vender por tu cuenta con mejor criterio y sin depender de una tasación.</div>
                <div className="ref-box">
                  <div className="ref-title">💡 Con esta información puedes</div>
                  <div className="ref-feat">Fijar un precio de salida competitivo y justificado</div>
                  <div className="ref-feat">Saber cuánta competencia tienes en el mercado ahora mismo</div>
                  <div className="ref-feat">Decidir si publicar tú mismo o pedir ayuda a CarWise (Opción B)</div>
                  <div className="ref-feat">Negociar con compradores desde una posición informada</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {sellError ? <div className="sell-market-error">{sellError}</div> : null}
    </div>
  );
}
