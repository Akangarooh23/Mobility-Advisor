import React from "react";

/**
 * El logotipo de PopCar, en un solo sitio.
 *
 * Va en texto y no como imagen por un motivo concreto: el PNG de marca lleva
 * «Car» en negro, y sobre el pie —que es negro— desaparecia. Solo se veia
 * «Pop». Con el logotipo dibujado en texto el color de cada mitad es explicito
 * y siempre se lee, sea cual sea el fondo.
 *
 * De paso, la cabecera y el pie pasan a ser el mismo componente en todas las
 * pantallas; antes el home usaba texto y el resto de la aplicacion la imagen,
 * y no coincidian.
 *
 *   tono="oscuro" → «Car» en negro. Para fondo claro.
 *   tono="claro"  → «Car» en blanco. Para fondo oscuro.
 */
export default function LogoPopCar({ size = 28, tono = "oscuro", style, ...resto }) {
  return (
    <span
      style={{
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: "-0.055em",
        color: tono === "claro" ? "var(--blanco)" : "var(--gris-900)",
        whiteSpace: "nowrap",
        userSelect: "none",
        ...style,
      }}
      {...resto}
    >
      <span style={{ color: "var(--acento)" }}>Pop</span>Car
    </span>
  );
}
