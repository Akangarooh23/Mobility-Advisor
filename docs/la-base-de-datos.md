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

## 4 · Lo que queda por hacer

Por orden de lo que más duele:

- **Cuatro claves prestadas.** `moveadvisor_user_invoices.id` es el
  identificador de la sesión de Stripe; `erp_staff_passwords` y
  `moveadvisor_user_preferences` van por correo —cambiarlo pierde la fila— y
  `erp_vendedores_marketplace` va por **nombre**: corregir una tilde crea un
  vendedor nuevo.
- **Datos copiados.** 16 tablas guardan `user_email` al lado de `user_id`, y
  alguna el nombre del taller o del proveedor al lado de su identificador. Dos
  sitios donde mirar y uno que se queda viejo.
- **Los 47 ficheros que tocan el esquema a mano**, que es lo que el trinquete
  vigila.
- **Dos tablas sin clave primaria**: `moveadvisor_vehicle_brands_copia_20260822`
  y `moveadvisor_vehicle_models_copia_20260822`, copias de seguridad de agosto.
  Si ya no hacen falta, se tiran.
