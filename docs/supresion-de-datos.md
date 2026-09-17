# Cuando alguien pide que borremos sus datos

Qué hacer, en orden, cuando llega una petición de supresión (derecho al olvido,
artículo 17 del RGPD). Hoy se hace a mano; esto es para que se haga completo y
nadie se deje nada.

Escrito el 17 de septiembre de 2026, contra el esquema real de la base de ese
día. **Si se crea una tabla nueva con datos de clientes, hay que añadirla aquí.**

---

## 1. Antes de borrar nada

- **Plazo:** hay que responder en **un mes** desde que llega la petición. Se
  puede alargar dos meses más si es complicado, pero avisando dentro del primero.
- **Que sea quien dice ser.** Vale que la petición llegue desde el mismo correo
  de la cuenta. Si llega desde otro, se le pide que escriba desde el suyo. No se
  piden documentos de identidad si no hace falta.
- **Guardar la petición y la respuesta** (el hilo de correo) **tres años**. Es la
  prueba de que se atendió, y es lo único que se conserva con su nombre.
- **Mirar si tiene algo en marcha.** Una venta gestionada con mandato firmado,
  una importación o un renting activo no se borran sin más: se le explica qué se
  borra ya y qué cuando termine la operación.

Todo lo que sigue usa `correo@del.cliente` como marcador. **Sustitúyelo en todo el
bloque por su correo, en minúsculas**, antes de ejecutar nada.

---

## 2. Qué se borra, qué se guarda y qué se anonimiza

No todo se puede borrar. La ley obliga a conservar las facturas años, y lo que
se guarda por ese motivo se **bloquea**: se aparta y no se usa para nada más.

| Qué | Qué se hace | Por qué |
|---|---|---|
| Coches, fotos, papeles, seguros, mantenimientos, tasaciones, citas, alertas, guardados, preferencias, sesiones, solicitudes de taller | **Se borra** | Son suyos y no hay obligación de guardarlos |
| Facturas (`moveadvisor_user_invoices`, `moveadvisor_provider_invoices`) y los datos fiscales de su ficha (nombre, NIF, dirección de facturación) | **Se bloquea** | Código de Comercio: 6 años. Hacienda: 4 |
| Contratos y operaciones (`moveadvisor_renting_contracts`, `erp_encargos_venta`, `erp_tramites`, `erp_pedidos`) | **Se bloquea** — confirmar plazo con el asesor | Pueden generar responsabilidades después |
| Historial de consentimientos (`moveadvisor_user_consents`) | **Se bloquea** | Es la prueba de qué autorizó y cuándo lo retiró. Hasta 3 años |
| Estadísticas (`moveadvisor_funnel_events`, `funnel_outreach`) y solicitudes comerciales (`moveadvisor_market_leads`) | **Se anonimiza** | Sirven para métricas sin necesidad de saber de quién son |
| Visitas con otra persona (`vehicle_visit_bookings`, `moveadvisor_viewing_appointments`) | **Se anonimiza su parte** | El vendedor o el concesionario tienen derecho a conservar la suya |

---

## 3. Paso a paso

### 3.1 Ver qué hay (no cambia nada)

```sql
SELECT 'coches' AS que, count(*) FROM moveadvisor_user_vehicles WHERE lower(user_email) = 'correo@del.cliente'
UNION ALL SELECT 'facturas', count(*) FROM moveadvisor_user_invoices WHERE lower(email) = 'correo@del.cliente'
UNION ALL SELECT 'solicitudes comerciales', count(*) FROM moveadvisor_market_leads WHERE lower(user_email) = 'correo@del.cliente'
UNION ALL SELECT 'rentings', count(*) FROM moveadvisor_renting_contracts WHERE lower(user_email) = 'correo@del.cliente'
UNION ALL SELECT 'encargos de venta', count(*) FROM erp_encargos_venta WHERE lower(cliente_email) = 'correo@del.cliente'
UNION ALL SELECT 'tramites', count(*) FROM erp_tramites WHERE lower(cliente_email) = 'correo@del.cliente';
```

