import { useTranslation } from "react-i18next";

export default function ServiceAutogestorPage({ onGoBack, onGoHome, onCreateIdCar, onManageIdCars }) {
  const { t } = useTranslation();
  
  const cardStyle = {
    background: "#ffffff",
    borderRadius: 16,
    border: "1px solid #ece8df",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05),0 4px 20px rgba(0,0,0,0.04)",
  };

  const docs = [
    { icon: "📄", name: t("autogestor.circulationPermit"), status: t("autogestor.statusActive"), active: true },
    { icon: "🛡️", name: t("autogestor.insurancePolicy"), status: t("autogestor.statusActive"), active: true },
    { icon: "🔧", name: t("autogestor.lastInvoice"), status: t("autogestor.statusPending"), active: false },
    { icon: "📋", name: t("autogestor.extendedWarranty"), status: t("autogestor.statusPending"), active: false },
    { icon: "🚗", name: t("autogestor.technicalSheet"), status: t("autogestor.statusPending"), active: false },
  ];

  const profileChecks = [
    { label: t("autogestor.matriculaVerified"), ok: true },
    { label: t("autogestor.insuranceLinked"), ok: true },
    { label: t("autogestor.itvPending"), ok: false },
    { label: t("autogestor.completeHistory"), ok: false },
    { label: t("autogestor.warrantyRegistered"), ok: false },
  ];

  return (
    <div style={{ width: "100%", maxWidth: 1040, margin: "0 auto", color: "#1a1a1a", padding: "0 8px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <button
          type="button"
          onClick={onGoBack}
          style={{
            border: "1px solid #ece8df",
            background: "#ffffff",
            borderRadius: 8,
            padding: "7px 12px",
            fontSize: 12,
            color: "#888",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {t("autogestor.back")}
        </button>
        <div style={{ fontSize: 12, color: "#b8b8b8" }}>
          {t("autogestor.breadcrumbServices")} › <span style={{ color: "#2563eb", fontWeight: 700 }}>{t("autogestor.breadcrumbAutogestor")}</span>
        </div>
      </div>

      <section style={{ ...cardStyle, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ height: 4, background: "#3b82f6" }} />
        <div style={{ padding: "26px 28px" }}>
          <div
            style={{
              display: "inline-flex",
              border: "1px solid rgba(59,130,246,0.3)",
              color: "#2563eb",
              background: "rgba(59,130,246,0.08)",
              borderRadius: 20,
              padding: "4px 11px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            {t("autogestor.badge")}
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: "clamp(30px,3.1vw,40px)", letterSpacing: "-0.03em", lineHeight: 1.15, color: "#111" }}>
            {t("autogestor.title")}
          </h2>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: "#868686", maxWidth: 760 }}>
            {t("autogestor.subtitle")}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
            {t("autogestor.features", { returnObjects: true }).map((pill) => (
              <span
                key={pill}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#a0a0a0",
                  border: "1px solid #efebe4",
                  background: "#fafaf9",
                  padding: "5px 12px",
                  borderRadius: 30,
                }}
              >
                {pill}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12, marginBottom: 12 }}>
        <div style={{ ...cardStyle, padding: 22 }}>
          <div style={{ fontSize: 10, color: "#c0c0c0", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>
            {t("autogestor.documentsLabel")}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {docs.map((doc) => (
              <div
                key={doc.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  border: "1px solid #ece8df",
                  borderRadius: 10,
                  background: "#fafaf9",
                  padding: "10px 12px",
                }}
              >
                <span style={{ fontSize: 14 }}>{doc.icon}</span>
                <span style={{ flex: 1, fontSize: 13, color: "#444", fontWeight: 600 }}>{doc.name}</span>
                <span
                  style={{
                    fontSize: 10,
                    borderRadius: 20,
                    padding: "3px 9px",
                    color: doc.active ? "#2563eb" : "#aaa",
                    border: doc.active ? "1px solid rgba(59,130,246,0.35)" : "1px solid #eee",
                    background: doc.active ? "rgba(59,130,246,0.1)" : "#f7f7f7",
                    fontWeight: 700,
                  }}
                >
                  {doc.status}
                </span>
              </div>
            ))}
            <button
              type="button"
              style={{
                border: "1px dashed #e0dcd4",
                borderRadius: 10,
                background: "#fdfcfa",
                padding: "10px 12px",
                textAlign: "left",
                color: "#888",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {t("autogestor.addDocument")}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ ...cardStyle, padding: 18 }}>
            <div style={{ fontSize: 10, color: "#c0c0c0", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 10 }}>
              {t("autogestor.idCarProfileLabel")}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#666", marginBottom: 6, fontWeight: 600 }}>
              <span>{t("autogestor.completeness")}</span>
              <span style={{ color: "#3b82f6" }}>45%</span>
            </div>
            <div style={{ height: 6, background: "#ece8df", borderRadius: 3, overflow: "hidden", marginBottom: 12 }}>
              <div style={{ width: "45%", height: 6, background: "#3b82f6" }} />
            </div>
            <div style={{ display: "grid", gap: 7, marginBottom: 10 }}>
              {profileChecks.map((item) => (
                <div key={item.label} style={{ fontSize: 14, color: item.ok ? "#5f5f5f" : "#b9b9b9", fontWeight: 500 }}>
                  {item.ok ? "✓" : "○"} {item.label}
                </div>
              ))}
            </div>
            <div
              style={{
                border: "1px solid rgba(59,130,246,0.3)",
                background: "rgba(59,130,246,0.08)",
                borderRadius: 12,
                padding: "12px 13px",
                color: "#3b82f6",
                fontSize: 13,
                lineHeight: 1.5,
                fontWeight: 600,
              }}
            >
              {t("autogestor.profileTip")}
            </div>
          </div>

          <div style={{ ...cardStyle, padding: 18 }}>
            <div style={{ fontSize: 10, color: "#c0c0c0", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 10 }}>
              {t("autogestor.upcomingExpirations")}
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {[
                ["ITV", "Nov 2025"],
                [t("autogestor.insurance"), "Mar 2026"],
                [t("autogestor.extendedWarranty"), t("autogestor.notRegistered")],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span style={{ color: "#666", fontWeight: 600 }}>{label}</span>
                  <span style={{ color: value === t("autogestor.notRegistered") ? "#b9b9b9" : "#3b82f6", fontWeight: 700 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          ...cardStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "18px 20px",
        }}
      >
        <div>
          <div style={{ fontSize: 18, color: "#303030", fontWeight: 700, marginBottom: 3 }}>{t("autogestor.activateSection")}</div>
          <div style={{ fontSize: 13, color: "#a2a2a2", lineHeight: 1.45 }}>
            {t("autogestor.activateDescription")}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={onGoBack}
            style={{ border: "none", background: "transparent", color: "#bbb", fontSize: 14, cursor: "pointer" }}
          >
            {t("autogestor.back")}
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof onManageIdCars === "function") {
                onManageIdCars();
                return;
              }
              onGoHome();
            }}
            style={{
              border: "1px solid rgba(59,130,246,0.35)",
              borderRadius: 12,
              background: "rgba(59,130,246,0.08)",
              color: "#2563eb",
              padding: "11px 16px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {t("autogestor.manageIdCars")}
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof onCreateIdCar === "function") {
                onCreateIdCar();
                return;
              }
              onGoHome();
            }}
            style={{
              border: "none",
              borderRadius: 14,
              background: "linear-gradient(135deg,#2563eb,#3b82f6)",
              color: "#fff",
              padding: "12px 20px",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(37,99,235,0.32)",
            }}
          >
            {t("autogestor.createIdCar")}
          </button>
        </div>
      </section>
    </div>
  );
}
