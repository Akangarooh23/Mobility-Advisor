import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import CapituloHistoria from "../components/historia/CapituloHistoria";
import ProgresoHistoria from "../components/historia/ProgresoHistoria";
import IdCarHilo from "../components/historia/IdCarHilo";
import EscenaMercado from "../components/historia/EscenaMercado";
import EscenaCoche from "../components/historia/EscenaCoche";
import "./ComoFuncionaPage.css";

/**
 * Cómo funciona PopCar, contado con el scroll.
 *
 * Ocho capítulos. Cada uno se queda fijo en pantalla mientras sus escenas se
 * suceden al ritmo que marca el dedo del usuario, y el IdCar de la esquina se va
 * construyendo con lo que cada capítulo aporta de verdad.
 *
 * Esta es la arquitectura: capítulos, sistema de scroll, progreso, hilo
 * conductor y transiciones. Las escenas llevan de momento un hueco marcado con
 * el componente real que va a ocuparlo; se rellenan una a una después.
 *
 * Regla que ordena todo lo que hay aquí: cada movimiento explica una
 * funcionalidad que existe. Lo que no explica nada, no se anima. Y lo que la
 * aplicación no hace todavía no se enseña como si lo hiciera — por eso el
 * capítulo 07 dice que la venta gestionada se solicita hablando con PopCar, que
 * es exactamente lo que pasa hoy al pulsar su botón.
 */

