# Deploy con `clasp` — paso a paso

Guía para subir el módulo de recibos a Google Apps Script desde tu compu usando
`clasp` (la CLI oficial de Apps Script) y publicarlo como Web App.

> ¿Preferís no usar la terminal? El `README.md` tiene el camino manual desde
> [script.google.com](https://script.google.com). Esta guía es el camino CLI.

---

## 0) Requisitos previos

- **Node.js** instalado (cualquier versión LTS reciente). Verificá:
  ```bash
  node -v
  npm -v
  ```
- Una **cuenta de Google** que sea dueña (o tenga acceso de edición) de las dos
  planillas: `financiero` y `clientes`.

---

## 1) Instalar clasp

```bash
npm install -g @google/clasp
clasp --version
```

---

## 2) Habilitar la Apps Script API (una sola vez)

Entrá a **https://script.google.com/home/usersettings** y activá
**"API de Google Apps Script"** (Apps Script API → ON).

Sin esto, `clasp push` falla con un error de permisos.

---

## 3) Loguearte

```bash
clasp login
```

Se abre el navegador, elegí la cuenta de Google y aceptá los permisos. Esto
guarda tus credenciales en `~/.clasprc.json`.

> Si estás en un servidor sin navegador: `clasp login --no-localhost` y seguí
> las instrucciones que imprime.

---

## 4) Completar el CONFIG ANTES de subir

Abrí `Codigo.gs` y reemplazá los `<<< COMPLETAR >>>`:

- `SHEET_FINANCIERO_ID` y `SHEET_CLIENTES_ID` → el ID de cada planilla
  (lo sacás de la URL: `.../spreadsheets/d/`**`ESTE_ID`**`/edit`).
- `LOGO_BASE64` y `FIRMA_BASE64` → el data URI de cada imagen
  (`data:image/png;base64,....`). Opcional: si los dejás, salen en el PDF.
- Revisá que `COLS_FINANCIERO` / `COLS_CLIENTES` coincidan con los encabezados
  reales (primera fila) de tus hojas.

> Podés subir igual sin completar y editarlo después en el editor web, pero la
> app no va a traer datos hasta que los IDs estén puestos.

---

## 5) Crear el proyecto de Apps Script

Parado en la carpeta del repo (`/home/user/recibo` o donde lo tengas):

```bash
clasp create --type webapp --title "Recibos Surcherie"
```

Cuando pregunte por el directorio / sobrescribir `appsscript.json`, **elegí NO
sobrescribir** (ya tenemos uno configurado con zona horaria Argentina, scopes y
la config de Web App).

Esto genera un archivo `.clasp.json` con el `scriptId`. **No lo borres** ni lo
subas a git público (ya lo ignoramos en `.gitignore`).

> Si el proyecto **ya existe** en Apps Script y querés vincularlo en vez de
> crearlo nuevo: `clasp clone <SCRIPT_ID>` (el ID está en la URL del editor,
> `.../projects/`**`SCRIPT_ID`**`/edit`).

---

## 6) Subir los archivos

```bash
clasp push
```

`clasp` sube `Codigo.gs`, `Index.html`, `Estilos.html`, `Scripts.html` y
`appsscript.json`. El resto (README, .md, etc.) se ignora vía `.claspignore`.

Para verificar en el navegador:

```bash
clasp open
```

---

## 7) Probar el número en letras (recomendado)

En el editor web (`clasp open`), seleccioná la función
`recibo_testNumeroALetras` y ejecutala (*Ejecutar*). Mirá el *Registro de
ejecución*: debe decir `TODOS LOS TESTS OK ✓`. La primera vez te va a pedir
**autorizar permisos** (Sheets + email) — aceptá.

---

## 8) Publicar como Web App

```bash
clasp deploy --description "v1 recibos"
```

Te devuelve un **Deployment ID**. La URL pública es:

```
https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec
```

Los permisos de la web app (ejecutar como vos, acceso anónimo) ya vienen del
`appsscript.json`:

```json
"webapp": { "executeAs": "USER_DEPLOYING", "access": "ANYONE_ANONYMOUS" }
```

- `executeAs: USER_DEPLOYING` → la app corre **con tu cuenta**, así los usuarios
  **no** necesitan permisos sobre las planillas.
- `access: ANYONE_ANONYMOUS` → cualquiera con el enlace entra **sin login**.

> Si querés restringir a tu dominio de Google Workspace, cambiá `access` a
> `DOMAIN` en `appsscript.json`, `clasp push` y volvé a deployar.

---

## 9) Actualizaciones futuras

Cada vez que cambies código:

```bash
clasp push                                  # sube los cambios
clasp deploy --deploymentId <DEPLOYMENT_ID> --description "v2 ..."
```

Reutilizar el mismo `--deploymentId` mantiene **la misma URL**. Si hacés
`clasp deploy` sin ID, crea una implementación nueva (URL nueva).

Para listar tus deployments:

```bash
clasp deployments
```

---

## Comandos de referencia rápida

| Acción | Comando |
|---|---|
| Login | `clasp login` |
| Crear proyecto | `clasp create --type webapp --title "Recibos Surcherie"` |
| Vincular existente | `clasp clone <SCRIPT_ID>` |
| Subir código | `clasp push` |
| Abrir en el navegador | `clasp open` |
| Publicar | `clasp deploy --description "..."` |
| Re-publicar misma URL | `clasp deploy --deploymentId <ID> --description "..."` |
| Ver deployments | `clasp deployments` |

---

## Problemas comunes

- **`User has not enabled the Apps Script API`** → hacé el paso 2.
- **`Push failed` / permisos** → revisá que estés logueado (`clasp login`) con la
  cuenta correcta.
- **La app abre pero no trae datos** → faltan los IDs en `CONFIG`, o los nombres
  de hoja / encabezados no coinciden.
- **No aparece logo/firma** → `LOGO_BASE64`/`FIRMA_BASE64` vacíos o sin el prefijo
  `data:image/...;base64,`.
- **El PDF sale raro con html2pdf** → usá el botón *PDF (modo servidor)* como
  fallback.
