# SEO limpio: indexacion y difusion

Fecha de preparacion: 2026-04-20

## 0) Estado tecnico base (verificado)

- [x] `robots.txt` publicado con referencia a sitemap.
- [x] `sitemap.xml` publicado y alineado con las URLs objetivo.
- [x] URLs clave presentes en frontend y listas para indexacion.
- [x] Verificar en produccion: https://www.carswiseai.com/robots.txt (ok, 2026-04-20)
- [x] Verificar en produccion: https://www.carswiseai.com/sitemap.xml (ok, 2026-04-20)

Estado Google Search Console (revision 2026-04-20):

- Sitemap procesado correctamente.
- Paginas descubiertas: 12.
- Paginas indexadas: al menos 1 confirmada (Home).
- Paginas sin indexar: 3 (2 motivos).
	- Pagina con redireccion: 1 (esperable para URL no canonica).
	- Rastreada: actualmente sin indexar: 2.
- Validacion iniciada para ambos motivos en Search Console.
- Solicitud manual de indexacion enviada para las 11 URLs restantes (2026-04-20).

Conclusiones tecnicas de revision:

- [x] Redirecciones canónicas correctas:
	- `http://carswiseai.com/` -> `https://carswiseai.com/` -> `https://www.carswiseai.com/`
	- `https://carswiseai.com/` -> `https://www.carswiseai.com/`
	- `http://www.carswiseai.com/` -> `https://www.carswiseai.com/`
- [x] URL canonica final responde 200: `https://www.carswiseai.com/`
- [ ] Esperar recrawl de Google tras validacion (normalmente 3-14 dias).

## 1) URLs publicas a indexar

- https://www.carswiseai.com/
- https://www.carswiseai.com/marketplace-vo
- https://www.carswiseai.com/asesor-vehiculo
- https://www.carswiseai.com/servicios
- https://www.carswiseai.com/blog
- https://www.carswiseai.com/blog/guia-compra-coche-segunda-mano-espana
- https://www.carswiseai.com/blog/renting-vs-compra-2026-que-conviene-segun-tu-uso
- https://www.carswiseai.com/contacto
- https://www.carswiseai.com/aviso-legal
- https://www.carswiseai.com/politica-privacidad
- https://www.carswiseai.com/politica-cookies
- https://www.carswiseai.com/terminos-condiciones

Checklist rapido:

- [ ] Todas devuelven 200 en navegador (sin redirects raros).
- [ ] Todas cargan `title` y `description` correctos.
- [ ] Todas incluyen enlazado interno desde Home/Blog/Footer.

## 2) Solicitar indexacion en Google Search Console

Acceso directo: https://search.google.com/search-console

1. Abrir inspeccion de URL en Search Console.
2. Pegar cada URL de la lista.
3. Pulsar Solicitar indexacion.
4. Repetir hasta completar todas.
5. Revisar el informe de indexacion a las 24-72 horas.

Control de avance:

- [x] Home `/` (inspeccionado y solicitado)
- [x] Marketplace VO `/marketplace-vo` (solicitado)
- [x] Asesor `/asesor-vehiculo` (solicitado)
- [x] Servicios `/servicios` (solicitado)
- [x] Blog index `/blog` (solicitado)
- [x] Blog compra usado (solicitado)
- [x] Blog renting vs compra (solicitado)
- [x] Contacto (solicitado)
- [x] Aviso legal (solicitado)
- [x] Politica privacidad (solicitado)
- [x] Politica cookies (solicitado)
- [x] Terminos y condiciones (solicitado)

Acciones prioritarias por estado actual (pendiente de recrawl):

- [x] Solicitar indexacion manual hoy para las 11 URLs restantes.
- [ ] Asegurar al menos 3 enlaces externos directos a `https://www.carswiseai.com/` esta semana.
- [ ] Publicar 1 articulo nuevo en blog en 7-10 dias para acelerar senal de frescura.
- [ ] Revisar de nuevo Cobertura e Inspeccion de URL en 72h y en 7 dias.

## 3) Compartir la web en al menos 3 sitios externos

## Opcion A: perfiles propios

- LinkedIn (perfil personal y/o pagina)
- X (hilo corto con propuesta de valor)
- Medium (resumen del articulo con enlace canonico a CarsWise)

## Opcion B: comunidades y directorios

- Product Hunt (lanzamiento)
- Indie Hackers (post de presentacion)
- Hacker News Show HN (si preparas un texto tecnico)

## Mensaje base recomendado

CarsWise AI ya esta online: te ayuda a decidir mejor entre compra, renting y servicios de movilidad con enfoque de coste total. Hemos publicado dos guias practicas para reducir errores caros al comprar y para decidir entre renting y compra. Feedback bienvenido.

Version corta para X/LinkedIn:

CarsWise AI ya esta online. Ayuda a decidir mejor entre compra, renting y servicios con foco en coste total real. Incluye dos guias practicas para evitar errores caros. Feedback bienvenido: https://www.carswiseai.com/

Tracking de difusion:

- [ ] LinkedIn perfil
- [ ] LinkedIn pagina
- [ ] X
- [ ] Medium
- [ ] Product Hunt
- [ ] Indie Hackers
- [ ] Hacker News Show HN

## 4) Seguimiento semanal minimo

- Revisar paginas descubiertas e indexadas en Search Console.
- Revisar consultas y CTR en Rendimiento.
- Publicar 1 articulo nuevo cada 2-3 semanas.
- Añadir enlaces internos desde home y blog a las paginas clave.

Indicadores minimos semanales:

- [ ] Cobertura: paginas indexadas / paginas enviadas.
- [ ] Rendimiento: clics, impresiones, CTR y posicion media de URLs clave.
- [ ] Top consultas nuevas y su URL de aterrizaje.
- [ ] 3 mejoras aplicadas (titulo, enlazado, snippet, contenido).

## 5) Mini plan de 14 dias (ejecucion)

Dia 1-2

- [ ] Solicitar indexacion de todas las URLs.
- [ ] Publicar en 3 canales externos.

Dia 3-7

- [ ] Revisar primeras impresiones y errores de cobertura.
- [ ] Ajustar enlazado interno Home -> Servicios/Marketplace/Blog.

Dia 8-14

- [ ] Publicar 1 contenido nuevo en blog.
- [ ] Reenviar a indexacion la nueva URL y actualizar sitemap si aplica.
