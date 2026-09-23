# Las cabeceras de seguridad de los tres sitios

Escrito el 23 de septiembre de 2026. Los tres sitios —www.popcar.com.es,
app.popcar.com.es y el ERP— servían **solo** `Strict-Transport-Security`.
Ahora llevan cuatro cabeceras más, puestas en el `vercel.json` de cada
proyecto.

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: frame-ancestors 'none'; base-uri 'self';
                         object-src 'none'; form-action 'self';
                         upgrade-insecure-requests
```

## Qué evita cada una

- **`nosniff`**: el navegador deja de adivinar el tipo de un fichero. Sin esto,
  algo servido como texto pero que parece JavaScript se puede acabar ejecutando.
- **`X-Frame-Options: DENY` y `frame-ancestors 'none'`**: nadie puede meter
  nuestras páginas dentro de un iframe. Eso es lo que impide el *clickjacking*:
  una página que aparenta ser otra cosa con la nuestra invisible encima, y el
  cliente pulsando «Publicar» o «Confirmar» sin saberlo. Van las dos porque la
  primera la entienden los navegadores viejos y la segunda los nuevos.
- **`Referrer-Policy`**: al salir hacia otro dominio solo se manda el origen, no
  la dirección entera. Sin esto, un enlace desde `/mi-cita?id=…&token=…` le
  regala el token al sitio de destino.
- **`base-uri 'self'`**: nadie puede inyectar un `<base>` que cambie a dónde
  apuntan todas las rutas relativas de la página.
- **`object-src 'none'`**: nada de Flash ni de `<embed>`. No se usan.
- **`form-action 'self'`**: un formulario de nuestras páginas solo puede enviar
  a nuestro dominio. Si algún día hay que enviar a un tercero —una pasarela que
  lo pida por POST— hay que añadirlo aquí; hoy el pago se hace redirigiendo, no
  con un formulario.

## Lo que **no** lleva, y por qué

**No hay `default-src` ni `script-src`.** Esa es la parte de verdad de una CSP,
y es también la que rompe un sitio en silencio si se pone a ciegas:

- la web y el ERP cargan imágenes de **decenas de dominios** —los CDN de los
  portales, Supabase, Google—, así que una `img-src` mal puesta deja el
  escaparate en blanco;
- la aplicación de la web es un CRA, que mete un script en línea en el
  `index.html`, y el ERP usa Google Fonts.

Ponerla bien es medir primero: publicar la política en modo `Report-Only`
—que no bloquea, solo avisa—, recoger una semana de avisos y cerrar a partir de
lo que salga. Eso necesita un sitio donde recoger los avisos, y es trabajo
aparte. Lo de arriba es lo que se puede poner hoy sin romper nada.

**No hay `Permissions-Policy`.** La app hace **fotos** con la cámara y la web
pide la **ubicación** para buscar talleres cerca. Una lista de permisos escrita
de memoria apaga justo eso. Cuando se ponga, hay que enumerar lo que se usa, no
lo que se prohíbe.

## Cómo comprobar que siguen puestas

```powershell
curl.exe -sI https://www.popcar.com.es/ | findstr /i "content-security x-frame referrer nosniff"
```

O las tres a la vez, que es lo que hace `npm run test:cabeceras`.
