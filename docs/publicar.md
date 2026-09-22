# Publicar: qué sube a dónde

Tres cosas se publican por caminos distintos, y confundirlos es publicar a
medias. Escrito el 22 de septiembre de 2026.

| Qué | Dónde se ve | Cómo se publica |
|---|---|---|
| La web y la API | www.popcar.com.es | Empujar a `main` de **Mobility-Advisor**. Vercel lo despliega solo. |
| La web de la app | app.popcar.com.es | Empujar a `main` de **popcar-pocket-advisor**. También sola. |
| La app de Android | El APK | Lanzar el flujo de Actions a mano, desde `main`. |

---

## 1 · La web y la API

```powershell
cd C:\Users\Anapi\Projects\Mobility-Advisor
git add -A
git commit -m "lo que has hecho"
git push
```

Y ya está: al llegar a `main`, Vercel construye y pone el resultado en
www.popcar.com.es. Tarda un par de minutos.

## 2 · La web de la app

Igual que la web: **lo que llega a `main` está publicado**.

```powershell
cd C:\Users\Anapi\Projects\popcar-pocket-advisor
git add -A
git commit -m "lo que has hecho"
git push
```

### Lo que dice la rama `produccion`, y lo que no

Existe una rama `produccion` y **no publica nada**: en Vercel la rama de
producción de este proyecto es `main`, así que lo que se empuja a `produccion`
sale como **vista previa**, con su propia dirección y sin tocar
app.popcar.com.es.

Se escribió para ser una puerta —«main la sincroniza Lovable y publicaría sin
que nadie lo mire»— pero esa puerta nunca llegó a cerrarse, y una puerta que lo
parece y está abierta es peor que no tenerla: el 22 de septiembre di por hecho
que la app llevaba 46 commits sin publicar y fusioné para «soltarlos», cuando
ya estaban publicados desde `main`.

Se queda por si sirve para ver algo antes de soltarlo:

```powershell
git checkout produccion
git merge main
git push                 # sale una vista previa, no toca app.popcar.com.es
git checkout main
```

**Cuándo habría que volver a la puerta de verdad**: el día que se vuelva a tocar
la app desde Lovable, o entre alguien más al repositorio. Entonces se cambia la
rama de producción a `produccion` en Vercel (Settings → Git → Production Branch)
y publicar pasa a ser esa fusión. Mientras el único que escribe seas tú, la red
de seguridad son las pruebas, no la rama.

## 3 · El APK

```powershell
cd C:\Users\Anapi\Projects\popcar-pocket-advisor
gh workflow run android.yml
```

Se compila desde `main`, así que **no** hace falta pasar por `produccion` para
probar en el móvil. Sale en Actions, en Artifacts, como `popcar-android-debug`.

Para el paquete de Google Play es el otro flujo, `android-play.yml`, y su
camino entero está en el repo de la app: `docs/subir-a-play.md`.

---

## Comprobar que ha salido de verdad

```powershell
npx vercel ls mobility-advisor        # los últimos despliegues y su estado
npx vercel ls popcar-pocket-advisor
```

El primero de la lista es el más reciente: tiene que poner **Ready** y
**Production**.

Y dos trampas al comprobarlo a mano:

- **El panel no viaja en `main.js`.** Se carga aparte, en un `*.chunk.js`, así
  que buscar un texto nuevo en `main.js` y no encontrarlo **no** quiere decir
  que no esté publicado. Se mira el trozo que carga esa pantalla.
- **El navegador guarda la página.** Si sigues viendo lo de antes, Ctrl+F5.

## Lo que NO se publica empujando

Los flujos de **n8n**. El repositorio guarda su copia, pero lo que corre es la
de n8n: hay que **reimportar** el JSON. Para saber cuáles están desfasados:

```powershell
cd C:\Users\Anapi\Projects\Mobility-Advisor
npm run que-reimporto
```
