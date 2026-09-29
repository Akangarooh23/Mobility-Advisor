import { useCallback, useState } from "react";
import { normalizeText } from "../utils/offerHelpers";

/**
 * La cita del taller, de principio a fin.
 *
 * ## Qué estado es éste
 *
 * Cuatro cosas que solo tienen sentido juntas:
 *
 *   · el coche para el que se pide la cita;
 *   · el tipo de revisión;
 *   · **a dónde se vuelve** si la persona se arrepiente, que no es siempre el
 *     mismo sitio: quien entra desde «Servicios» vuelve ahí, y quien entra
 *     desde «Mantenimiento» vuelve a mantenimiento;
 *   · y el borrador de la reserva, que viaja de la pantalla de la cita a la
 *     del calendario y allí se confirma.
 *
 * ## Por qué salen de `App`
 *
 * Porque se empiezan siempre a la vez, y eso estaba escrito tres veces:
 *
 *     setServiceAppointmentVehicleId("");
 *     setServiceAppointmentTypeTitle("");
 *     setServiceAppointmentBackMode("serviceOptions");
 *     setServiceAppointmentDraft(null);
 *
 * Tres copias de «empieza una cita limpia» son tres sitios donde olvidarse de
 * una de las cuatro. Y olvidarse del borrador es lo peor que puede pasar aquí:
 * la pantalla del calendario lo lee, así que una cita nueva se confirmaría con
 * el taller y la hora de la anterior sin que nada fallara por el camino.
 *
 * Aquí es una llamada, y las cuatro se mueven o no se mueve ninguna.
 *
 * ## Lo que NO hace
 *
 * Navegar. `entryMode` y `step` son de `App`, que es quien sabe qué pantalla
 * toca; esto solo guarda de qué va la cita.
 */
export function useCitaDeServicio() {
  const [vehicleId, setVehicleId] = useState("");
  const [tipo, setTipo] = useState("");
  const [volverA, setVolverA] = useState("serviceOptions");
  const [borrador, setBorrador] = useState(null);

  /**
   * Empieza una cita.
   *
   * Sin argumentos es una cita en blanco desde «Servicios», que es el caso de
   * dos de los tres sitios. Con contexto viene de «Mantenimiento», que ya sabe
   * el coche y la revisión.
   */
  const preparaLaCita = useCallback(({ vehicleId: coche, tipo: revision, volverA: vuelta } = {}) => {
    setVehicleId(normalizeText(coche));
    setTipo(normalizeText(revision));
    setVolverA(normalizeText(vuelta) || "serviceOptions");
    // Siempre a null: el borrador de una cita anterior no vale para ésta.
    setBorrador(null);
  }, []);

  const eligeElCoche = useCallback((id) => {
    setVehicleId(normalizeText(id));
  }, []);

  const guardaElBorrador = useCallback((datos) => {
    setBorrador(datos || null);
  }, []);

  const olvidaElBorrador = useCallback(() => {
    setBorrador(null);
  }, []);

  return {
    citaVehicleId: vehicleId,
    citaTipo: tipo,
    citaVolverA: volverA,
    citaBorrador: borrador,
    preparaLaCita,
    eligeElCoche,
    guardaElBorrador,
    olvidaElBorrador,
  };
}
