import "./SellProfessionalAssistPage.css";

export default function SellProfessionalAssistPage({ onGoBack, onGoHome, onStartRequest }) {
  return (
    <div className="sell-pro-assist-root">
      <div className="back-row">
        <button className="back-btn" type="button" onClick={onGoBack}>
          <svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Volver
        </button>
        <span className="breadcrumb">Vender &rsaquo; <b>Venta asistida integral</b></span>
      </div>

      <div className="hero-card">
        <div className="hero-band" />
        <div className="hero-inner">
          <div className="badge">Opción B · Venta asistida integral</div>
          <h1 className="hero-title">Te ayudamos a vender como un profesional</h1>
          <p className="hero-desc">
            Definimos el precio, publicamos en portales, filtramos llamadas, agendamos citas y gestionamos la
            venta completa por ti. Tú solo tienes que estar disponible cuando llegue el comprador.
          </p>
          <div className="hero-meta">
            <div className="mpill">
              <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              Gestor personal
            </div>
            <div className="mpill">
              <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              Gestión completa
            </div>
            <div className="mpill">
              <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.81A16 16 0 0 0 16 16.9l.86-.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
              Sin llamadas de desconocidos
            </div>
          </div>
        </div>
      </div>

      <div className="flow-card">
        <div className="flow-band" />
        <div className="flow-inner">
          <div className="blabel"><div className="blabel-dot" />Flujo B · Venta asistida integral</div>
          <div className="steps-grid">
            <div className="step-block">
              <div className="step-left"><div className="step-circle">1</div></div>
              <div className="step-right">
                <div className="step-label">Paso 1</div>
                <div className="step-title">Revisamos el estado real del vehículo</div>
                <div className="step-desc">Certificación previa para generar confianza desde el primer contacto.</div>
                <div className="step-tag tag-opt">Opcional según caso</div>
                <div className="detail-box">
                  <div className="detail-feat">Inspección presencial si el estado del coche lo requiere</div>
                  <div className="detail-feat">Informe de estado que acompaña al anuncio y genera confianza en compradores</div>
                  <div className="detail-feat">Valoramos si una pequeña preparación mejora el precio de venta</div>
                </div>
              </div>
            </div>

            <div className="step-block">
              <div className="step-left"><div className="step-circle">2</div></div>
              <div className="step-right">
                <div className="step-label">Paso 2</div>
                <div className="step-title">Definimos el precio contigo</div>
                <div className="step-desc">Con apoyo de datos de mercado y posicionamiento frente a otros anuncios.</div>
                <div className="step-tag tag-inc">Análisis incluido</div>
                <div className="detail-box">
                  <div className="detail-feat">Analizamos el mercado actual: precio medio, unidades en venta y días anunciados</div>
                  <div className="detail-feat">Te presentamos un rango de precios competitivo y acordamos juntos el precio de salida</div>
                  <div className="detail-feat">Ajustamos la estrategia según si priorizas rapidez o precio máximo</div>
                </div>
              </div>
            </div>

            <div className="step-block">
              <div className="step-left"><div className="step-circle">3</div></div>
              <div className="step-right">
                <div className="step-label">Paso 3</div>
                <div className="step-title">Publicamos y gestionamos interesados</div>
                <div className="step-desc">Filtrado de llamadas, coordinación y seguimiento comercial.</div>
                <div className="step-tag tag-acc">Sin spam · Sin pérdida de tiempo</div>
                <div className="detail-box">
                  <div className="detail-feat">Redactamos y publicamos anuncios optimizados en los principales portales</div>
                  <div className="portal-badges">
                    <span className="pb">Coches.net</span>
                    <span className="pb">AutoScout24</span>
                    <span className="pb">Milanuncios</span>
                    <span className="pb">Wallapop</span>
                  </div>
                  <div className="detail-feat portal-top-gap">Recibimos y filtramos todas las llamadas y mensajes — solo te trasladamos compradores reales</div>
                  <div className="detail-feat">Coordinamos visitas según tu disponibilidad: los compradores van a tu casa en tu horario</div>
                </div>
              </div>
            </div>

            <div className="step-block">
              <div className="step-left"><div className="step-circle">4</div></div>
              <div className="step-right">
                <div className="step-label">Paso 4</div>
                <div className="step-title">Te acompañamos hasta el cierre</div>
                <div className="step-desc">Soporte en documentación, negociación y venta final.</div>
                <div className="step-tag tag-inc">Trámites incluidos</div>
                <div className="detail-box">
                  <div className="detail-feat">Contrato de compraventa redactado y revisado por nosotros</div>
                  <div className="detail-feat">Notificación a la DGT y gestión de la transferencia de titularidad</div>
                  <div className="detail-feat">Soporte en negociación para que no vendas por debajo de tu objetivo</div>
                  <div className="detail-feat">Acompañamiento hasta que el dinero esté en tu cuenta y la venta esté cerrada</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="dark-cta">
        <div className="dc-left">
          <div className="dc-eyebrow">Empieza hoy</div>
          <div className="dc-title">¿Listo para vender sin complicaciones?</div>
          <div className="dc-sub">Cuéntanos qué coche tienes y en cuánto tiempo quieres venderlo. Te contactamos en menos de 24 horas con un plan personalizado.</div>
        </div>
        <div className="dc-right">
          <button className="btn-gold" type="button" onClick={onStartRequest}>
            Quiero vender mi coche
            <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </button>
          <button className="btn-outline" type="button" onClick={onGoHome}>Volver al inicio</button>
        </div>
      </div>
    </div>
  );
}