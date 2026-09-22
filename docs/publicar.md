# Publicar: qué sube a dónde

Tres cosas se publican por caminos distintos, y confundirlos es publicar a
medias. Escrito el 22 de septiembre de 2026.

| Qué | Dónde se ve | Cómo se publica |
|---|---|---|
| La web y la API | www.popcar.com.es | Empujar a `main` de **Mobility-Advisor**. Vercel lo despliega solo. |
| La web de la app | app.popcar.com.es | Fusionar `main` en **`produccion`** de **popcar-pocket-advisor** y empujar. |
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

`main` **no** publica: esa rama la sincroniza el editor de Lovable, y cualquiera
que guardara allí publicaría sin que nadie lo mire. La que publica es
`produccion`.

```powershell
cd C:\Users\Anapi\Projects\popcar-pocket-advisor
git add -A
git commit -m "lo que has hecho"
git push                 # main: aquí vive el código y de aquí sale el APK

git checkout produccion
git merge main
git push                 # esto es lo que publica app.popcar.com.es
git checkout main        # y se vuelve, para seguir trabajando
```

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
