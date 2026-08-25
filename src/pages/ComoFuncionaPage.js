import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import EscenaMercado from "../components/historia/EscenaMercado";
import { SEARCH_OFFERS_API_ENDPOINT } from "../utils/apiClient";
import "./ComoFuncionaPage.css";

gsap.registerPlugin(ScrollTrigger);

/**
 * Cómo funciona PopCar.
 *
 * Tres bloques —comprar, vender, gestionar— y en cada uno una escena grande que
 * se transforma con el scroll. La idea es que en minuto y medio se entienda qué
 * hace PopCar sin apenas leer: manda lo que se ve y el texto solo pone nombre.
 *
 * Los tres se cuentan igual: arriba las puertas de entrada, siempre a la vista y
 * marcando la que toca, y debajo un acto por puerta que se recorre entero antes
 * de dar paso al siguiente. Solo hay un acto visible cada vez.
 *
 * Todo lo que aparece es interfaz o dato de la aplicación, no maqueta:
 *
 *  - Comprar reutiliza la escena del mercado, que llama al mismo endpoint que el
 *    buscador y pinta ofertas de verdad; después, los cinco ejes del comparador
 *    y el desglose con el que puntúa el test.
 *  - Vender enseña el informe de mercado medido en la base, los tres requisitos
 *    que exige publicar y los cuatro pasos de la venta gestionada.
 *  - Gestionar empieza por el IdCar —los seis apartados de la ficha real— y
 *    sigue con los otros tres servicios, con sus intervalos de mantenimiento y
 *    los precios de su catálogo.
 *
 * Se anima con GSAP y ScrollTrigger, siempre con `scrub`: el usuario mueve la
 * animación, no se le reproduce. Sin 3D. Si algún día una funcionalidad gana
 * algo de verdad con volumen, se añade entonces y solo ahí.
 */

/** Informe de mercado del Golf 2020-2022, contado en la base el 26/08/2026. */
const MERCADO = { unidades: 2638, media: 20739, desde: 16900, hasta: 22690 };
/** Cuatro anuncios del mismo tramo, para ver el precio medio en su contexto. */
const COMPARABLES = [16950, 18400, 21900, 22500];

/**
 * Las tres puertas de entrada de cada bloque, con lo que hay detras de verdad.
 * Las seis existen y funcionan.
 *
 * La de vender por tu cuenta pasa por el IdCar: el boton de la web dice
 * «publicar con IdCar» y lleva a crear la ficha, y desde la ficha se publica en
 * el Marketplace. Al publicar se crea la oferta `idcar-<id>` en la base, asi
 * que el recorrido llega hasta el final.
 */
const CAMINOS = {
  comprar: [
    { id: "claro", titulo: "Sé qué modelo quiero", destino: "Buscar coche" },
    { id: "dudo", titulo: "Dudo entre varios", destino: "Comparador" },
    { id: "nose", titulo: "No sé qué me conviene", destino: "Test PopCar" },
  ],
  vender: [
    { id: "precio", titulo: "Saber lo que vale hoy", destino: "Informe de mercado" },
    { id: "yo", titulo: "Venderlo por mi cuenta", destino: "Marketplace para particulares" },
    { id: "vosotros", titulo: "Que lo vendáis vosotros", destino: "Venta gestionada" },
  ],
};

/**
 * Los cinco ejes con los que puntúa el comparador y los seis bloques del test.
 * Los nombres son los de la aplicación. Las barras van sin cifra a propósito:
 * la puntuación la calcula el análisis para cada caso, y poner aquí un número
 * concreto sería inventarse un resultado.
 */
const EJES_COMPARADOR = ["Fiabilidad", "Coste de uso", "Equipamiento", "Prestaciones", "Valor de reventa"];
const BLOQUES_TEST = ["Perfil", "Energía", "Uso real", "Capacidad", "Preferencias", "Prioridades"];

/**
 * Ejemplo de comparación: tres compactos parecidos de marcas distintas, que es
 * el caso de verdad —se comparan coches que compiten entre sí, no un utilitario
 * con una furgoneta—. La ficha es la del comparador: puesto, nota sobre cien y
 * los cinco ejes con su valor.
 *
 * Las puntuaciones son de muestra, y el pie lo dice: en la aplicación las
 * calcula el análisis para los coches que añada cada uno.
 */
const COMPARADOS = [
  { marca: "Toyota", modelo: "Corolla", version: "1.8 Hybrid 140 CV", puntos: 87, detalle: [92, 88, 74, 70, 86] },
  { marca: "Volkswagen", modelo: "Golf", version: "1.5 TSI 130 CV", puntos: 81, detalle: [82, 72, 86, 84, 80] },
  { marca: "Seat", modelo: "León", version: "1.5 TSI 130 CV", puntos: 78, detalle: [79, 76, 82, 80, 72] },
];

/**
 * El desglose con el que puntúa el análisis del test, con los pesos que usa de
 * verdad (25 + 20 + 20 + 20 + 15 = 100). Lo logrado suma 92, que es la
 * coincidencia que enseña la tarjeta: la cifra no está puesta a ojo.
 */
const PESOS_TEST = [
  { nombre: "Encaje con tu uso", peso: 25, logrado: 23 },
  { nombre: "Coste total", peso: 20, logrado: 17 },
  { nombre: "Flexibilidad", peso: 20, logrado: 19 },
  { nombre: "Viabilidad real", peso: 20, logrado: 18 },
  { nombre: "Ajuste contigo", peso: 15, logrado: 15 },
];
const COINCIDENCIA = PESOS_TEST.reduce((a, b) => a + b.logrado, 0);

/** Y el test termina en ofertas, cada una con su porcentaje de encaje. */
const MEJORES = [
  { coche: "Toyota Corolla 1.8 Hybrid", datos: "2021 · 19.900 €", encaje: 94 },
  { coche: "Kia Ceed 1.6 GDi HEV", datos: "2022 · 21.400 €", encaje: 89 },
];

/** Los nodos del cerebro, donde acaba cada rama. */
const NODOS = [[38, 40], [34, 62], [40, 82], [82, 40], [86, 62], [80, 82], [60, 52]];
/** Las ramas que salen de la línea central hacia cada nodo. */
const RAMAS = [
  "M60 34C50 34 46 40 38 40", "M60 52C48 52 44 60 34 62", "M60 72C50 72 46 78 40 82",
  "M60 34C70 34 74 40 82 40", "M60 52C72 52 76 60 86 62", "M60 72C70 72 74 78 80 82",
];

/**
 * El análisis del test, dibujado.
 *
 * No es un icono de archivo: es un cerebro con su línea central y las seis
 * ramas por las que entran las respuestas, y se traza con el scroll —primero el
 * contorno, luego las conexiones y al final se encienden los nodos— para que se
 * lea como algo que está pensando, no como una estampa.
 *
 * El trazado usa `pathLength="1"`: así el recorrido de cada línea va de 1 a 0
 * sin medir nada, y sale igual de bien en un contorno largo que en una rama
 * corta.
 */
