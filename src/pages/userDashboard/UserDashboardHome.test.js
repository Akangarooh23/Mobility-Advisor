import { fireEvent, render, screen } from "@testing-library/react";
import i18next from "i18next";
import UserDashboardHome from "./UserDashboardHome";

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
