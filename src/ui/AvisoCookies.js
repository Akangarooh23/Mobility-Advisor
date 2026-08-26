import React from "react";
import { useTranslation } from "react-i18next";
import "./AvisoCookies.css";

/**
 * Aviso de cookies.
 *
 * Es una barra al pie, del ancho de la página, y no una capa que tape la
 * pantalla. Dos razones:
 *
 *  - Se puede ver el sitio mientras se decide. Un muro delante del contenido no
 *    lo pide la ley —la AEPD pide informar, poder aceptar y rechazar con la
 *    misma facilidad, y no instalar nada opcional antes del consentimiento—, y
 *    en cambio sí se lleva por delante lo primero que ve quien llega.
 *  - Antes tapaba la entrada del coche del home, que corre al cargar la página:
 *    la animación pasaba entera detrás del velo y al aceptar ya estaba puesto.
 *
 * Por defecto la barra es corta: aceptar y configurar. El detalle por
 * categorías se abre solo si se pide, y entonces la barra crece con su propio
 * scroll. Mientras no se contesta, un velo suave oscurece la página sin taparla
 * ni interceptar los clics.
 */
export default function AvisoCookies({
  preferencias,
  onCambiarPreferencia,
  mostrarAjustes,
  onAlternarAjustes,
  onGuardar,
}) {
  const { t } = useTranslation();

  const CATEGORIAS = [
    { clave: "necessary", fija: true },
    { clave: "analytics" },
    { clave: "personalization" },
    { clave: "marketing" },
  ];

  return (
    <>
      {/* Un velo suave mientras no se ha contestado. Oscurece sin tapar: deja
          ver la página —y la entrada del coche del home— y no intercepta los
          clics, así que la barra sigue sin bloquear nada. */}
      <div className="ac-velo" aria-hidden="true" />

      {/* Un `section` con nombre ya es una region, y no un `dialog`: esto no
          atrapa el foco ni bloquea la página, así que anunciarlo como diálogo
          sería describir algo que no es. */}
      <section className="ac-aviso" aria-label={t("cookies.title")}>
        <div className="ac-caja">
          <div className="ac-texto">
            <h2>{t("cookies.title")}</h2>
            <p>{t("cookies.description")}</p>
          </div>

          <div className="ac-botones">
            <button type="button" className="ac-btn ac-btn-principal" onClick={() => onGuardar("all")}>
              {t("cookies.acceptAll")}
            </button>
            {/* Sin botón de «solo necesarias»: es decisión de producto. Rechazar
                sigue siendo posible desde «configurar cookies», apagando las
                categorías y guardando.

                Aviso para quien lo lea: la guía de cookies de la AEPD pide poder
                rechazar con la misma facilidad con la que se acepta, en el mismo
                nivel del aviso. Con el rechazo a un clic de distancia esto no lo
                cumple, y lo mismo vale para las de marketing activadas de
                entrada. Devolver el botón es una línea. */}
            <button
              type="button"
              className="ac-btn ac-btn-plano"
              aria-expanded={Boolean(mostrarAjustes)}
              onClick={onAlternarAjustes}
            >
              {mostrarAjustes ? t("cookies.hideSettings") : t("cookies.showSettings")}
            </button>
          </div>
        </div>

        {mostrarAjustes && (
          <div className="ac-detalle">
            <p className="ac-nota">{t("cookies.note")}</p>

            <div className="ac-tipos">
              {CATEGORIAS.map(({ clave, fija }) => {
                const activa = Boolean(preferencias[clave]);
                return (
                  <div className="ac-tipo" key={clave}>
                    <div>
                      <strong>{t(`cookies.${clave}.title`)}</strong>
                      <small>{t(`cookies.${clave}.description`)}</small>
                    </div>
                    {fija ? (
                      <span className="ac-fija">{t("cookies.alwaysActive")}</span>
                    ) : (
                      <button
                        type="button"
                        className={`ac-interruptor${activa ? " es-activa" : ""}`}
                        aria-pressed={activa}
                        onClick={() => onCambiarPreferencia(clave)}
                      >
                        {activa ? t("cookies.enabled") : t("cookies.disabled")}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="ac-guardar">
              <button type="button" className="ac-btn ac-btn-acento" onClick={() => onGuardar("custom")}>
                {t("cookies.saveSelection")}
              </button>
              <p>{t("cookies.footerHint")}</p>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