function Cerebro() {
  return (
    <svg className="cf-cerebro-svg" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <path
        className="cf-cerebro-borde"
        pathLength="1"
        d="M60 18C52 10 38 12 34 22C24 22 18 32 22 41C14 47 14 61 22 67C18 78 26 90 38 90C42 100 56 103 60 95C64 103 78 100 82 90C94 90 102 78 98 67C106 61 106 47 98 41C102 32 96 22 86 22C82 12 68 10 60 18Z"
      />
      <path className="cf-cerebro-via" pathLength="1" d="M60 18V95" />
      {RAMAS.map((d) => <path className="cf-cerebro-via" pathLength="1" d={d} key={d} />)}
      {NODOS.map(([cx, cy]) => <circle className="cf-cerebro-nodo" cx={cx} cy={cy} r="3.4" key={`${cx}-${cy}`} />)}
    </svg>
  );
}

/**
 * Los seis apartados que hay que completar para crear un IdCar, con el nombre y
 * el subtítulo que llevan en la ficha real, y en el orden en que aparecen.
 *
 * El primero se lleva la mayor parte: son los veintiún campos del coche, y se
 * rellenan casi solos si eliges marca, modelo y versión del catálogo.
 */
const PASOS_IDCAR = [
  { titulo: "Características del vehículo", pie: "Marca, modelo y versión del catálogo; lo demás se autocompleta", sello: "21 campos" },
  { titulo: "Documentos del vehículo", pie: "Fotos, ficha técnica, permiso de circulación e ITV", sello: "Papeles" },
  { titulo: "Informe de estado", pie: "Captura guiada con el móvil y estado aparente del coche", sello: "Informe de estado" },
  { titulo: "Seguros", pie: "Aseguradora, póliza y cobertura", sello: "Seguro" },
  { titulo: "Mantenimientos", pie: "Facturas y qué se le ha hecho al coche", sello: "Facturas" },
  { titulo: "Notas internas", pie: "Lo que quieras recordar de este coche", sello: "Notas" },
];

/**
 * Lo que pide la aplicación antes de dejar publicar en el Marketplace. No son
 * recomendaciones: sin las tres, el botón devuelve un error y no publica.
 */
const REQUISITOS = [
  { titulo: "Un precio de salida", pie: "Lo pones tú" },
  { titulo: "El informe de estado terminado", pie: "El comprador lo ve" },
  { titulo: "Al menos una franja horaria", pie: "Para las visitas" },
];

/** Los cuatro pasos de la venta gestionada, con la etiqueta que lleva cada uno. */
const PASOS_GESTIONADA = [
  { titulo: "Revisamos el estado real del coche", pie: "Opcional según el caso" },
  { titulo: "Definimos el precio contigo", pie: "Análisis incluido" },
  { titulo: "Publicamos y filtramos las llamadas", pie: "Solo compradores reales" },
  { titulo: "Te acompañamos hasta el cierre", pie: "Trámites incluidos" },
];

/** Los portales donde se publica en la venta gestionada. */
const PORTALES = ["Coches.net", "AutoScout24", "Milanuncios", "Wallapop"];

/** Los seis datos que pide el formulario de venta, en su orden. */
const DATOS_VENTA = [
  { etiqueta: "Matrícula", valor: "1234 KLM" },
  { etiqueta: "Marca", valor: "Volkswagen" },
  { etiqueta: "Modelo", valor: "Golf" },
  { etiqueta: "Versión", valor: "1.5 TSI Life" },
  { etiqueta: "Año", valor: "2021" },
  { etiqueta: "Kilómetros", valor: "48.300" },
];

/**
 * El plan de mantenimiento por defecto, con los intervalos exactos que usa la
 * aplicación para calcular cuándo avisar. No son cifras de ejemplo: salen de
 * `DEFAULT_MAINTENANCE_PLAN`.
 */
const AVISOS = [
  { tarea: "Cambio de aceite y filtro", cada: "Cada 15.000 km o 12 meses", estado: "Aviso" },
  { tarea: "Filtro de aire", cada: "Cada 20.000 km o 18 meses", estado: "Aviso" },
  { tarea: "Revisión de frenos", cada: "Cada 30.000 km o 18 meses", estado: "Cita agendada" },
  { tarea: "Líquido de frenos", cada: "Cada 45.000 km o 24 meses", estado: "" },
];

/**
 * Octubre de 2026 cae en jueves, así que la primera fila arranca con tres
 * huecos. El aviso y la cita del ejemplo van el 7 y el 20.
 */
const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];
const HUECOS_OCTUBRE = 3;
const DIAS_OCTUBRE = 31;
const DIA_AVISO = 7;
const DIA_CITA = 20;

/**
 * La cita, con los precios del catálogo de la aplicación: cambio de aceite y
 * filtro en Norauto va de 60 a 110 €, y el precio acordado es el medio. La web
 * enseña el alto como PVP particular y el medio como precio PopCar, que es
 * exactamente esta resta.
 */
const CITA = { servicio: "Cambio de aceite + filtro", taller: "Norauto", particular: 110, popcar: 75 };
const PASOS_CITA = ["IdCar", "Provincia y código postal", "Tipo de revisión", "Taller cercano"];

/**
 * Los talleres alrededor de la ubicación, en tanto por ciento del mapa ya
 * acercado. Norauto y MIDAS son los proveedores con precio en el catálogo; los
 * otros dos son talleres independientes, que es lo que devuelve la búsqueda por
 * código postal junto a ellos.
 */
const TALLERES = [
  { nombre: "Taller", x: 32, y: 30 },
  { nombre: "Norauto", x: 64, y: 24, elegido: true },
  { nombre: "MIDAS", x: 27, y: 66 },
  { nombre: "Taller", x: 71, y: 62 },
];

/**
 * España, dibujada desde coordenadas reales de la costa y de la frontera, con
 * la corrección del coseno de la latitud —sin ella el país sale estirado de
 * norte a sur—. Es una silueta, no una carta náutica: sirve para situar, y por
 * eso va sin provincias ni nombres.
 */
const ESPANA = "M11.4 7.3L20.0 0.9L27.6 4.7L37.8 4.4L44.3 4.7L58.2 7.0L66.6 6.1L76.2 7.3L85.8 8.3L90.7 7.6L103.2 14.0L120.6 17.9L130.8 21.1L139.8 21.8L148.8 22.2L151.6 23.9L150.6 30.4L144.0 34.3L138.2 38.5L127.2 42.6L122.6 48.8L112.6 60.4L108.2 68.5L115.0 79.9L106.4 86.0L104.0 91.6L103.8 97.0L93.6 99.8L85.9 111.2L69.8 111.2L59.2 111.2L48.1 120.1L45.0 122.3L36.7 114.2L36.0 110.1L28.9 103.6L23.4 104.1L25.2 92.8L28.2 88.1L28.8 74.1L28.2 65.5L29.4 56.9L30.0 44.5L36.6 37.4L33.0 33.5L28.2 29.6L17.4 30.4L13.8 28.1L5.8 30.9L6.0 24.2L3.6 19.5L0.8 14.8L2.0 10.1Z";
const ISLAS = [
  "M140.4 67.1L145.2 70.2L153.6 64.4L150.0 60.8L144.0 61.6Z",
  "M158.0 61.3L163.8 59.3L162.8 58.2L158.4 59.7Z",
  "M126.8 77.7L130.8 76.4L129.2 74.1L126.8 75.7Z",
];
/** Madrid, en las mismas coordenadas: es hacia donde se acerca el mapa. */
const MADRID = { x: 67.8, y: 53.5 };

/**
 * Las seis coberturas que lee el análisis de la póliza, con el nivel que da a
 * cada una. Los nombres y los niveles son los de la aplicación; el largo de la
 * barra solo traduce ese nivel a algo que se pueda ver de un vistazo.
 */
