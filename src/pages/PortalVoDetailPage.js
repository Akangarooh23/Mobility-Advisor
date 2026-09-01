import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { etiquetaDeGarantia, importeDeGarantia } from "../utils/etiquetaGarantia";
import { llevaRecargo } from "../utils/entregaPeninsula";
import { buildImageProxyUrl, buildOfferLocalImageCandidates, slugifyOfferFolderName } from "../utils/offerHelpers";
import { getUtmPayload } from "../utils/utmTracker";
import { trackLead } from "../utils/metaPixel";
import { trackFunnelEvent } from "../utils/funnelTracker";
import { readUserBillingProfile } from "../utils/storage";
import SlotPicker from "../components/SlotPicker";
import SimuladorFinanciacion, { TIPOS_FINANCIACION_IMPORTACION } from "../components/SimuladorFinanciacion";
import ConditionReportAr from "../components/ConditionReportAr";
import ConditionReportDownload from "../components/ConditionReportDownload";
import ComoFuncionaImportacion from "../components/ComoFuncionaImportacion";
import { getRentingDesde } from "../utils/portalVoHelpers";

// Número de WhatsApp de PopCar (formato internacional sin +).
const CARSWISE_WHATSAPP = "34684717736";

function getAvailableDurations(offer) {
  if (offer.rentingPricesJson?.km_options) {
    return ['12m','24m','36m','48m','60m'].filter(d => {
      const prices = offer.rentingPricesJson[d];
      return Array.isArray(prices) && prices.some(p => p != null && p > 0);
    });
  }
  return ['12m','24m','36m','48m','60m'].filter(d => (offer[`renting${d}`] || 0) > 0);
}

function getRentingPriceForSelection(offer, duration, km) {
  if (offer.rentingPricesJson?.km_options) {
    const kmIdx = offer.rentingPricesJson.km_options.indexOf(Number(km));
    const prices = offer.rentingPricesJson[duration];
    if (kmIdx >= 0 && Array.isArray(prices) && prices[kmIdx] != null) return prices[kmIdx];
    return null;
  }
  if (Number(km) === 15000) return offer[`renting${duration}`] || null;
  return null;
}

function getPrefilledForm(currentUser) {
  try {
    const billing = readUserBillingProfile();
    return {
      name:    currentUser?.name  || billing?.fullName || "",
      phone:   currentUser?.phone || billing?.phone    || "",
      email:   currentUser?.email || billing?.email    || "",
      when:    "",
      type:    "info",
      message: "",
    };
  } catch {
    return { name: "", phone: "", email: "", when: "", type: "info", message: "" };
  }
}

const ENTREGA_GUARDADA = "popcar_entrega";

const ENTREGA_VACIA = { calle: "", cp: "", ciudad: "", provincia: "" };

/**
 * Dónde dijo la última vez que quería recibirlo.
 *
 * Se guarda entre coches: quien está comparando cinco no tiene por qué escribir
 * su ciudad cinco veces.
 */
function leeEntregaGuardada() {
  try {
    const guardado = JSON.parse(localStorage.getItem(ENTREGA_GUARDADA) || "{}");
    return {
      calle: String(guardado.calle || ""),
      cp: String(guardado.cp || ""),
      ciudad: String(guardado.ciudad || ""),
      provincia: String(guardado.provincia || ""),
    };
  } catch {
    return { ...ENTREGA_VACIA };
  }
}