const CAPITULOS = [
  {
    id: "busca",
    n: "01",
    titulo: "Busca",
    titular: "Medio millón de ofertas, hasta dejar las tuyas",
    entrada:
      "Buscar coche no es un catálogo: es todo el mercado español recortándose con cada filtro que pones.",
    escenas: [
      {
        id: "busca-todo",
        pantallas: 5,
        propia: true,
        paso: "Paso 01",
        titulo: "Encuentra tu próximo coche",
        texto:
          "Empiezas con todo el mercado. Cada filtro apaga la parte que no es para ti.",
        componente: "BuscarCochePage · rejilla de ofertas",
        datos: ["569.691 ofertas", "137 marcas", "8 portales"],
      },
      {
        id: "busca-filtros",
        paso: "Paso 02",
        titulo: "Vas recortando",
        texto:
          "Marca y modelo siempre a la vista; el resto se despliega. Cada filtro dice cuántas ofertas quedan antes de que lo pulses.",
        componente: "BuscarCochePage · panel de filtros",
        datos: ["Marca y modelo", "Precio, año, kilómetros", "Potencia, combustible, cambio", "Carrocería y provincia"],
      },
      {
        id: "busca-ficha",
        paso: "Paso 03",
        titulo: "Y abres la que te interesa",
        texto:
          "La oferta abre una ficha de PopCar, no el anuncio del portal. Mismos datos, sin salir de aquí.",
        componente: "VehicleDetailPage",
        datos: ["Ficha propia", "Fotos, precio y kilómetros", "Provincia y vendedor"],
      },
    ],
  },
  {
    id: "descubre",
    n: "02",
    titulo: "Descubre",
    titular: "Y si no sabes qué coche quieres, lo averiguamos",
    entrada:
      "El test no pregunta qué coche te gusta. Pregunta cómo vives, y de ahí sale el coche.",
    escenas: [
      {
        id: "descubre-test",
        paso: "Paso 01",
        titulo: "Veintiuna preguntas, por bloques",
        texto:
          "Perfil, energía, uso real, capacidad, preferencias y prioridades. Ninguna sobre marcas concretas hasta el final.",
        componente: "QuestionnairePage",
        datos: ["Uso y desplazamientos", "Entorno y zona", "Presupuesto", "Prioridades"],
      },
      {
        id: "descubre-ranking",
        paso: "Paso 02",
        titulo: "Salen modelos con nota",
        texto:
          "Cada uno con su puntuación de 0 a 100 y el desglose de por qué encaja contigo. No es un top de ventas: es tu top.",
        componente: "AdviceResultsPage · ranking",
        datos: ["Puntuación 0-100", "Desglose por criterio", "Tres modelos"],
      },
    ],
  },
  {
    id: "decide",
    n: "03",
    titulo: "Decide",
    titular: "Cinco coches enfrentados en cinco ejes",
    entrada:
      "Cuando ya tienes candidatos, el comparador los puntúa y dice cuál gana, con lo que se pierde eligiendo el otro.",
    escenas: [
      {
        id: "decide-meter",
        paso: "Paso 01",
        titulo: "Metes de dos a cinco",
        texto: "Marca, modelo, versión, potencia y año. Nada más.",
        componente: "ComparadorPage · formulario",
        datos: ["De 2 a 5 coches", "Marca y modelo", "Versión, CV y año"],
      },
      {
        id: "decide-ejes",
        paso: "Paso 02",
        titulo: "Se puntúan en cinco ejes",
        texto:
          "Fiabilidad, coste de uso, equipamiento, prestaciones y valor de reventa. Las barras crecen mientras bajas.",
        componente: "ComparadorPage · barras",
        datos: ["Fiabilidad", "Coste de uso", "Equipamiento", "Prestaciones", "Valor de reventa"],
      },
      {
        id: "decide-ganador",
        paso: "Paso 03",
        titulo: "Y hay un ganador razonado",
        texto:
          "Con el cara a cara contra el segundo y en qué caso concreto convendría el otro. También dice lo que no puede saber.",
        componente: "ComparadorPage · tarjeta ganadora",
        datos: ["Ganador y puesto", "Cara a cara", "Cuándo elegir otro", "Límites"],
      },
    ],
  },
  {
    id: "compra",
    n: "04",
    titulo: "Compra",
    titular: "Del coche elegido a la cuota que pagarías",
    entrada:
      "La ficha reúne lo que hay que mirar antes de decidir, y el simulador convierte el precio en una cuota real.",
    escenas: [
      {
        id: "compra-ficha",
        paso: "Paso 01",
        titulo: "Toda la ficha, en un sitio",
        texto:
          "Año, kilómetros, combustible, cambio, potencia, carrocería, distintivo, provincia y vendedor.",
        componente: "VehicleDetailPage",
        datos: ["Ficha completa", "Galería", "Distintivo ambiental"],
      },
      {
        id: "compra-cuota",
        paso: "Paso 02",
        titulo: "Y lo que costaría al mes",
        texto:
          "Entrada, plazo y valor final. El simulador devuelve cuota y TAE, con el interés que corresponde a cada plazo.",
        componente: "SimuladorFinanciacion",
        datos: ["Cuota mensual", "TAE", "Plazo y entrada"],
      },
    ],
  },
  {
    id: "cuentanos",
    n: "05",
    titulo: "Cuéntanos tu coche",
    titular: "Ahora el coche que se vende es el tuyo",
    entrada:
      "El recorrido gira. Lo que hasta aquí era un coche que buscabas pasa a ser el que tienes en la puerta.",
    escenas: [
      {
        id: "cuentanos-datos",
        paso: "Paso 01",
        titulo: "Seis datos",
        texto: "Matrícula, marca, modelo, versión, año y kilómetros.",
        componente: "SellPage · formulario",
        datos: ["Matrícula", "Marca y modelo", "Versión y año", "Kilómetros"],
      },
      {
        id: "cuentanos-idcar",
        paso: "Paso 02",
        titulo: "O ninguno, si ya tienes IdCar",
        texto:
          "Si el coche ya está en tu garaje, sus datos entran solos. Es la primera vez que el IdCar te ahorra trabajo.",
        componente: "SellReportMarketPage · selector de IdCar",
        datos: ["Elegir IdCar", "Datos rellenados", "Sin volver a escribir"],
      },
    ],
  },
  {
    id: "mercado",
    n: "06",
    titulo: "Conoce el mercado",
    titular: "Qué piden hoy por un coche como el tuyo",
    entrada:
      "PopCar no tasa tu coche. Te enseña lo que está pasando en el mercado y te deja decidir el precio con criterio.",
    escenas: [
      {
        id: "mercado-datos",
        paso: "Paso 01",
        titulo: "Precio medio y unidades a la venta",
        texto:
          "En tiempo real, sobre los anuncios publicados en los principales portales. Con la horquilla de salida.",
        componente: "SellReportMarketPage · informe",
        datos: ["Precio medio actual", "Unidades similares", "Horquilla de salida"],
      },
      {
        id: "mercado-limite",
        paso: "Paso 02",
        titulo: "Y lo que esto no es",
        texto:
          "No es una tasación ni una oferta de compra. El precio real depende del estado del coche, y eso solo lo dice una revisión.",
        componente: "Aviso de límites",
        datos: ["No es tasación", "No es oferta", "El estado lo fija el informe"],
      },
    ],
  },
  {
    id: "vende",
    n: "07",
    titulo: "Vende con PopCar",
    titular: "O nos encargamos nosotros de venderlo",
    entrada:
      "Si no quieres gestionarlo, PopCar lo hace por ti. Es un servicio con personas detrás, no un botón que publica solo.",
    escenas: [
      {
        id: "vende-servicio",
        paso: "Paso 01",
        titulo: "Qué incluye",
        texto:
          "Definimos el precio, publicamos en los portales, filtramos las llamadas y agendamos las visitas.",
        componente: "SellProfessionalAssistPage",
        datos: ["Definición de precio", "Publicación", "Filtrado de llamadas", "Citas"],
      },
      {
        id: "vende-solicitar",
        paso: "Paso 02",
        titulo: "Cómo se pide",
        texto:
          "Hablando con nosotros. Hoy el servicio se solicita por contacto y lo lleva una persona; no es un flujo automático dentro de la web.",
        componente: "ContactCarswisePage",
        datos: ["Se solicita por contacto", "Gestor asignado"],
      },
    ],
  },
  {
    id: "gestiona",
    n: "08",
    titulo: "Gestiona tu coche",
    titular: "Y todo lo que le pase, guardado en su IdCar",
    entrada:
      "El coche que encontraste al principio termina aquí: con su ficha, sus papeles, sus avisos y su taller.",
    escenas: [
      {
        id: "gestiona-garaje",
        paso: "Paso 01",
        titulo: "Creas tu garaje",
        texto:
          "Un IdCar por coche, con veintiún campos de ficha. Se sincroniza con tu panel y sobrevive a la venta.",
        componente: "ServiceIdCarsManagePage",
        datos: ["21 campos", "Sincronizado", "Un IdCar por coche"],
      },
      {
        id: "gestiona-papeles",
        paso: "Paso 02",
        titulo: "Metes los papeles",
        texto:
          "Fotos, documentos, ITV, póliza del seguro y facturas de mantenimiento. Cinco tipos, todos dentro.",
        componente: "ServiceIdCarsManagePage · adjuntos",
        datos: ["Fotos", "Documentos", "ITV", "Seguro", "Facturas"],
      },
      {
        id: "gestiona-avisos",
        paso: "Paso 03",
        titulo: "Y te avisamos antes",
        texto:
          "Cruzamos los datos del coche con los intervalos recomendados y te avisamos antes de que caduque la ITV o el seguro.",
        componente: "ServiceMaintenancePage",
        datos: ["Próxima ITV", "Vencimiento del seguro", "Intervalos de mantenimiento"],
      },
      {
        id: "gestiona-taller",
        paso: "Paso 04",
        titulo: "Con taller y hora",
        texto:
          "Talleres de la red sobre el mapa, con sus franjas libres. Eliges una y la cita queda hecha.",
        componente: "WorkshopMapModal · SlotPicker",
        datos: ["Talleres cercanos", "Franjas libres", "Cita confirmada"],
      },
    ],
  },
];

