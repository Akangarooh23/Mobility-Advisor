-- ============================================================================
--  La libreta de barridos: que marca se miro, cuando, y si cabia entera
--  2026-09-06
-- ============================================================================
--
--  En Wallapop se verifica oferta por oferta: se pide la ficha y un 404 dice
--  que ya no esta. En Milanuncios eso no se puede hacer. Sus fichas estan
--  detras de Imperva y devuelven la pagina de desafio con un HTTP 200, asi que
--  no hay forma de preguntar por un anuncio concreto.
--
--  Lo unico que sigue accesible es el listado por marca. Y de un listado solo
--  se puede deducir una baja si se ha visto ENTERO: si de una marca de 200
--  paginas miramos las 9 primeras, una oferta nuestra que no aparezca puede
--  estar viva y sepultada bajo anuncios mas nuevos. Ausencia solo significa
--  baja con el listado completo delante.
--
--  ── Por que hace falta apuntarlo ───────────────────────────────────────────
--
--  El cupo de Milanuncios es de ~9-10 peticiones por ventana, o sea un barrido
--  por ejecucion. Hay que elegir a que marca le toca, y la primera version
--  elegia "la que tenga la fila mas antigua sin comprobar". Eso se atasca: una
--  marca de 200 paginas nunca llega a verificarse entera, asi que sus filas
--  siguen siendo las mas antiguas y se lleva el turno todas las noches, para
--  siempre, sin llegar a dar de baja a nadie.
--
--  El dato que falta no es de la oferta, es de la marca: cuantas paginas tiene
--  en el portal y cuando se miro por ultima vez. Eso no cabe en
--  moveadvisor_market_offers -seria el mismo valor repetido en 250 filas- y por
--  eso va aparte.
--
--  ── Que se gana ────────────────────────────────────────────────────────────
--
--  Saber el tamaño de cada marca permite repartir la noche en vez de dedicarsela
--  a una sola. El planificador mete marcas que quepan ENTERAS hasta agotar el
--  cupo, y lo que sobre lo gasta en sondear -pagina 1 y nada mas- las marcas sin
--  medir. Una noche puede verificar Ineos, Dongfeng, Tata y Daewoo enteras y aun
--  sondear dos marcas nuevas; antes se habria ido en media Volkswagen, que no
--  sirve para nada porque media marca no permite deducir ninguna baja.
--
--  Las marcas que se midieron grandes se vuelven a sondear cada 30 dias, por si
--  han encogido lo bastante para caber.
--
--  Y de paso queda escrito, marca por marca, hasta donde llega lo que sabemos:
--  `complete = false` es la respuesta honesta a "¿esta verificada esta oferta?".
--
--  Sirve para cualquier portal que haya que verificar por listado, no solo
--  Milanuncios; de ahi la columna `portal`.
-- ============================================================================

CREATE TABLE IF NOT EXISTS moveadvisor_brand_sweeps (
  portal          TEXT        NOT NULL,

  -- La marca en minusculas, como se guarda en las ofertas: 'mercedes benz'.
  -- El slug del portal ('mercedes-benz') se deduce de aqui, no se guarda.
  brand           TEXT        NOT NULL,

  swept_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Paginas que dice tener el listado de esa marca, y cuantas llegamos a leer.
  total_pages     INTEGER,
  pages_read      INTEGER,

  -- El campo que decide si se puede dar de baja por ausencia. Solo es true si
  -- se leyo el listado entero Y ninguna pagina vino bloqueada.
  complete        BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Anuncios vistos publicados en ese barrido, y bajas que provoco.
  seen_count      INTEGER,
  deactivated     INTEGER,

  -- Para distinguir "no cabia en el cupo" de "nos echaron a mitad".
  blocked         BOOLEAN     NOT NULL DEFAULT FALSE,

  PRIMARY KEY (portal, brand)
);

-- El turno se pide siempre igual: las de un portal, ordenadas por fecha.
CREATE INDEX IF NOT EXISTS ix_brand_sweeps_turno
  ON moveadvisor_brand_sweeps (portal, swept_at);

-- Solo se guarda el ultimo barrido de cada marca, no el historico. Si algun dia
-- interesa la serie -para medir cuanto dura un anuncio, por ejemplo- se añade
-- una tabla de eventos aparte; meter el historico aqui obligaria a que cada
-- consulta del turno hiciera un DISTINCT ON, y el turno se pide cada noche.

-- ============================================================================
--  Para deshacerla:  DROP TABLE moveadvisor_brand_sweeps;
-- ============================================================================
