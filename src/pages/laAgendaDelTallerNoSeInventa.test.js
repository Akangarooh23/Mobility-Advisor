/**
 * Si no se puede leer la agenda del taller, no se pintan horas.
 *
 * Cuando la consulta fallaba, la pantalla se caía en un horario inventado: las
 * nueve, las diez, las once... todas libres, en verde y elegibles. Daba igual
 * mientras detrás no hubiera nada, pero ahora las reservas están en la base, y
 * entonces son dos mentiras seguidas: una hora que puede estar cogida, y un
 * error justo al confirmar, porque reservar pasa por la misma base que acaba
 * de fallar.
 *
 * ## Por qué hay que pinchar un día
 *
 * Las horas no salen hasta que se elige el día. La primera versión de esta
 * prueba miraba si había un botón de las nueve nada más pintar la pantalla, y
 * pasaba igual con el arreglo deshecho: no había ninguno porque todavía no
 * había día elegido. Comprobaba el escaparate, no la tienda. Por eso se elige
 * un día y se mira entonces.
 *
 * Y se elige uno del mes siguiente: el horario inventado tacha los días
 * pasados, así que un miércoles de este mes podría salir sin horas por viejo y
 * dar por buena una pantalla que sigue inventando.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ServiceAppointmentCalendarPage from "./ServiceAppointmentCalendarPage";

jest.mock("../utils/apiClient", () => ({
  getWorkshopAvailabilityJson: jest.fn(),
  postWorkshopReservationJson: jest.fn(),
}));

const { getWorkshopAvailabilityJson } = require("../utils/apiClient");

const ENCARGO = { workshopId: "norauto-mad-sur", provider: "Norauto", workshopName: "Norauto Madrid Sur" };

/**
 * El tercer miércoles del mes que viene.
 *
 * Miércoles porque el taller abre; del mes que viene porque está por llegar; y
 * el tercero porque cae entre el 15 y el 21, y ese número de día sale una sola
 * vez en la rejilla —los de principios de mes salen dos, con la cola del mes
 * siguiente, y no se sabría cuál se está pinchando—.
 */
function elDiaQueSePincha() {
  const hoy = new Date();
  const d = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
  let miercoles = 0;
  while (true) {
    if (d.getDay() === 3) {
      miercoles += 1;
      if (miercoles === 3) break;
    }
    d.setDate(d.getDate() + 1);
  }
  return {
    clave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    numero: String(d.getDate()),
  };
}

const DIA = elDiaQueSePincha();

const HORAS_DE_VERDAD = {
  ok: true,
  availabilityByDate: {
    [DIA.clave]: {
      closed: false,
      fullyBooked: false,
      slots: [
        { time: "09:00", available: true },
        { time: "10:00", available: false },
      ],
    },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
});

/** Pinta la pantalla, pasa al mes siguiente y elige el día. */
async function eligeElDia(draft = ENCARGO) {
  render(<ServiceAppointmentCalendarPage bookingDraft={draft} />);
  fireEvent.click(screen.getByRole("button", { name: /Mes siguiente/i }));
  await waitFor(() => expect(screen.getByRole("button", { name: DIA.numero })).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: DIA.numero }));
}

describe("cuando la agenda no se puede leer", () => {
  test("se dice, y no sale ninguna hora", async () => {
    getWorkshopAvailabilityJson.mockResolvedValue({ response: { ok: false }, data: { error: "vaya" } });

    await eligeElDia();

    await waitFor(() => expect(screen.getByText(/No se pudo cargar el horario/i)).toBeInTheDocument());
    // Las nueve son la primera hora del horario inventado. Si sale, la pantalla
    // ha vuelto a prometer huecos que no ha mirado.
    expect(screen.queryByRole("button", { name: "09:00" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "11:00" })).not.toBeInTheDocument();
  });

  test("y se puede volver a intentar", async () => {
    getWorkshopAvailabilityJson.mockResolvedValue({ response: { ok: false }, data: {} });

    render(<ServiceAppointmentCalendarPage bookingDraft={ENCARGO} />);

    await waitFor(() => expect(screen.getByRole("button", { name: /Reintentar/i })).toBeInTheDocument());

    getWorkshopAvailabilityJson.mockResolvedValue({ response: { ok: true }, data: HORAS_DE_VERDAD });
    fireEvent.click(screen.getByRole("button", { name: /Reintentar/i }));

    await waitFor(() => expect(screen.queryByText(/No se pudo cargar el horario/i)).not.toBeInTheDocument());
  });

  test("lo mismo si la peticion ni siquiera llega", async () => {
    getWorkshopAvailabilityJson.mockRejectedValue(new Error("sin red"));

    render(<ServiceAppointmentCalendarPage bookingDraft={ENCARGO} />);

    await waitFor(() => expect(screen.getByText(/No se pudo cargar el horario/i)).toBeInTheDocument());
  });
});

describe("cuando si se puede leer", () => {
  test("salen las horas que dice la agenda, y solo esas", async () => {
    getWorkshopAvailabilityJson.mockResolvedValue({ response: { ok: true }, data: HORAS_DE_VERDAD });

    await eligeElDia();

    await waitFor(() => expect(screen.getByRole("button", { name: "09:00" })).toBeInTheDocument());
    expect(screen.queryByText(/No se pudo cargar el horario/i)).not.toBeInTheDocument();
    // El horario fijo tiene nueve horas; la agenda ha dicho dos.
    expect(screen.queryByRole("button", { name: "11:00" })).not.toBeInTheDocument();
    // Y la que está cogida sale, pero sin poder elegirse: la pone «Ocupado»
    // debajo, y por eso su nombre no es solo la hora.
    expect(screen.getByRole("button", { name: /^10:00\s*Ocupado$/ })).toBeDisabled();
  });
});

describe("un taller sin agenda propia", () => {
  test("sigue con su horario de siempre y sin avisos", async () => {
    /*
     * Sin `workshopId` no hay nada que consultar —la reserva tampoco se
     * intenta— y el horario fijo es lo único que se puede enseñar. Eso no es
     * un fallo, y no debe salir el aviso.
     */
    await eligeElDia({ provider: "Taller del barrio" });

    expect(getWorkshopAvailabilityJson).not.toHaveBeenCalled();
    expect(screen.queryByText(/No se pudo cargar el horario/i)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "09:00" })).toBeInTheDocument());
  });
});