Si salen **encargos de venta, trámites o rentings**, para aquí y mira el punto 1:
puede que no se pueda borrar todo todavía.

### 3.2 Apuntar los ids de sus coches

```sql
SELECT id, title, plate FROM moveadvisor_user_vehicles WHERE lower(user_email) = 'correo@del.cliente';
```

Hacen falta para el paso siguiente, **y hay que sacarlos antes de borrar**: una vez
borradas las filas, no hay forma de saber qué carpetas eran suyas.

### 3.3 Borrar los ficheros de Supabase

Las fotos y los papeles están en **Supabase → Storage → bucket `vehicle-files`**,
cada coche en su carpeta: `vehicles/<id del coche>/`. Por cada id del paso
anterior, borrar esa carpeta entera.

Ojo: los papeles más antiguos no están en Supabase sino **dentro de la base**, en
columnas `file_content_base64`. Esos se borran solos con el paso siguiente.

### 3.4 Borrar y anonimizar en la base

Todo en una transacción: o se hace entero, o no se hace nada.

```sql
BEGIN;

-- Lo que cuelga de sus coches, antes que los coches
DELETE FROM moveadvisor_user_vehicle_files WHERE vehicle_id IN (SELECT id FROM moveadvisor_user_vehicles WHERE lower(user_email) = 'correo@del.cliente');
DELETE FROM moveadvisor_user_vehicle_documents WHERE vehicle_id IN (SELECT id FROM moveadvisor_user_vehicles WHERE lower(user_email) = 'correo@del.cliente');
DELETE FROM moveadvisor_vehicle_condition_reports WHERE lower(created_by_email) = 'correo@del.cliente' OR vehicle_id IN (SELECT id FROM moveadvisor_user_vehicles WHERE lower(user_email) = 'correo@del.cliente');
DELETE FROM moveadvisor_user_vehicle_states WHERE lower(user_email) = 'correo@del.cliente';

-- Seguros y mantenimientos, con sus documentos
DELETE FROM moveadvisor_user_insurance_documents WHERE insurance_id IN (SELECT id FROM moveadvisor_user_insurances WHERE lower(user_email) = 'correo@del.cliente');
DELETE FROM moveadvisor_user_insurances WHERE lower(user_email) = 'correo@del.cliente';
DELETE FROM moveadvisor_user_maintenance_invoices WHERE maintenance_id IN (SELECT id FROM moveadvisor_user_maintenances WHERE lower(user_email) = 'correo@del.cliente');
DELETE FROM moveadvisor_user_maintenances WHERE lower(user_email) = 'correo@del.cliente';

-- El resto de lo suyo
DELETE FROM moveadvisor_user_valuations WHERE lower(user_email) = 'correo@del.cliente';
DELETE FROM moveadvisor_user_appointments WHERE lower(user_email) = 'correo@del.cliente';
DELETE FROM moveadvisor_user_vehicles WHERE lower(user_email) = 'correo@del.cliente';
DELETE FROM moveadvisor_user_saved_offers WHERE lower(user_email) = 'correo@del.cliente';
DELETE FROM moveadvisor_user_saved_comparisons WHERE lower(user_email) = 'correo@del.cliente';
DELETE FROM moveadvisor_user_preferences WHERE lower(user_email) = 'correo@del.cliente';
DELETE FROM moveadvisor_user_market_alert_status WHERE lower(user_email) = 'correo@del.cliente';
DELETE FROM moveadvisor_user_market_alerts WHERE lower(user_email) = 'correo@del.cliente';
DELETE FROM market_alert_notifications WHERE lower(user_email) = 'correo@del.cliente';
DELETE FROM market_alerts WHERE lower(user_email) = 'correo@del.cliente';
DELETE FROM moveadvisor_vehicle_alerts WHERE lower(email) = 'correo@del.cliente';
DELETE FROM moveadvisor_service_requests WHERE lower(user_email) = 'correo@del.cliente';
DELETE FROM moveadvisor_sessions WHERE user_id IN (SELECT id FROM moveadvisor_users WHERE lower(email) = 'correo@del.cliente');

-- Solo si la tabla existe (se crea la primera vez que alguien activa los avisos)
-- DELETE FROM moveadvisor_push_devices WHERE lower(user_email) = 'correo@del.cliente';

-- Anonimizar: se quedan para estadística, sin saber de quién son
UPDATE moveadvisor_funnel_events SET user_email = NULL, user_id = NULL WHERE lower(user_email) = 'correo@del.cliente';
UPDATE funnel_outreach SET user_email = '' WHERE lower(user_email) = 'correo@del.cliente';
UPDATE moveadvisor_market_leads SET user_email = '', contact_name = '', contact_phone = '', contact_when = '', appointment_address = '', appointment_contact = '', entrega_direccion = '', plate = '' WHERE lower(user_email) = 'correo@del.cliente';

-- Visitas con otra persona: se borra su parte, la del otro se queda
UPDATE vehicle_visit_bookings SET buyer_email = '', buyer_name = 'Anonimizado', buyer_phone = '' WHERE lower(buyer_email) = 'correo@del.cliente';
UPDATE moveadvisor_viewing_appointments SET buyer_email = '', buyer_name = 'Anonimizado', buyer_message = '' WHERE lower(buyer_email) = 'correo@del.cliente';

-- Su ficha: se quita lo que no hace falta para las facturas
UPDATE moveadvisor_users SET phone = '', iban = NULL, registration_ip = '' WHERE lower(email) = 'correo@del.cliente';

COMMIT;
```