export default function PortalVoDetailPage({
  themeMode,
  styles,
  currentUser,
  haySesion = true,
  onEntrar,
  // Para volver a pedir sus solicitudes en cuanto reserve una visita.
  onSolicitudCreada,
  selectedPortalVoOffer,
  ResolvedOfferImage,
  getOfferBadgeStyle,
  getPortalVoEcoLabel,
  getPortalVoTransmission,
  buildPortalVoHighlights,
  buildPortalVoEquipment,
  formatCurrency,
  onBackToMarketplace,
  onGoHome,
  onOpenSection,
  onTasar,
  onCreateAlert,
  onLeadCreated,
  isReserved = false,
}) {
  const isDark = themeMode === "dark";
  const { t } = useTranslation();
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [galleryFailed, setGalleryFailed] = useState(false);
  const [reqModal, setReqModal] = useState(false);
  const [reqForm, setReqForm] = useState(() => getPrefilledForm(currentUser));

  useEffect(() => {
    setReqForm(getPrefilledForm(currentUser));
  }, [selectedPortalVoOffer.id, currentUser]);
  const [reqState, setReqState] = useState("idle");
  const [reqError, setReqError] = useState("");
  const [offerStats, setOfferStats] = useState(null);

  const isParticular = (selectedPortalVoOffer.sellerType || "").toLowerCase() === "particular";
  const isImport = !!selectedPortalVoOffer.isImport;
  // Financiación: concesionarios, renting y particulares usan la config estándar.
  // Importación usa su variante (entrada mínima = fianza 30%, plazos 36-72, copys propios).
  /**
   * La garantía que ha elegido, y lo que le suma.
   *
   * Empieza con **la que lleva el precio publicado**, no sin ninguna. No la damos
   * nosotros: PopCar no le vende el coche, se lo vende el concesionario alemán,
   * así que es un producto de un tercero. Pero va puesta de salida porque el
   * precio que ha visto en la lista la lleva dentro, y quitarla lo **baja**. Al
   * revés —anunciar sin garantía y ofrecerla después— es el mismo dinero leído
   * como una subida al final.
   *
   * Si el catálogo está vacío no hay nada de esto y la ficha se ve como siempre.
   */
  const opcionesGarantia = selectedPortalVoOffer.garantias?.opciones ?? [];
  const garantiaPorDefecto = selectedPortalVoOffer.garantias?.porDefecto?.id ?? null;
  const [garantiaElegida, setGarantiaElegida] = useState(garantiaPorDefecto);

  // Si se cambia de coche, se vuelve a la suya: la elegida en otro anuncio puede
  // no poder dársele a éste, y su precio ya no sería el que lleva este precio.
  useEffect(() => {
    setGarantiaElegida(garantiaPorDefecto);
  }, [selectedPortalVoOffer.id, garantiaPorDefecto]);

  /**
   * Lo que le mueve al precio la garantía que ha elegido.
   *
   * Es la **diferencia** y no el precio, porque el precio que llega ya lleva la
   * de por defecto dentro. Sumarle el precio entero la contaría dos veces.
   */
  const diferenciaGarantia = opcionesGarantia
    .find((o) => (o.id ?? null) === garantiaElegida)?.diferencia ?? 0;
  const precioConGarantia = (Number(selectedPortalVoOffer.price) || 0) + diferenciaGarantia;
  /**
   * Dónde quiere que se lo llevemos.
   *
   * Se guarda en el navegador, no en la solicitud: aquí todavía no hay
   * solicitud ninguna. Sirve para dos cosas — que el aviso del recargo salga
   * **antes** de pagar la fianza, y para no volver a preguntarlo en cada coche
   * que mire.
   *
   * Si el navegador no deja guardar, se queda vacío y no pasa nada: la
   * dirección de verdad se pone luego en su panel.
   */
  const [entrega, setEntrega] = useState(() => leeEntregaGuardada());
  const [cambiandoEntrega, setCambiandoEntrega] = useState(false);

  /**
   * Si no ha dicho dónde, la dirección que ya tiene puesta en sus datos.
   *
   * Es la de facturación, la que rellenó una vez en su panel. Volver a
   * pedírsela sería preguntarle algo que ya nos dijo, y es de las cosas que más
   * cansan de un formulario.
   *
   * Solo se usa como punto de partida: en cuanto la cambia aquí, manda la suya.
   */
  useEffect(() => {
    const yaDijo = entrega.calle || entrega.ciudad;
    if (yaDijo || !currentUser?.email) return;
    let vigente = true;
    void (async () => {
      try {
        const { getBillingAccountJson } = await import("../utils/apiClient");
        const { data } = await getBillingAccountJson(currentUser.email);
        const perfil = data?.account?.profile || {};
        if (!vigente) return;
        /**
         * `billingAddress` **no es la ciudad**.
         *
         * Es la direccion entera en una linea, que la monta el propio backend
         * como calle + codigo postal + provincia. Metida en el campo de ciudad,
         * la direccion salia escrita dos veces: «Calle Mauricio Legendre 45 G2B,
         * 28046 Calle Mauricio Legendre 45 G2B, 28046, MADRID, (MADRID)». Y asi
         * viajaba a la solicitud y al documento de entrega.
         *
         * En los datos de facturacion no hay ciudad, solo calle, codigo postal y
         * provincia. Asi que se queda vacia y la escribe el: un campo en blanco
         * se rellena, uno mal relleno hay que darse cuenta de que esta mal.
         */
        const calle = String(perfil.billingStreet || "").trim();
        const cp = String(perfil.billingPostalCode || "").trim();
        const provincia = String(perfil.billingProvince || "").trim();
        if (!calle && !cp && !provincia) return;
        setEntrega({ calle, cp, ciudad: "", provincia });
      } catch { /* sin datos suyos, se le pregunta */ }
    })();
    return () => { vigente = false; };
    // Solo al abrir la ficha: si se relanzara al escribir, pisaría lo que teclea.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.email]);

  /** «Calle Mauricio Legendre 45 G2B, 28046 MADRID (Madrid)» */
  const entregaEscrita = [
    entrega.calle,
    [entrega.cp, entrega.ciudad].filter(Boolean).join(" "),
    entrega.provincia ? `(${entrega.provincia})` : "",
  ].map((x) => String(x || "").trim()).filter(Boolean).join(", ");
  const recargoDeEntrega = llevaRecargo(entrega.provincia);

  /**
   * Lo que se puede contratar aparte del coche.
   *
   * El precio trae el coche hasta su casa, lo matricula y le da su garantía.
   * Lo que queda fuera es lo que no todo el mundo quiere: asegurarlo y dejarlo
   * a punto. Se marcan uno a uno.
   *
   * Ninguno entra en el depósito, y eso se dice en pantalla: el depósito es el
   * coche y nuestro servicio, que es lo que hay que tener en Alemania. Cobrarle
   * por adelantado un seguro que todavía no tiene sería otra cosa.
   */
  const servicios = Array.isArray(selectedPortalVoOffer.servicios)
    ? selectedPortalVoOffer.servicios
    : [];
  const [serviciosElegidos, setServiciosElegidos] = useState([]);
  const sumaDeServicios = servicios
    .filter((s) => serviciosElegidos.includes(s.id) && s.precio != null)
    .reduce((t, s) => t + Number(s.precio || 0), 0);

  useEffect(() => {
    try {
      localStorage.setItem(ENTREGA_GUARDADA, JSON.stringify(entrega));
    } catch { /* sin sitio donde guardarlo, da igual */ }
  }, [entrega]);

  const garantiaDelCoche = opcionesGarantia
    .find((o) => (o.id ?? null) === garantiaElegida) ?? null;
  const coberturasDeLaElegida = garantiaDelCoche?.coberturas ?? [];

  /**
   * El precio de este coche **con la garantía que ha elegido**.
   *
   * De aquí salen todos los números que ve: el grande de arriba, la cuota del
   * mes, la fianza y el ahorro. Antes solo cambiaba el total del desglose, así
   * que elegir una ampliación subía una línea y dejaba las otras cuatro
   * diciendo lo de antes. Cuatro números distintos para el mismo coche.
   */
  const precioFinanciable = isImport
    ? precioConGarantia
    : Number(selectedPortalVoOffer.salePrice ?? selectedPortalVoOffer.price) || 0;

  /**
   * Lo que deposita ahora: el coche y nuestro servicio.
   *
   * No es una fianza. La fianza del 30 % era de cuando comprábamos el coche y
   * se lo vendíamos; ahora se lo compra él al concesionario alemán, así que el
   * dinero del coche tiene que estar entero. Se queda retenido hasta que uno de
   * los nuestros lo ve allí.
   *
   * El impuesto de matriculación no va aquí: se liquida al matricular, cuando
   * ya se sabe cuánto es.
   */
  const depositoOferta = selectedPortalVoOffer.importDeposito || null;
  // Con la **diferencia** y no con el precio: el depósito que llega ya cuenta la
  // garantía de por defecto, igual que el precio de arriba.
  const depositoImport = isImport && depositoOferta
    ? depositoOferta.total + diferenciaGarantia
    : 0;

  /**
   * El ahorro, recalculado.
   *
   * Si el precio sube y el ahorro se queda como estaba, la resta deja de
   * cuadrar delante del cliente: 29.899 − 22.400 no son 7.789.
   */
  const precioEspanolMedio = Number(selectedPortalVoOffer.marketPriceEs) || 0;
  const ahorroConGarantia = precioEspanolMedio > 0 && precioConGarantia > 0
    ? Math.round(precioEspanolMedio - precioConGarantia)
    : 0;
  const ahorroPct = ahorroConGarantia > 0 && precioEspanolMedio > 0
    ? Math.round((ahorroConGarantia / precioEspanolMedio) * 100)
    : null;
  const mostrarFinanciacion = precioFinanciable > 0;
  const [cuotaMensual, setCuotaMensual] = useState(null);

  const [savedAlert, setSavedAlert] = useState(false);
  const whatsappHref = `https://wa.me/${CARSWISE_WHATSAPP}?text=${encodeURIComponent(`Hola, me interesa el ${selectedPortalVoOffer.title} por ${formatCurrency(precioFinanciable)}. ¿Sigue disponible?`)}`;
  const handleGuardarAlerta = () => {
    const created = onCreateAlert?.({
      mode: isRentingOffer ? "renting" : "compra",
      brand: selectedPortalVoOffer.brand,
      model: selectedPortalVoOffer.model,
      maxPrice: precioFinanciable || undefined,
      notifyByEmail: true,
    });
    setSavedAlert(created ? "ok" : "login");
  };
  const isRentingOffer = !!(selectedPortalVoOffer.rentingAvailable && !selectedPortalVoOffer.availableForPurchase);
  const isRentingReserved = isReserved && selectedPortalVoOffer.rentingAvailable && selectedPortalVoOffer.unitsAvailable <= 1 && !selectedPortalVoOffer.availableForPurchase;
  // Se abre en la combinación que anuncia el listado, para que el número que
  // el cliente ha pulsado sea el que ve al entrar.
  const desde = getRentingDesde(selectedPortalVoOffer);
  const [rentingDuration, setRentingDuration] = useState(
    () => desde?.plazo || getAvailableDurations(selectedPortalVoOffer)[0] || "36m"
  );
  const [rentingKm, setRentingKm] = useState(
    () => desde?.km || selectedPortalVoOffer.rentingPricesJson?.km_options?.[1] || 15000
  );
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);

  useEffect(() => {
    if (!selectedPortalVoOffer.id) return;
    fetch(`/api/marketplace-vo?stats=1&vehicleId=${encodeURIComponent(selectedPortalVoOffer.id)}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setOfferStats(d.stats); })
      .catch(() => {});
  }, [selectedPortalVoOffer.id]);

  /**
   * ¿Este coche tiene informe de estado publicado?
   *
   * Se pregunta antes de pintar la descarga y el botón de realidad aumentada:
   * la mayoría de los anuncios no tendrán informe, y ofrecer una descarga que
   * devuelve un 404 es peor que no ofrecer nada.
   */
  const [tieneInforme, setTieneInforme] = useState(false);
  useEffect(() => {
    if (!selectedPortalVoOffer.id) return;
    let vivo = true;
    fetch(`/api/modelo-3d/${encodeURIComponent(selectedPortalVoOffer.id)}/info`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo) setTieneInforme(Boolean(d?.informe)); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [selectedPortalVoOffer.id]);

  const [sectionShowcase, setSectionShowcase] = useState([]);
  useEffect(() => {
    fetch("/api/marketplace-vo?showcase=1")
      .then((r) => r.json())
      .then((d) => { if (d.ok && Array.isArray(d.sections)) setSectionShowcase(d.sections); })
      .catch(() => {});
  }, []);

  const [solicitudHecha, setSolicitudHecha] = useState(null);

  const [pidiendoLlamada, setPidiendoLlamada] = useState(false);
  const [llamadaPedida, setLlamadaPedida] = useState(false);
  const [errorFianza, setErrorFianza] = useState("");

  /*
   * Aquí había una función que abría Stripe y cobraba la fianza del 30 %.
   *
   * Ya no: lo que se deposita es el coche entero más nuestro servicio, y eso no
   * se cobra con tarjeta. Un coche de 20.000 € llevaría unos 300 € de comisión
   * y además choca con el límite de cualquier tarjeta particular.
   *
   * Va por transferencia a una cuenta de depósito, y los datos de la cuenta se
   * dan hablando con el cliente. Cuando haya proveedor —PayComet o MangoPay—
   * volverá a haber un botón, pero será otro botón: uno que retiene el dinero
   * en vez de cobrarlo.
   */

  /**
   * «Prefiero que me llaméis.»
   *
   * Al lado del botón de pagar, porque es la otra respuesta razonable a que te
   * pidan mil euros: la pantalla ya decía que se puede esperar a la llamada,
   * pero no había manera de decirlo y había que quedarse quieto y confiar.
   *
   * Queda anotado en su solicitud, que es donde lo ve quien la atiende.
   */
  async function pideQueLeLlamen() {
    if (!solicitudHecha?.id) return;
    setPidiendoLlamada(true);
    try {
      const res = await fetch("/api/import-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accion: "llamada", lead_id: solicitudHecha.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) setLlamadaPedida(true);
      else setErrorFianza("No hemos podido anotarlo. Te llamamos igualmente.");
    } catch {
      setErrorFianza("No hemos podido anotarlo. Te llamamos igualmente.");
    }
    setPidiendoLlamada(false);
  }

  async function handleReqSubmit(e) {
    e.preventDefault();
    setReqState("submitting");
    setReqError("");
    try {
      let res;
      if (isImport) {
        res = await fetch("/api/import-lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            offer_id: selectedPortalVoOffer.id,
            name: reqForm.name,
            email: reqForm.email,
            phone: reqForm.phone,
            message: reqForm.message,
            // La que ha elegido. El precio lo vuelve a calcular el servidor:
            // esto dice cuál quiere, no cuánto cuesta.
            garantia_id: garantiaElegida,
            // Lo que ha marcado aparte: entrega, seguro, reacondicionado.
            //
            // Van como petición, no como compra: hoy ninguno tiene precio y no
            // suman nada a la fianza. Lo que hacen es llegar al expediente para
            // que quien le llame sepa de qué hablarle.
            servicios: serviciosElegidos,
            // Y dónde se lo llevamos. El viaje va en el precio, así que esto
            // no es opcional: es el segundo tramo, de Zaragoza a su puerta.
            entrega_direccion: entrega.calle,
            entrega_cp: entrega.cp,
            entrega_ciudad: entrega.ciudad,
            entrega_provincia: entrega.provincia,
          }),
        });
      } else if (isParticular) {
        res = await fetch("/api/viewing-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            offer_id: selectedPortalVoOffer.id,
            buyer_name: reqForm.name,
            buyer_email: reqForm.email,
            buyer_message: reqForm.message,
            ...getUtmPayload(),
          }),
        });
      } else {
        let finalType = reqForm.type;
        let finalWhen = reqForm.when;
        if (isRentingOffer) {
          finalType = "renting";
          const price = getRentingPriceForSelection(selectedPortalVoOffer, rentingDuration, rentingKm);
          const kmLabel = Number(rentingKm) >= 1000 ? `${(Number(rentingKm)/1000).toFixed(0)}.000` : String(rentingKm);
          finalWhen = `Plazo: ${rentingDuration} · ${kmLabel} km/año${price ? ` · ${price} €/mes` : ""}${selectedColor ? ` · ${selectedQuantity}x ${selectedColor}` : ""}`;
        }
        res = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: reqForm.name,
            phone: reqForm.phone,
            email: reqForm.email,
            when: finalWhen,
            type: finalType,
            vehicle_id: selectedPortalVoOffer.id,
            vehicle_title: selectedPortalVoOffer.title,
            vehicle_url: selectedPortalVoOffer.url || "",
            portal: isRentingOffer ? "marketplace-vo-renting" : "marketplace-vo-compra",
            ...getUtmPayload(),
          }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al enviar");
      // De una importación vuelven su identificador y su fianza: con eso se le
      // puede ofrecer pagarla ahí mismo, sin esperar a que le llamen.
      // `correoEnviado` viene del servidor: si el envío no ha salido, no se le
      // dice que le hemos escrito.
      if (isImport) setSolicitudHecha({ id: data.id || "", fianza: Number(data.deposit || 0), correoEnviado: data.correoEnviado !== false });
      trackLead({
        vehicleTitle: selectedPortalVoOffer.title,
        vehicleId: selectedPortalVoOffer.id,
        leadType: reqForm.type || "info",
        utm: getUtmPayload(),
      });
      trackFunnelEvent({
        event_type:  "lead_request",
        user_id:     currentUser?.id || null,
        user_email:  reqForm.email || null,
        offer_id:    selectedPortalVoOffer.id,
        offer_title: selectedPortalVoOffer.title || "",
        modality:    isRentingOffer ? "renting" : "compra",
      });
      setReqState("done");
      if (onLeadCreated) onLeadCreated();
    } catch (err) {
      setReqState("error");
      setReqError(err.message || "No se pudo enviar la solicitud");
    }
  }

  function openReqModal() {
    const defaultType = isRentingOffer ? "renting" : "info";
    setReqForm({ ...getPrefilledForm(currentUser), when: "", type: defaultType, message: "" });
    if (isRentingOffer) {
      setRentingDuration(desde?.plazo || getAvailableDurations(selectedPortalVoOffer)[0] || "36m");
      setRentingKm(desde?.km || selectedPortalVoOffer.rentingPricesJson?.km_options?.[1] || 15000);
    }
    setReqState("idle");
    setReqError("");
    setReqModal(true);
  }
  // Real images from the offer (for thumbnail strip)
  const realImages = (selectedPortalVoOffer.images?.length
    ? selectedPortalVoOffer.images
    : selectedPortalVoOffer.image
    ? [selectedPortalVoOffer.image]
    : []).map((u) => buildImageProxyUrl(u) || u);
  // Local static images take priority over remote URLs
  const localCandidates = buildOfferLocalImageCandidates(
    { imageFolder: slugifyOfferFolderName(selectedPortalVoOffer) }
  );
  const allImages = realImages.length > 0
    ? realImages
    : localCandidates.filter(Boolean);
  useEffect(() => { setGalleryIdx(0); setGalleryFailed(false); }, [selectedPortalVoOffer.id]);
  const titleColor = isDark ? "var(--gris-50)" : "var(--gris-900)";
  const bodyColor = isDark ? "var(--acento-tenue)" : "var(--gris-700)";
  const metaColor = isDark ? "var(--gris-300)" : "var(--marca-oscuro)";
  const panelCardBg = isDark ? "rgba(17,17,17,0.3)" : "rgba(242,242,237,0.92)";
  const specCardBg = isDark ? "rgba(17,17,17,0.34)" : "rgba(250,250,248,0.96)";

  // Rejilla de especificaciones. En importación se pinta bajo la galería (para
  // aprovechar el hueco de la columna izquierda); en el resto, en la columna derecha.
  const specsGrid = (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
      {[
        [t("marketplace.specYear"), selectedPortalVoOffer.year],
        [t("marketplace.specKm"), `${Number(selectedPortalVoOffer.mileage || 0).toLocaleString("es-ES")} km`],
        [t("marketplace.specFuel"), selectedPortalVoOffer.fuel],
        [t("marketplace.specPower"), selectedPortalVoOffer.power],
        [t("marketplace.specTransmission"), getPortalVoTransmission(selectedPortalVoOffer)],
        /*
         * Sin cilindrada no se dice «EV».
         *
         * Estaba puesto así, y como ninguna oferta de importación trae la
         * cilindrada, los 1.568 coches decían ser eléctricos: un Golf diésel de
         * 2005 incluido. No es un fallo de estilo, es afirmar del coche algo que
         * no es, en la ficha donde el cliente decide.
         *
         * Cuando no se sabe, se dice que no se sabe.
         */
        [t("marketplace.specDisplacement"), selectedPortalVoOffer.displacement > 0 ? `${selectedPortalVoOffer.displacement.toLocaleString("es-ES")} cc` : "—"],
        [t("marketplace.specLocation"), selectedPortalVoOffer.location],
      ].map(([label, value]) => (
        <div
          key={`${selectedPortalVoOffer.id}-${label}`}
          style={{
            background: specCardBg,
            border: "1px solid rgba(150,150,143,0.14)",
            borderRadius: 12,
            padding: "10px 12px",
          }}
        >
          <div style={{ fontSize: 10, color: metaColor, marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 12, color: titleColor, fontWeight: 700 }}>{value}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={styles.center}>
      <div style={{ ...styles.blockBadge("Vinculación"), marginBottom: 10 }}>{t("marketplace.detailBadge")}</div>
      <div style={{ ...styles.panel, marginBottom: 18, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10, color: isDark ? "var(--gris-300)" : "var(--gris-900)", fontWeight: 800, letterSpacing: "0.6px", marginBottom: 4 }}>
              {t("marketplace.detailSubBadge")}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: titleColor }}>{selectedPortalVoOffer.title}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onBackToMarketplace}
              style={{
                background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.95)",
                border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(150,150,143,0.32)",
                color: isDark ? "var(--gris-300)" : "var(--gris-600)",
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {t("marketplace.backToMarketplace")}
            </button>
            <button
              type="button"
              onClick={onGoHome}
              style={{
                background: "linear-gradient(135deg,var(--marca),var(--marca-oscuro))",
                border: "none",
                color: "var(--blanco)",
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {t("marketplace.backToHome")}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16, alignItems: "start" }}>
          <div>
          <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(150,150,143,0.16)", background: isDark ? "rgba(5,5,5,0.45)" : "rgba(250,250,248,0.96)" }}>
            {allImages.length > 0 && !galleryFailed ? (
              <div>
                <img
                  key={allImages[galleryIdx]}
                  src={allImages[galleryIdx]}
                  alt={selectedPortalVoOffer.title}
                  referrerPolicy="no-referrer"
                  style={{ width: "100%", height: 320, objectFit: "cover", display: "block" }}
                  onError={() => setGalleryFailed(true)}
                />
                {realImages.length > 1 && (
                  <div style={{ display: "flex", gap: 6, padding: "8px 10px", overflowX: "auto", background: isDark ? "rgba(5,5,5,0.6)" : "rgba(242,242,237,0.96)" }}>
                    {realImages.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => { setGalleryIdx(idx); setGalleryFailed(false); }}
                        style={{
                          flexShrink: 0,
                          width: 64,
                          height: 48,
                          padding: 0,
                          border: idx === galleryIdx
                            ? "2px solid var(--marca)"
                            : "2px solid transparent",
                          borderRadius: 8,
                          overflow: "hidden",
                          cursor: "pointer",
                          background: "none",
                          opacity: idx === galleryIdx ? 1 : 0.65,
                          transition: "opacity 0.15s, border-color 0.15s",
                        }}
                      >
                        <img
                          src={buildImageProxyUrl(url) || url}
                          alt={`Foto ${idx + 1}`}
                          referrerPolicy="no-referrer"
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                          onError={(e) => { e.target.parentElement.style.display = "none"; }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <ResolvedOfferImage
                offer={selectedPortalVoOffer}
                alt={selectedPortalVoOffer.title}
                style={{ width: "100%", height: 320, objectFit: "cover", display: "block" }}
              />
            )}
          </div>
            {isImport && (
              <div style={{ marginTop: 12 }}>
                {specsGrid}
              </div>
            )}
            {offerStats && (offerStats.viewCount > 0 || offerStats.contactCount > 0) && (
              <div style={{ marginTop: 12, fontSize: 12, color: isDark ? "var(--gris-400)" : "var(--gris-500)" }}>
                👁 {offerStats.viewCount} {offerStats.viewCount === 1 ? "persona ha visto" : "personas han visto"} este vehículo{offerStats.contactCount > 0 ? ` · ${offerStats.contactCount} ${offerStats.contactCount === 1 ? "contacto" : "contactos"}` : ""} esta semana
              </div>
            )}
          </div>

          <div style={isImport ? { display: "flex", flexDirection: "column", alignSelf: "stretch" } : undefined}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              <span style={getOfferBadgeStyle(selectedPortalVoOffer.hasGuaranteeSeal ? "green" : "slate")}>
                {selectedPortalVoOffer.hasGuaranteeSeal ? t("marketplace.guaranteeLabel", { months: selectedPortalVoOffer.warrantyMonths }) : t("marketplace.postedByUser")}
              </span>
              <span style={getOfferBadgeStyle("slate")}>{getPortalVoEcoLabel(selectedPortalVoOffer)}</span>
              <span style={getOfferBadgeStyle("slate")}>{selectedPortalVoOffer.color}</span>
            </div>

            {/* Price / modality */}
            <div style={{ marginBottom: 10 }}>
              {selectedPortalVoOffer.availableForPurchase !== false && (
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: selectedPortalVoOffer.rentingAvailable ? 6 : 0 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: titleColor }}>
                    {formatCurrency(precioFinanciable)}
                  </span>
                  <span style={{ fontSize: 12, color: isDark ? "var(--gris-400)" : "var(--gris-500)" }}>{isImport ? "Importado estimado" : t("marketplace.modalityPurchase", "Compra")}</span>
                </div>
              )}
              {mostrarFinanciacion && cuotaMensual != null && (
                <button
                  type="button"
                  onClick={() => document.getElementById("financiacion")?.scrollIntoView({ behavior: "smooth" })}
                  style={{ display: "block", background: "none", border: "none", padding: 0, marginBottom: 6, fontSize: 13, color: isDark ? "#5eead4" : "#137370", cursor: "pointer", textAlign: "left" }}
                >
                  o <strong>{formatCurrency(cuotaMensual)}</strong>/mes financiado
                </button>
              )}
              {isImport && (
                <div style={{ marginTop: 6 }}>
                  {ahorroConGarantia > 0 && (
                    <div style={{ display: "inline-block", fontSize: 13, fontWeight: 800, padding: "5px 12px", borderRadius: 999, background: "#059669", color: "#fff" }}>
                      Ahorras ~{ahorroConGarantia.toLocaleString("es-ES")} €{ahorroPct ? ` (${ahorroPct}%)` : ""}
                    </div>
                  )}
                  {/*
                    * De qué se compone el precio.
                    *
                    * Un coche de importación cuesta más que su anuncio alemán, y sin
                    * decir por qué parece un recargo. Tres líneas: el coche, traerlo
                    * y matricularlo. El margen va dentro del precio del coche, como
                    * en cualquier compraventa.
                    *
                    * Y debajo, lo que NO está incluido. Enterarse de eso después de
                    * pagar la fianza es lo que hace desconfiar de un importador.
                    */}
                  {Array.isArray(selectedPortalVoOffer.importDesglose) && selectedPortalVoOffer.importDesglose.length > 0 && (
                    <div style={{ background: isDark ? "rgba(255,255,255,0.04)" : "var(--gris-50)", border: "1px solid var(--gris-200)", borderRadius: 12, padding: "12px 14px", marginTop: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: isDark ? "var(--gris-200)" : "var(--gris-700)", marginBottom: 8 }}>De qué se compone este precio</div>
                      {/*
                        * Todas menos la de la garantía, que se pinta aparte.
                        *
                        * La API manda la de por defecto porque es la que hace su
                        * total. Aquí él puede haber elegido otra, así que esa línea
                        * la pone el bloque de abajo con la suya.
                        */}
                      {selectedPortalVoOffer.importDesglose.filter((l) => !l.esGarantia).map((linea) => (
                        <div key={linea.concepto} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5, color: isDark ? "var(--gris-300)" : "var(--gris-700)", marginBottom: 4 }}>
                          <span>{linea.concepto}</span>
                          <strong style={{ whiteSpace: "nowrap" }}>{formatCurrency(linea.importe)}</strong>
                        </div>
                      ))}
                      {/*
                        * La garantía **que ha elegido**, no la que trae el precio.
                        *
                        * La API manda su línea marcada y arriba se quita, porque es la
                        * de por defecto y él puede haber cambiado. Aquí se pinta la
                        * suya, con su precio entero: las otras líneas ya no la llevan,
                        * así que la suma vuelve a dar el total de debajo.
                        */}
                      {garantiaDelCoche && (
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5, color: isDark ? "var(--gris-300)" : "var(--gris-700)", marginBottom: 4 }}>
                          <span>{etiquetaDeGarantia(garantiaDelCoche)}</span>
                          <strong style={{ whiteSpace: "nowrap" }}>
                            {formatCurrency(garantiaDelCoche.precio)}
                          </strong>
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13.5, fontWeight: 800, borderTop: "1px solid var(--gris-200)", marginTop: 8, paddingTop: 8, color: isDark ? "#fff" : "var(--gris-900)" }}>
                        <span>Puesto en tu casa</span>
                        <span style={{ whiteSpace: "nowrap" }}>{formatCurrency(precioConGarantia)}</span>
                      </div>

                      {/*
                        * Las otras garantías, como diferencia sobre la base.
                        *
                        * Sumar o restar sobre un total que ya has visto se entiende;
                        * recalcularlo entero delante del cliente, no. La opción de
                        * quedarse sin ninguna solo sale si la base es renunciable:
                        * el mínimo legal no se puede quitar aunque quiera.
                        */}
                      {opcionesGarantia.length > 1 && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--gris-200)" }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: isDark ? "var(--gris-300)" : "var(--gris-600)", marginBottom: 6 }}>
                            Garantía mecánica, si la quieres
                          </div>
                          {/*
                            * Lo que de verdad se vende aquí no es la póliza.
                            *
                            * El vendedor alemán le debe la garantía legal europea de
                            * dos años. El problema no es tenerla: es usarla. Un
                            * particular que compra una vez en Alemania no tiene forma
                            * de presionar a un concesionario de otro país, en otro
                            * idioma y con otro derecho de consumo.
                            *
                            * Nosotros traemos coches todas las semanas y hablamos con
                            * esa gente todas las semanas. Eso no cabe en el precio de
                            * un producto, así que se dice aquí.
                            */}
                          <p style={{ margin: "0 0 8px", fontSize: 11.5, color: isDark ? "var(--gris-400)" : "var(--gris-500)", lineHeight: 1.6 }}>
                            La pone una aseguradora, no nosotros. Lo que ponemos nosotros es
                            que <strong>si hay que reclamar, reclamamos nosotros</strong>: ni te
                            escribes con un concesionario alemán ni discutes en otro idioma.
                          </p>
                          {opcionesGarantia.map((o) => {
                            const elegida = (o.id ?? null) === garantiaElegida;
                            return (
                              <button
                                key={o.id ?? "sin"}
                                type="button"
                                onClick={() => setGarantiaElegida(o.id ?? null)}
                                style={{
                                  display: "flex", width: "100%", justifyContent: "space-between", gap: 12,
                                  alignItems: "center", textAlign: "left", cursor: "pointer",
                                  background: elegida ? (isDark ? "rgba(255,255,255,0.06)" : "#fff") : "transparent",
                                  border: `1px solid ${elegida ? "var(--marca)" : "var(--gris-200)"}`,
                                  borderRadius: 10, padding: "8px 10px", marginBottom: 6,
                                  fontSize: 12.5, color: isDark ? "var(--gris-200)" : "var(--gris-700)",
                                }}
                              >
                                <span>
                                  <strong>{etiquetaDeGarantia(o)}</strong>
                                  {o.kmCubiertos ? ` · hasta ${o.kmCubiertos.toLocaleString("es-ES")} km` : ""}
                                </span>
                                <span style={{ whiteSpace: "nowrap", fontWeight: 700 }}>
                                  {importeDeGarantia(o.diferencia, formatCurrency)}
                                </span>
                              </button>
                            );
                          })}
                          {coberturasDeLaElegida.length > 0 && (
                            <ul style={{ margin: "2px 0 0", paddingLeft: 18, fontSize: 11.5, color: isDark ? "var(--gris-400)" : "var(--gris-600)", lineHeight: 1.7 }}>
                              {coberturasDeLaElegida.map((c) => (
                                <li key={c.texto} style={{ textDecoration: c.incluida === false ? "line-through" : "none" }}>{c.texto}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                      {/*
                        * Qué cubre el transporte que va en el precio.
                        *
                        * La línea de arriba dice «Transporte desde Alemania» y se
                        * queda a medias: no aclara hasta dónde. Es un precio único
                        * para toda la península, viva donde viva, y eso hay que
                        * decirlo aquí y no cuando ya haya pagado la fianza.
                        *
                        * Fuera de la península puede haber recargo, y va sin cifra
                        * a propósito: no hay tarifa de nadie para meter un coche en
                        * un barco, y un número inventado en un precio público es
                        * peor que decir que se confirma.
                        */}
                      {/*
                        * El viaje del coche, con sus tres puntos.
                        *
                        * «Transporte desde Alemania» decía de dónde y no decía hasta
                        * dónde. Y el viaje no es directo: todos los coches pasan por
                        * Zaragoza, que es donde se homologa y donde se preparan.
                        *
                        * Zaragoza y no Madrid porque queda a media distancia de Madrid,
                        * Barcelona, Valencia y Bilbao.
                        *
                        * Los dos tramos van dentro del precio. Que por dentro sean dos
                        * camiones —o el mismo conductor— es cosa nuestra, y aquí no se
                        * cuenta: lo que él compra es un viaje.
                        */}
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--gris-200)" }}>
                        <div style={{ fontSize: 11.5, fontWeight: 800, color: isDark ? "var(--gris-300)" : "var(--gris-600)", marginBottom: 6 }}>
                          El viaje, incluido en el precio
                        </div>

                        <div style={{ display: "flex", gap: 10, fontSize: 12.5, color: isDark ? "var(--gris-300)" : "var(--gris-700)", marginBottom: 3 }}>
                          <span style={{ width: 46, color: isDark ? "var(--gris-500)" : "var(--gris-400)" }}>Desde</span>
                          <strong>{selectedPortalVoOffer.location || "Alemania"}</strong>
                          {selectedPortalVoOffer.location && <span style={{ color: isDark ? "var(--gris-500)" : "var(--gris-400)" }}>(Alemania)</span>}
                        </div>

                        <div style={{ display: "flex", gap: 10, fontSize: 12.5, color: isDark ? "var(--gris-400)" : "var(--gris-500)", marginBottom: 3 }}>
                          <span style={{ width: 46, color: isDark ? "var(--gris-500)" : "var(--gris-400)" }}>Pasa por</span>
                          <span><strong>Zaragoza</strong>, donde se homologa y se prepara</span>
                        </div>

                        <div style={{ display: "flex", gap: 10, fontSize: 12.5, color: isDark ? "var(--gris-300)" : "var(--gris-700)", alignItems: "baseline", flexWrap: "wrap" }}>
                          <span style={{ width: 46, color: isDark ? "var(--gris-500)" : "var(--gris-400)" }}>Hasta</span>
                          {entregaEscrita ? (
                            <span>
                              tu casa, <strong>«{entregaEscrita}»</strong>
                            </span>
                          ) : (
                            <span style={{ color: isDark ? "var(--gris-500)" : "var(--gris-400)" }}>
                              tu casa, en cualquier punto de la península
                            </span>
                          )}
                          {!cambiandoEntrega && (
                            <button
                              type="button"
                              onClick={() => setCambiandoEntrega(true)}
                              style={{
                                background: "none", border: "none", padding: 0, fontSize: 11.5,
                                fontWeight: 700, color: "var(--marca-claro)", cursor: "pointer",
                                textDecoration: "underline",
                              }}
                            >
                              Cambiar dirección de envío
                            </button>
                          )}
                        </div>

                        {cambiandoEntrega && (
                          <div style={{ marginTop: 6 }}>
                            <input
                              value={entrega.calle}
                              onChange={(e) => setEntrega((d) => ({ ...d, calle: e.target.value }))}
                              placeholder="Calle, número y piso"
                              style={{ width: "100%", padding: "6px 8px", fontSize: 12, borderRadius: 8, border: "1px solid var(--gris-200)", marginBottom: 6, boxSizing: "border-box" }}
                            />
                            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                              <input
                                value={entrega.cp}
                                onChange={(e) => setEntrega((d) => ({ ...d, cp: e.target.value }))}
                                placeholder="C. P."
                                style={{ flex: "0 1 90px", padding: "6px 8px", fontSize: 12, borderRadius: 8, border: "1px solid var(--gris-200)" }}
                              />
                              <input
                                value={entrega.ciudad}
                                onChange={(e) => setEntrega((d) => ({ ...d, ciudad: e.target.value }))}
                                placeholder="Ciudad"
                                style={{ flex: "1 1 110px", padding: "6px 8px", fontSize: 12, borderRadius: 8, border: "1px solid var(--gris-200)" }}
                              />
                              <input
                                value={entrega.provincia}
                                onChange={(e) => setEntrega((d) => ({ ...d, provincia: e.target.value }))}
                                placeholder="Provincia"
                                style={{ flex: "1 1 110px", padding: "6px 8px", fontSize: 12, borderRadius: 8, border: "1px solid var(--gris-200)" }}
                              />
                              <button
                                type="button"
                                onClick={() => setCambiandoEntrega(false)}
                                style={{
                                  padding: "6px 12px", fontSize: 12, fontWeight: 800, borderRadius: 8,
                                  border: "none", background: "var(--marca)", color: "#fff", cursor: "pointer",
                                }}
                              >
                                Listo
                              </button>
                            </div>
                          </div>
                        )}

                        {recargoDeEntrega ? (
                          <div style={{ marginTop: 6, padding: "6px 10px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fbbf24", color: "#92400e", fontSize: 11.5 }}>
                            Fuera de la península la entrega puede llevar un recargo. Te lo
                            confirmamos antes de que pagues nada.
                          </div>
                        ) : (
                          <p style={{ margin: "6px 0 0", fontSize: 11.5, color: isDark ? "var(--gris-400)" : "var(--gris-500)", lineHeight: 1.6 }}>
                            Los dos tramos van en el precio. La calle la puedes cambiar hasta
                            que pagues el depósito.
                          </p>
                        )}
                      </div>

                      {/*
                        * Lo que se contrata aparte.
                        *
                        * Solo dos, y ninguno con precio: el seguro no lo tendrá hasta que
                        * haya correduría, y el reacondicionado no lo puede tener hasta
                        * que el coche llegue a la campa y se mire. Los dos salen como
                        * «a consultar» y no suman nada: no se puede sumar lo que no se
                        * sabe.
                        *
                        * Y ninguno entra en la fianza, que se dice aquí abajo.
                        */}
                      {servicios.length > 0 && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--gris-200)" }}>
                          <div style={{ fontSize: 11.5, fontWeight: 800, color: isDark ? "var(--gris-300)" : "var(--gris-600)", marginBottom: 6 }}>
                            Si quieres, aparte
                          </div>

                          {servicios.map((sv) => {
                            const marcado = serviciosElegidos.includes(sv.id);
                            return (
                              <label
                                key={sv.id}
                                style={{
                                  display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer",
                                  padding: "7px 9px", marginBottom: 5, borderRadius: 8,
                                  border: marcado ? "1px solid var(--marca)" : "1px solid var(--gris-200)",
                                  background: marcado ? (isDark ? "rgba(37,99,235,0.10)" : "rgba(37,99,235,0.04)") : "transparent",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={marcado}
                                  onChange={() => setServiciosElegidos((antes) => (
                                    antes.includes(sv.id) ? antes.filter((x) => x !== sv.id) : [...antes, sv.id]
                                  ))}
                                  style={{ marginTop: 2, cursor: "pointer" }}
                                />
                                <span style={{ flex: 1 }}>
                                  <span style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, fontWeight: 700, color: isDark ? "var(--gris-200)" : "var(--gris-800)" }}>
                                    <span>{sv.nombre}</span>
                                    <span style={{ whiteSpace: "nowrap", color: sv.precio != null ? (isDark ? "var(--gris-200)" : "var(--gris-800)") : (isDark ? "var(--gris-500)" : "var(--gris-400)"), fontWeight: sv.precio != null ? 800 : 600 }}>
                                      {sv.precio != null ? `+${formatCurrency(sv.precio)}` : "a consultar"}
                                    </span>
                                  </span>
                                  <span style={{ display: "block", fontSize: 11.5, color: isDark ? "var(--gris-400)" : "var(--gris-500)", lineHeight: 1.5, marginTop: 2 }}>
                                    {sv.resumen}
                                  </span>
                                </span>
                              </label>
                            );
                          })}

                          {sumaDeServicios > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--gris-200)", fontSize: 13, fontWeight: 800, color: isDark ? "var(--gris-200)" : "var(--gris-800)" }}>
                              <span>Con los servicios</span>
                              <span>{formatCurrency(precioConGarantia + sumaDeServicios)}</span>
                            </div>
                          )}

                          <p style={{ margin: "6px 0 0", fontSize: 11.5, color: isDark ? "var(--gris-400)" : "var(--gris-500)", lineHeight: 1.6 }}>
                            Ninguno entra en el depósito: se factura aparte, y siempre
                            presupuestado antes.
                          </p>
                        </div>
                      )}
                      {Array.isArray(selectedPortalVoOffer.importAparte) && selectedPortalVoOffer.importAparte.length > 0 && (
                        <p style={{ margin: "6px 0 0", fontSize: 11.5, color: isDark ? "var(--gris-400)" : "var(--gris-500)", lineHeight: 1.6 }}>
                          Se factura aparte, y siempre presupuestado antes: {selectedPortalVoOffer.importAparte.join(", ").toLowerCase()}.
                        </p>
                      )}
                    </div>
                  )}
                  <div style={{ background: isDark ? "rgba(5,150,105,0.12)" : "rgba(5,150,105,0.06)", border: "1px solid rgba(5,150,105,0.25)", borderRadius: 12, padding: "12px 14px", marginTop: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: isDark ? "#34d399" : "#047857", marginBottom: 6 }}>Por qué es una buena oferta</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: isDark ? "var(--gris-300)" : "var(--gris-700)", lineHeight: 1.8 }}>
                      {selectedPortalVoOffer.marketPriceEs != null && (
                        <li>Precio medio en España: <strong>{precioEspanolMedio.toLocaleString("es-ES")} €</strong>{ahorroConGarantia > 0 ? ` — ahorras ~${ahorroConGarantia.toLocaleString("es-ES")} €` : ""}.</li>
                      )}
                      {selectedPortalVoOffer.importComparables != null && (
                        <li>Contrastado con <strong>{selectedPortalVoOffer.importComparables} vehículos comparables</strong> del mercado español.</li>
                      )}
                      <li>Lo <strong>compramos, importamos y matriculamos</strong> nosotros por ti.</li>
                      {/*
                        * La garantía ya no va incluida: no le vendemos el coche, así
                        * que no se la debemos. Lo que sí va incluido, y es lo que de
                        * verdad se compra, es que reclamamos nosotros.
                        */}
                      <li><strong>Entrega en tu casa</strong> en toda la península.</li>
                      <li>Si hay que reclamarle algo al vendedor alemán, <strong>lo hacemos nosotros</strong>.</li>
                    </ul>
                  </div>
                  {/*
                    * El depósito, y sobre todo cuándo se suelta.
                    *
                    * Antes esto era un aviso amarillo de «fianza del 30 %», que es
                    * el tono de una condición que hay que tragarse. Y ahora la
                    * cifra es mucho mayor —el coche entero—, así que un aviso en
                    * amarillo asustaría por la razón equivocada.
                    *
                    * Lo que tranquiliza no es el número: es que el dinero no se
                    * mueve hasta que uno de los nuestros ve el coche. Eso va en
                    * verde y va primero.
                    */}
                  {depositoImport > 0 && (
                    <div style={{ background: isDark ? "rgba(5,150,105,0.12)" : "rgba(5,150,105,0.06)", border: "1.5px solid rgba(5,150,105,0.35)", borderRadius: 12, padding: "12px 14px", marginTop: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: isDark ? "#34d399" : "#047857", marginBottom: 4 }}>
                        No se paga a Alemania hasta que veamos el coche
                      </div>
                      <div style={{ fontSize: 12.5, color: isDark ? "var(--gris-300)" : "#065f46", lineHeight: 1.6 }}>
                        Pagas <strong style={{ fontSize: 15 }}>{formatCurrency(depositoImport)}</strong>: el coche,
                        nuestro servicio y el impuesto. <strong>No se lo pagamos al vendedor</strong> hasta
                        que uno de los nuestros está delante del coche en Alemania y confirma que es el
                        que se anunció. Si no lo es, te lo devolvemos entero.
                      </div>
                      {/*
                        * El impuesto va a cuenta, y hay que decirlo aquí.
                        *
                        * Es una estimación mientras no tengamos el CO₂ de cada coche.
                        * Si fuera un precio cerrado y el real saliera por encima —pasa
                        * en los coches de más de 160 g/km, que pagan el doble del tramo
                        * que estimamos— esa diferencia saldría de nuestro margen.
                        *
                        * Decirlo antes de que pague es lo que permite ajustarlo después
                        * sin que sea una sorpresa. Y como la estimación se equivoca
                        * hacia arriba a propósito, casi siempre es una devolución.
                        */}
                      <div style={{ fontSize: 11.5, color: isDark ? "var(--gris-400)" : "#047857", lineHeight: 1.6, marginTop: 6, opacity: 0.9 }}>
                        El impuesto de matriculación va <strong>a cuenta</strong>: al matricularlo se
                        sabe el importe exacto y se ajusta. Si sale menos, te lo devolvemos;
                        si sale más, se te cobra la diferencia.
                      </div>
                    </div>
                  )}
                </div>
              )}
              {selectedPortalVoOffer.rentingAvailable && isRentingOffer && (() => {
                const durations = getAvailableDurations(selectedPortalVoOffer);
                const kmOptions = selectedPortalVoOffer.rentingPricesJson?.km_options || [selectedPortalVoOffer.rentingKmYear || 15000];
                const selectedPrice = getRentingPriceForSelection(selectedPortalVoOffer, rentingDuration, rentingKm);
                return (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 11, color: isDark ? "#6ee7b7" : "#059669", fontWeight: 700, marginBottom: 8 }}>
                      Renting — elige tu opción
                    </div>
                    {kmOptions.length > 1 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, color: isDark ? "var(--gris-400)" : "var(--gris-500)", fontWeight: 600, marginBottom: 4 }}>km/año</div>
                        <select
                          value={rentingKm}
                          onChange={e => setRentingKm(Number(e.target.value))}
                          style={{ padding: "7px 10px", borderRadius: 8, border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid var(--gris-200)", background: isDark ? "rgba(255,255,255,0.05)" : "var(--gris-50)", color: isDark ? "var(--gris-50)" : "var(--gris-900)", fontSize: 12, outline: "none", cursor: "pointer" }}
                        >
                          {kmOptions.map(km => (
                            <option key={km} value={km}>{Number(km) >= 1000 ? `${(Number(km)/1000).toFixed(0)}.000 km/año` : `${km} km/año`}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {durations.map(d => {
                        const price = getRentingPriceForSelection(selectedPortalVoOffer, d, rentingKm);
                        const isSelected = rentingDuration === d;
                        return (
                          <button
                            key={d} type="button"
                            onClick={() => setRentingDuration(d)}
                            style={{
                              background: isSelected ? (isDark ? "rgba(5,150,105,0.22)" : "var(--gris-50)") : (isDark ? "rgba(52,211,153,0.05)" : "rgba(5,150,105,0.04)"),
                              border: isSelected ? `2px solid #059669` : (isDark ? "1px solid rgba(52,211,153,0.2)" : "1px solid rgba(5,150,105,0.18)"),
                              borderRadius: 10, padding: "8px 14px", textAlign: "center", cursor: "pointer",
                              transform: isSelected ? "scale(1.03)" : "scale(1)",
                              transition: "all 0.12s",
                            }}
                          >
                            <div style={{ fontSize: 10, color: isDark ? "#6ee7b7" : "#059669", fontWeight: 600, marginBottom: 2 }}>{d.replace("m", " meses")}</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: isDark ? "#34d399" : "#059669" }}>{price != null ? `${price} €/mes` : "—"}</div>
                          </button>
                        );
                      })}
                    </div>
                    {/* Step 2: Color selector */}
                    {(() => {
                      const colorMap = {};
                      if (selectedPortalVoOffer.availableUnits?.length > 0) {
                        selectedPortalVoOffer.availableUnits.forEach(u => {
                          const c = u.color || "Sin color";
                          colorMap[c] = (colorMap[c] || 0) + 1;
                        });
                      } else if (selectedPortalVoOffer.availableColors?.length > 0) {
                        selectedPortalVoOffer.availableColors.forEach(c => { colorMap[c] = null; });
                      }
                      const colors = Object.keys(colorMap);
                      if (!colors.length) return null;
                      const maxForSelected = selectedColor ? (colorMap[selectedColor] ?? 1) : 1;
                      return (
                        <>
                          {/* Color cards */}
                          <div style={{ marginTop: 14 }}>
                            <div style={{ fontSize: 10, color: isDark ? "var(--gris-400)" : "var(--gris-500)", fontWeight: 700, letterSpacing: "0.04em", marginBottom: 8 }}>COLOR</div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {colors.map(c => {
                                const avail = colorMap[c];
                                const isSel = selectedColor === c;
                                return (
                                  <button key={c} type="button"
                                    onClick={() => { setSelectedColor(isSel ? null : c); setSelectedQuantity(1); }}
                                    style={{
                                      background: isSel ? (isDark ? "rgba(5,150,105,0.22)" : "var(--gris-50)") : (isDark ? "rgba(255,255,255,0.04)" : "#fff"),
                                      border: isSel ? "2px solid #059669" : (isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid var(--gris-200)"),
                                      borderRadius: 10, padding: "8px 16px", textAlign: "center", cursor: "pointer",
                                      transform: isSel ? "scale(1.03)" : "scale(1)", transition: "all 0.12s",
                                    }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: isSel ? (isDark ? "#34d399" : "#059669") : (isDark ? "var(--gris-50)" : "var(--gris-900)") }}>{c}</div>
                                    {avail !== null && <div style={{ fontSize: 10, color: isDark ? "#6ee7b7" : "#059669", marginTop: 2 }}>{avail} ud{avail !== 1 ? "s" : ""}</div>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Step 3: Quantity selector — only when color selected */}
                          {selectedColor && (
                            <div style={{ marginTop: 12, padding: "10px 14px", background: isDark ? "rgba(255,255,255,0.03)" : "var(--gris-50)", border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid var(--gris-200)", borderRadius: 10 }}>
                              <div style={{ fontSize: 10, color: isDark ? "var(--gris-400)" : "var(--gris-500)", fontWeight: 700, letterSpacing: "0.04em", marginBottom: 8 }}>UNIDADES ({selectedColor})</div>
                              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                                  <button type="button"
                                    onClick={() => setSelectedQuantity(q => Math.max(1, q - 1))}
                                    disabled={selectedQuantity <= 1}
                                    style={{ width: 34, height: 34, borderRadius: "8px 0 0 8px", border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid var(--gris-300)", background: isDark ? "rgba(255,255,255,0.06)" : "#fff", color: isDark ? "var(--gris-50)" : "var(--gris-700)", fontSize: 20, fontWeight: 700, cursor: "pointer", opacity: selectedQuantity <= 1 ? 0.35 : 1 }}>−</button>
                                  <div style={{ width: 48, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid var(--gris-300)", borderLeft: "none", borderRight: "none", background: isDark ? "rgba(255,255,255,0.02)" : "#fff", fontSize: 16, fontWeight: 800, color: isDark ? "var(--gris-50)" : "var(--gris-900)" }}>{selectedQuantity}</div>
                                  <button type="button"
                                    onClick={() => setSelectedQuantity(q => Math.min(maxForSelected, q + 1))}
                                    disabled={selectedQuantity >= maxForSelected}
                                    style={{ width: 34, height: 34, borderRadius: "0 8px 8px 0", border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid var(--gris-300)", background: isDark ? "rgba(255,255,255,0.06)" : "#fff", color: isDark ? "var(--gris-50)" : "var(--gris-700)", fontSize: 20, fontWeight: 700, cursor: "pointer", opacity: selectedQuantity >= maxForSelected ? 0.35 : 1 }}>+</button>
                                </div>
                                <span style={{ fontSize: 11, color: isDark ? "var(--gris-500)" : "var(--gris-400)" }}>máx. {maxForSelected} disponible{maxForSelected !== 1 ? "s" : ""}</span>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                    {selectedPrice != null && (
                      <div style={{ marginTop: 12, fontSize: 12, color: isDark ? "#6ee7b7" : "#059669", fontWeight: 600 }}>
                        Seleccionado: {rentingDuration.replace("m", " meses")} · {Number(rentingKm) >= 1000 ? `${(Number(rentingKm)/1000).toFixed(0)}.000` : rentingKm} km/año · <strong>{selectedPrice} €/mes</strong>{selectedColor ? ` · ${selectedQuantity}x ${selectedColor}` : ""}
                      </div>
                    )}
                  </div>
                );
              })()}
              {selectedPortalVoOffer.rentingAvailable && !isRentingOffer && (() => {
                const plazos = [
                  { label: "12 meses", value: selectedPortalVoOffer.renting12m },
                  { label: "24 meses", value: selectedPortalVoOffer.renting24m },
                  { label: "36 meses", value: selectedPortalVoOffer.renting36m },
                  { label: "48 meses", value: selectedPortalVoOffer.renting48m },
                  { label: "60 meses", value: selectedPortalVoOffer.renting60m },
                ].filter((p) => p.value > 0);
                if (!plazos.length) return null;
                return (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 11, color: isDark ? "#6ee7b7" : "#059669", fontWeight: 700, marginBottom: 6 }}>
                      {t("marketplace.modalityRenting", "Renting")} · {(selectedPortalVoOffer.rentingKmYear || 15000).toLocaleString("es-ES")} km/año
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {plazos.map((p) => (
                        <div key={p.label} style={{ background: isDark ? "rgba(52,211,153,0.08)" : "rgba(5,150,105,0.06)", border: isDark ? "1px solid rgba(52,211,153,0.2)" : "1px solid rgba(5,150,105,0.18)", borderRadius: 10, padding: "6px 12px", textAlign: "center" }}>
                          <div style={{ fontSize: 10, color: isDark ? "#6ee7b7" : "#059669", fontWeight: 600, marginBottom: 2 }}>{p.label}</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: isDark ? "#34d399" : "#059669" }}>{formatCurrency(p.value)}/mes</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>


            <p style={{ margin: "0 0 12px", fontSize: 13, color: bodyColor, lineHeight: 1.7 }}>
              {selectedPortalVoOffer.description}{" "}
              {t("marketplace.detailLocation", {
                location: selectedPortalVoOffer.location,
                mileage: Number(selectedPortalVoOffer.mileage || 0).toLocaleString("es-ES"),
                fuel: selectedPortalVoOffer.fuel.toLowerCase(),
                power: selectedPortalVoOffer.power ? t("marketplace.detailPower", { power: selectedPortalVoOffer.power }) : "",
              })}
            </p>

            {!isImport && specsGrid}


            {/* CTA */}
            {isRentingReserved && (
              <div style={{ marginTop: 16, padding: "10px 14px", background: "#fef9c3", border: "1.5px solid #fbbf24", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#92400e" }}>
                🔒 Unidad en renting reservada para otro cliente
              </div>
            )}
            <button
              type="button"
              onClick={openReqModal}
              disabled={isRentingReserved}
              style={{
                marginTop: isImport ? "auto" : 16,
                width: "100%",
                padding: "14px 0",
                background: isRentingReserved
                  ? (isDark ? "rgba(255,255,255,0.06)" : "rgba(150,150,143,0.18)")
                  : isParticular
                    ? "linear-gradient(135deg,var(--gris-900),var(--gris-700))"
                    : isRentingOffer
                    ? "linear-gradient(135deg,#059669,#047857)"
                    : "linear-gradient(135deg,var(--marca),var(--marca-oscuro))",
                color: isRentingReserved ? (isDark ? "var(--gris-500)" : "var(--gris-400)") : "#fff",
                border: "none",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 800,
                cursor: isRentingReserved ? "not-allowed" : "pointer",
                letterSpacing: "0.02em",
              }}
            >
              {isRentingReserved ? "Unidad reservada" : isImport ? "🌍 Solicitar importación" : !isRentingOffer ? "Solicitar visita" : "🔑 Solicitar esta oferta de renting"}
            </button>
            {!isImport && !isRentingReserved && (
              <>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackFunnelEvent({ event_type: "whatsapp_click", offer_id: selectedPortalVoOffer.id, offer_title: selectedPortalVoOffer.title, modality: isRentingOffer ? "renting" : "compra", section: "detalle" })}
                  style={{ display: "block", textAlign: "center", boxSizing: "border-box", marginTop: 10, width: "100%", padding: "12px 0", background: isDark ? "rgba(255,255,255,0.04)" : "#fff", border: isDark ? "1px solid rgba(255,255,255,0.14)" : "1px solid var(--gris-300)", color: isDark ? "var(--gris-200)" : "var(--gris-900)", borderRadius: 12, fontSize: 13.5, fontWeight: 700, textDecoration: "none" }}
                >
                  💬 Preguntar por WhatsApp
                </a>
                <div style={{ marginTop: 8, textAlign: "center", fontSize: 11, color: isDark ? "var(--gris-500)" : "var(--gris-400)" }}>
                  Sin registro · Respuesta en menos de 24 h
                </div>
                {/* El informe y la vista en 3D van aquí, junto a la visita y el
                    WhatsApp: forman parte de decidir si vale la pena moverse a
                    verlo. Solo si el coche tiene informe — pintarlos siempre
                    dejaba al visitante con una descarga rota y un visor vacío. */}
                {tieneInforme && (
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    <ConditionReportDownload
                      url={`/api/informe-publico/${encodeURIComponent(selectedPortalVoOffer.id)}/informe-de-estado.pdf`}
                      compacto
                    />
                    <ConditionReportAr
                      base={`/api/modelo-3d/${encodeURIComponent(selectedPortalVoOffer.id)}`}
                      titulo={selectedPortalVoOffer.title || "Vehículo"}
                      etiqueta="Ver Realidad Aumentada"
                      compacto
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleGuardarAlerta}
                  style={{ marginTop: 10, width: "100%", background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: isDark ? "#5eead4" : "#137370", textDecoration: "underline", textUnderlineOffset: 2 }}
                >
                  {savedAlert === "ok"
                    ? "✓ Te avisaremos si baja de precio"
                    : savedAlert === "login"
                    ? "Inicia sesión para activar el aviso"
                    : "Guardar y avisarme si baja de precio"}
                </button>
              </>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, marginTop: 16 }}>
          <div style={{ background: panelCardBg, border: "1px solid rgba(150,150,143,0.14)", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11, color: isDark ? "var(--gris-400)" : "var(--gris-800)", fontWeight: 700, marginBottom: 8 }}>{t("marketplace.keyPointsLabel")}</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: bodyColor, fontSize: 12, lineHeight: 1.7 }}>
              {buildPortalVoHighlights(selectedPortalVoOffer).map((item) => (
                <li key={`${selectedPortalVoOffer.id}-${item}`}>{item}</li>
              ))}
            </ul>
          </div>
          <div style={{ background: panelCardBg, border: "1px solid rgba(150,150,143,0.14)", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11, color: isDark ? "var(--gris-400)" : "var(--gris-800)", fontWeight: 700, marginBottom: 8 }}>{t("marketplace.featuresLabel")}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {buildPortalVoEquipment(selectedPortalVoOffer).map((item) => (
                <span key={`${selectedPortalVoOffer.id}-feature-${item}`} style={getOfferBadgeStyle("slate")}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        {mostrarFinanciacion && (
          <div style={{ marginTop: 16 }}>
            <SimuladorFinanciacion
              precio={precioFinanciable}
              isDark={isDark}
              onCuotaChange={setCuotaMensual}
              {...(isImport
                ? {
                    tinPorPlazo: TIPOS_FINANCIACION_IMPORTACION.tinPorPlazo,
                    comisionAperturaPct: TIPOS_FINANCIACION_IMPORTACION.comisionAperturaPct,
                    entradaMaxPct: TIPOS_FINANCIACION_IMPORTACION.entradaMaxPct,
                    plazoPorDefecto: TIPOS_FINANCIACION_IMPORTACION.plazoPorDefecto,
                    entradaMinima: depositoImport,
                    entradaPorDefectoPct: 0.3,
                    mostrarVfg: false,
                    subtitulo: "Sobre el precio final matriculado. Tu reserva cuenta como entrada.",
                    textoCta: "Estudiar mi financiación",
                    nota: "El préstamo se firma cuando el coche ya está matriculado en España (semana 6). Podemos hacer el estudio de viabilidad antes de que reserves, sin coste y sin dejar rastro en tu historial crediticio.",
                  }
                : {})}
            />
          </div>
        )}

        {!isImport && (
          <div style={{ marginTop: 16, borderRadius: 14, border: "1.5px solid #EF9F27", background: isDark ? "rgba(186,117,23,0.08)" : "var(--blanco)", padding: 18 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
              <div style={{ flex: "1 1 240px" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: titleColor }}>¿Y el coche que tienes ahora?</div>
                <div style={{ fontSize: 12.5, color: bodyColor, lineHeight: 1.6, marginTop: 4 }}>
                  Si buscas venderlo, te ayudamos. Te decimos lo que vale hoy en el mercado real, gratis y en 30 segundos.
                </div>
              </div>
              <button type="button" onClick={onTasar} style={{ flexShrink: 0, padding: "11px 22px", borderRadius: 10, border: "none", background: "#BA7517", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                Tasar mi coche
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 20px", borderTop: "1px solid rgba(150,150,143,0.2)", marginTop: 14, paddingTop: 12 }}>
              {["Sin registro", "Precio de venta y de tasación", "Sin compromiso de venta"].map((txt) => (
                <span key={txt} style={{ fontSize: 11.5, color: bodyColor, display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ color: "#BA7517", fontWeight: 800 }}>✓</span> {txt}
                </span>
              ))}
            </div>
          </div>
        )}

        {!isImport && sectionShowcase.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: titleColor, marginBottom: 12 }}>Otros que encajan con tu búsqueda</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 12 }}>
              {sectionShowcase.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => onOpenSection?.(s.nav)}
                  title={`Ir a ${s.label}`}
                  style={{ textAlign: "left", padding: 0, background: isDark ? "rgba(17,17,17,0.4)" : "#fff", border: "1px solid rgba(150,150,143,0.22)", borderRadius: 14, overflow: "hidden", cursor: "pointer", display: "flex", flexDirection: "column" }}
                >
                  {s.offer.image
                    ? <img src={s.offer.image} alt={s.offer.title} referrerPolicy="no-referrer" style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} onError={(e) => { e.target.style.display = "none"; }} />
                    : <div style={{ width: "100%", height: 120, background: isDark ? "var(--gris-800)" : "var(--gris-100)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>🚗</div>}
                  <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: titleColor, lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.offer.title}</div>
                    <div style={{ fontSize: 11, color: bodyColor }}>
                      {[s.offer.year, s.offer.mileage != null ? `${Number(s.offer.mileage).toLocaleString("es-ES")} km` : null, s.offer.price != null ? (s.offer.monthly ? `desde ${formatCurrency(s.offer.price)}/mes` : formatCurrency(s.offer.price)) : null].filter(Boolean).join(" · ")}
                    </div>
                    <div style={{ marginTop: "auto", paddingTop: 6, fontSize: 10.5, fontWeight: 800, color: isDark ? "#5eead4" : "#137370", letterSpacing: "0.2px" }}>{s.label} →</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* REQUEST MODAL */}
      {reqModal && (
        <div
          onClick={() => setReqModal(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: isDark ? "var(--gris-900)" : "#fff",
              border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(150,150,143,0.24)",
              borderRadius: 16, padding: 28, width: "100%", maxWidth: 420,
              boxShadow: "0 24px 64px rgba(0,0,0,0.3)",
            }}
          >
            {/* SlotPicker para ofertas no-renting (importación NO: solicitud directa sin calendario) */}
            {!isRentingOffer && !isImport ? (
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: isDark ? "var(--gris-50)" : "var(--gris-900)", marginBottom: 4 }}>
                  Solicitar visita
                </div>
                <div style={{ fontSize: 12, color: isDark ? "var(--gris-400)" : "var(--gris-500)", marginBottom: 16 }}>
                  {selectedPortalVoOffer.title}
                </div>
                <SlotPicker
                  offerId={selectedPortalVoOffer.id}
                  vehicleTitle={selectedPortalVoOffer.title}
                  userEmail={reqForm.email || currentUser?.email || ""}
                  userName={reqForm.name || currentUser?.name || ""}
                  userPhone={reqForm.phone || currentUser?.phone || ""}
                  source="marketplace"
                  haySesion={haySesion}
                  onEntrar={onEntrar}
                  onBooked={(booking) => {
                    trackLead({ content_name: selectedPortalVoOffer.title, content_ids: [selectedPortalVoOffer.id], currency: "EUR", value: selectedPortalVoOffer.price || 0 });
                    trackFunnelEvent("booking_requested", { offer_id: selectedPortalVoOffer.id, offer_title: selectedPortalVoOffer.title, estado: booking?.status || "pending" });
                    // Sus solicitudes, otra vez, ya: acaba de pedir una visita y
                    // tiene que estar en su panel sin recargar la pagina.
                    if (onSolicitudCreada) onSolicitudCreada();
                  }}
                />
                <button
                  type="button"
                  onClick={() => setReqModal(false)}
                  style={{ marginTop: 16, padding: "8px 20px", background: "none", border: "1.5px solid var(--gris-200)", color: "var(--gris-500)", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13 }}
                >
                  Cerrar
                </button>
              </div>
            ) : reqState === "done" ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>{isRentingOffer ? "🔑" : "✅"}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: isDark ? "var(--gris-50)" : "var(--gris-900)", marginBottom: 8 }}>
                  {isRentingOffer ? "¡Solicitud de renting recibida!" : "¡Solicitud recibida!"}
                </div>
                <div style={{ fontSize: 13, color: isDark ? "var(--gris-400)" : "var(--gris-600)", lineHeight: 1.6 }}>
                  {isImport
                    ? (solicitudHecha?.correoEnviado === false
                        ? "La tenemos guardada, aunque el correo con los datos no ha salido. El siguiente paso es el depósito: hasta que no está, no vamos a ver el coche a Alemania."
                        : "Te hemos mandado un correo con los datos. El siguiente paso es el depósito: hasta que no está, no vamos a ver el coche a Alemania.")
                    : isRentingOffer
                    ? "Te enviaremos un email de confirmación y nos pondremos en contacto contigo para gestionar tu contrato de renting."
                    : "Te contactaremos en menos de 2 horas."}
                </div>

                {/*
                  * Aquí ya no se paga con tarjeta.
                  *
                  * Antes había un botón que abría Stripe y cobraba la fianza del
                  * 30 %. Ahora lo que se deposita es el coche entero más nuestro
                  * servicio, y eso no se cobra con tarjeta: ni por límite ni por
                  * comisión —serían unos 300 € de coste en un coche de 20.000—.
                  *
                  * Va a una cuenta de depósito por transferencia, y los datos de
                  * esa cuenta **no se publican en esta página**. Un número de
                  * cuenta en una pantalla pública es la forma más fácil de que
                  * alguien haga una captura, cambie un dígito y la reenvíe. Se los
                  * damos hablando con él, que además es cuando se resuelven las
                  * dudas que tiene delante de una cifra así.
                  */}
                {isImport && solicitudHecha?.fianza > 0 && (
                  <div style={{ marginTop: 18 }}>
                    {/* Explicado antes: nadie transfiere veinte mil euros sin
                        saber qué pasa después. */}
                    <div style={{ marginBottom: 12 }}>
                      <ComoFuncionaImportacion isDark={isDark} />
                    </div>
                    <div style={{
                      background: isDark ? "rgba(5,150,105,0.12)" : "rgba(5,150,105,0.06)",
                      border: "1.5px solid rgba(5,150,105,0.35)", borderRadius: 10,
                      padding: "12px 14px", marginBottom: 10,
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: isDark ? "#34d399" : "#047857", marginBottom: 4 }}>
                        {solicitudHecha.fianza.toLocaleString("es-ES")} € a la cuenta de depósito
                      </div>
                      <div style={{ fontSize: 12.5, color: isDark ? "var(--gris-300)" : "#065f46", lineHeight: 1.6 }}>
                        Por transferencia, desde tu panel. <strong>No se lo pagamos al
                        vendedor</strong> hasta que uno de los nuestros ve el coche en Alemania y
                        confirma que es el que se anunció. Si no lo es, vuelve entero.
                      </div>
                    </div>
                    {/* La otra respuesta razonable a que te pidan mil euros. Va
                        debajo y sin relleno: es una alternativa, no la acción. */}
                    {llamadaPedida ? (
                      <div style={{ fontSize: 12, color: "#047857", fontWeight: 700, marginTop: 10, textAlign: "center" }}>
                        Anotado: te llamamos antes de nada.
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={pideQueLeLlamen}
                        disabled={pidiendoLlamada}
                        style={{
                          width: "100%", padding: "11px 20px", marginTop: 8,
                          background: "none",
                          border: isDark ? "1.5px solid rgba(255,255,255,0.18)" : "1.5px solid var(--gris-200)",
                          color: isDark ? "var(--gris-300)" : "var(--gris-600)",
                          borderRadius: 10, fontWeight: 700, fontSize: 13,
                          cursor: pidiendoLlamada ? "default" : "pointer",
                        }}
                      >
                        {pidiendoLlamada ? "Anotando…" : "Prefiero que me llaméis antes"}
                      </button>
                    )}
                    <div style={{ fontSize: 11.5, color: isDark ? "var(--gris-400)" : "var(--gris-500)", marginTop: 8, lineHeight: 1.6 }}>
                      Se paga desde tu panel y te emitimos factura del servicio. Si al final
                      no se hace el pedido, se te devuelve. No caduca: puedes dejarlo para
                      luego y pagarlo desde ahí.
                    </div>
                    {errorFianza && (
                      <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 8, lineHeight: 1.5 }}>{errorFianza}</div>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setReqModal(false)}
                  style={{ marginTop: 20, padding: "10px 28px", background: "none", border: "1.5px solid var(--gris-200)", color: isDark ? "var(--gris-400)" : "var(--gris-500)", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 13 }}
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={handleReqSubmit}>
                <div style={{ fontSize: 15, fontWeight: 800, color: isDark ? "var(--gris-50)" : "var(--gris-900)", marginBottom: 4 }}>
                  {isImport ? "🌍 Solicitar importación" : isParticular ? "Solicitar visita al vendedor" : isRentingOffer ? "🔑 Solicitar oferta de renting" : "Solicitar información"}
                </div>
                <div style={{ fontSize: 12, color: isDark ? "var(--gris-400)" : "var(--gris-500)", marginBottom: 18 }}>
                  {selectedPortalVoOffer.title}
                </div>
                {isImport && depositoImport > 0 && (
                  <div style={{ background: isDark ? "rgba(5,150,105,0.12)" : "rgba(5,150,105,0.06)", border: "1.5px solid rgba(5,150,105,0.35)", borderRadius: 10, padding: "10px 12px", marginBottom: 16, fontSize: 12.5, color: isDark ? "var(--gris-300)" : "#065f46", lineHeight: 1.6 }}>
                    Para pedirlo se deposita <strong>{formatCurrency(depositoImport)}</strong> —el coche y nuestro
                    servicio— en una cuenta de depósito. No se libera hasta que vemos el coche en Alemania.
                    Te llamamos para explicarte el proceso.
                  </div>
                )}

                {!isParticular && !isRentingOffer && !isImport && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    {[["info","Información"],["visit","Visita"]].map(([v, l]) => (
                      <button
                        key={v} type="button"
                        onClick={() => setReqForm((f) => ({ ...f, type: v }))}
                        style={{
                          flex: 1, padding: "8px 0", border: "1px solid",
                          borderColor: reqForm.type === v ? "var(--marca)" : (isDark ? "rgba(255,255,255,0.12)" : "var(--gris-200)"),
                          background: reqForm.type === v ? (isDark ? "rgba(255,196,0,0.18)" : "var(--acento-tenue)") : "transparent",
                          color: reqForm.type === v ? "var(--marca)" : (isDark ? "var(--gris-400)" : "var(--gris-600)"),
                          borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        }}
                      >{l}</button>
                    ))}
                  </div>
                )}

                {isRentingOffer && (() => {
                  const selectedPrice = getRentingPriceForSelection(selectedPortalVoOffer, rentingDuration, rentingKm);
                  const kmLabel = Number(rentingKm) >= 1000 ? `${(Number(rentingKm)/1000).toFixed(0)}.000` : String(rentingKm);
                  return (
                    <div style={{ marginBottom: 16, background: isDark ? "rgba(5,150,105,0.12)" : "var(--gris-50)", border: "1px solid #86efac", borderRadius: 10, padding: "10px 14px" }}>
                      <div style={{ fontSize: 10, color: isDark ? "#6ee7b7" : "#065f46", fontWeight: 600, marginBottom: 4 }}>Opción seleccionada</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#059669" }}>
                        {rentingDuration.replace("m", " meses")} · {kmLabel} km/año{selectedPrice != null ? ` · ${selectedPrice} €/mes` : ""}
                      </div>
                    </div>
                  );
                })()}

                {[
                  ["name", "Nombre *", "text", true],
                  ...(isParticular ? [] : [["phone", "Teléfono *", "tel", true]]),
                  ["email", "Email *", "email", true],
                ].map(([field, label, inputType, required]) => (
                  <div key={field} style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: isDark ? "var(--gris-400)" : "var(--gris-600)", display: "block", marginBottom: 4 }}>{label}</label>
                    <input
                      type={inputType}
                      required={required}
                      value={reqForm[field]}
                      onChange={(e) => setReqForm((f) => ({ ...f, [field]: e.target.value }))}
                      style={{
                        width: "100%", padding: "9px 12px", borderRadius: 8,
                        border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid var(--gris-200)",
                        background: isDark ? "rgba(255,255,255,0.05)" : "var(--gris-50)",
                        color: isDark ? "var(--gris-50)" : "var(--gris-900)", fontSize: 13, outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                ))}

                {/* Last field: depends on type (hidden for renting; importación = solo mensaje, sin agenda) */}
                {isRentingOffer ? null : (isParticular || isImport) ? (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: isDark ? "var(--gris-400)" : "var(--gris-600)", display: "block", marginBottom: 4 }}>Mensaje (opcional)</label>
                    <input
                      type="text"
                      value={reqForm.message}
                      onChange={(e) => setReqForm((f) => ({ ...f, message: e.target.value }))}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid var(--gris-200)", background: isDark ? "rgba(255,255,255,0.05)" : "var(--gris-50)", color: isDark ? "var(--gris-50)" : "var(--gris-900)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                ) : reqForm.type === "visit" ? (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: isDark ? "var(--gris-400)" : "var(--gris-600)", display: "block", marginBottom: 4 }}>¿Cuándo quieres ver el coche?</label>
                    <select
                      value={reqForm.when}
                      onChange={(e) => setReqForm((f) => ({ ...f, when: e.target.value }))}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid var(--gris-200)", background: isDark ? "rgba(255,255,255,0.05)" : "var(--gris-50)", color: isDark ? "var(--gris-50)" : "var(--gris-900)", fontSize: 13, outline: "none", boxSizing: "border-box", cursor: "pointer" }}
                    >
                      <option value="">Selecciona una opción</option>
                      <option value="Lo antes posible">Lo antes posible</option>
                      <option value="Esta semana">Esta semana</option>
                      <option value="La próxima semana">La próxima semana</option>
                      <option value="Me lo indican ellos">Me lo indican ellos</option>
                    </select>
                  </div>
                ) : (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: isDark ? "var(--gris-400)" : "var(--gris-600)", display: "block", marginBottom: 4 }}>¿Cuándo prefieres que te llamemos? (opcional)</label>
                    <input
                      type="text"
                      value={reqForm.when}
                      onChange={(e) => setReqForm((f) => ({ ...f, when: e.target.value }))}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid var(--gris-200)", background: isDark ? "rgba(255,255,255,0.05)" : "var(--gris-50)", color: isDark ? "var(--gris-50)" : "var(--gris-900)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                )}

                {reqError && (
                  <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 10 }}>{reqError}</div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => setReqModal(false)}
                    style={{ flex: 1, padding: "11px 0", border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid var(--gris-200)", background: "transparent", color: isDark ? "var(--gris-400)" : "var(--gris-600)", borderRadius: 10, fontSize: 13, cursor: "pointer" }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={reqState === "submitting"}
                    style={{ flex: 2, padding: "11px 0", background: isRentingOffer ? "linear-gradient(135deg,#059669,#047857)" : "linear-gradient(135deg,var(--marca),var(--marca-oscuro))", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: reqState === "submitting" ? "not-allowed" : "pointer", opacity: reqState === "submitting" ? 0.7 : 1 }}
                  >
                    {reqState === "submitting" ? "Enviando…" : isRentingOffer ? "🔑 Solicitar renting" : "Enviar solicitud"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
