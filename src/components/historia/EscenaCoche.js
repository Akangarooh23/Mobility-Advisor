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
 * El modelo es `coche-esquema.glb`, generado desde `car-3d.ts` del proyecto de
 * captura con `scripts/exportar-coche-glb.ts`. Son 20 piezas con su nombre
 * —carroceria, ruedas, cristal_lateral_der…— y no se fusionan en una sola malla
 * a propósito: sin nombres no se pueden encender una a una, que es justo lo que
 * cuenta el capítulo 01.
 *
 * Se pinta bajo demanda, no en un bucle continuo. El scroll es quien manda, y
 * cuando el usuario no toca nada no hay nada que repintar: un `requestAnimationFrame`
 * eterno solo gastaría batería.
 *
 * Iluminación: `RoomEnvironment`, que es un estudio procedural y no pesa nada.
 * Nada de mapas de entorno externos todavía; primero hay que ver si el coche
 * estilizado aguanta con luz procedural.
 */

/** El coche mide 4,28 m de largo. Las cámaras van en metros, sobre ese tamaño. */
const ENCUADRES = [
  // 01 BUSCA · de mirar el mercado en planta a mirar un coche
  { de: [0, 13, 9], a: [4.3, 1.9, -4.6], miraDe: [0, 0, 0], miraA: [0, 0.8, 0] },
  // 02 DESCUBRE · órbita lenta hasta el perfil
  { de: [4.3, 1.9, -4.6], a: [6.3, 1.5, 0.2], miraDe: [0, 0.8, 0], miraA: [0, 0.8, 0] },
  // 03 DECIDE · retrocede para que quepan tres
  { de: [6.3, 1.5, 0.2], a: [8.6, 2.5, 3.1], miraDe: [0, 0.8, 0], miraA: [0, 0.8, 0] },
  // 04 COMPRA · empuje corto al lateral
  { de: [8.6, 2.5, 3.1], a: [5.0, 1.4, 0.5], miraDe: [0, 0.8, 0], miraA: [0, 0.9, 0] },
  // 05 TU COCHE · la cámara no se mueve: gira el coche
  { de: [5.0, 1.4, 0.5], a: [5.0, 1.4, 0.5], miraDe: [0, 0.9, 0], miraA: [0, 0.9, 0] },
  // 06 MERCADO · se eleva para leer la nube de comparables
  { de: [5.0, 1.4, 0.5], a: [3.2, 7.6, 7.4], miraDe: [0, 0.9, 0], miraA: [0, 0.4, 0] },
  // 07 VENDE · rodea el coche hasta el otro costado
  { de: [3.2, 7.6, 7.4], a: [-5.6, 2.0, -3.0], miraDe: [0, 0.4, 0], miraA: [0, 0.8, 0] },
  // 08 GESTIONA · retroceso largo: el coche se hace pequeño y lo llena su historia
  { de: [-5.6, 2.0, -3.0], a: [0, 5.2, 13.5], miraDe: [0, 0.8, 0], miraA: [0, 0.7, 0] },
];

/**
 * Los siete grupos de montaje del capítulo 01, uno por filtro del buscador.
 * El orden no es estético: va de lo que define el coche a lo que lo remata,
 * igual que los filtros van de lo que más recorta a lo que menos.
 */
export const GRUPOS_MONTAJE = [
  ["carroceria"],
  ["ruedas"],
  ["cristal_lateral_der", "cristal_lateral_izq"],
  ["faro_der", "faro_izq", "piloto_der", "piloto_izq"],
  ["rejilla", "faldon_der", "faldon_izq"],
  ["retrovisor_der", "retrovisor_izq", "barra_techo_der", "barra_techo_izq"],
  ["molduras", "moldura_del_der", "moldura_del_izq", "moldura_tras_der", "moldura_tras_izq"],
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
          grupo.forEach((nombre) => {
            const malla = piezas.get(nombre);
            if (malla) malla.visible = puesto;
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
      "/coche-esquema.glb",
      (gltf) => {
        gltf.scene.traverse((nodo) => {
          if (!nodo.isMesh) return;
          piezas.set(nodo.name, nodo);
          nodo.visible = false;
          // El modelo llega con sus colores; solo se afina el acabado para que
          // el entorno tenga dónde reflejarse sin volverlo un espejo.
          if (nodo.material) {
            nodo.material.envMapIntensity = 1.1;
            nodo.material.needsUpdate = true;
          }
        });
        coche.add(gltf.scene);
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
