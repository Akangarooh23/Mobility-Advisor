/**
 * El cliente ve por qué esa oferta va primera.
 *
 * Las ofertas se ordenan por cuánto están por debajo de lo que se pide por su
 * mismo coche, pero en la tarjeta no aparecía nada: el cliente veía el orden
 * sin la razón, que es como no tenerla.
 *
 * ## Lo que se comprueba, y por qué es esto y no otra cosa
 *
 * Que la frase diga **lo que la cifra es y lo que no**. La mediana sale de los
 * anuncios del mismo modelo, año y tramo de kilómetros, y no distingue
 * acabados: un Golf base y un GTI entran en la misma. Así que sitúa la oferta
 * en su mercado y no afirma lo que vale ese coche. Si la tarjeta dijera «vale
 * 20.000 €», estaríamos tasando un coche que no hemos visto.
 */
import { render, screen } from "@testing-library/react";
import ResultsOffersView from "./ResultsOffersView";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k) => k, i18n: { language: "es" } }),
}));

const OFERTA = {
  id: "o-1",
  title: "Volkswagen Golf 2022",
  url: "https://ejemplo.es/golf",
  price: 18690,
  source: "coches.net",
  mercado: { mediana: 26380, ahorro: 7690, comparables: 1268 },
};

function pinta(featuredOffer) {
  render(
    <ResultsOffersView
      themeMode="light"
      quickValidationQuestions={[]}
      displayResult={{}}
      quickValidationAnswers={{}}
      updateQuickValidationAnswer={() => {}}
      MONTHLY_BUDGET_OPTIONS={[]}
      INCOME_STABILITY_OPTIONS={[]}
      listingFilters={{}}
      updateListingFilter={() => {}}
      canSearchListing
      searchRealListing={() => {}}
      featuredOffer={featuredOffer}
      otherOffers={[]}
      ResolvedOfferImage={() => null}
      openOfferInProductSheet={() => {}}
      openOfferInNewTab={() => {}}
      getOfferTrustBadges={() => []}
      getOfferBadgeStyle={() => ({})}
      toggleSavedRecommendation={() => {}}
      isRecommendationSaved={() => false}
      getOfferActionMeta={() => ({})}
    />
  );
}

describe("lo que se ahorra, en la tarjeta", () => {
  test("se dice cuánto y con cuántos coches se ha comparado", () => {
    pinta(OFERTA);

    /*
     * Se busca con los dígitos pegados y no con «7.690 €»: el separador de
     * miles que pone `Intl` depende de la versión de ICU del entorno, y la
     * primera versión de esta prueba falló por eso, señalando un texto que en
     * pantalla estaba perfectamente bien.
     */
    const dice = (trozo) =>
      screen.getByText((texto) => texto.replace(/[\s .]/g, "").includes(trozo));

    expect(dice("7690€pordebajo")).toBeInTheDocument();
    expect(dice("1268anunciosparecidos")).toBeInTheDocument();
  });

  test("y se dice «de lo que se pide», no «vale»", () => {
    /*
     * La mediana no distingue acabados: un Golf base y un GTI del mismo ano y
     * kilometros entran en la misma. Decir «vale X» seria tasar un coche que no
     * hemos visto.
     */
    pinta(OFERTA);

    expect(screen.getByText(/de lo que se pide por ese coche/)).toBeInTheDocument();
    expect(screen.queryByText(/\bvale\b/i)).not.toBeInTheDocument();
  });

  test("si está por encima de la mediana, no se dice nada", () => {
    /*
     * Que una oferta sea cara no es motivo para esconderla -puede ser el coche
     * que buscaba- pero tampoco hay que senalarlo en su tarjeta. Se ordena y ya.
     */
    pinta({ ...OFERTA, mercado: { mediana: 17000, ahorro: -1690, comparables: 900 } });

    expect(screen.queryByText(/por debajo/)).not.toBeInTheDocument();
  });

  test("y sin comparables tampoco", () => {
    pinta({ ...OFERTA, mercado: undefined });

    expect(screen.queryByText(/por debajo/)).not.toBeInTheDocument();
  });
});

/**
 * El texto de bienvenida no puede tapar un «no hay ofertas».
 *
 * Cuando la búsqueda volvía vacía, el hueco se rellenaba con la frase de
 * presentación —«la oferta destacada es la que mejor funciona para tu caso»—
 * y quien lo leía veía una pantalla a medias sin saber por qué. El motivo
 * existía y no se pintaba.
 */
describe("cuando no hay ofertas se dice por que", () => {
  const FUENTE = require("fs")
    .readFileSync(require("path").join(__dirname, "ResultsOffersView.js"), "utf8")
    .replace(/\r\n/g, "\n");

  test("la vista recibe el motivo", () => {
    expect(FUENTE).toMatch(/^\s*listingInsight,$/m);
  });

  test("y lo pinta cuando lo hay", () => {
    expect(FUENTE).toContain("{listingInsight && !listingLoading && !listingError && (");
  });

  test("y entonces el texto de bienvenida se calla", () => {
    /*
     * Esta es la condicion que importa: sin el `!listingInsight`, las dos
     * cosas se pintarian a la vez y la explicacion quedaria debajo de la
     * frase generica que la contradice.
     */
    expect(FUENTE).toContain("{!featuredOffer && !listingLoading && !listingError && !listingInsight && (");
  });
});
