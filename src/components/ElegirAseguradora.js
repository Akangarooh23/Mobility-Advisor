import { useEffect, useMemo, useState } from "react";
import { ASEGURADORAS, OTRA, comoSeAbre, loQueSeGuarda } from "../utils/aseguradoras";

/**
 * El desplegable de aseguradora, con su salida para las que no están.
 *
 * Vive aquí y no en cada pantalla porque son dos —la ficha del IDCar y la del
 * panel— y una lista repetida es una lista que se separa: el día que entre una
 * compañía nueva, entraría en una sola y nadie se enteraría hasta que un cliente
 * dijera que la suya sale en su móvil y no en el ordenador.
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
 * que no haber elegido nada. La primera versión de esto guardaba vacío al elegir
 * «Otra», y entonces el desplegable volvía solo a «Elige tu aseguradora» y el
 * hueco para escribir desaparecía antes de poder usarlo.
 *
 * Así que se recuerda esa intención, y nada más. Se olvida en cuanto llega un
 * valor que sí está en la lista —porque entonces ya no hay nada que escribir— o
 * al cambiar de coche.
 */
export default function ElegirAseguradora({
  valor,
  onCambiar,
  estiloCampo,
  estiloEtiqueta,
  etiqueta = "Aseguradora",
  etiquetaOtra = "¿Cuál?",
  textoOtra = "Otra (escríbela)",
  textoElige = "Elige tu aseguradora",
}) {
  const abierta = useMemo(() => comoSeAbre(valor), [valor]);
  const [eligioOtra, setEligioOtra] = useState(false);

  // Si lo guardado pasa a ser una de la lista, la intención sobra: la llevaría
  // pegada al siguiente coche que se abriera.
  useEffect(() => {
    if (abierta.seleccion !== "" && abierta.seleccion !== OTRA) setEligioOtra(false);
  }, [abierta.seleccion]);

  const seleccion = abierta.seleccion === OTRA || eligioOtra ? OTRA : abierta.seleccion;

  return (
    <label style={estiloEtiqueta}>
      {etiqueta}
      <select
        value={seleccion}
        onChange={(evento) => {
          const elegida = evento.target.value;
          setEligioOtra(elegida === OTRA);
          /*
           * Al pasar a «Otra» se limpia lo guardado en vez de arrastrar el
           * nombre de la que estaba: quien viene de «MAPFRE» y elige «Otra» no
           * quiere escribir encima de «MAPFRE», quiere escribir la suya.
           */
          onCambiar(elegida === OTRA ? "" : loQueSeGuarda(elegida, ""));
        }}
        style={estiloCampo}
      >
        <option value="">{textoElige}</option>
        {ASEGURADORAS.map((nombre) => (
          <option key={nombre} value={nombre}>
            {nombre}
          </option>
        ))}
        <option value={OTRA}>{textoOtra}</option>
      </select>

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
