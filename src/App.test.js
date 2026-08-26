import { fireEvent, render, screen } from "@testing-library/react";
import App from "./App";

test("renders the PopCar landing page", () => {
  render(<App />);

  expect(
    screen.getByRole("button", {
      name: /buscamos por ti/i,
    })
  ).toBeInTheDocument();
});

test("shows resume action when there is a saved questionnaire draft", () => {
  window.localStorage.setItem(
    "movilidad-advisor.questionnaireDraft.v1",
    JSON.stringify({
      step: 2,
      advancedMode: false,
      answers: { perfil: "particular", flexibilidad: "renting" },
      updatedAt: new Date().toISOString(),
    })
  );

  render(<App />);

  expect(screen.getByRole("button", { name: /continuar cuestionario/i })).toBeInTheDocument();
});

test.each([
  ["propiedad_contado", "Comprar al contado"],
  ["propiedad_financiada", "Comprar financiado"],
  ["propiedad_entrada_inicial", "Entrada inicial"],
  ["renting", "Renting"],
  ["no_tengo_claro", "No lo tengo claro"],
])("shows resume action with flexibilidad option: %s", (flexibilidadValue, flexibilidadLabel) => {
  window.localStorage.setItem(
    "movilidad-advisor.questionnaireDraft.v1",
    JSON.stringify({
      step: 2,
      advancedMode: false,
      answers: { perfil: "particular", flexibilidad: flexibilidadValue },
      updatedAt: new Date().toISOString(),
    })
  );

  render(<App />);

  expect(screen.getByRole("button", { name: /continuar cuestionario/i })).toBeInTheDocument();
});

test("opens a real registration form from the user access menu", () => {
  render(<App />);

  fireEvent.click(screen.getByRole("button", { name: /iniciar sesión/i }));
  fireEvent.click(screen.getByRole("button", { name: /regístrate/i }));

  expect(screen.getByText(/crear tu cuenta/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
});


/**
 * Las paginas se cargan bajo demanda con lazy(), asi que llegan despues del
 * primer pintado. Esta prueba navega de verdad y espera al trozo: si la
 * frontera de Suspense se rompiera, o una pagina dejara de resolverse, aqui
 * saldria. El resto de pruebas montan la portada, que va por adelantado, y no
 * pasarian nunca por ese camino.
 */
test("loads a lazily-imported page when navigating to it", async () => {
  render(<App />);

  // Sale dos veces, en la cabecera y en el pie: vale cualquiera.
  fireEvent.click(screen.getAllByRole("button", { name: /cómo funciona/i })[0]);

  // Se busca algo que solo existe en esa pagina; el nombre del menu sale
  // tambien en la cabecera y en el pie y no probaria que el trozo ha llegado.
  // findBy espera: mientras tanto, Suspense pinta el hueco.
  expect(
    await screen.findByText(/no sé qué me conviene/i, {}, { timeout: 12000 })
  ).toBeInTheDocument();
  // La pagina es grande y en jsdom tarda: el limite por defecto de Jest son 5 s.
}, 20000);