"use strict";

/**
 * El mismo cliente pidiendo dos veces lo mismo.
 *
 * Pasó con Juan: pidió «vender su coche» a las 22:40:06 y otra vez a las
 * 22:40:46. En el ERP salieron **dos leads idénticos** —mismo correo, mismo
 * coche, misma frase— y quien los mira no puede saber si son dos personas, dos
 * coches o un dedo nervioso. Lo llama dos veces, o llama a una y la otra se
 * queda ahí muerta dando guerra en Pendientes.
 *
 * No es culpa suya: le dio a enviar, no vio nada claro y volvió a darle. Lo que
 * falta es que el servidor no lo apunte dos veces.
 *
 * ## Por qué no vale el límite que ya había
 *
 * Hay un tope de tres solicitudes por correo cada diez minutos, pero vive **en
 * la memoria de la función**. En Vercel cada petición puede caer en una copia
 * distinta, así que el segundo envío llegó a una copia recién arrancada, donde
 * no constaba el primero. Esto se pregunta a la base, que es la única que sabe
 * lo que hay.
 *
 * ## Qué cuenta como repetido
 *
 * El mismo correo, el mismo tipo de solicitud y el mismo coche, dentro de un
 * día. Y solo si el de antes **sigue vivo**: si ya se atendió y se cerró, que
 * vuelva a escribir es una solicitud nueva de verdad.
 *
 * Al que repite no se le dice que es un repetido: se le contesta que está
 * recibida, que es lo que ha pasado. Lo que no se hace es apuntarlo otra vez ni
 * volver a avisar al equipo.
 */

/** Cuánto dura la ventana en la que dos solicitudes iguales son la misma. */
const HORAS_DE_LA_VENTANA = 24;

/**
 * Los estados en los que un lead ya no espera nada.
 *
 * Mientras esté en cualquier otro —pendiente, contactado, en proceso, cita
 * confirmada— la solicitud sigue viva y no hace falta una segunda.
 *
 * Son los cinco finales de la lista que valida el ERP en `routes/leads.ts`, ni
 * uno más. Aquí llegó a haber «No interesado» y «Perdido», que allí no existen
 * y por tanto no cerraban nada, y faltaba «Cerrado», que sí: a quien se le
 * atendió, se le cerró la solicitud y volvía a escribir semanas después se le
 * tragaba el mensaje sin apuntarlo en ningún sitio. Si el ERP añade un estado
 * final, va aquí.
 */
const YA_NO_ESPERA = ["Cerrado", "Vendido", "Entregado", "Cancelado", "Descartado"];

/**
 * El lead vivo e igual que este, si lo hay.
 *
 * El coche se compara por su identificador cuando lo hay —es lo que eligió de
 * su garaje— y si no por el título, que es lo que escribió a mano. Sin ninguno
 * de los dos, basta el correo y el tipo: dos «quiero que me vendáis un coche»
 * del mismo señor en el mismo día son la misma conversación.
 */
const SQL_YA_LO_PIDIO = `
  SELECT id, numero, created_at
    FROM moveadvisor_market_leads
   WHERE lower(user_email) = lower($1)
     AND lead_type = $2
     AND created_at > NOW() - ($5 || ' hours')::interval
     AND COALESCE(status, '') <> ALL ($6::text[])
     AND (
       ($3 <> '' AND COALESCE(vehicle_id, '') = $3)
       OR ($3 = '' AND $4 <> '' AND lower(COALESCE(vehicle_title, '')) = lower($4))
       OR ($3 = '' AND $4 = '')
     )
   ORDER BY created_at DESC
   LIMIT 1`;

/** Los parámetros de esa consulta, en su orden. */
function losDatosDeLaBusqueda({ email, leadType, vehicleId, vehicleTitle }) {
  return [
    String(email || "").trim(),
    String(leadType || ""),
    String(vehicleId || "").trim(),
    String(vehicleTitle || "").trim(),
    String(HORAS_DE_LA_VENTANA),
    YA_NO_ESPERA,
  ];
}

module.exports = { HORAS_DE_LA_VENTANA, YA_NO_ESPERA, SQL_YA_LO_PIDIO, losDatosDeLaBusqueda };
