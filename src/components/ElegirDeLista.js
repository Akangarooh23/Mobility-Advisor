import { useEffect, useMemo, useState } from "react";
import { OTRA, comoSeAbre, loQueSeGuarda } from "../utils/listaCerrada";

/**
 * Un desplegable de lista cerrada, con salida para lo que no está.
 *
 * Lo usan la aseguradora y la cobertura. Estuvo escrito solo para la primera y
 * se generalizó al llegar la segunda: dos copias de esto serían dos sitios donde
 * arreglar el mismo fallo, y el fallo que tuvo era sutil.
 *
 * ## El texto de «Otra» aparece solo cuando hace falta
 *
 * Enseñarlo siempre convierte un campo en dos y sugiere que hay que rellenar los
 * dos. Enseñarlo solo al elegir «Otra» deja la pantalla como estaba para la
 * inmensa mayoría.
 *
 * ## Por qué hay un estado y solo uno
 *
 * Casi todo se deriva de lo guardado, que es una cadena. Pero **«he elegido Otra
 * y aún no he escrito nada» no se puede derivar**: eso es cadena vacía, igual
 * que no haber elegido nada. La primera versión guardaba vacío al elegir «Otra»,
 * y entonces el desplegable volvía solo a «Elige…» y el hueco para escribir
 * desaparecía antes de poder usarlo. Compilaba, se leía bien y no servía.
 *
 * Así que se recuerda esa intención, y nada más. Se olvida en cuanto llega un
 * valor que sí está en la lista, o al cambiar de coche.
 */
export default function ElegirDeLista({
  valor,
  onCambiar,
  /** `['MAPFRE', …]` o `[{ valor, explica }, …]`. */
  opciones,
  estiloCampo,
  estiloEtiqueta,
  estiloExplicacion,
  etiqueta,
  etiquetaOtra = "¿Cuál?",
  textoOtra = "Otra (escríbela)",
  textoElige = "Elige una opción",
}) {
  const entradas = useMemo(
    () => (opciones || []).map((o) => (typeof o === "string" ? { valor: o, explica: "" } : o)),
    [opciones],
  );
  const nombres = useMemo(() => entradas.map((o) => o.valor), [entradas]);
  const abierta = useMemo(() => comoSeAbre(nombres, valor), [nombres, valor]);
  const [eligioOtra, setEligioOtra] = useState(false);

  // Si lo guardado pasa a ser una de la lista, la intención sobra: la llevaría
  // pegada al siguiente coche que se abriera.
  useEffect(() => {
    if (abierta.seleccion !== "" && abierta.seleccion !== OTRA) setEligioOtra(false);
  }, [abierta.seleccion]);

  const seleccion = abierta.seleccion === OTRA || eligioOtra ? OTRA : abierta.seleccion;
  const explica = entradas.find((o) => o.valor === seleccion)?.explica ?? "";

  return (
    <label style={estiloEtiqueta}>
      {etiqueta}
      <select
        value={seleccion}
        onChange={(evento) => {
          const elegida = evento.target.value;
          setEligioOtra(elegida === OTRA);
          /*
           * Al pasar a «Otra» se limpia lo guardado en vez de arrastrar lo que
           * estaba: quien viene de «MAPFRE» y elige «Otra» no quiere escribir
           * encima de «MAPFRE», quiere escribir la suya.
           */
          onCambiar(elegida === OTRA ? "" : loQueSeGuarda(elegida, ""));
        }}
        style={estiloCampo}
      >
        <option value="">{textoElige}</option>
        {entradas.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.valor}
          </option>
        ))}
        <option value={OTRA}>{textoOtra}</option>
      </select>

      {/* Solo la de la elegida: las diecinueve juntas serían un muro. */}
      {explica !== "" && <span style={estiloExplicacion}>{explica}</span>}

      {seleccion === OTRA && (
        <input
          value={abierta.escrita}
          onChange={(evento) => onCambiar(loQueSeGuarda(OTRA, evento.target.value))}
          placeholder={etiquetaOtra}
          aria-label={etiquetaOtra}
          style={{ ...estiloCampo, marginTop: 6 }}
        />
      )}
    </label>
  );
}
