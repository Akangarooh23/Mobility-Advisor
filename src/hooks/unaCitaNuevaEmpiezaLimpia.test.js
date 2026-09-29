/**
 * La cita del taller: que empezar una nueva no arrastre la anterior.
 *
 * ## Qué había
 *
 * Cuatro `useState` en `App` —el coche, la revisión, a dónde se vuelve y el
 * borrador de la reserva— y este trozo escrito **tres veces**:
 *
 *     setServiceAppointmentVehicleId("");
 *     setServiceAppointmentTypeTitle("");
 *     setServiceAppointmentBackMode("serviceOptions");
 *     setServiceAppointmentDraft(null);
 *
 * ## Por qué esto se prueba y no solo se mueve
 *
 * Porque de las cuatro, olvidarse de una tiene consecuencias muy distintas.
 * Olvidar el coche se ve: la pantalla sale con el coche de antes y quien la
 * usa lo corrige. Olvidar **el borrador** no se ve: la pantalla de la cita
 * parece limpia, pero la del calendario lee el borrador, así que la cita nueva
 * se confirmaría con el taller y la hora de la anterior — y nadie se entera
 * hasta que aparece en un taller equivocado.
 *
 * Con la regla en tres sitios, bastaba con que uno se quedara atrás.
 */

import { renderHook, act } from "@testing-library/react";
import { useCitaDeServicio } from "./useCitaDeServicio";

describe("empezar una cita", () => {
  test("sin contexto, todo en blanco y vuelta a Servicios", () => {
    const { result } = renderHook(() => useCitaDeServicio());

    act(() => result.current.preparaLaCita());

    expect(result.current.citaVehicleId).toBe("");
    expect(result.current.citaTipo).toBe("");
    expect(result.current.citaVolverA).toBe("serviceOptions");
    expect(result.current.citaBorrador).toBeNull();
  });

  test("con contexto, se queda con el coche y la revisión", () => {
    const { result } = renderHook(() => useCitaDeServicio());

    act(() => result.current.preparaLaCita({
      vehicleId: "veh-1",
      tipo: "Revisión de los 60.000",
      volverA: "serviceMaintenance",
    }));

    expect(result.current.citaVehicleId).toBe("veh-1");
    expect(result.current.citaTipo).toBe("Revisión de los 60.000");
    expect(result.current.citaVolverA).toBe("serviceMaintenance");
  });

  test("y una cita nueva NUNCA hereda el borrador de la anterior", () => {
    /*
     * Ésta es la que importa. Si esto deja de pasar, la pantalla del calendario
     * confirma la cita nueva con el taller y la hora de la vieja.
     */
    const { result } = renderHook(() => useCitaDeServicio());

    act(() => result.current.guardaElBorrador({
      workshopName: "Norauto Alcalá",
      appointmentType: "Cambio de aceite",
    }));
    expect(result.current.citaBorrador).not.toBeNull();

    act(() => result.current.preparaLaCita({ vehicleId: "veh-2" }));

    expect(result.current.citaBorrador).toBeNull();
  });

  test("sin decir a dónde se vuelve, se vuelve a Servicios", () => {
    // Quedarse sin sitio al que volver deja a la persona encerrada en la
    // pantalla de la cita.
    const { result } = renderHook(() => useCitaDeServicio());
    act(() => result.current.preparaLaCita({ vehicleId: "veh-3", volverA: "" }));
    expect(result.current.citaVolverA).toBe("serviceOptions");
  });
});

describe("durante la cita", () => {
  test("se puede cambiar de coche sin perder el resto", () => {
    const { result } = renderHook(() => useCitaDeServicio());

    act(() => result.current.preparaLaCita({
      vehicleId: "veh-1", tipo: "ITV", volverA: "serviceMaintenance",
    }));
    act(() => result.current.eligeElCoche("veh-9"));

    expect(result.current.citaVehicleId).toBe("veh-9");
    expect(result.current.citaTipo).toBe("ITV");
    expect(result.current.citaVolverA).toBe("serviceMaintenance");
  });

  test("el borrador se guarda y se olvida", () => {
    const { result } = renderHook(() => useCitaDeServicio());

    act(() => result.current.guardaElBorrador({ workshopName: "Midas" }));
    expect(result.current.citaBorrador.workshopName).toBe("Midas");

    act(() => result.current.olvidaElBorrador());
    expect(result.current.citaBorrador).toBeNull();
  });

  test("y lo que llega con espacios se limpia", () => {
    // Los identificadores vienen de la interfaz y se comparan con los de la
    // base: un espacio de más convierte una coincidencia en un «no existe».
    const { result } = renderHook(() => useCitaDeServicio());
    act(() => result.current.eligeElCoche("  veh-4  "));
    expect(result.current.citaVehicleId).toBe("veh-4");
  });
});
