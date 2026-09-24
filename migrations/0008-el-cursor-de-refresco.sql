-- El cursor de refresco de la libreta de barridos.
--
-- El verificador por listado de Milanuncios tenia una regla: "nunca se empieza
-- una marca que no cabe entera en el cupo de 9 peticiones", porque sin el
-- listado completo una ausencia no prueba una venta. Correcta para DAR DE BAJA,
-- y devastadora en la practica: la libreta del 24-sep-2026 tenia a Audi con 200
-- paginas y UNA leida desde el 14 de septiembre, igual que Citroen, Cupra o
-- Chevrolet. Las marcas donde estan casi todas nuestras filas no se miraban
-- nunca, y el verificador refrescaba ~200 ofertas al dia de 263.349.
--
-- Refrescar no necesita el listado entero: ver un anuncio prueba que sigue
-- publicado, se haya leido una pagina o doscientas. Asi que lo que sobra del
-- cupo se gasta leyendo paginas de las marcas grandes, y estas dos columnas son
-- lo que permite seguir manana por donde se quedo hoy en vez de releer siempre
-- las primeras.
--
-- refresh_at va aparte de swept_at a proposito: swept_at es el turno de los
-- barridos completos -los unicos que pueden dar de baja- y la cola descarta lo
-- barrido en las ultimas 20 horas. Si un refresco lo moviera, una marca grande
-- se quedaria fuera de esa cola sin haberse verificado jamas, que es justo el
-- problema que esto viene a arreglar.

ALTER TABLE moveadvisor_brand_sweeps
  ADD COLUMN IF NOT EXISTS refresh_page integer NOT NULL DEFAULT 0;

ALTER TABLE moveadvisor_brand_sweeps
  ADD COLUMN IF NOT EXISTS refresh_at timestamptz;

COMMENT ON COLUMN moveadvisor_brand_sweeps.refresh_page IS
  'Ultima pagina leida en un barrido de REFRESCO (no verifica, solo sella last_seen_at). 0 = empezar por la primera.';
COMMENT ON COLUMN moveadvisor_brand_sweeps.refresh_at IS
  'Cuando fue el ultimo refresco. Separado de swept_at, que es el de los barridos completos.';
