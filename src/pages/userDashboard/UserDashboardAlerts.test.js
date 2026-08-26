import { fireEvent, render, screen } from "@testing-library/react";
import i18next from "i18next";
import UserDashboardAlerts from "./UserDashboardAlerts";

/**
 * Estas seis pruebas vivian en UserDashboardSaved.test.js.
 *
 * Las alertas de mercado empezaron dentro de Guardados y luego se separaron a
 * su propia seccion del panel. Lo que quedo en Guardados fue un bloque de 438
 * lineas envuelto en `{false && (...)}`: codigo que no se renderiza nunca. Las
 * pruebas seguian apuntando ahi, asi que llevaban meses fallando por buscar
 * algo que ningun usuario podia ver.
 *
 * Se busca por la clave de traduccion y no por el texto: cambiar una palabra en
 * es.json no es una regresion y no deberia romper nada. Que desaparezca el
 * boton, si.
 */
const t = (clave, opciones) => i18next.t(clave, opciones);

const ALERTA_TOYOTA = {
  id: "alert-toyota",
  title: "Alerta Compra · Toyota · Corolla",
  createdAt: "11/04/2026, 12:00",
  status: "Vigilando mercado",
  modeLabel: "Compra",
  brand: "Toyota",
  model: "Corolla",
};

const COINCIDENCIA_COROLLA = {
  id: "vo-001",
  title: "Toyota Corolla 120H Active Tech",
  price: 21990,
  location: "Madrid",
  mileage: 34800,
};

/** Lo minimo para montar el componente; cada prueba anade lo suyo. */
function pinta(props = {}) {
  return render(
    <UserDashboardAlerts
      panelStyle={{}}
      formatCurrency={(value) => `${value} €`}
      {...props}
    />
  );
}

test("shows a market alerts section", () => {
  pinta();

  expect(screen.getByText(t("dashboard.alertSectionLabel"))).toBeInTheDocument();
  expect(screen.getByRole("button", { name: t("dashboard.alertAddAlert") })).toBeInTheDocument();
});

test("shows marketplace matches for an active alert", () => {
  pinta({
    marketAlerts: [ALERTA_TOYOTA],
    marketAlertMatches: { "alert-toyota": { count: 1, matches: [COINCIDENCIA_COROLLA] } },
  });

  expect(screen.getByText(t("dashboard.alertMatch", { count: 1 }))).toBeInTheDocument();
  expect(screen.getByText(COINCIDENCIA_COROLLA.title)).toBeInTheDocument();
});

test("opens concrete marketplace offer detail when clicking a match", () => {
  const onOpenMarketplaceOffer = jest.fn();

  pinta({
    marketAlerts: [ALERTA_TOYOTA],
    marketAlertMatches: { "alert-toyota": { count: 1, matches: [COINCIDENCIA_COROLLA] } },
    onOpenMarketplaceOffer,
  });

  fireEvent.click(screen.getByRole("button", { name: t("dashboard.alertViewOffer") }));

  expect(onOpenMarketplaceOffer).toHaveBeenCalledWith(expect.objectContaining({ id: "vo-001" }));
});

test("shows a new matches badge when an alert has unseen offers", () => {
  pinta({
    marketAlerts: [{ ...ALERTA_TOYOTA, id: "alert-byd", title: "Alerta Compra · BYD · Dolphin" }],
    marketAlertMatches: { "alert-byd": { count: 2, matches: [] } },
    marketAlertStatus: { "alert-byd": { seenCount: 1 } },
  });

  // Dos coincidencias, una ya vista: queda una novedad pendiente.
  expect(screen.getByText(t("dashboard.alertsNew", { count: 1 }))).toBeInTheDocument();
  expect(screen.getByRole("button", { name: t("dashboard.alertMarkReviewed") })).toBeInTheDocument();
});

test("shows the email digest button when an alert notifies by email", () => {
  pinta({
    marketAlerts: [{ ...ALERTA_TOYOTA, notifyByEmail: true, email: "cliente@carswise.es" }],
  });

  expect(screen.getByRole("button", { name: t("dashboard.alertSendEmail") })).toBeInTheDocument();
});

test("uses the login email as the default recipient for new alerts", () => {
  pinta({ currentUserEmail: "cliente@carswise.es" });

  fireEvent.click(screen.getByRole("button", { name: t("dashboard.alertAddAlert") }));
  fireEvent.click(screen.getByRole("checkbox", { name: t("dashboard.alertEmailCheckbox") }));

  expect(screen.getByDisplayValue("cliente@carswise.es")).toBeInTheDocument();
});