export default function ComoFuncionaPage({ onGoHome }) {
  const [activo, setActivo] = useState(0);
  const [hiloVisible, setHiloVisible] = useState(false);
  const contenedor = useRef(null);
  // La escena 3D se suscribe aqui. Igual que las escenas: por referencia y sin
  // pasar por el estado, porque esto se llama en cada fotograma.
  const escena3d = useRef(null);
  const registrarEscena = useCallback((fn) => { escena3d.current = fn; }, []);

  // Estable: si cambiara en cada render, cada capitulo volveria a montar su
  const marcarActivo = useCallback((indice) => {
    setActivo(indice);
    setHiloVisible(true);
  }, []);

  // ScrollTrigger mide el documento al montar. Con fuentes web y tres imagenes
  // por medio, esa medida se toma antes de tiempo y los capitulos arrancan
  // desplazados; refrescar cuando todo ha cargado lo cuadra.
  useEffect(() => {
    const refrescar = () => ScrollTrigger.refresh();
    window.addEventListener("load", refrescar);
    const t = window.setTimeout(refrescar, 400);
    return () => {
      window.removeEventListener("load", refrescar);
      window.clearTimeout(t);
      // Aquí no se matan los ScrollTrigger: cada capítulo revierte el suyo con
      // `gsap.context`. Barrerlos todos desde el padre se llevaría por delante
      // los de cualquier otro componente que use ScrollTrigger el día de mañana.
    };
  }, []);

  /**
   * La línea de tiempo maestra.
   *
   * Un solo ScrollTrigger sobre todo el recorrido, que traduce el scroll global
   * en el avance de la escena 3D. Los capítulos siguen teniendo el suyo para su
   * texto y sus escenas, pero el coche no es de ninguno: es de la página, y por
   * eso su avance se mide de punta a punta.
   */
  useLayoutEffect(() => {
    const el = contenedor.current;
    if (!el) return undefined;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add(
        { anima: "(prefers-reduced-motion: no-preference)" },
        (contexto) => {
          if (!contexto.conditions.anima) {
            // Sin movimiento, el coche se queda montado y de tres cuartos: el
            // estado en el que mejor se entiende de un solo vistazo.
            escena3d.current?.(0.12);
            return;
          }
          ScrollTrigger.create({
            trigger: el,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.4,
            onUpdate: (self) => { escena3d.current?.(self.progress); },
          });
        }
      );
    }, contenedor);

    return () => ctx.revert();
  }, []);

  const irACapitulo = useCallback((indice) => {
    const seccion = contenedor.current?.querySelectorAll(".cf-capitulo")[indice];
    if (!seccion) return;
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    seccion.scrollIntoView({ behavior: quieto ? "auto" : "smooth", block: "start" });
  }, []);

  return (
    <div className="cf-root" ref={contenedor}>
      <EscenaCoche registrarEscena={registrarEscena} />
      <ProgresoHistoria capitulos={CAPITULOS} activo={activo} onIr={irACapitulo} />
      <IdCarHilo capitulo={activo} visible={hiloVisible} />

      <header className="cf-portada">
        <p className="cf-portada-eyebrow">Cómo funciona</p>
        <h1 className="cf-portada-titulo">
          PopCar va construyendo<br />la historia de tu coche
        </h1>
        <p className="cf-portada-entrada">
          Baja y lo vas viendo. A la izquierda hay una ficha vacía: al final del
          recorrido estará completa, y no habrá en ella un solo dato que PopCar no
          sepa conseguir hoy.
        </p>
        <p className="cf-portada-pista" aria-hidden="true">Baja para empezar</p>
      </header>

      {CAPITULOS.map((capitulo, i) => (
        <CapituloHistoria
          key={capitulo.id}
          capitulo={capitulo}
          indice={i}
          onActivo={marcarActivo}
        >
          {(escena, indiceEscena, registrar) => (escena.propia ? (
            <EscenaMercado registrar={registrar} indice={indiceEscena} />
          ) : (
            /* Hueco de la escena. Lleva el nombre del componente real que va a
               ocuparlo y los datos que enseñara, para que se vea que esta
               pendiente en vez de parecer una maqueta terminada. */
            <div className="cf-hueco">
              <span className="cf-hueco-marca">{escena.componente}</span>
              <ul className="cf-hueco-datos">
                {escena.datos.map((dato) => <li key={dato}>{dato}</li>)}
              </ul>
            </div>
          ))}
        </CapituloHistoria>
      ))}

      <footer className="cf-cierre">
        <h2 className="cf-cierre-titulo">La ficha ya está completa</h2>
        <p className="cf-cierre-texto">
          Ese es el trato: cuantas más cosas hagas con tu coche en PopCar, más
          sabe PopCar de tu coche. Y eso vale tanto para comprarlo como para
          venderlo diez años después.
        </p>
        <button type="button" className="cf-cierre-boton" onClick={onGoHome}>
          Empezar por donde quieras
        </button>
      </footer>
    </div>
  );
}
