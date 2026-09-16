import { fireEvent, render, screen } from "@testing-library/react";
import i18next from "i18next";
import UserDashboardHome, { buildActivityLog } from "./UserDashboardHome";

/**
 * Se busca por la clave de traduccion, no por el texto.
 *
 * Estas pruebas llevaban meses en rojo porque comprobaban frases sueltas
 * —"bandeja de avisos", "abrir alertas"— y el panel se tradujo a i18n. La
 * funcionalidad no se habia movido: solo habia cambiado como se llama en
 * pantalla, y aun asi la prueba decia que estaba rota.
 *
 * Preguntando por la clave, un cambio de redaccion en es.json no rompe nada
 * —que es lo correcto: cambiar una palabra no es una regresion— pero si
 * desaparece el boton o la seccion, la prueba sigue fallando, que es para lo
 * que esta.
 */
const t = (clave, opciones) => i18next.t(clave, opciones);

test("shows an alerts inbox summary on the dashboard home", () => {
  const onNavigate = jest.fn();
  const onMarkAllAlertsSeen = jest.fn();

  render(
    <UserDashboardHome
      counts={{ saved: 3, appointments: 1, valuations: 0, vehicles: 2 }}
      sections={[]}
      panelStyle={{}}
      newAlertMatchesCount={2}
      pendingAlertNotifications={[
        {
          id: "alert-byd",
          title: "Alerta Compra · BYD · Dolphin",
          newMatchesCount: 2,
          summary: "2 coincidencias nuevas detectadas en el marketplace",
        },
      ]}
      onNavigate={onNavigate}
      onMarkAllAlertsSeen={onMarkAllAlertsSeen}
    />
  );

  expect(screen.getByText(t("dashboard.homeNewsTitle"))).toBeInTheDocument();

  // El titulo y el resumen del aviso salen tal cual se le pasan al componente:
  // son datos, no copy, y por eso si se comprueban literales.
  // Sale dos veces: en la lista de avisos y otra vez en la actividad reciente.
  expect(screen.getAllByText("Alerta Compra · BYD · Dolphin").length).toBeGreaterThan(0);
  expect(screen.getAllByText("2 coincidencias nuevas detectadas en el marketplace").length).toBeGreaterThan(0);

  fireEvent.click(screen.getByRole("button", { name: t("dashboard.homeOpenAlerts") }));
  expect(onNavigate).toHaveBeenCalledWith("saved");

  fireEvent.click(screen.getByRole("button", { name: t("dashboard.homeMarkReviewed") }));
  expect(onMarkAllAlertsSeen).toHaveBeenCalled();
});

test("shows an email summary action when notifications have an email recipient", () => {
  const onSendAlertEmailDigest = jest.fn();

  render(
    <UserDashboardHome
      counts={{ saved: 1, appointments: 0, valuations: 0, vehicles: 0 }}
      sections={[]}
      panelStyle={{}}
      newAlertMatchesCount={1}
      pendingAlertNotifications={[
        {
          id: "alert-toyota",
          title: "Alerta Compra · Toyota · Corolla",
          newMatchesCount: 1,
          summary: "1 coincidencia nueva detectada en el marketplace",
          email: "cliente@carswise.es",
          notifyByEmail: true,
        },
      ]}
      onNavigate={() => {}}
      onMarkAllAlertsSeen={() => {}}
      onSendAlertEmailDigest={onSendAlertEmailDigest}
    />
  );

  expect(screen.getAllByText(/cliente@carswise.es/i).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: t("dashboard.homeSendEmail") }));
  expect(onSendAlertEmailDigest).toHaveBeenCalled();
});

describe("la cita del taller en el resumen", () => {
  /*
   * Estaba solo dentro de su solicitud. El resumen es la primera pantalla del
   * panel y es donde mira el que entra a ver cómo va lo suyo: una cita con día
   * y hora que no sale ahí es una cita a la que se llega tarde.
   */
  const encargoConCita = (extra = {}) => ([{
    id: "lead-1",
    type: "venta_gestionada",
    title: "Volkswagen T-Roc · 8888LXR",
    meta: JSON.stringify({
      puertas: [],
      taller: {
        taller: "Norauto Alcobendas",
        direccion: "Calle de los Calabozos 13",
        cita_at: new Date(Date.now() + 86400000 * 4).toISOString(),
        cliente_pidio: "",
        ...extra,
      },
    }),
  }]);

  const log = (solicitudes) => buildActivityLog([], {}, t, [], solicitudes);

  test("sale en la actividad reciente", () => {
    const fila = log(encargoConCita()).find((e) => e.type === "cita-taller");
    expect(fila).toBeTruthy();
    expect(fila.label).toMatch(/Revisión en el taller/);
    expect(fila.detail).toMatch(/Norauto Alcobendas/);
  });

  test("y lleva a su solicitud, que es donde está entera", () => {
    const fila = log(encargoConCita()).find((e) => e.type === "cita-taller");
    expect(fila.section).toBe("solicitudes");
  });

  test("sin cita no se inventa la fila", () => {
    const sinCita = [{ id: "lead-1", type: "venta_gestionada", title: "T-Roc", meta: JSON.stringify({ puertas: [] }) }];
    expect(log(sinCita).find((e) => e.type === "cita-taller")).toBeUndefined();
  });
});