Si algo falla a mitad, `ROLLBACK;` y no ha pasado nada.

### 3.5 Su ficha de usuario

- **Si no tiene ninguna factura:** se borra la fila entera.
  ```sql
  DELETE FROM moveadvisor_users WHERE lower(email) = 'correo@del.cliente';
  ```
- **Si tiene facturas:** la fila se queda, con solo lo fiscal, porque las facturas
  la necesitan. Ya no puede entrar: sus sesiones se han borrado arriba. Anotar en
  qué fecha vence el plazo de conservación para borrarla entonces.

---

## 4. Fuera de nuestra base

| Dónde | Qué hacer |
|---|---|
| **Stripe** | Si tiene facturas, el cliente **no se borra**: se le quitan teléfono y dirección que no salgan en ellas. Si nunca pagó nada, se borra el cliente |
| **ERP** (`erp_*`, misma base) | Buscar su correo en `erp_users`, `erp_peritaciones` y `erp_transportes`. Lo que sea de una operación cerrada se trata como las facturas |
| **Firebase** | Nada: al borrar sus móviles de `moveadvisor_push_devices` ya no le llega nada |
| **Resend** | Guarda los correos enviados unos días por su cuenta. No se borra desde aquí; caduca solo |
| **Copias de seguridad** | Las copias de la base se renuevan solas. No hace falta tocarlas, pero si alguna vez se restaura una, hay que repetir esto |

---

## 5. Contestarle

Un correo corto diciendo, sin tecnicismos:

- que sus datos se han borrado, con la fecha;
- qué se conserva y por qué — normalmente, *"las facturas, durante el plazo que
  nos obliga la ley; no se usan para nada más"*;
- que puede reclamar ante la Agencia Española de Protección de Datos si no está
  conforme.

Guardar ese correo junto con su petición (punto 1).

---

## Cuando haya volumen

Esto está pensado para unas pocas peticiones al año. El día que lleguen varias al
mes, tiene sentido automatizarlo: un botón de "borrar mi cuenta", confirmación
por correo, unos días de margen y un proceso que haga todo lo de arriba. El
diseño está hablado; lo que no conviene es montarlo antes de que haga falta.
