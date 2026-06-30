# Generador de Recibos de Cobranza — Surcherie

Módulo de **Google Apps Script** (Web App) para emitir recibos de cobranza de
**Surcherie Implantes Quirúrgicos**. El usuario busca un N° de factura, la app
trae los datos desde Google Sheets, permite editar todo, calcula descuentos y
total en vivo, muestra el total en letras y genera un **PDF descargable** con
logo y firma. Cada recibo emitido queda registrado (correlativo + auditoría).

Está pensado para **enchufarse a un proyecto de Apps Script existente** sin
romper nada: todo namespaceado con el prefijo `recibo_`, la configuración en un
único objeto `CONFIG`, y sin globals que colisionen.

## Archivos

| Archivo         | Rol                                                            |
|-----------------|----------------------------------------------------------------|
| `Codigo.gs`     | Backend: CONFIG, acceso a Sheets, API, registro, `numeroALetras`, PDF server-side. |
| `Index.html`    | UI principal (formulario editable + vista previa del recibo).  |
| `Estilos.html`  | Estilos (incluido con `include('Estilos')`).                   |
| `Scripts.html`  | Lógica del cliente (incluido con `include('Scripts')`).        |

> En Apps Script, los archivos `.html` se crean desde el editor como
> **Archivo → HTML** con el nombre `Index`, `Estilos` y `Scripts` (sin la
> extensión `.html`, que el editor agrega solo).

---

## 1) Completar `CONFIG` (en `Codigo.gs`)

Buscá los valores marcados con `<<< COMPLETAR >>>` y reemplazalos:

- **`SHEET_FINANCIERO_ID`** / **`SHEET_CLIENTES_ID`**: el ID de cada planilla.
  Está en la URL: `https://docs.google.com/spreadsheets/d/`**`<ESTE_ID>`**`/edit`.
- **`SHEET_FINANCIERO_NOMBRE`** / **`SHEET_CLIENTES_NOMBRE`**: el nombre de la
  pestaña (hoja) dentro de cada planilla.
- **`COLS_FINANCIERO`** / **`COLS_CLIENTES`**: el **texto exacto** de los
  encabezados (primera fila) de cada hoja. El mapeo es **por nombre**, no por
  posición, y es tolerante a mayúsculas/acentos. Si un encabezado no matchea,
  ese campo queda vacío (no rompe).
- **`LOGO_BASE64`** / **`FIRMA_BASE64`**: un *data URI* completo, por ejemplo
  `data:image/png;base64,iVBORw0KGgo...`. Para obtenerlo, convertí el PNG a
  base64 (cualquier conversor "image to data URI"). Si los dejás sin completar,
  el recibo igual se genera, pero sin logo/firma.
- **`HOJA_LOG_RECIBOS`**: nombre de la hoja donde se registra cada recibo. Vive
  **dentro de la planilla financiero** y se crea automáticamente la primera vez
  con los encabezados: `N° Recibo · Fecha emisión · N° Factura · Cliente ·
  Importe · Descuento · Total · Usuario`.
- **`EMPRESA`**: datos fijos del encabezado del recibo. Editá `razonSocial`
  cuando se pase a sociedad unipersonal (Hugo Salami).

### Verificar el número en letras

En el editor de Apps Script, ejecutá la función **`recibo_testNumeroALetras`**
(menú *Ejecutar*) y mirá el *Registro de ejecución*. Debe pasar el caso
obligatorio:

```
numeroALetras(4582830)
  => "Cuatro millones quinientos ochenta y dos mil ochocientos treinta pesos"
```

---

## 2) Desplegar la Web App (permisos)

1. En el editor: **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web**.
3. **Ejecutar como:** *Yo* (el propietario). Así los usuarios **no** necesitan
   permisos sobre las planillas: la app lee/escribe con tu cuenta.
4. **Quién tiene acceso:** *Cualquier usuario con el enlace* (o *Cualquier
   usuario dentro de `<tu dominio>`* si querés restringir). Sin login.
5. **Implementar** y autorizar los permisos que pide (Sheets + ejecución).
6. Compartí la URL `/exec` resultante. Cualquiera con el enlace escribe el N°
   de factura y descarga el recibo.

> Nota sobre el usuario en la auditoría: con acceso "cualquiera con el enlace",
> `Session.getActiveUser().getEmail()` puede venir vacío para usuarios fuera de
> tu dominio. Si necesitás identificar siempre al emisor, restringí el acceso a
> tu dominio de Google Workspace.

---

## 3) Flujo de uso

