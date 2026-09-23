-- --------------------------------------------------------------------------
-- 0007 · El freno de ritmo, en la base
--
-- Había un limitador de intentos, y vivía en un `Map` dentro del proceso. Eso
-- en Vercel no limita nada: cada petición puede caer en una instancia distinta
-- —y las instancias se reciclan solas—, así que quien prueba contraseñas en
-- bucle reparte los intentos entre varias memorias y ninguna llega al tope. El
-- contador se reiniciaba solo, gratis y a favor de quien ataca.
--
-- Una tabla es lo contrario: una sola cuenta, la vean desde donde la vean.
--
-- Cómo cuenta: una fila por (ámbito, clave) con un plazo. Mientras el plazo no
-- venza se suma; cuando vence, la siguiente llamada lo reinicia. Es una ventana
-- fija —en el cambio de ventana caben dos ráfagas seguidas— y para lo que esto
-- protege sobra: la diferencia entre aguantar 10 intentos o 20 en quince
-- minutos no cambia nada, y la de aguantar 10 o infinitos lo cambia todo.
--
-- La fila se queda tras vencer, para que la siguiente llamada la reutilice en
-- vez de crear otra. Las que nadie vuelve a tocar las barre `limpiaLosFrenos`.
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS frenos_de_ritmo (
  -- Qué se está limitando: 'login', 'reset', 'visita'…
  ambito     TEXT        NOT NULL,
  -- Contra quién: un correo, una IP. Nunca los dos en la misma fila.
  clave      TEXT        NOT NULL,
  intentos   INTEGER     NOT NULL DEFAULT 0,
  -- Hasta cuándo cuenta esta ventana.
  hasta      TIMESTAMPTZ NOT NULL,
  creado_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ambito, clave)
);

-- Para barrer lo vencido sin recorrer la tabla entera.
CREATE INDEX IF NOT EXISTS ix_frenos_hasta ON frenos_de_ritmo (hasta);

COMMENT ON TABLE frenos_de_ritmo IS
  'Cuenta intentos por ámbito y clave. Se toca solo desde lib/freno.js.';
