import { BLOG_POSTS } from "../data/blogPosts";

export default function BlogIndexPage({ styles, onOpenPost, onGoHome }) {
  return (
    <div style={{ ...styles.center, maxWidth: 980, textAlign: "left" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ ...styles.blockBadge("Contenido"), marginBottom: 8 }}>BLOG DE MOVILIDAD</div>
          <h2 style={{ margin: "0 0 6px", fontSize: "clamp(28px, 4vw, 36px)", color: "#f8fafc" }}>
            Guias practicas para decidir mejor
          </h2>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: 14, lineHeight: 1.7 }}>
            Articulos utiles sobre compra, renting, coste total y operativa de movilidad en Espana.
          </p>
        </div>
        <button
          type="button"
          onClick={onGoHome}
          style={{
            border: "1px solid rgba(148,163,184,0.34)",
            background: "rgba(15,23,42,0.52)",
            color: "#cbd5e1",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            alignSelf: "flex-start",
          }}
        >
          Volver al inicio
        </button>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {BLOG_POSTS.map((post) => (
          <article
            key={post.slug}
            className="ma-card-soft"
            style={{
              border: "1px solid rgba(148,163,184,0.22)",
              borderRadius: 14,
              background: "rgba(15,23,42,0.55)",
              padding: "14px 12px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: "#67e8f9", fontWeight: 800, letterSpacing: "0.5px" }}>{post.category}</span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>{post.publishedAt} · {post.readTime}</span>
            </div>
            <h3 style={{ margin: "0 0 8px", color: "#e2e8f0", fontSize: 20, lineHeight: 1.35 }}>
              {post.title}
            </h3>
            <p style={{ margin: "0 0 12px", color: "#cbd5e1", fontSize: 13, lineHeight: 1.7 }}>
              {post.description}
            </p>
            <button
              type="button"
              onClick={() => onOpenPost(post.slug)}
              style={{
                border: "1px solid rgba(125,211,252,0.36)",
                background: "rgba(14,165,233,0.12)",
                color: "#bae6fd",
                borderRadius: 10,
                padding: "8px 11px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Leer articulo
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