1. **Buscar factura**: escribí el N° (Enter o botón *Buscar*) o elegí del
   desplegable.
2. **Autocompletado**: Paciente, Obra Social, Importe, Fecha, IG, IIBB, Neto.
   Con la Obra Social se cruza la tabla `clientes` para traer Dirección,
   Localidad, CUIT e IVA. Si la obra social no está, avisa y se cargan a mano.
3. **Retenciones**: IG e IIBB vienen de `financiero` (editables). **Sellos** y
   **Otros** son siempre manuales (vacías por defecto).
4. **Cálculos en vivo** (recalculan ante cualquier edición):
   - `Descuento = IG + IIBB + Sellos + Otros`
   - `Total a cobrar = Importe − Descuento`
   - Si el Total no coincide con el `Neto` de `financiero`, muestra un aviso
     (no bloquea).
   - **Son:** el total en letras (pesos; centavos como `con NN/100`).
5. **Forma de pago**: una o varias filas (Fecha · Forma de pago · Banco ·
   Importe). Se agregan/quitan filas.
6. **Generar y descargar PDF** (logo + firma). Al generar, se registra el
   recibo con N° correlativo.

Montos siempre en formato argentino: `$4.582.830,00` (punto miles, coma
decimales).

### PDF: opción principal y fallback

- **Principal:** `html2pdf.js` (CDN) exporta el `div` del recibo a PDF A4 en el
  navegador. Mejor fidelidad. Archivo: `Recibo_<NroFactura>_<Cliente>.pdf`.
- **Fallback (modo servidor):** botón *PDF (modo servidor)*. Arma el HTML en el
  cliente y lo convierte con `Utilities.newBlob(...).getAs('application/pdf')`
  en el backend (`recibo_generarPdfServidor`). Útil si el CDN está bloqueado.

---

## 4) Integrar al proyecto de Apps Script principal

Todo el código del módulo está namespaceado (`recibo_*`) salvo los puntos de
entrada estándar. Para mergearlo:

1. **`doGet` / router:** si tu proyecto ya tiene un `doGet(e)`, **no** copies el
   de este módulo. Llamá a **`recibo_render_()`** desde tu router cuando
   corresponda, por ejemplo:

   ```javascript
   function doGet(e) {
     if (e && e.parameter.page === 'recibos') return recibo_render_();
     // ...tu ruteo existente...
   }
   ```

2. **`include(filename)`:** si ya existe en tu proyecto, **borrá** la copia de
   este módulo (es el patrón estándar de HtmlService).

3. **HTML:** copiá `Index.html`, `Estilos.html` y `Scripts.html`. Si ya tenés un
   `Index.html`, renombrá el de este módulo (p. ej. `RecibosIndex`) y cambiá la
   referencia dentro de `recibo_render_()`
   (`createTemplateFromFile("RecibosIndex")`).

4. **CONFIG:** mantené el objeto `CONFIG` de este módulo. Si tu proyecto ya
   define una constante `CONFIG`, renombrá la de recibos (p. ej.
   `RECIBOS_CONFIG`) y actualizá las referencias en `Codigo.gs`.

5. **Hoja de log:** `HOJA_LOG_RECIBOS` se crea sola en la planilla financiero la
   primera vez que se emite un recibo.

---

## 5) Abrir con una factura precargada (deep link)

El módulo acepta el parámetro de URL **`?factura=<nro>`**. Si se abre así, busca
ese número solo al cargar y deja el recibo listo para revisar/generar:

```
https://script.google.com/macros/s/<SCRIPT_ID>/exec?factura=2934
```

`recibo_render_(e)` lee `e.parameter.factura`, lo inyecta en la plantilla
(`#rbFacturaInicial`) y `rbBuscarFacturaInicial()` dispara la búsqueda. Sin el
parámetro, el flujo manual no cambia. Esto es lo que usa el **sistema de
gestión** (botón "Generar recibo" en la lista de facturas) para enlazar cada
factura con su recibo.

---

## Notas técnicas

- **Mapeo por nombre de columna** (`recibo_indiceColumna_`), tolerante a
  mayúsculas y acentos. Encabezado que no matchea → campo vacío.
- **Correlativo seguro**: `recibo_registrar` usa `LockService` para evitar N°
  duplicados ante emisiones simultáneas.
- **`numeroALetras`** vive en `Codigo.gs` (con `recibo_testNumeroALetras`) y
  tiene un port en `Scripts.html` (`rbNumeroALetras`) para el cálculo en vivo
  del "Son:". Si tocás uno, sincronizá el otro.