const COBERTURAS = [
  { nombre: "Responsabilidad", nivel: "Alta", valor: 100 },
  { nombre: "Daños propios", nivel: "Media", valor: 58 },
  { nombre: "Robo", nivel: "Buena", valor: 84 },
  { nombre: "Asistencia", nivel: "Baja", valor: 30 },
  { nombre: "Defensa legal", nivel: "Baja", valor: 30 },
  { nombre: "Lunas", nivel: "Media", valor: 58 },
];

/** Los cuatro servicios de Gestionar, con el nombre que tienen en la web. */
const SERVICIOS = [
  { id: "garaje", titulo: "Crea tu garaje", pie: "21 campos", icono: "coche" },
  { id: "aviso", titulo: "Recordatorio inteligente", pie: "ITV y seguro", icono: "reloj" },
  { id: "taller", titulo: "Cita de mantenimiento", pie: "Talleres de la red", icono: "punto" },
  { id: "seguro", titulo: "Seguro", pie: "Entiende tu póliza", icono: "escudo" },
];

const num = (n) => n.toLocaleString("es-ES");

/**
 * Los iconos van en SVG, no en emoji. Ya se aprendió montando el home: los
 * glifos de texto salen desiguales entre sistemas y en Windows algunos se ven
 * como un cuadrado vacío.
 */
