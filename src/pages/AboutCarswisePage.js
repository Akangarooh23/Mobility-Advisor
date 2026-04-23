import { useMemo, useState } from "react";
import "./AboutCarswisePage.css";

function FounderAvatar({ initials, alt, className, candidates = [] }) {
  const normalizedCandidates = useMemo(
    () => (Array.isArray(candidates) ? candidates.filter(Boolean) : []),
    [candidates]
  );
  const [candidateIndex, setCandidateIndex] = useState(0);
  const currentSrc = normalizedCandidates[candidateIndex] || "";

  return (
    <div className={className}>
      <span className="cw-about-team-avatar-fallback">{initials}</span>
      {currentSrc ? (
        <img
          src={currentSrc}
          alt={alt}
          className="cw-about-team-avatar-image"
          onError={() => {
            setCandidateIndex((prev) => {
              if (prev >= normalizedCandidates.length - 1) {
                return prev;
              }
              return prev + 1;
            });
          }}
        />
      ) : null}
    </div>
  );
}

export default function AboutCarswisePage() {
  return (
    <div className="cw-about-page">
      <div className="cw-about-bg-orb cw-about-bg-orb-1" aria-hidden="true" />
      <div className="cw-about-bg-orb cw-about-bg-orb-2" aria-hidden="true" />
      <div className="cw-about-bg-grid" aria-hidden="true" />
      <div className="cw-about-shell">
        <section className="cw-about-hero">
          <div className="cw-about-eyebrow">Sobre CarsWise</div>
          <h1 className="cw-about-title">
            Quienes somos en <span className="cw-about-title-accent">CarsWise</span>
          </h1>
          <p className="cw-about-description">
            CarsWise nace para que cualquier persona compre, gestione y venda su coche con informacion neutral y criterio
            financiero real.
          </p>
        </section>

        <section className="cw-about-stats" aria-label="Indicadores">
          <article className="cw-about-stat">
            <p className="cw-about-stat-number">3</p>
            <p className="cw-about-stat-label">Cofundadores expertos</p>
          </article>
          <article className="cw-about-stat">
            <p className="cw-about-stat-number">100%</p>
            <p className="cw-about-stat-label">Criterio financiero real</p>
          </article>
          <article className="cw-about-stat">
            <p className="cw-about-stat-number">360deg</p>
            <p className="cw-about-stat-label">Cobertura compra, gestion y venta</p>
          </article>
        </section>

        <div className="cw-about-divider" />

        <section className="cw-about-section">
          <div className="cw-about-section-label">Nuestra mision</div>
          <h2 className="cw-about-section-title">El proposito que nos mueve</h2>
          <article className="cw-about-mission">
            <p className="cw-about-mission-text">
              Queremos profesionalizar la movilidad del particular con la misma disciplina de analisis y operacion que hoy
              solo tienen grandes flotas y operadores.
            </p>
          </article>
        </section>

        <div className="cw-about-divider" />

        <section className="cw-about-section">
          <div className="cw-about-section-label">Producto</div>
          <h2 className="cw-about-section-title">Que construimos</h2>
          <div className="cw-about-grid-three">
            <article className="cw-about-feature-card">
              <div className="cw-about-feature-icon is-buy">🔍</div>
              <div className="cw-about-feature-tag is-buy">Compra</div>
              <h3 className="cw-about-feature-title">Recomendacion de modelo</h3>
              <p className="cw-about-feature-text">
                Ranking de oportunidades con foco en coste total para decidir mejor antes de comprar.
              </p>
            </article>

            <article className="cw-about-feature-card">
              <div className="cw-about-feature-icon is-manage">⚙️</div>
              <div className="cw-about-feature-tag is-manage">Gestion</div>
              <h3 className="cw-about-feature-title">Seguimiento del vehiculo</h3>
              <p className="cw-about-feature-text">
                Asistente para mantenimiento, costes y decisiones de continuidad a lo largo del ciclo de vida.
              </p>
            </article>

            <article className="cw-about-feature-card">
              <div className="cw-about-feature-icon is-sell">📈</div>
              <div className="cw-about-feature-tag is-sell">Venta</div>
              <h3 className="cw-about-feature-title">Salida con mejor valor</h3>
              <p className="cw-about-feature-text">
                Estrategia de reventa basada en mercado para capturar el mayor valor residual posible.
              </p>
            </article>
          </div>
        </section>

        <div className="cw-about-divider" />

        <section className="cw-about-section">
          <div className="cw-about-section-label">El equipo</div>
          <h2 className="cw-about-section-title">Las personas detras de CarsWise</h2>
          <div className="cw-about-grid-three">
            <article className="cw-about-team-card">
              <FounderAvatar
                className="cw-about-team-avatar is-1"
                initials="JH"
                alt="Juan Hernandez"
                candidates={[
                  "/team/juan.png",
                  "/team/juan.jpg",
                  "/team/juan.jpeg",
                  "/team/juan.webp",
                  "/team/imagen1.png",
                  "/team/imagen1.jpg",
                  "/team/imagen1.jpeg",
                  "/team/imagen1.webp",
                ]}
              />
              <h3 className="cw-about-team-name">Juan Hernandez</h3>
              <div className="cw-about-team-role">Cofundador</div>
              <div className="cw-about-team-divider" />
              <p className="cw-about-team-bio">
                Trayectoria ejecutiva en renting, seguros y banca. Responsable de crecimiento comercial, alianzas y
                ejecucion operativa.
              </p>
              <span className="cw-about-team-tag">Estrategia y Negocio</span>
            </article>

            <article className="cw-about-team-card">
              <FounderAvatar
                className="cw-about-team-avatar is-2"
                initials="JL"
                alt="Javier Linares"
                candidates={[
                  "/team/javier.png",
                  "/team/javier.jpg",
                  "/team/javier.jpeg",
                  "/team/javier.webp",
                  "/team/imagen2.png",
                  "/team/imagen2.jpg",
                  "/team/imagen2.jpeg",
                  "/team/imagen2.webp",
                ]}
              />
              <h3 className="cw-about-team-name">Javier Linares</h3>
              <div className="cw-about-team-role">Cofundador</div>
              <div className="cw-about-team-divider" />
              <p className="cw-about-team-bio">
                Experiencia en VO, gestion de flotas y operaciones estructuradas. Lidera pricing, unit economics y control
                financiero de la plataforma.
              </p>
              <span className="cw-about-team-tag">Operaciones y Finanzas</span>
            </article>

            <article className="cw-about-team-card">
              <FounderAvatar
                className="cw-about-team-avatar is-3"
                initials="AP"
                alt="Ana Picazo"
                candidates={[
                  "/team/ana.png",
                  "/team/ana.jpg",
                  "/team/ana.jpeg",
                  "/team/ana.webp",
                  "/team/imagen3.png",
                  "/team/imagen3.jpg",
                  "/team/imagen3.jpeg",
                  "/team/imagen3.webp",
                ]}
              />
              <h3 className="cw-about-team-name">Ana Picazo</h3>
              <div className="cw-about-team-role">Cofundadora</div>
              <div className="cw-about-team-divider" />
              <p className="cw-about-team-bio">
                Especialista en software, datos y arquitectura de producto digital. Dirige la hoja de ruta tecnica y la
                calidad de la experiencia CarsWise.
              </p>
              <span className="cw-about-team-tag">Tecnologia y Producto</span>
            </article>
          </div>
        </section>

        <div className="cw-about-divider" />

        <section className="cw-about-section">
          <div className="cw-about-section-label">Lo que nos define</div>
          <h2 className="cw-about-section-title">Nuestros valores</h2>
          <div className="cw-about-grid-three">
            <article className="cw-about-value-card">
              <p className="cw-about-value-number">01</p>
              <h3 className="cw-about-value-title">Transparencia</h3>
              <p className="cw-about-value-text">
                Decisiones basadas en datos y criterio objetivo para el cliente, sin agenda oculta.
              </p>
            </article>
            <article className="cw-about-value-card">
              <p className="cw-about-value-number">02</p>
              <h3 className="cw-about-value-title">Rigor</h3>
              <p className="cw-about-value-text">
                Cada recomendacion combina analisis financiero, contexto de uso y riesgo real.
              </p>
            </article>
            <article className="cw-about-value-card">
              <p className="cw-about-value-number">03</p>
              <h3 className="cw-about-value-title">Ejecucion</h3>
              <p className="cw-about-value-text">
                Convertimos el diagnostico en accion desde la compra hasta la venta del vehiculo.
              </p>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}
