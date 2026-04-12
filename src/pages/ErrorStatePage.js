export default function ErrorStatePage({ error, onRetry }) {
  return (
    <div
      style={{
        maxWidth: 500,
        margin: "60px auto",
        padding: "0 20px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          background: "rgba(220,38,38,0.08)",
          border: "1px solid rgba(220,38,38,0.22)",
          borderRadius: 14,
          padding: 24,
        }}
      >
        <p style={{ color: "#fca5a5", marginBottom: 16, fontSize: 13 }}>{error}</p>
        <button
          onClick={onRetry}
          style={{
            background: "#dc2626",
            border: "none",
            color: "white",
            padding: "10px 20px",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Intentar de nuevo
        </button>
      </div>
    </div>
  );
}