function Icono({ nombre }) {
  const comun = {
    viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round",
  };
  if (nombre === "coche") {
    return (<svg {...comun}><path d="M5 13h14l-1.4-4.2A2 2 0 0 0 15.7 7H8.3a2 2 0 0 0-1.9 1.8L5 13Z" /><path d="M4 13h16v4H4z" /><circle cx="7.5" cy="17.5" r="1.5" /><circle cx="16.5" cy="17.5" r="1.5" /></svg>);
  }
  if (nombre === "reloj") {
    return (<svg {...comun}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 1.8" /></svg>);
  }
  if (nombre === "punto") {
    return (<svg {...comun}><path d="M12 21s6.5-5.6 6.5-10a6.5 6.5 0 1 0-13 0c0 4.4 6.5 10 6.5 10Z" /><circle cx="12" cy="11" r="2.4" /></svg>);
  }
  return (<svg {...comun}><path d="M12 3l7 3v5.5c0 4.3-3 8.2-7 9.5-4-1.3-7-5.2-7-9.5V6l7-3Z" /></svg>);
}

/** El coche del ejemplo, para pedir su foto al mismo sitio que las ofertas. */
const CONSULTA_ANUNCIO = "brand=Volkswagen&model=Golf&fuel=Gasolina&minYear=2021&limit=1";

export default function ComoFuncionaPage({ onGoHome }) {
  const raiz = useRef(null);
  const embudo = useRef(null);

  // La escena del mercado se mueve por referencia: su avance cambia en cada
  // fotograma y no puede pasar por el estado de React.
  const registrarEmbudo = useCallback((_, fn) => { embudo.current = fn; }, []);

  /* La foto del anuncio sale del buscador, como las del embudo. Un Golf de
     verdad, no un rectángulo gris: el anuncio publicado es lo que se enseña en
     ese acto y sin foto no parece un anuncio. Si la llamada falla se queda el
     hueco, que es lo que había antes. */
  const [fotoAnuncio, setFotoAnuncio] = useState("");
  useEffect(() => {
    let vivo = true;
    fetch(`${SEARCH_OFFERS_API_ENDPOINT}?${CONSULTA_ANUNCIO}`)
      .then((r) => r.json())
      .then((d) => {
        if (!vivo || !d?.ok) return;
        const foto = d.ofertas?.[0]?.image;
        if (foto) setFotoAnuncio(foto);
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el) return undefined;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add({ anima: "(prefers-reduced-motion: no-preference)" }, (contexto) => {
        if (!contexto.conditions.anima) {
          // Sin movimiento: el embudo se enseña ya resuelto, que es el estado
          // que cuenta la historia entera de un vistazo.
          embudo.current?.(1);
          return;
        }

        /* ── Portada ──────────────────────────────────────────────────────
           Las tres manchas se mueven a distinta velocidad. Es lo único
           decorativo de la página, y va aquí a propósito: la portada no
           explica nada, invita a bajar. */
        gsap.timeline({
          scrollTrigger: { trigger: ".cf-hero", start: "top top", end: "bottom top", scrub: true },
        })
          .to(".cf-hero-texto", { y: -170, opacity: 0, ease: "none" }, 0)
          .to(".cf-mancha-1", { x: -230, y: -190, scale: 1.45, ease: "none" }, 0)
          .to(".cf-mancha-2", { x: 240, y: -90, scale: 0.65, ease: "none" }, 0)
          .to(".cf-mancha-3", { x: -140, y: 140, scale: 1.7, ease: "none" }, 0);

        /* ── 01 Comprar ───────────────────────────────────────────────────
           El scroll del bloque mueve el embudo: medio millón de ofertas,
           siete filtros y las que quedan, con sus fichas reales. La
           transformación la hace la escena; aquí solo se le dice por dónde va. */
        /* Tres actos, uno por opción, cada uno con su tramo. Las tarjetas se
           quedan arriba y se marca la que toca; abajo solo hay una escena a la
           vista y opaca. El relevo entre actos es corto —la escena que sale se
           va antes de que entre la siguiente— porque solaparlas es exactamente
           lo que hacía que no se leyera ninguna. */
        // Sobre once pantallas y media: casi cuatro para el embudo, que es lo
        // que pide contar siete filtros, y unas tres para cada una de las otras
        // dos, que ahora también se recorren enteras.
        const ACTOS = [0.06, 0.45, 0.75];
        const RELEVO = 0.05;

        const comprar = gsap.timeline({
          scrollTrigger: {
            trigger: "#comprar",
            start: "top top",
            end: "bottom bottom",
            scrub: 0.5,
            onUpdate: (self) => {
              // El embudo solo corre durante su acto; fuera se queda quieto.
              const p = self.progress;
              const fin = ACTOS[1] - RELEVO;
              const dentro = (p - ACTOS[0]) / (fin - ACTOS[0]);
              embudo.current?.(dentro < 0 ? 0 : dentro > 1 ? 1 : dentro);
            },
          },
        });

        const tarjetas = gsap.utils.toArray("#comprar .cf-camino");
        tarjetas.forEach((c, i) => {
          comprar.fromTo(c, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, ease: "none", duration: 0.03 }, 0.01 + i * 0.025);
          // Cada tarjeta se enciende cuando le llega su turno y se apaga al
          // pasar: siempre se sabe de cuál de las tres se está hablando.
          comprar.to(c, { "--activa": 1, scale: 1.02, ease: "none", duration: 0.02 }, ACTOS[i]);
          if (i < 2) comprar.to(c, { "--activa": 0, scale: 1, ease: "none", duration: 0.02 }, ACTOS[i + 1] - RELEVO);
        });

        const actos = gsap.utils.toArray("#comprar .cf-acto");
        actos.forEach((acto, i) => {
          const entra = ACTOS[i];
          const sale = i < 2 ? ACTOS[i + 1] - RELEVO : 1;
          comprar.fromTo(acto, { autoAlpha: 0 }, { autoAlpha: 1, ease: "none", duration: RELEVO * 0.6 }, entra - RELEVO * 0.4);
          if (i < 2) comprar.to(acto, { autoAlpha: 0, ease: "none", duration: RELEVO * 0.6 }, sale);
        });

        /* Cada acto se recorre por dentro, no solo aparece. El primero lo lleva
           el embudo; estos dos necesitan lo suyo o serían una lámina quieta
           durante dos pantallas de scroll. */
        /* Acto 2 · el comparador. Entra un coche, se puntúa, entra el siguiente.
           Al final se apagan los que no ganan: se ve quién queda primero sin que
           nadie lo diga. */
        const inicioComp = ACTOS[1];
        const largoComp = (ACTOS[2] - RELEVO) - inicioComp;
        const enComp = (t) => inicioComp + largoComp * t;
        gsap.utils.toArray("#comprar .cf-comparado").forEach((coche, i) => {
          comprar.fromTo(coche,
            { autoAlpha: 0, y: 26 },
            { autoAlpha: 1, y: 0, ease: "none", duration: largoComp * 0.08 },
            enComp(0.04 + i * 0.14));
          comprar.fromTo(coche.querySelectorAll(".cf-eje em"),
            { scaleX: 0 },
            { scaleX: 1, ease: "none", duration: largoComp * 0.1, stagger: largoComp * 0.012 },
            enComp(0.1 + i * 0.14));
        });
        comprar.fromTo("#comprar .cf-hueco",
          { autoAlpha: 0 }, { autoAlpha: 1, ease: "none", duration: largoComp * 0.08 }, enComp(0.5));
        comprar.to("#comprar .cf-comparado:not(.es-gana)",
          { autoAlpha: 0.42, ease: "none", duration: largoComp * 0.1 }, enComp(0.72));

        /* Acto 3 · el test. Entran las respuestas, se traza el cerebro, se
           encienden sus nodos y por el otro lado sale la recomendación con las
           ofertas. El orden importa: primero se pregunta, después se piensa y
           solo al final se recomienda. */
        const inicioTest = ACTOS[2];
        const largoTest = 1 - inicioTest;
        const enTest = (t) => inicioTest + largoTest * t;
        gsap.utils.toArray("#comprar .cf-bloques-test li").forEach((b, i) => {
          comprar.fromTo(b,
            { autoAlpha: 0.2, x: -16 },
            { autoAlpha: 1, x: 0, ease: "none", duration: largoTest * 0.06 },
            enTest(0.03 + i * 0.035));
        });
        comprar
          .fromTo("#comprar .cf-cerebro-borde",
            { strokeDashoffset: 1 },
            { strokeDashoffset: 0, ease: "none", duration: largoTest * 0.16 }, enTest(0.2))
          .fromTo("#comprar .cf-cerebro-via",
            { strokeDashoffset: 1 },
            { strokeDashoffset: 0, ease: "none", duration: largoTest * 0.12, stagger: largoTest * 0.012 }, enTest(0.3))
          .fromTo("#comprar .cf-cerebro-nodo",
            { scale: 0 },
            { scale: 1, ease: "none", duration: largoTest * 0.05, stagger: largoTest * 0.012 }, enTest(0.42))
          .fromTo("#comprar .cf-flujo i",
            { xPercent: -140 },
            { xPercent: 140, ease: "none", duration: largoTest * 0.24 }, enTest(0.3))
          .fromTo("#comprar .cf-veredicto",
            { autoAlpha: 0, y: 26 },
            { autoAlpha: 1, y: 0, ease: "none", duration: largoTest * 0.1 }, enTest(0.52))
          .fromTo("#comprar .cf-peso em",
            { scaleX: 0 },
            { scaleX: 1, ease: "none", duration: largoTest * 0.12, stagger: largoTest * 0.02 }, enTest(0.6));
        gsap.utils.toArray("#comprar .cf-mejor").forEach((m, i) => {
          comprar.fromTo(m,
            { autoAlpha: 0, y: 14 },
            { autoAlpha: 1, y: 0, ease: "none", duration: largoTest * 0.08 },
            enTest(0.78 + i * 0.08));
        });

        /* ── 02 Vender ────────────────────────────────────────────────────
           Tres puertas y tres actos, igual que comprar. Cómo se crea el IdCar
           se cuenta en gestionar, que es donde vive la ficha; aquí se da por
           hecho y el informe ya ofrece leerlo. */
        const ACTOS_V = [0.05, 0.40, 0.72];
        const tramo = (i) => {
          const ini = ACTOS_V[i];
          const fin = i < ACTOS_V.length - 1 ? ACTOS_V[i + 1] - RELEVO : 1;
          return { ini, largo: fin - ini, en: (t) => ini + (fin - ini) * t };
        };

        const vender = gsap.timeline({
          scrollTrigger: { trigger: "#vender", start: "top top", end: "bottom bottom", scrub: 0.5 },
        });

        gsap.utils.toArray("#vender .cf-camino").forEach((c, i) => {
          vender.fromTo(c,
            { autoAlpha: 0, y: 18 },
            { autoAlpha: 1, y: 0, ease: "none", duration: 0.02 },
            0.005 + i * 0.012);
          vender.to(c, { "--activa": 1, scale: 1.02, ease: "none", duration: 0.02 }, ACTOS_V[i]);
          if (i < 2) vender.to(c, { "--activa": 0, scale: 1, ease: "none", duration: 0.02 }, ACTOS_V[i + 1] - RELEVO);
        });

        gsap.utils.toArray("#vender .cf-acto").forEach((acto, i) => {
          const { ini } = tramo(i);
          vender.fromTo(acto, { autoAlpha: 0 }, { autoAlpha: 1, ease: "none", duration: RELEVO * 0.6 }, ini - RELEVO * 0.4);
          if (i < 2) vender.to(acto, { autoAlpha: 0, ease: "none", duration: RELEVO * 0.6 }, ACTOS_V[i + 1] - RELEVO);
        });

        /* Acto 0 · el informe. Los seis datos entran uno a uno, la ficha se
           aparta y en su sitio se abre el informe con los comparables. */
        const informe = tramo(0);
        gsap.utils.toArray("#vender .cf-dato").forEach((dato, i) => {
          vender.fromTo(dato,
            { autoAlpha: 0, y: 22 },
            { autoAlpha: 1, y: 0, ease: "none", duration: informe.largo * 0.08 },
            informe.en(0.05 + i * 0.07));
        });
        vender
          .fromTo("#vender .cf-ficha-fuente",
            { autoAlpha: 0 }, { autoAlpha: 1, ease: "none", duration: informe.largo * 0.06 }, informe.en(0.5))
          .fromTo("#vender .cf-informe",
            { autoAlpha: 0, y: 36 },
            { autoAlpha: 1, y: 0, ease: "none", duration: informe.largo * 0.14 }, informe.en(0.55))
          .fromTo("#vender .cf-barra i",
            { scaleX: 0 }, { scaleX: 1, ease: "none", duration: informe.largo * 0.24 }, informe.en(0.62))
          .to("#vender .cf-ficha-venta",
            { y: -22, scale: 0.94, ease: "none", duration: informe.largo * 0.3 }, informe.en(0.6));
        gsap.utils.toArray("#vender .cf-comparable").forEach((b, i) => {
          vender.fromTo(b,
            { autoAlpha: 0, scale: 0.8 },
            { autoAlpha: 1, scale: 1, ease: "none", duration: informe.largo * 0.1 },
            informe.en(0.6 + i * 0.07));
        });

        /* Acto 1 · publicar. Los tres requisitos se van cumpliendo y solo
           entonces aparece el anuncio: sin ellos, la aplicación tampoco deja. */
        const anuncio = tramo(1);
        gsap.utils.toArray("#vender .cf-requisito").forEach((r, i) => {
          vender.fromTo(r,
            { autoAlpha: 0.25, x: -16 },
            { autoAlpha: 1, x: 0, ease: "none", duration: anuncio.largo * 0.1 },
            anuncio.en(0.06 + i * 0.16));
          vender.to(r, { "--hecho": 1, ease: "none", duration: anuncio.largo * 0.05 }, anuncio.en(0.14 + i * 0.16));
        });
        vender.fromTo("#vender .cf-anuncio",
          { autoAlpha: 0, y: 30, scale: 0.94 },
          { autoAlpha: 1, y: 0, scale: 1, ease: "none", duration: anuncio.largo * 0.14 },
          anuncio.en(0.62));
        vender.fromTo("#vender .cf-anuncio-estado",
          { autoAlpha: 0, scale: 0.7 },
          { autoAlpha: 1, scale: 1, ease: "none", duration: anuncio.largo * 0.08 },
          anuncio.en(0.82));

        /* Acto 2 · la venta gestionada, paso a paso, y los portales cuando toca
           publicar. */
        const gest = tramo(2);
        gsap.utils.toArray("#vender .cf-paso-venta").forEach((p, i) => {
          vender.fromTo(p,
            { autoAlpha: 0.22, y: 20 },
            { autoAlpha: 1, y: 0, ease: "none", duration: gest.largo * 0.1 },
            gest.en(0.05 + i * 0.2));
        });
        vender.fromTo("#vender .cf-portales li",
          { autoAlpha: 0, y: 8 },
          { autoAlpha: 1, y: 0, ease: "none", duration: gest.largo * 0.06, stagger: gest.largo * 0.03 },
          gest.en(0.52));

        /* ── 03 Gestionar ─────────────────────────────────────────────────
           Cuatro servicios y un acto para cada uno. El primero es el garaje,
           porque sin ficha no hay avisos, ni cita, ni póliza que leer: es el
           orden en que ocurre de verdad. */
        const ACTOS_G = [0.04, 0.30, 0.53, 0.77];
        const tramoG = (i) => {
          const ini = ACTOS_G[i];
          const fin = i < ACTOS_G.length - 1 ? ACTOS_G[i + 1] - RELEVO : 1;
          return { ini, largo: fin - ini, en: (t) => ini + (fin - ini) * t };
        };

        const gestionar = gsap.timeline({
          scrollTrigger: { trigger: "#gestionar", start: "top top", end: "bottom bottom", scrub: 0.5 },
        });

        gsap.utils.toArray("#gestionar .cf-servicio").forEach((s, i) => {
          gestionar.fromTo(s,
            { autoAlpha: 0, y: 18 },
            { autoAlpha: 1, y: 0, ease: "none", duration: 0.02 },
            0.005 + i * 0.012);
          gestionar.to(s, { "--activa": 1, scale: 1.02, ease: "none", duration: 0.02 }, ACTOS_G[i]);
          if (i < 3) gestionar.to(s, { "--activa": 0, scale: 1, ease: "none", duration: 0.02 }, ACTOS_G[i + 1] - RELEVO);
        });

        gsap.utils.toArray("#gestionar .cf-acto").forEach((acto, i) => {
          const { ini } = tramoG(i);
          gestionar.fromTo(acto, { autoAlpha: 0 }, { autoAlpha: 1, ease: "none", duration: RELEVO * 0.6 }, ini - RELEVO * 0.4);
          if (i < 3) gestionar.to(acto, { autoAlpha: 0, ease: "none", duration: RELEVO * 0.6 }, ACTOS_G[i + 1] - RELEVO);
        });

        /* Acto 0 · el IdCar. Se abre un apartado, se rellena y se sella en la
           ficha. El sello llega después del paso, no a la vez: primero se hace
           el trabajo y luego se ve el resultado. */
        const garaje = tramoG(0);
        gsap.utils.toArray("#gestionar .cf-paso-idcar").forEach((paso, i) => {
          gestionar.fromTo(paso,
            { autoAlpha: 0.25, x: -18 },
            { autoAlpha: 1, x: 0, ease: "none", duration: garaje.largo * 0.07 },
            garaje.en(0.05 + i * 0.13));
        });
        gsap.utils.toArray("#gestionar .cf-sello").forEach((sello, i) => {
          gestionar.fromTo(sello,
            { autoAlpha: 0, scale: 0.8 },
            { autoAlpha: 1, scale: 1, ease: "none", duration: garaje.largo * 0.05 },
            garaje.en(0.12 + i * 0.13));
        });
        gestionar.fromTo("#gestionar .cf-idcar-listo",
          { autoAlpha: 0, y: 10 },
          { autoAlpha: 1, y: 0, ease: "none", duration: garaje.largo * 0.08 },
          garaje.en(0.9));

        /* Acto 1 · los avisos: se marca el mes y van cayendo las revisiones. */
        const avisos = tramoG(1);
        gestionar
          .fromTo("#gestionar .cf-calendario li",
            { autoAlpha: 0 },
            { autoAlpha: 1, ease: "none", duration: avisos.largo * 0.02, stagger: avisos.largo * 0.006 },
            avisos.en(0.05))
          .fromTo("#gestionar .cf-leyenda span",
            { autoAlpha: 0 },
            { autoAlpha: 1, ease: "none", duration: avisos.largo * 0.06 }, avisos.en(0.5));
        gsap.utils.toArray("#gestionar .cf-aviso").forEach((a, i) => {
          gestionar.fromTo(a,
            { autoAlpha: 0, x: 22 },
            { autoAlpha: 1, x: 0, ease: "none", duration: avisos.largo * 0.1 },
            avisos.en(0.3 + i * 0.14));
        });

        /* Acto 2 · la cita. El mapa se acerca a la provincia, aparece dónde
           estás, salen los talleres de alrededor y al elegir uno llega su
           precio. Es el orden de la pantalla: sin código postal no hay talleres,
           y sin taller no hay precio.

           El acercamiento se hace con `svgOrigin` en Madrid, así la escala no
           lo mueve de sitio y solo hace falta centrarlo después. */
        const cita = tramoG(2);
        const centrar = { x: 84 - MADRID.x, y: 63 - MADRID.y };
        gsap.utils.toArray("#gestionar .cf-pasos-cita li").forEach((p, i) => {
          gestionar.fromTo(p,
            { autoAlpha: 0.22, y: 10 },
            { autoAlpha: 1, y: 0, ease: "none", duration: cita.largo * 0.06 },
            cita.en(0.03 + i * 0.06));
        });
        gestionar
          .fromTo("#gestionar .cf-mapa",
            { autoAlpha: 0 }, { autoAlpha: 1, ease: "none", duration: cita.largo * 0.06 }, cita.en(0.04))
          .fromTo("#gestionar .cf-mapa-zoom",
            { scale: 1, x: 0, y: 0 },
            {
              scale: 4.6, x: centrar.x, y: centrar.y,
              svgOrigin: `${MADRID.x} ${MADRID.y}`, ease: "none", duration: cita.largo * 0.34,
            },
            cita.en(0.12))
          .fromTo("#gestionar .cf-ubicacion",
            { autoAlpha: 0, scale: 0 },
            { autoAlpha: 1, scale: 1, ease: "none", duration: cita.largo * 0.08 }, cita.en(0.44));
        gsap.utils.toArray("#gestionar .cf-taller").forEach((t, i) => {
          gestionar.fromTo(t,
            { autoAlpha: 0, y: 10 },
            { autoAlpha: 1, y: 0, ease: "none", duration: cita.largo * 0.06 },
            cita.en(0.5 + i * 0.05));
        });
        gestionar
          // Se elige uno, y solo entonces hay precio que enseñar.
          .to("#gestionar .cf-taller.es-elegido",
            { "--elegido": 1, scale: 1.14, ease: "none", duration: cita.largo * 0.06 }, cita.en(0.7))
          .to("#gestionar .cf-taller:not(.es-elegido)",
            { autoAlpha: 0.45, ease: "none", duration: cita.largo * 0.06 }, cita.en(0.7))
          .fromTo("#gestionar .cf-presupuesto",
            { autoAlpha: 0, y: 26 },
            { autoAlpha: 1, y: 0, ease: "none", duration: cita.largo * 0.1 }, cita.en(0.74))
          .fromTo("#gestionar .cf-ahorro",
            { autoAlpha: 0, scale: 0.86 },
            { autoAlpha: 1, scale: 1, ease: "none", duration: cita.largo * 0.08 }, cita.en(0.86))
          .fromTo("#gestionar .cf-boton-pintado",
            { autoAlpha: 0, y: 10 },
            { autoAlpha: 1, y: 0, ease: "none", duration: cita.largo * 0.08 }, cita.en(0.92));

        /* Acto 3 · el seguro: cae la póliza y se van midiendo las coberturas. */
        const seguro = tramoG(3);
        gestionar
          .fromTo("#gestionar .cf-soltar",
            { autoAlpha: 0, scale: 0.92 },
            { autoAlpha: 1, scale: 1, ease: "none", duration: seguro.largo * 0.12 }, seguro.en(0.05))
          .fromTo("#gestionar .cf-cobertura",
            { autoAlpha: 0, x: 18 },
            { autoAlpha: 1, x: 0, ease: "none", duration: seguro.largo * 0.08, stagger: seguro.largo * 0.06 },
            seguro.en(0.32))
          .fromTo("#gestionar .cf-cobertura em",
            { scaleX: 0 },
            { scaleX: 1, ease: "none", duration: seguro.largo * 0.1, stagger: seguro.largo * 0.06 },
            seguro.en(0.36));

        /* ── Profundidad ──────────────────────────────────────────────────
           El rótulo sube más que la escena. Deja claro quién manda: la escena
           se queda, el texto pasa de largo. */
        gsap.utils.toArray(".cf-bloque").forEach((bloque) => {
          const rotulo = bloque.querySelector(".cf-rotulo");
          if (!rotulo) return;
          gsap.to(rotulo, {
            y: -90,
            ease: "none",
            scrollTrigger: { trigger: bloque, start: "top bottom", end: "bottom top", scrub: true },
          });
        });
      });
    }, raiz);

    return () => ctx.revert();
  }, []);

  return (
    <div className="cf-root" ref={raiz}>

      <section className="cf-hero">
        <div className="cf-manchas" aria-hidden="true">
          <span className="cf-mancha cf-mancha-1" />
          <span className="cf-mancha cf-mancha-2" />
          <span className="cf-mancha cf-mancha-3" />
        </div>
        <div className="cf-hero-texto">
          <p className="cf-eyebrow">Cómo funciona</p>
          <h1>Todo lo que necesitas<br /><span>para tu coche.</span></h1>
          <p className="cf-hero-pie">Encuentra. Vende. Gestiona.</p>
          <p className="cf-baja" aria-hidden="true">Baja<span className="cf-baja-linea" /></p>
        </div>
      </section>

      <section className="cf-intro">
        <div>
          <p className="cf-eyebrow">Una forma distinta</p>
          <h2>Tu coche no es<br /><span>solo un coche.</span></h2>
        </div>
      </section>

      {/* ── 01 Comprar ─────────────────────────────────────────────────── */}
      <section className="cf-bloque" id="comprar">
        <div className="cf-fijo">
          <div className="cf-rotulo">
            <p className="cf-paso">01</p>
            <p className="cf-eyebrow">Comprar</p>
            <h2>Encuentra<br /><span>el tuyo.</span></h2>
            <p className="cf-apoyo">Todo el mercado, hasta los que encajan contigo.</p>
          </div>
          <div className="cf-escena cf-escena-actos">
            {/* Las tres puertas se quedan arriba todo el bloque y se va marcando
                la que toca. Antes compartían sitio con la escena y las dos se
                veían a medias: no se leía ninguna. */}
            <ul className="cf-caminos">
              {CAMINOS.comprar.map((c) => (
                <li className={`cf-camino cf-camino-${c.id}`} key={c.id}>
                  <strong>{c.titulo}</strong>
                  <small>{c.destino}</small>
                </li>
              ))}
            </ul>

            {/* Un escenario, tres escenas. Solo una a la vista, y opaca. */}
            <div className="cf-tablero">
              <div className="cf-acto cf-acto-embudo">
                <EscenaMercado registrar={registrarEmbudo} indice={0} />
              </div>

              {/* Coches distintos, uno al lado del otro y con su nota: es lo que
                  devuelve el comparador. Los dos huecos del final no son adorno,
                  son las plazas que quedan libres de las cinco. */}
              <div className="cf-acto cf-acto-comparador">
                <p className="cf-acto-etq">Uno al lado del otro, con su nota</p>
                <div className="cf-comparados">
                  {COMPARADOS.map((c, i) => (
                    <article className={`cf-comparado${i === 0 ? " es-gana" : ""}`} key={c.modelo}>
                      <p className="cf-comparado-cab">
                        <b className="cf-comparado-puesto">{i + 1}º</b>
                        <span>
                          <strong>{c.marca} {c.modelo}</strong>
                          <small>{c.version}</small>
                        </span>
                      </p>
                      <p className="cf-comparado-nota"><b>{c.puntos}</b><small>puntos</small></p>
                      <div className="cf-ejes">
                        {EJES_COMPARADOR.map((eje, k) => (
                          <div className="cf-eje" key={eje}>
                            <span>{eje}</span>
                            <i><em style={{ width: `${c.detalle[k]}%` }} /></i>
                            <b>{c.detalle[k]}</b>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                  <p className="cf-hueco"><span>+2</span>Hasta cinco a la vez</p>
                </div>
                <p className="cf-acto-pie">
                  Se comparan hasta cinco coches a la vez. La puntuación la calcula el análisis en cada comparación.
                </p>
              </div>

              {/* Las respuestas entran por la izquierda, el análisis las pesa y
                  por la derecha sale la recomendación con las ofertas que
                  encajan. Es el recorrido del test, de principio a fin. */}
              <div className="cf-acto cf-acto-test">
                <p className="cf-acto-etq">Veintiuna preguntas sobre cómo vives</p>
                <div className="cf-analisis">
                  <ul className="cf-bloques-test">
                    {BLOQUES_TEST.map((b) => <li key={b}>{b}</li>)}
                  </ul>

                  <div className="cf-flujo" aria-hidden="true"><i /></div>
                  <div className="cf-cerebro"><Cerebro /></div>
                  <div className="cf-flujo" aria-hidden="true"><i /></div>

                  <article className="cf-veredicto">
                    <p className="cf-veredicto-etq">Recomendación · <b>{COINCIDENCIA}%</b> de coincidencia</p>
                    <h4>Compacto híbrido de ocasión</h4>
                    <ul className="cf-pesos">
                      {PESOS_TEST.map((peso) => (
                        <li className="cf-peso" key={peso.nombre}>
                          <span>{peso.nombre}</span>
                          <i><em style={{ width: `${(peso.logrado / peso.peso) * 100}%` }} /></i>
                        </li>
                      ))}
                    </ul>
                    <ul className="cf-mejores">
                      {MEJORES.map((m) => (
                        <li className="cf-mejor" key={m.coche}>
                          <span><strong>{m.coche}</strong><small>{m.datos}</small></span>
                          <b>{m.encaje}%</b>
                        </li>
                      ))}
                    </ul>
                  </article>
                </div>
                <p className="cf-acto-pie">Y termina en ofertas de verdad, ordenadas por lo que encajan contigo.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 02 Vender ──────────────────────────────────────────────────── */}
      <section className="cf-bloque cf-bloque-claro" id="vender">
        <div className="cf-fijo">
          <div className="cf-rotulo">
            <p className="cf-paso">02</p>
            <p className="cf-eyebrow">Vender</p>
            <h2>Dale una<br /><span>salida.</span></h2>
            <p className="cf-apoyo">Lo que pide hoy el mercado por un coche como el tuyo.</p>
          </div>

          <div className="cf-escena cf-escena-actos">
            <ul className="cf-caminos">
              {CAMINOS.vender.map((c) => (
                <li className={`cf-camino cf-camino-${c.id}`} key={c.id}>
                  <strong>{c.titulo}</strong>
                  <small>{c.destino}</small>
                </li>
              ))}
            </ul>

            <div className="cf-tablero">
              {/* Acto 0 · el informe de mercado. */}
              <div className="cf-acto cf-acto-informe">
                <p className="cf-acto-etq">Lo que pide hoy el mercado por uno como el tuyo</p>
                <div className="cf-escena-venta">
                  <div className="cf-ficha-venta">
                    <p className="cf-ficha-titulo">Tu coche</p>
                    <dl className="cf-datos">
                      {DATOS_VENTA.map((d) => (
                        <div className="cf-dato" key={d.etiqueta}>
                          <dt>{d.etiqueta}</dt>
                          <dd>{d.valor}</dd>
                        </div>
                      ))}
                    </dl>
                    {/* Y si ya hay IdCar, ni eso: se elige y viene relleno. */}
                    <p className="cf-ficha-fuente">O usar un IdCar guardado</p>
                  </div>

                  <div className="cf-informe">
                    <p className="cf-informe-etq">Precio medio del mercado</p>
                    <p className="cf-informe-cifra">{num(MERCADO.media)} €</p>
                    <p className="cf-informe-pie">{num(MERCADO.unidades)} unidades similares a la venta</p>
                    <div className="cf-barra"><i /></div>
                    <p className="cf-informe-rango">
                      <span>{num(MERCADO.desde)} €</span>
                      <span>{num(MERCADO.hasta)} €</span>
                    </p>
                    {/* No es una tasación y no puede parecerlo: la cifra es del
                        mercado, nunca del coche del usuario. */}
                    <p className="cf-limite">Información de mercado. PopCar no tasa tu coche.</p>
                  </div>

                </div>

                {/* Antes eran cuatro precios sueltos flotando por la escena, sin
                    nada que dijera de qué eran. Ahora van juntos y con su
                    rótulo: son los anuncios con los que se compara. */}
                <div className="cf-comparables">
                  <span className="cf-comparables-etq">Anuncios parecidos hoy</span>
                  <ul>
                    {COMPARABLES.map((p) => <li className="cf-comparable" key={p}>{num(p)} €</li>)}
                  </ul>
                </div>
              </div>

              {/* Acto 1 · publicar por tu cuenta. Los tres requisitos no son
                  consejos: sin ellos el botón devuelve un error. */}
              <div className="cf-acto cf-acto-anuncio">
                <p className="cf-acto-etq">Tres cosas y tu coche está publicado</p>
                <div className="cf-publicar">
                  <ul className="cf-requisitos">
                    {REQUISITOS.map((r) => (
                      <li className="cf-requisito" key={r.titulo}>
                        <i aria-hidden="true" />
                        <span>
                          <strong>{r.titulo}</strong>
                          <small>{r.pie}</small>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <article className="cf-anuncio">
                    <p className="cf-anuncio-estado">Publicado</p>
                    <div className="cf-anuncio-foto">
                      {fotoAnuncio ? <img src={fotoAnuncio} alt="" loading="lazy" /> : null}
                    </div>
                    <p className="cf-anuncio-titulo">Volkswagen Golf</p>
                    <p className="cf-anuncio-datos">1.5 TSI Life · 2021 · 48.300 km</p>
                    <p className="cf-anuncio-precio">19.900 €</p>
                  </article>
                </div>
                <p className="cf-acto-pie">En el Marketplace de PopCar, y los compradores escriben a tu anuncio.</p>
              </div>

              {/* Acto 2 · la venta gestionada, con sus cuatro pasos reales. */}
              <div className="cf-acto cf-acto-gestionada">
                <p className="cf-acto-etq">O lo llevamos nosotros de principio a fin</p>
                <ol className="cf-gestionada">
                  {PASOS_GESTIONADA.map((p, i) => (
                    <li className="cf-paso-venta" key={p.titulo}>
                      <b>{i + 1}</b>
                      <strong>{p.titulo}</strong>
                      <small>{p.pie}</small>
                      {i === 2 && (
                        <ul className="cf-portales">
                          {PORTALES.map((portal) => <li key={portal}>{portal}</li>)}
                        </ul>
                      )}
                    </li>
                  ))}
                </ol>
                <p className="cf-acto-pie">Tú solo estás cuando llega el comprador.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 03 Gestionar ───────────────────────────────────────────────── */}
      <section className="cf-bloque" id="gestionar">
        <div className="cf-fijo">
          <div className="cf-rotulo">
            <p className="cf-paso">03</p>
            <p className="cf-eyebrow">Gestionar</p>
            <h2>Todo sobre<br /><span>tu coche.</span></h2>
            <p className="cf-apoyo">Papeles, avisos y taller, en un solo sitio.</p>
          </div>

          <div className="cf-escena cf-escena-actos">
            {/* Aquí las puertas son cuatro, una por servicio, y hay un acto por
                cada una: el mismo patrón que en comprar y en vender. */}
            <ul className="cf-servicios">
              {SERVICIOS.map((s) => (
                <li className={`cf-servicio cf-servicio-${s.id}`} key={s.id}>
                  <span className="cf-servicio-icono"><Icono nombre={s.icono} /></span>
                  <span className="cf-servicio-texto">
                    <strong>{s.titulo}</strong>
                    <small>{s.pie}</small>
                  </span>
                </li>
              ))}
            </ul>

            <div className="cf-tablero">
              {/* Acto 0 · cómo se crea el IdCar. A la izquierda los seis
                  apartados que hay que completar; a la derecha la ficha, que se
                  va sellando con lo que acaba de rellenarse. Va el primero
                  porque sin ficha no hay avisos, ni cita, ni póliza que leer. */}
              <div className="cf-acto cf-acto-garaje">
                <p className="cf-acto-etq">Todo empieza por el IdCar</p>
                <div className="cf-creacion">
                  <ol className="cf-pasos-idcar">
                    {PASOS_IDCAR.map((p, i) => (
                      <li className="cf-paso-idcar" key={p.titulo}>
                        <b>{i + 1}</b>
                        <span>
                          <strong>{p.titulo}</strong>
                          <small>{p.pie}</small>
                        </span>
                      </li>
                    ))}
                  </ol>
                  <article className="cf-ficha-idcar">
                    <p className="cf-ficha-titulo">IdCar</p>
                    <p className="cf-idcar-resumen">Volkswagen Golf · 1234 KLM</p>
                    <ul className="cf-sellos">
                      {PASOS_IDCAR.map((p) => <li className="cf-sello" key={p.sello}>{p.sello}</li>)}
                    </ul>
                    <p className="cf-idcar-listo">Hecho. Ya no se vuelve a pedir.</p>
                  </article>
                </div>
                <p className="cf-acto-pie">La ficha de tu coche: datos, papeles y estado. Se crea una vez y sirve para todo.</p>
              </div>

              {/* Acto 1 · los avisos. Los intervalos son los que usa la
                  aplicación para calcular la fecha, no unos de ejemplo. */}
              <div className="cf-acto cf-acto-avisos">
                <p className="cf-acto-etq">Te avisa antes de que se te pase</p>
                <div className="cf-recordatorio">
                  <div className="cf-mes">
                    <p className="cf-mes-etq">Octubre</p>
                    <ul className="cf-semana" aria-hidden="true">
                      {DIAS_SEMANA.map((d, i) => <li key={`${d}-${i}`}>{d}</li>)}
                    </ul>
                    <ul className="cf-calendario" aria-hidden="true">
                      {Array.from({ length: 35 }, (_, i) => {
                        const dia = i - HUECOS_OCTUBRE + 1;
                        if (dia < 1 || dia > DIAS_OCTUBRE) return <li className="es-vacio" key={i} />;
                        const marca = dia === DIA_AVISO ? "es-aviso" : dia === DIA_CITA ? "es-cita" : "";
                        return <li className={marca} key={i}>{dia}</li>;
                      })}
                    </ul>
                    <p className="cf-leyenda">
                      <span className="cf-leyenda-aviso">Aviso para pedir cita</span>
                      <span className="cf-leyenda-cita">Cita agendada</span>
                    </p>
                  </div>
                  <ul className="cf-avisos">
                    {AVISOS.map((a) => (
                      <li className="cf-aviso" key={a.tarea}>
                        <span>
                          <strong>{a.tarea}</strong>
                          <small>{a.cada}</small>
                        </span>
                        {a.estado ? <b className={a.estado === "Aviso" ? "es-aviso" : "es-cita"}>{a.estado}</b> : null}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="cf-acto-pie">Cruza los kilómetros y la fecha de tu coche con los intervalos de su plan.</p>
              </div>

              {/* Acto 2 · la cita. El precio sale del catálogo de la aplicación:
                  el alto es el de particular y el medio, el acordado. */}
              <div className="cf-acto cf-acto-cita">
                <p className="cf-acto-etq">Con el precio ya acordado</p>
                <ol className="cf-pasos-cita">
                  {PASOS_CITA.map((p, i) => (
                    <li key={p}><b>{i + 1}</b>{p}</li>
                  ))}
                </ol>
                <div className="cf-cita">
                  {/* El mapa se acerca a la provincia, aparece dónde estás y
                      salen los talleres que hay cerca. Es lo que hace la
                      pantalla: busca por código postal y ofrece proveedores. */}
                  <div className="cf-mapa">
                    <svg className="cf-mapa-svg" viewBox="0 0 168 126" aria-hidden="true">
                      <g className="cf-mapa-zoom">
                        <path className="cf-mapa-tierra" d={ESPANA} />
                        {ISLAS.map((d) => <path className="cf-mapa-tierra" d={d} key={d} />)}
                      </g>
                    </svg>
                    <span className="cf-ubicacion" aria-hidden="true" />
                    {TALLERES.map((t, i) => (
                      <span
                        className={`cf-taller${t.elegido ? " es-elegido" : ""}`}
                        style={{ left: `${t.x}%`, top: `${t.y}%` }}
                        key={`${t.nombre}-${i}`}
                      >
                        {t.nombre}
                      </span>
                    ))}
                  </div>

                  <article className="cf-presupuesto">
                    <p className="cf-presupuesto-taller">Taller · {CITA.taller}</p>
                    <p className="cf-presupuesto-etq">{CITA.servicio}</p>
                    <dl className="cf-precios">
                      <div className="cf-precio">
                        <dt>PVP particular</dt>
                        <dd>{num(CITA.particular)} €</dd>
                      </div>
                      <div className="cf-precio es-popcar">
                        <dt>Con PopCar</dt>
                        <dd>{num(CITA.popcar)} €</dd>
                      </div>
                    </dl>
                    <p className="cf-ahorro">Ahorras {num(CITA.particular - CITA.popcar)} €</p>
                    {/* Lo dice la pantalla de la cita y aquí también: el importe
                        final depende del modelo y de las piezas. */}
                    <p className="cf-limite">Precios orientativos, sobre rangos históricos.</p>
                    {/* Es el botón de la pantalla real, dibujado. Aquí no lleva
                        a ningún sitio a propósito: esto cuenta la aplicación, no
                        la sustituye. */}
                    <span className="cf-boton-pintado">Comprobar disponibilidad</span>
                  </article>
                </div>
                <p className="cf-acto-pie">Talleres verificados y cerca de tu código postal.</p>
              </div>

              {/* Acto 3 · el seguro. Las seis coberturas y el nivel que les da el
                  análisis son los de la aplicación. */}
              <div className="cf-acto cf-acto-seguro">
                <p className="cf-acto-etq">Subes la póliza y te la explica</p>
                <div className="cf-poliza">
                  <div className="cf-soltar">
                    <span className="cf-soltar-icono" aria-hidden="true" />
                    <strong>Arrastra tu póliza aquí</strong>
                    <small>PDF · JPG · PNG</small>
                    <small className="cf-soltar-tiempo">Menos de 30 segundos</small>
                  </div>
                  <div className="cf-coberturas">
                    <p className="cf-coberturas-etq">Análisis de cobertura actual</p>
                    <ul>
                      {COBERTURAS.map((c) => (
                        <li className="cf-cobertura" key={c.nombre}>
                          <span>{c.nombre}</span>
                          <i><em style={{ width: `${c.valor}%` }} /></i>
                          <b>{c.nivel}</b>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <p className="cf-acto-pie">Qué cubre bien, qué se queda corto y qué mirar en la renovación.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="cf-final">
        <div>
          <p className="cf-eyebrow">PopCar</p>
          <h2>Un coche.<br /><span>Todo lo demás.</span></h2>
          <p className="cf-final-pie">Compra, vende y gestiona. En un solo sitio.</p>
          <button type="button" className="cf-final-boton" onClick={onGoHome}>Empezar</button>
        </div>
      </section>

    </div>
  );
}
