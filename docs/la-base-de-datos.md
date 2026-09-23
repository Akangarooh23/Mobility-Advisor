# La base de datos: cómo se cambia y cómo se nombra

Escrito el 22 de septiembre de 2026, el día en que el esquema dejó de estar
solo dentro del código.

**Una base para todo.** La web (`Mobility-Advisor`), la app
(`popcar-pocket-advisor`) y el ERP (`carswise-erp-backoffice`) escriben en la
**misma** base de Neon. Por eso las migraciones de todo —también las de las
tablas `erp_`— viven aquí, en `migrations/`. Dos carpetas de migraciones contra
una base es volver al problema.

---

## 1 · El esquema se cambia en un sitio

```powershell
cd C:\Users\Anapi\Projects\Mobility-Advisor
npm run migra -- --mirar     # qué falta por aplicar
npm run migra                # aplicarlo
```

Para hacer un cambio se escribe un fichero nuevo en `migrations/`, con el
siguiente número:

```
migrations/0004-lo-que-hace.sql
```

Y tres reglas:

1. **Una migración aplicada no se toca.** Se guarda su huella: si se edita
   después, `npm run migra` lo dice y para. Lo que corre en la base ya no sería
   lo que pone el fichero. Para corregir algo se escribe la siguiente.
2. **Cada fichero entra entero o no entra.** Se aplica dentro de una
   transacción. Si falla a la mitad, no queda nada a medias.
3. **Nada de `CREATE TABLE` dentro de un manejador.** Eso era lo de antes:
   22 ficheros de la web y 25 del ERP crean tablas la primera vez que alguien
   entra en la pantalla que los ejecuta. `npm run test:migraciones` vigila que
   ese número no suba; cuando se quite uno, se baja el tope en
   `scripts/comprueba-migraciones.js`.

Para ver lo que hay de verdad, sin fiarse de nada:

```powershell
npm run esquema                          # reescribe migrations/0001 desde la base
node scripts/que-falta-por-normalizar.mjs   # relaciones sin declarar y demás
```

## 2 · Cómo se identifica cada cosa

Cada entidad tiene **tres** identificadores, y confundirlos es lo que duele.

| | Qué es | Ejemplo | Dónde sale |
|---|---|---|---|
| **Clave** (`id`) | Lo que une las filas. No cambia nunca | `idcar-1790076532522-w3hajh` | En la base y en las direcciones |
| **Número** (`numero`) | Correlativo y legible | `IDC-0003` | En pantalla, por teléfono, en un contrato |
| **Identificador externo** | El de otro: Stripe, un portal | `cs_test_a1rey…` | En su columna, **nunca de clave** |

- **Lo que viaja en una dirección tiene que ser impredecible.** Un `/idcars/3`
  deja recorrer el inventario entero probando números. Es el agujero que tenían
  las facturas de proveedor: `PROV-2026-001.pdf`, y a partir de ahí todas.
- **El número se pone solo.** Un disparador (`pon_el_numero`) lo pide a
  `siguiente_numero()`, que lo saca de la tabla `numeracion` dentro de la misma
  transacción que la fila. No hace falta acordarse al escribir una pantalla
  nueva, y dos altas a la vez no se llevan el mismo número.
- **Sin huecos.** Una secuencia de Postgres los deja por diseño; un contador en
  una tabla se deshace con la fila. Para algo que sale en un papel eso importa,
  y para una factura además es obligatorio.

Las series de hoy:

| Serie | Qué numera | Se reinicia cada año |
|---|---|---|
| `CLI-0001` | Clientes | No |
| `IDC-0001` | IDCars | No |
| `ENC-2026-0001` | Encargos de venta | Sí |
| `LEAD-2026-0001` | Leads | Sí |
| `VIS-2026-0001` | Visitas | Sí |

Las facturas van por su cuenta con `nextInvoiceNumber` en el ERP, que ya hacía
esto mismo antes y es de donde salió el patrón.

Para numerar algo nuevo, en una migración:

```sql
ALTER TABLE lo_que_sea ADD COLUMN IF NOT EXISTS numero TEXT;
-- … rellenar lo que ya hay por orden de created_at …
CREATE TRIGGER pon_numero BEFORE INSERT ON lo_que_sea
  FOR EACH ROW EXECUTE FUNCTION pon_el_numero('XXX', 'true');
```

## 3 · Las relaciones se declaran

Una columna que se llama `lead_id` y no tiene una clave ajena detrás **no es**
una relación: es un texto que se parece a una. La base deja escribir un pedido
de un lead que no existe, y deja borrar un lead dejando huérfanos su historial y
sus documentos.

Hoy hay 70 declaradas (eran 39). Lo que cuelga de algo —historial, documentos,
gastos, daños— se borra con su padre; lo demás impide borrar al padre por
accidente.

**Lo único que no se declara es lo que apunta a `moveadvisor_market_offers`.**
Las ofertas son datos de fuera: los scrapers las borran y las reescriben a
diario. Una visita, un lead o una corrección a mano tienen que sobrevivir a que
la oferta desaparezca del portal.

## 4 · Los datos copiados: cuáles son deuda y cuáles no

No todo dato repetido es un error, y tratarlos igual lleva a romper cosas que
estaban bien.

**Una foto es correcta.** Una factura guarda `provider_name` porque eso es lo
que decía el documento el día que se emitió; si mañana el proveedor cambia de
razón social, la factura de antes **no** puede cambiar. Lo mismo con
`vehicle_title` en un lead: el anuncio del portal desaparece y el lead tiene que
seguir diciendo de qué coche hablaba. Esas se quedan, y por eso.

**Una copia que se espera que esté al día es deuda.** Doce tablas guardan
`user_email` al lado de `user_id`. Medido contra la base el 23 de septiembre de
2026: **0** filas con un correo que no es de nadie, **0** con la copia
diciendo un correo distinto al del usuario, y —antes de la migración 0006— 604
registros de embudo atados **solo** por el correo. Esos ya están atados por
identificador.

Lo que hace que esas doce copias sigan siendo inofensivas es una sola cosa:
**nada en el código cambia el correo de un usuario**. La prueba
`lib/cambiar-el-correo-toca-doce-tablas.test.js` existe para que eso no deje de
ser verdad en silencio: el día que se escriba la pantalla de «cambiar mi
correo», falla y enseña la lista de tablas que hay que actualizar en la misma
transacción.

Para volver a medirlo: `node scripts/que-falta-por-normalizar.mjs`.

## 5 · Lo que queda por hacer

- **Los 47 ficheros que tocan el esquema a mano**, que es lo que el trinquete
  vigila. Se quitan de uno en uno, bajando el tope.
- **Dos tablas sin clave primaria**: `moveadvisor_vehicle_brands_copia_20260822`
  y `moveadvisor_vehicle_models_copia_20260822`, copias de seguridad de agosto.
  Si ya no hacen falta, se tiran.
- **`workshop_name_resolved`**: la pantalla de citas del ERP lo pinta como
  respaldo de `workshop_name`, y no lo manda nadie. O se calcula por la relación
  —que es lo suyo— o se quita de la pantalla.
