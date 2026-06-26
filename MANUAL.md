# Deploy manual desde el navegador (sin Node, sin clasp, sin API)

Esta es la forma más simple: copiar y pegar en el editor de Apps Script. No hace
falta instalar nada ni habilitar la Apps Script API (eso era solo para `clasp`).

---

## 1) Crear el proyecto

1. Entrá a **https://script.google.com**
2. Botón **"Nuevo proyecto"** (arriba a la izquierda).
3. Ponele nombre arriba a la izquierda (donde dice *Proyecto sin título*):
   **Recibos Surcherie**.

---

## 2) Pegar el código `.gs`

1. En el panel izquierdo ya hay un archivo llamado **`Código.gs`** (o `Code.gs`).
2. Borrá todo su contenido y pegá **todo el contenido de `Codigo.gs`** del repo.
3. Guardá con el ícono del diskette (o `Ctrl/Cmd + S`).

---

## 3) Crear los 3 archivos HTML

Por cada uno: tocá el **`+`** al lado de "Archivos" → **HTML** → escribí el
nombre **exacto** (sin `.html`, el editor lo agrega solo) → pegá el contenido y
guardá.

| Nombre a escribir | Contenido a pegar |
|---|---|
| `Index`   | todo `Index.html`   |
| `Estilos` | todo `Estilos.html` |
| `Scripts` | todo `Scripts.html` |

> Importante: los nombres tienen que ser exactamente `Index`, `Estilos` y
> `Scripts` (con mayúscula inicial), porque el código los llama por ese nombre.

---

## 4) Poner la zona horaria (para que las fechas salgan bien)

1. Ícono de **engranaje** (⚙️ *Configuración del proyecto*) en el panel izquierdo.
2. En **Zona horaria**, elegí **(GMT-03:00) Buenos Aires**.

---

## 5) Completar el CONFIG

En el archivo `Codigo.gs`, arriba de todo, reemplazá los `<<< COMPLETAR >>>`:

- `SHEET_FINANCIERO_ID` y `SHEET_CLIENTES_ID` → el ID de cada planilla.
  Está en la URL de la planilla: `.../spreadsheets/d/`**`ESTE_PEDAZO`**`/edit`.
- Revisá que los nombres de hoja (`financiero`, `clientes`) y los encabezados en
  `COLS_FINANCIERO` / `COLS_CLIENTES` coincidan con tus planillas reales.

> El **logo ya viene cargado** en `LOGO_BASE64`. La **firma** no es una imagen
> fija: en el formulario hay un campo **"Firmado por / Aclaración"** que se
> completa en cada recibo (porque no siempre firma la misma persona). Si más
> adelante querés una imagen de firma, se pega su data URI en `FIRMA_BASE64`.

Guardá.

---

## 6) Probar el número en letras (opcional pero recomendado)

1. Arriba, en el selector de función, elegí **`recibo_testNumeroALetras`**.
2. Tocá **Ejecutar** (▶).
3. La **primera vez** te pide autorización: *Revisar permisos* → elegí tu cuenta
   → *Configuración avanzada* → *Ir a Recibos Surcherie (no seguro)* → *Permitir*.
   (Esto es normal: le das permiso al script para usar tus Sheets y tu email.
   No tiene nada que ver con la "API de Apps Script" de la otra guía.)
4. Mirá el *Registro de ejecución* abajo: debe decir `TODOS LOS TESTS OK ✓`.

---

## 7) Publicar como aplicación web

1. Botón azul **Implementar** (arriba a la derecha) → **Nueva implementación**.
2. En el ícono de engranaje ⚙️ elegí el tipo **Aplicación web**.
3. Completá:
   - **Descripción:** `v1 recibos` (lo que quieras).
   - **Ejecutar como:** **Yo (tu email)**  ← clave: así los usuarios no
     necesitan permiso sobre las planillas.
   - **Quién tiene acceso:** **Cualquier usuario**  ← entran sin login.
     (Si querés limitar a tu empresa: *Cualquier usuario de tu dominio*.)
4. **Implementar**. Si pide autorización otra vez, aceptá igual que en el paso 6.
5. Copiá la **URL de la aplicación web** (`.../exec`). Esa es tu app: la
   compartís y listo.

---

## 8) Actualizar después de un cambio

Cuando edites código:

1. Guardá los cambios.
2. **Implementar → Administrar implementaciones**.
3. En tu implementación, tocá el **lápiz** (editar) → en *Versión* elegí
   **Nueva versión** → **Implementar**.

Esto **mantiene la misma URL**. (Si en cambio hacés *Nueva implementación*, te da
una URL nueva.)

---

## Problemas comunes

- **Abre pero no trae datos** → faltan los IDs en `CONFIG`, o no coinciden los
  nombres de hoja / encabezados.
- **No aparece logo/firma** → `LOGO_BASE64`/`FIRMA_BASE64` vacíos o sin el prefijo
  `data:image/...;base64,`.
- **El PDF sale raro** con el botón principal → usá **PDF (modo servidor)**.
- **Pantalla de "app no verificada"** al autorizar → es porque la app es tuya y
  no está verificada por Google; *Configuración avanzada → Ir a… (no seguro)* es
  el camino normal para tus propios scripts.
