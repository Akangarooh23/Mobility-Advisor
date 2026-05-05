import { useTranslation } from "react-i18next";
import "./SellProfessionalAssistPage.css";

export default function SellProfessionalAssistPage({ onGoBack, onGoHome, onStartRequest }) {
  const { t } = useTranslation();

  return (
    <div className="sell-pro-assist-root">
      <div className="back-row">
        <button className="back-btn" type="button" onClick={onGoBack}>
          <svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          {t("sell.goBack")}
        </button>
        <span className="breadcrumb">{t("sell.breadcrumbProfessionalAssist")} <b>{t("sell.professionalFlowHeader")}</b></span>
      </div>

      <div className="hero-card">
        <div className="hero-band" />
        <div className="hero-inner">
          <div className="badge">{`${t("sell.optionBBadge")} · ${t("sell.professionalFlowHeader")}`}</div>
          <h1 className="hero-title">{t("sell.professionalHeroTitle")}</h1>
          <p className="hero-desc">
            {t("sell.professionalHeroDesc")}
          </p>
          <div className="hero-meta">
            <div className="mpill">
              <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              {t("sell.professionalMetaPersonalManager")}
            </div>
            <div className="mpill">
              <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              {t("sell.professionalMetaFullService")}
            </div>
            <div className="mpill">
              <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.81A16 16 0 0 0 16 16.9l.86-.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
              {t("sell.professionalMetaNoSpam")}
            </div>
          </div>
        </div>
      </div>

      <div className="flow-card">
        <div className="flow-band" />
        <div className="flow-inner">
          <div className="blabel"><div className="blabel-dot" />{t("sell.professionalFlowHeader")}</div>
          <div className="steps-grid">
            <div className="step-block">
              <div className="step-left"><div className="step-circle">1</div></div>
              <div className="step-right">
                <div className="step-label">{t("sell.professionalStep1Label")}</div>
                <div className="step-title">{t("sell.professionalStep1Title")}</div>
                <div className="step-desc">{t("sell.professionalStep1Desc")}</div>
                <div className="step-tag tag-opt">{t("sell.professionalStep1Tag")}</div>
                <div className="detail-box">
                  <div className="detail-feat">{t("sell.professionalStep1Feat1")}</div>
                  <div className="detail-feat">{t("sell.professionalStep1Feat2")}</div>
                  <div className="detail-feat">{t("sell.professionalStep1Feat3")}</div>
                </div>
              </div>
            </div>

            <div className="step-block">
              <div className="step-left"><div className="step-circle">2</div></div>
              <div className="step-right">
                <div className="step-label">{t("sell.professionalStep2Label")}</div>
                <div className="step-title">{t("sell.professionalStep2Title")}</div>
                <div className="step-desc">{t("sell.professionalStep2Desc")}</div>
                <div className="step-tag tag-inc">{t("sell.professionalStep2Tag")}</div>
                <div className="detail-box">
                  <div className="detail-feat">{t("sell.professionalStep2Feat1")}</div>
                  <div className="detail-feat">{t("sell.professionalStep2Feat2")}</div>
                  <div className="detail-feat">{t("sell.professionalStep2Feat3")}</div>
                </div>
              </div>
            </div>

            <div className="step-block">
              <div className="step-left"><div className="step-circle">3</div></div>
              <div className="step-right">
                <div className="step-label">{t("sell.professionalStep3Label")}</div>
                <div className="step-title">{t("sell.professionalStep3Title")}</div>
                <div className="step-desc">{t("sell.professionalStep3Desc")}</div>
                <div className="step-tag tag-acc">{t("sell.professionalStep3Tag")}</div>
                <div className="detail-box">
                  <div className="detail-feat">{t("sell.professionalStep3Feat1")}</div>
                  <div className="portal-badges">
                    <span className="pb">{t("sell.professionalPortalCoches")}</span>
                    <span className="pb">{t("sell.professionalPortalAutoscout")}</span>
                    <span className="pb">{t("sell.professionalPortalMilanuncios")}</span>
                    <span className="pb">{t("sell.professionalPortalWallapop")}</span>
                  </div>
                  <div className="detail-feat portal-top-gap">{t("sell.professionalStep3Feat2")}</div>
                  <div className="detail-feat">{t("sell.professionalStep3Feat3")}</div>
                </div>
              </div>
            </div>

            <div className="step-block">
              <div className="step-left"><div className="step-circle">4</div></div>
              <div className="step-right">
                <div className="step-label">{t("sell.professionalStep4Label")}</div>
                <div className="step-title">{t("sell.professionalStep4Title")}</div>
                <div className="step-desc">{t("sell.professionalStep4Desc")}</div>
                <div className="step-tag tag-inc">{t("sell.professionalStep4Tag")}</div>
                <div className="detail-box">
                  <div className="detail-feat">{t("sell.professionalStep4Feat1")}</div>
                  <div className="detail-feat">{t("sell.professionalStep4Feat2")}</div>
                  <div className="detail-feat">{t("sell.professionalStep4Feat3")}</div>
                  <div className="detail-feat">{t("sell.professionalStep4Feat4")}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="dark-cta">
        <div className="dc-left">
          <div className="dc-eyebrow">{t("sell.professionalCtaEyebrow")}</div>
          <div className="dc-title">{t("sell.professionalCtaTitle")}</div>
          <div className="dc-sub">{t("sell.professionalCtaSubtitle")}</div>
        </div>
        <div className="dc-right">
          <button className="btn-gold" type="button" onClick={onStartRequest}>
            {t("sell.professionalCtaButton")}
            <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </button>
          <button className="btn-outline" type="button" onClick={onGoHome}>{t("sell.professionalCtaBackButton")}</button>
        </div>
      </div>
    </div>
  );
}