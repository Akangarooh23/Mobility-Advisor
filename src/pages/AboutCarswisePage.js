import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  return (
    <div className="cw-about-page">
      <div className="cw-about-bg-orb cw-about-bg-orb-1" aria-hidden="true" />
      <div className="cw-about-bg-orb cw-about-bg-orb-2" aria-hidden="true" />
      <div className="cw-about-bg-grid" aria-hidden="true" />
      <div className="cw-about-shell">
        <section className="cw-about-hero">
          <div className="cw-about-eyebrow">{t("about.eyebrow")}</div>
          <h1 className="cw-about-title">
            {t("about.title")} <span className="cw-about-title-accent">{t("about.titleAccent")}</span>
          </h1>
          <p className="cw-about-description">
            {t("about.description")}
          </p>
        </section>

        <section className="cw-about-stats" aria-label="Indicadores">
          <article className="cw-about-stat">
            <p className="cw-about-stat-number">{t("about.stat1Number")}</p>
            <p className="cw-about-stat-label">{t("about.stat1Label")}</p>
          </article>
          <article className="cw-about-stat">
            <p className="cw-about-stat-number">{t("about.stat2Number")}</p>
            <p className="cw-about-stat-label">{t("about.stat2Label")}</p>
          </article>
          <article className="cw-about-stat">
            <p className="cw-about-stat-number">{t("about.stat3Number")}</p>
            <p className="cw-about-stat-label">{t("about.stat3Label")}</p>
          </article>
        </section>

        <div className="cw-about-divider" />

        <section className="cw-about-section">
          <div className="cw-about-section-label">{t("about.missionLabel")}</div>
          <h2 className="cw-about-section-title">{t("about.missionTitle")}</h2>
          <article className="cw-about-mission">
            <p className="cw-about-mission-text">
              {t("about.missionText")}
            </p>
          </article>
        </section>

        <div className="cw-about-divider" />

        <section className="cw-about-section">
          <div className="cw-about-section-label">{t("about.productLabel")}</div>
          <h2 className="cw-about-section-title">{t("about.productTitle")}</h2>
          <div className="cw-about-grid-three">
            <article className="cw-about-feature-card">
              <div className="cw-about-feature-icon is-buy">🔍</div>
              <div className="cw-about-feature-tag is-buy">{t("about.feature1Tag")}</div>
              <h3 className="cw-about-feature-title">{t("about.feature1Title")}</h3>
              <p className="cw-about-feature-text">
                {t("about.feature1Text")}
              </p>
            </article>

            <article className="cw-about-feature-card">
              <div className="cw-about-feature-icon is-manage">⚙️</div>
              <div className="cw-about-feature-tag is-manage">{t("about.feature2Tag")}</div>
              <h3 className="cw-about-feature-title">{t("about.feature2Title")}</h3>
              <p className="cw-about-feature-text">
                {t("about.feature2Text")}
              </p>
            </article>

            <article className="cw-about-feature-card">
              <div className="cw-about-feature-icon is-sell">📈</div>
              <div className="cw-about-feature-tag is-sell">{t("about.feature3Tag")}</div>
              <h3 className="cw-about-feature-title">{t("about.feature3Title")}</h3>
              <p className="cw-about-feature-text">
                {t("about.feature3Text")}
              </p>
            </article>
          </div>
        </section>

        <div className="cw-about-divider" />

        <section className="cw-about-section">
          <div className="cw-about-section-label">{t("about.teamLabel")}</div>
          <h2 className="cw-about-section-title">{t("about.teamTitle")}</h2>
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
              <div className="cw-about-team-role">{t("about.founder1Role")}</div>
              <div className="cw-about-team-divider" />
              <p className="cw-about-team-bio">{t("about.founder1Bio")}</p>
              <span className="cw-about-team-tag">{t("about.founder1Tag")}</span>
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
              <div className="cw-about-team-role">{t("about.founder2Role")}</div>
              <div className="cw-about-team-divider" />
              <p className="cw-about-team-bio">{t("about.founder2Bio")}</p>
              <span className="cw-about-team-tag">{t("about.founder2Tag")}</span>
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
              <div className="cw-about-team-role">{t("about.founder3Role")}</div>
              <div className="cw-about-team-divider" />
              <p className="cw-about-team-bio">{t("about.founder3Bio")}</p>
              <span className="cw-about-team-tag">{t("about.founder3Tag")}</span>
            </article>
          </div>
        </section>

        <div className="cw-about-divider" />

        <section className="cw-about-section">
          <div className="cw-about-section-label">{t("about.valuesLabel")}</div>
          <h2 className="cw-about-section-title">{t("about.valuesTitle")}</h2>
          <div className="cw-about-grid-three">
            <article className="cw-about-value-card">
              <p className="cw-about-value-number">01</p>
              <h3 className="cw-about-value-title">{t("about.value1Title")}</h3>
              <p className="cw-about-value-text">{t("about.value1Text")}</p>
            </article>
            <article className="cw-about-value-card">
              <p className="cw-about-value-number">02</p>
              <h3 className="cw-about-value-title">{t("about.value2Title")}</h3>
              <p className="cw-about-value-text">{t("about.value2Text")}</p>
            </article>
            <article className="cw-about-value-card">
              <p className="cw-about-value-number">03</p>
              <h3 className="cw-about-value-title">{t("about.value3Title")}</h3>
              <p className="cw-about-value-text">{t("about.value3Text")}</p>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}
