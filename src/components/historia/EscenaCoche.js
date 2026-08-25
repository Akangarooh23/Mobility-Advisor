import React, { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import "./EscenaCoche.css";

/**
 * El coche que atraviesa los ocho capítulos.
 *
 * Un solo lienzo, una sola escena, una sola cámara, detrás de todo y fijo. Ese
 * es el motivo de que exista este componente: si el coche viviera dentro de un
 * capítulo, entre capítulo y capítulo habría un relevo, y lo que queremos es que
 * sea literalmente el mismo objeto el que sigue ahí. La continuidad no se
 * simula.
 *
 * El modelo es un T-Roc de verdad: 54 KB, 2.136 triangulos y ocho materiales
 * con nombre. Se prefiere al esquema de daños porque el esquema esta hecho para
 * marcar golpes en un informe —volumenes simples, sin cristales tintados ni
 * llantas— y de protagonista parece un juguete.
 *
 * El esquema sigue siendo el bueno para el capitulo 07, que es literalmente lo
 * que el usuario vera en su informe. Ese cambio se hara alli, no aqui.
 *
 * Las mallas del T-Roc se llaman geometry_0 en adelante y no sirven de nada; los
 * materiales si. Por eso el montaje del capitulo 01 va por material.
 *
 * Se pinta bajo demanda, no en un bucle continuo. El scroll es quien manda, y
 * cuando el usuario no toca nada no hay nada que repintar: un `requestAnimationFrame`
 * eterno solo gastaría batería.
 *
 * Iluminación: `RoomEnvironment`, que es un estudio procedural y no pesa nada.
 * Nada de mapas de entorno externos todavía; primero hay que ver si el coche
 * estilizado aguanta con luz procedural.
 */

/**
 * Los ocho encuadres, en metros sobre el tamaño real del coche (4,28 m).
 *
 * Las distancias están calculadas para que el coche ocupe en torno al 40 % del
 * ancho, no más. Con un campo de 38° y el coche a seis metros llenaba dos
 * tercios de la pantalla y se comía el texto: aquí el coche es el hilo, no el
 * cartel. Si hay que acercarse, se acerca en un momento concreto y por un
 * motivo, no de continuo.
 */
const ENCUADRES = [
  // 01 BUSCA · de mirar el mercado casi en planta a mirar un coche
  { de: [0, 21, 15], a: [7.0, 3.0, -7.5], miraDe: [0, 0, 0], miraA: [0, 0.8, 0] },
  // 02 DESCUBRE · órbita lenta hasta el perfil
  { de: [7.0, 3.0, -7.5], a: [10.2, 2.4, 0.3], miraDe: [0, 0.8, 0], miraA: [0, 0.8, 0] },
  // 03 DECIDE · retrocede para que quepan tres
  { de: [10.2, 2.4, 0.3], a: [14.0, 4.0, 5.0], miraDe: [0, 0.8, 0], miraA: [0, 0.8, 0] },
  // 04 COMPRA · empuje corto al lateral, el único acercamiento del recorrido
  { de: [14.0, 4.0, 5.0], a: [8.2, 2.2, 0.8], miraDe: [0, 0.8, 0], miraA: [0, 0.9, 0] },
  // 05 TU COCHE · la cámara no se mueve: gira el coche
  { de: [8.2, 2.2, 0.8], a: [8.2, 2.2, 0.8], miraDe: [0, 0.9, 0], miraA: [0, 0.9, 0] },
  // 06 MERCADO · se eleva para leer la nube de comparables
  { de: [8.2, 2.2, 0.8], a: [5.2, 12.4, 12.0], miraDe: [0, 0.9, 0], miraA: [0, 0.4, 0] },
  // 07 VENDE · rodea el coche hasta el otro costado
  { de: [5.2, 12.4, 12.0], a: [-9.1, 3.2, -4.9], miraDe: [0, 0.4, 0], miraA: [0, 0.8, 0] },
  // 08 GESTIONA · retroceso largo: el coche se hace pequeño y lo llena su historia
  { de: [-9.1, 3.2, -4.9], a: [0, 8.4, 22.0], miraDe: [0, 0.8, 0], miraA: [0, 0.7, 0] },
];

/**
 * Los siete grupos de montaje del capítulo 01, uno por filtro del buscador.
 *
 * Van por MATERIAL, no por nombre de malla. El T-Roc trae sus 62 mallas
 * llamadas geometry_0 … geometry_63, que no dicen nada; sus ocho materiales sí:
 * «Body White», «Tinted Glass», «Tire Rubber», «Head Lamps»… Agrupar por
 * material es lo que permite montar el coche pieza a pieza con un modelo real en
 * vez de con el esquema.
 *
 * El orden no es estético: va de lo que define el coche a lo que lo remata,
 * igual que los filtros van del que más recorta al que menos. El séptimo va
 * vacío a propósito: el último filtro no añade chapa, solo cierra la búsqueda.
 */
export const GRUPOS_MONTAJE = [
  ["Body White"],
  ["Tire Rubber", "Wheel Alloy"],
  ["Tinted Glass"],
  ["Head Lamps", "Tail Lamps"],
  ["Black Trim"],
  ["Chrome"],
  [],
];
const entre = (a, b, t) => a + (b - a) * t;
const suave = (t) => t * t * (3 - 2 * t);
const acotar = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

export default function EscenaCoche({ registrarEscena }) {
  const contenedor = useRef(null);
  const api = useRef(null);

  useLayoutEffect(() => {
    const host = contenedor.current;
    if (!host) return undefined;

    // Sin WebGL la página sigue siendo legible: se queda sin coche, no sin
    // contenido. Es lo mismo que hace la escena del mercado sin contexto 2D.
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return undefined;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);

    const escena = new THREE.Scene();
    // Sin fondo: el blanco de PopCar se ve a través. El entorno solo ilumina.
    escena.background = null;

    const camara = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    const mira = new THREE.Vector3();

    // Estudio procedural. No pesa nada y da reflejos suaves y neutros, que es lo
    // que pide un coche estilizado; un mapa de entorno fotográfico le pondría
    // reflejos de nave industrial a una maqueta.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const entorno = pmrem.fromScene(new RoomEnvironment(), 0.04);
    escena.environment = entorno.texture;

    // Dos luces sobre el entorno: una que marca el volumen y otra que abre las
    // sombras. Nada más; el resto lo hace el entorno.
    const clave = new THREE.DirectionalLight(0xffffff, 1.6);
    clave.position.set(4, 7, -3);
    escena.add(clave);
    const relleno = new THREE.DirectionalLight(0xffffff, 0.35);
    relleno.position.set(-5, 2, 4);
    escena.add(relleno);

    const coche = new THREE.Group();
    escena.add(coche);

    const piezas = new Map();   // nombre → mesh
    let cargado = false;

    const medir = () => {
      const ancho = host.clientWidth || window.innerWidth;
      const alto = host.clientHeight || window.innerHeight;
      renderer.setSize(ancho, alto, false);
      camara.aspect = ancho / alto;
      camara.updateProjectionMatrix();
    };

    /** Coloca cámara, coche y piezas para un avance global de 0 a 1. */
    const aplicar = (p) => {
      const total = ENCUADRES.length;
      const enCaps = acotar(p) * total;
      const i = Math.min(total - 1, Math.floor(enCaps));
      const t = suave(enCaps - i);
      const cuadro = ENCUADRES[i];

      camara.position.set(
        entre(cuadro.de[0], cuadro.a[0], t),
        entre(cuadro.de[1], cuadro.a[1], t),
        entre(cuadro.de[2], cuadro.a[2], t)
      );
      mira.set(
        entre(cuadro.miraDe[0], cuadro.miraA[0], t),
        entre(cuadro.miraDe[1], cuadro.miraA[1], t),
        entre(cuadro.miraDe[2], cuadro.miraA[2], t)
      );
      camara.lookAt(mira);

      if (cargado) {
        // Capítulo 01: las piezas se encienden por grupos, una tanda por filtro.
        const montaje = i === 0 ? enCaps - i : 1;
        GRUPOS_MONTAJE.forEach((grupo, g) => {
          const puesto = montaje * GRUPOS_MONTAJE.length > g;
          grupo.forEach((material) => {
            const mallas = piezas.get(material);
            if (mallas) mallas.forEach((m) => { m.visible = puesto; });
          });
        });

        // Capítulo 05: el giro de 180°. Gira el coche, no la cámara, para que se
        // lea como que cambia de papel y no como que lo miramos desde otro sitio.
        const giro = i < 4 ? 0 : i > 4 ? Math.PI : Math.PI * t;
        coche.rotation.y = giro;
      }

      renderer.render(escena, camara);
    };

    // Se declara antes del cargador: la devolucion de llamada lo usa, y tenerlo
    // detras solo funciona por casualidad de que la carga sea asincrona.
    const ultimo = { current: 0 };

    api.current = { aplicar };

    const cargador = new GLTFLoader();
    cargador.load(
      "/coche-troc.glb",
      (gltf) => {
        /* El modelo llega tumbado y en sus propias unidades: mide 4,24 a lo
           largo de X y viene con Z hacia arriba, que es la convención de las
           herramientas de modelado. La escena es Y arriba y morro a −Z, como el
           esquema de daños, para que el día que haya que poner los marcadores
           encima los anclajes de `ANCLA_3D` valgan sin tocar nada.

           Se corrige con dos grupos anidados y no con una rotación de tres
           ángulos: encadenar giros sobre un mismo objeto depende del orden en
           que three.js los componga, y así cada giro tiene su caja y no hay
           orden que discutir. */
        const enPie = new THREE.Group();
        enPie.rotation.x = -Math.PI / 2;      // Z arriba → Y arriba
        enPie.add(gltf.scene);
        const orientado = new THREE.Group();
        orientado.rotation.y = Math.PI / 2;   // largo en X → largo en Z
        orientado.add(enPie);

        /* Y se normaliza midiendo, no con números a mano: así vale para
           cualquier modelo que entre después. Largo 4,28 m, centrado y apoyado
           en el suelo. */
        const caja = new THREE.Box3().setFromObject(orientado);
        const tam = caja.getSize(new THREE.Vector3());
        const escala = 4.28 / (tam.z || 1);
        orientado.scale.setScalar(escala);

        const yaEscalada = new THREE.Box3().setFromObject(orientado);
        const centro = yaEscalada.getCenter(new THREE.Vector3());
        orientado.position.x -= centro.x;
        orientado.position.z -= centro.z;
        orientado.position.y -= yaEscalada.min.y;

        /* Se indexa por material, no por malla: los nombres de malla del T-Roc
           no dicen nada y los de material sí. Un material toca muchas mallas, de
           ahí la lista. */
        orientado.traverse((nodo) => {
          if (!nodo.isMesh) return;
          const materiales = Array.isArray(nodo.material) ? nodo.material : [nodo.material];
          for (const material of materiales) {
            if (!material) continue;
            nodo.visible = false;   // el capitulo 01 las va encendiendo
            material.envMapIntensity = 1.15;
            material.needsUpdate = true;
            const lista = piezas.get(material.name) || [];
            lista.push(nodo);
            piezas.set(material.name, lista);
          }
        });

        coche.add(orientado);
        cargado = true;
        aplicar(ultimo.current);
      },
      undefined,
      () => { /* sin modelo, la página sigue: se queda sin coche */ }
    );

    const conMemoria = (p) => { ultimo.current = p; aplicar(p); };
    registrarEscena(conMemoria);

    const alRedimensionar = () => { medir(); aplicar(ultimo.current); };
    medir();
    aplicar(0);
    window.addEventListener("resize", alRedimensionar);

    return () => {
      window.removeEventListener("resize", alRedimensionar);
      registrarEscena(null);
      // Sin esto cada visita a la página deja una escena y un contexto WebGL
      // colgando, y los contextos son un recurso contado: al octavo el navegador
      // empieza a cerrar los viejos.
      piezas.forEach((malla) => {
        malla.geometry?.dispose();
        if (Array.isArray(malla.material)) malla.material.forEach((m) => m.dispose());
        else malla.material?.dispose();
      });
      piezas.clear();
      entorno.texture.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
      api.current = null;
    };
  }, [registrarEscena]);

  // El lienzo no recibe pulsaciones: todo lo que se toca está por encima.
  return <div className="cf-escena3d" ref={contenedor} aria-hidden="true" />;
}

export { ENCUADRES };
