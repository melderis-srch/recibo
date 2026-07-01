/**
 * ============================================================================
 *  Surcherie Implantes Quirúrgicos — Módulo Generador de Recibos de Cobranza
 * ============================================================================
 *
 *  Web App de Google Apps Script (backend .gs + frontend HtmlService).
 *
 *  Diseñado para integrarse a un proyecto de Apps Script existente SIN romper
 *  nada: todo el código está namespaceado con el prefijo `recibo_` (o expuesto
 *  como funciones puntuales como `numeroALetras` / `doGet` / `include`), las
 *  constantes viven en el objeto CONFIG de abajo, y no se declaran globals que
 *  puedan colisionar.
 *
 *  --------------------------------------------------------------------------
 *  CÓMO INTEGRARLO AL PROYECTO PRINCIPAL (leer antes de mergear)
 *  --------------------------------------------------------------------------
 *  1) Si tu proyecto YA tiene un `doGet(e)` (router), NO copies el `doGet` de
 *     este archivo. En su lugar, agregá una rama a tu router que devuelva
 *     `recibo_render_()` cuando corresponda (por ej. `?page=recibos`). Ver la
 *     función `recibo_render_()` más abajo.
 *  2) Si tu proyecto YA tiene una función `include(filename)`, borrá la de acá
 *     (es idéntica al patrón estándar de HtmlService).
 *  3) Copiá los archivos `Index.html`, `Estilos.html` y `Scripts.html` al
 *     proyecto. Si ya existe un `Index.html`, renombrá estos (p. ej.
 *     `RecibosIndex.html`) y actualizá las llamadas a `include()` / al template.
 *  4) Completá los valores marcados con `<<< COMPLETAR >>>` en CONFIG.
 *  5) Desplegá como Web App (ver README.md).
 * ============================================================================
 */

/* =========================================================================
 *  CONFIG  — Toda la configuración del módulo en un solo lugar.
 *  Nada hardcodeado en el medio del código: si algo cambia, se cambia acá.
 * ========================================================================= */
const CONFIG = {
  // Empresa (queda fijo en el encabezado del recibo). Se deja editable acá
  // porque la razón social va a cambiar a sociedad unipersonal (Hugo Salami).
  EMPRESA: {
    razonSocial: "Surcherie Implantes Quirúrgicos",
    subtitulo: "de Cobelli Gustavo y Salami Hugo SH.", // línea debajo del logo
    direccion: "San Martín 4041 – 3000 Santa Fe",
    tel: "(0342) 456 3173",
    email: "administracion@surcherie.com.ar",
    condicionIVA: "IVA Responsable Inscripto",
    cuit: "30-70932838-3",
    iibb: "Conv. Multi. 921-554855-1",
    derRegInsp: "89863",
    inicioActividades: "01/09/2025"
  },

  SHEET_FINANCIERO_ID: "1Qy7ylSFMy8-zOCMuGS7B6JUQ8K2BisuDX1WFB5bO-9E",
  SHEET_FINANCIERO_NOMBRE: "Ventas/Cobros",
  // Los datos de clientes están en la planilla de recibos, hoja "clientes".
  SHEET_CLIENTES_ID: "1sl866gwCKjx7H5GhP9p6_p_zqJc30uLNLuaGeXR2wiw",
  SHEET_CLIENTES_NOMBRE: "clientes",

  // Encabezados esperados en la hoja financiero (ajustar al texto real de la
  // primera fila de la hoja). El mapeo es POR NOMBRE, no por posición.
  COLS_FINANCIERO: {
    paciente: "Paciente",
    obraSocial: "Obra social",   // se usa para cruzar con la tabla de clientes
    nroFactura: "N° Factura",
    importe: "Monto facturado",
    fecha: "Fecha factura",
    retIG: "Retención de ganancias",
    retIIBB: "Retención de IIBB",
    retSellos: "Retención Sellados",
    retSuss: "RetSuss",
    neto: "Monto Cobrado"        // total efectivamente cobrado; se usa para validar
  },

  // Encabezados esperados en la hoja clientes:
  COLS_CLIENTES: {
    cliente: "Cliente",
    direccion: "Dirección",
    localidad: "Localidad",
    cuit: "CUIT",
    iva: "IVA",
    email: "Email"   // columna nueva en la hoja clientes para enviar el recibo
  },

  // Envío del recibo por email (MailApp, desde la cuenta que despliega la app).
  EMAIL: {
    enviarCopiaA: "administracion@surcherie.com.ar", // copia interna (CC); "" para no enviar
    replyTo: "administracion@surcherie.com.ar",      // a dónde responde el cliente; "" para omitir
    remitenteNombre: "Surcherie Implantes Quirúrgicos",
    asuntoPrefijo: "Recibo de cobranza"
  },

  // Logo/firma: podés cargarlos de DOS formas.
  //  (a) Pegando el data URI base64 completo en LOGO_BASE64 / FIRMA_BASE64, o
  //  (b) — RECOMENDADO — subiendo la imagen a Google Drive y poniendo acá SU ID
  //      (string corto y robusto). La app la lee de Drive y la embebe sola.
  //      El ID está en la URL del archivo en Drive:
  //      https://drive.google.com/file/d/ESTE_ID/view
  //      La imagen debe ser accesible por la cuenta que despliega la app.
  LOGO_BASE64: "",
  LOGO_DRIVE_ID: "",   // ej.: "1AbC...". Si está seteado y LOGO_BASE64 vacío, se usa Drive.
  FIRMA_BASE64: "",    // firma por defecto (opcional); normalmente se usa FIRMAS de abajo
  FIRMA_DRIVE_ID: "",

  // Firmas seleccionables según quién firma el recibo. En la UI aparece un
  // desplegable "Firmar como" y la imagen elegida se muestra en el documento.
  // Cargá el ID de Drive de cada firma como Propiedad del Script llamada
  // FIRMA_<ID>_DRIVE_ID (ej.: FIRMA_GUSTAVO_DRIVE_ID, FIRMA_HUGO_DRIVE_ID),
  // o poné el driveId directamente acá.
  FIRMAS: [
    { id: "gustavo", nombre: "Gustavo Cobelli", driveId: "", base64: "" },
    { id: "hugo",    nombre: "Hugo Salami",     driveId: "", base64: "" }
  ],

  HOJA_LOG_RECIBOS: "recibos", // hoja (dentro de la planilla financiero) donde se registra cada recibo emitido

  // Numeración del recibo. Se muestra como PUNTO_VENTA-XXXXXXXX (8 dígitos).
  // Ej.: 3041 -> "0001-00003041".
  RECIBO_PUNTO_VENTA: "0001",
  // Último N° emitido ANTES de usar este sistema. El próximo será este + 1
  // (acá: 3040 -> el primer recibo de la app será 3041).
  ULTIMO_NUMERO_PREVIO: 3040
};


/* =========================================================================
 *  WEB APP — punto de entrada e includes de HtmlService
 * ========================================================================= */

/**
 * Punto de entrada de la Web App.
 * Si tu proyecto ya tiene un doGet(), borrá este y usá recibo_render_() desde
 * tu router existente.
 */
function doGet(e) {
  return recibo_render_(e);
}

/**
 * Devuelve el HtmlOutput del módulo de recibos.
 * Útil para enchufarlo a un router existente:
 *   if (e.parameter.page === 'recibos') return recibo_render_(e);
 *
 * Soporta abrir la app con la factura precargada desde otra app:
 *   .../exec?factura=0001-00001234  -> autobusca esa factura al cargar.
 */
function recibo_render_(e) {
  var t = HtmlService.createTemplateFromFile("Index");
  // El logo y la firma se imprimen directo en el HTML desde el servidor
  // (más confiable que inyectarlos por JS con un data URI largo).
  t.logoData = recibo_imagenDataUri_(
    CONFIG.LOGO_BASE64 || recibo_prop_("LOGO_BASE64"),
    CONFIG.LOGO_DRIVE_ID || recibo_prop_("LOGO_DRIVE_ID"), "logo");
  t.firmaData = recibo_imagenDataUri_(
    CONFIG.FIRMA_BASE64 || recibo_prop_("FIRMA_BASE64"),
    CONFIG.FIRMA_DRIVE_ID || recibo_prop_("FIRMA_DRIVE_ID"), "firma");
  // N° de factura recibido por URL (lo pasa la app principal). Vacío si no viene.
  t.facturaParam = (e && e.parameter && e.parameter.factura) ? String(e.parameter.factura) : "";
  return t.evaluate()
    .setTitle("Recibos de Cobranza – Surcherie")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Próximo N° de recibo formateado, sin escribir nada. Para mostrarlo como
 * vista previa en la UI (el número definitivo se asigna al generar).
 */
function recibo_numeroPreview() {
  try {
    return recibo_formatearNumero_(recibo_proximoNumero_());
  } catch (e) {
    return "";
  }
}

/**
 * DIAGNÓSTICO del logo. Ejecutar manualmente desde el editor de Apps Script
 * (seleccionar recibo_diagnosticoLogo → Ejecutar) y leer el Registro de
 * ejecución. Dice si el ID llega, si el archivo se puede leer y si el data URI
 * se arma. Sirve para aislar por qué no aparece el logo.
 */
function recibo_diagnosticoLogo() {
  var idConfig = CONFIG.LOGO_DRIVE_ID || "";
  var idProp = recibo_prop_("LOGO_DRIVE_ID");
  Logger.log("CONFIG.LOGO_DRIVE_ID: '" + idConfig + "'");
  Logger.log("Propiedad del Script LOGO_DRIVE_ID: '" + idProp + "'");

  var claves = [];
  try { claves = Object.keys(PropertiesService.getScriptProperties().getProperties()); } catch (e) {}
  Logger.log("Nombres de todas las Propiedades del Script: " + JSON.stringify(claves));

  var id = idConfig || idProp;
  if (!id) {
    Logger.log(">> NO hay ID. La propiedad debe llamarse EXACTAMENTE 'LOGO_DRIVE_ID' " +
      "y el valor ser solo el ID (no la URL). Revisá el nombre en la lista de arriba.");
    return;
  }
  if (id.indexOf("/") > -1 || id.indexOf("http") === 0) {
    Logger.log(">> El valor parece una URL, no un ID. Usá solo el ID: " +
      "https://drive.google.com/file/d/ESTE_ID/view");
  }
  try {
    var file = DriveApp.getFileById(id);
    Logger.log("Archivo en Drive: '" + file.getName() + "'");
    var blob = file.getBlob();
    Logger.log("ContentType: " + blob.getContentType() + " | bytes: " + blob.getBytes().length);
    var uri = recibo_imagenDataUri_("", id, "logo_diag");
    Logger.log("data URI length: " + uri.length);
    Logger.log(uri.length > 0 ? ">> OK: el logo se puede cargar. Si no aparece, es la DEPLOYMENT/versión." :
      ">> El data URI salió vacío.");
  } catch (err) {
    Logger.log(">> ERROR leyendo el archivo de Drive: " + err.message);
    Logger.log(">> Causas típicas: ID incorrecto, falta RE-AUTORIZAR el permiso de Drive, " +
      "o la cuenta que ejecuta no tiene acceso al archivo (compartilo o subilo con esa cuenta).");
  }
}

/**
 * Lee una Propiedad del Script (Project Settings → Script Properties).
 * Sirve como "variable de entorno": permite configurar valores sin tocar el
 * código. Devuelve "" si no existe o no hay acceso.
 */
function recibo_prop_(key) {
  try {
    return PropertiesService.getScriptProperties().getProperty(key) || "";
  } catch (e) {
    return "";
  }
}

/**
 * Devuelve un data URI de imagen listo para usar en <img src>.
 * Prioridad: (1) el base64 provisto si es un data URI válido; (2) el archivo de
 * Drive por ID (lo lee, lo convierte y lo cachea). "" si no hay nada usable.
 *
 * @param {string} base64  Data URI completo o "".
 * @param {string} driveId ID del archivo en Drive o "".
 * @param {string} clave   Clave corta para el caché (ej. "logo", "firma").
 * @return {string}
 */
function recibo_imagenDataUri_(base64, driveId, clave) {
  if (base64 && base64.indexOf("data:") === 0) return base64;
  if (!driveId) return "";
  try {
    var cache = CacheService.getScriptCache();
    var ckey = "img_" + clave + "_" + driveId;
    var cached = cache.get(ckey);
    if (cached) return cached;

    var blob = DriveApp.getFileById(driveId).getBlob();
    var tipo = blob.getContentType() || "image/png";
    var uri = "data:" + tipo + ";base64," + Utilities.base64Encode(blob.getBytes());

    // CacheService admite hasta 100 KB por valor; cacheamos solo si entra.
    if (uri.length < 100000) cache.put(ckey, uri, 21600); // 6 horas
    return uri;
  } catch (err) {
    return ""; // si el ID es inválido o no hay acceso, mostramos el placeholder
  }
}

/**
 * Devuelve las firmas configuradas, cada una con su imagen ya resuelta como
 * data URI (desde base64, driveId en CONFIG, o la Propiedad del Script
 * FIRMA_<ID>_DRIVE_ID). El front arma el desplegable "Firmar como".
 *
 * @return {Array<{id:string, nombre:string, dataUri:string}>}
 */
function recibo_obtenerFirmas() {
  var firmas = CONFIG.FIRMAS || [];
  return firmas.map(function (f) {
    var propKey = "FIRMA_" + String(f.id).toUpperCase() + "_DRIVE_ID";
    var driveId = f.driveId || recibo_prop_(propKey);
    var uri = recibo_imagenDataUri_(f.base64 || "", driveId, "firma_" + f.id);
    return { id: f.id, nombre: f.nombre, dataUri: uri };
  });
}

/**
 * Helper estándar de HtmlService para incluir archivos .html parciales.
 * Si tu proyecto ya define include(), eliminá esta copia.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Config que el front necesita conocer (datos fijos de empresa + assets).
 * No exponemos los IDs de las planillas al cliente.
 */
function recibo_obtenerConfigCliente() {
  return {
    empresa: CONFIG.EMPRESA,
    logo: CONFIG.LOGO_BASE64,
    firma: CONFIG.FIRMA_BASE64
  };
}


/* =========================================================================
 *  ACCESO A DATOS — lectura de hojas con mapeo de columnas POR NOMBRE
 * ========================================================================= */

/**
 * Normaliza texto para comparaciones robustas: trim, minúsculas y sin acentos.
 */
function recibo_normalizar_(s) {
  return String(s == null ? "" : s)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Lee una hoja completa y devuelve { headers: [...], rows: [[...], ...] }.
 */
function recibo_leerHoja_(sheetId, sheetName) {
  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error("No se encontró la hoja '" + sheetName + "' en la planilla configurada.");
  }
  var values = sheet.getDataRange().getValues();
  if (values.length < 1) return { headers: [], rows: [] };
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var rows = values.slice(1);
  return { headers: headers, rows: rows };
}

/**
 * Índice de columna a partir del nombre del encabezado (comparación normalizada).
 * Devuelve -1 si no matchea ningún header.
 */
function recibo_indiceColumna_(headers, nombre) {
  if (!nombre) return -1;
  var objetivo = recibo_normalizar_(nombre);
  for (var i = 0; i < headers.length; i++) {
    if (recibo_normalizar_(headers[i]) === objetivo) return i;
  }
  return -1;
}

/** Valor de celda como string (vacío si la columna no existe). */
function recibo_celda_(fila, headers, nombreCol) {
  var idx = recibo_indiceColumna_(headers, nombreCol);
  if (idx === -1) return "";
  var v = fila[idx];
  return (v === null || v === undefined) ? "" : String(v).trim();
}

/** Valor de celda crudo (mantiene tipo Date/Number; "" si no existe). */
function recibo_celdaRaw_(fila, headers, nombreCol) {
  var idx = recibo_indiceColumna_(headers, nombreCol);
  if (idx === -1) return "";
  return fila[idx];
}

/**
 * Convierte un valor (number, "1.234,56", "$ 1.234,56", etc.) a Number.
 * Soporta formato argentino (punto miles, coma decimal) y formato plano.
 */
function recibo_aNumero_(v) {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  var s = String(v).trim().replace(/[^0-9,.\-]/g, "");
  if (s === "" || s === "-") return 0;
  var tieneComa = s.indexOf(",") > -1;
  var tienePunto = s.indexOf(".") > -1;
  if (tieneComa && tienePunto) {
    // Formato argentino: el punto es separador de miles, la coma decimal.
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (tieneComa) {
    // Solo coma → decimal.
    s = s.replace(",", ".");
  }
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/** Formatea una fecha (Date o string) a dd/MM/yyyy. */
function recibo_formatearFecha_(v) {
  if (v === null || v === undefined || v === "") return "";
  if (Object.prototype.toString.call(v) === "[object Date]") {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), "dd/MM/yyyy");
  }
  return String(v).trim();
}


/* =========================================================================
 *  API expuesta al front (google.script.run)
 * ========================================================================= */

/**
 * Devuelve la lista de facturas disponibles en la hoja financiero, para
 * poblar el desplegable opcional del front.
 * @return {Array<{nroFactura:string, paciente:string}>}
 */
function recibo_listarFacturas() {
  var fin = recibo_leerHoja_(CONFIG.SHEET_FINANCIERO_ID, CONFIG.SHEET_FINANCIERO_NOMBRE);
  var c = CONFIG.COLS_FINANCIERO;
  var idxFactura = recibo_indiceColumna_(fin.headers, c.nroFactura);
  var idxPaciente = recibo_indiceColumna_(fin.headers, c.paciente);
  var lista = [];
  if (idxFactura === -1) return lista;
  for (var i = 0; i < fin.rows.length; i++) {
    var nro = fin.rows[i][idxFactura];
    if (nro === null || nro === undefined || String(nro).trim() === "") continue;
    lista.push({
      nroFactura: String(nro).trim(),
      paciente: idxPaciente > -1 ? String(fin.rows[i][idxPaciente]).trim() : ""
    });
  }
  return lista;
}

/**
 * Busca una factura en la hoja financiero y cruza la obra social con clientes.
 * Nunca lanza por "no encontrada": devuelve { encontrada:false, mensaje }.
 *
 * @param {string} nroFactura
 * @return {Object}
 */
function recibo_buscarFactura(nroFactura) {
  if (nroFactura === null || nroFactura === undefined || String(nroFactura).trim() === "") {
    return { encontrada: false, mensaje: "Ingresá un número de factura." };
  }

  var fin = recibo_leerHoja_(CONFIG.SHEET_FINANCIERO_ID, CONFIG.SHEET_FINANCIERO_NOMBRE);
  var c = CONFIG.COLS_FINANCIERO;
  var idxFactura = recibo_indiceColumna_(fin.headers, c.nroFactura);
  if (idxFactura === -1) {
    throw new Error("No se encontró la columna de N° de Factura ('" + c.nroFactura +
      "') en la hoja financiero. Revisá CONFIG.COLS_FINANCIERO.");
  }

  var objetivo = recibo_normalizar_(nroFactura);
  var fila = null;
  for (var i = 0; i < fin.rows.length; i++) {
    if (recibo_normalizar_(fin.rows[i][idxFactura]) === objetivo) {
      fila = fin.rows[i];
      break;
    }
  }
  if (!fila) {
    return {
      encontrada: false,
      mensaje: "No se encontró la factura N° " + nroFactura + " en la hoja financiero."
    };
  }

  var financiero = {
    paciente: recibo_celda_(fila, fin.headers, c.paciente),
    obraSocial: recibo_celda_(fila, fin.headers, c.obraSocial),
    nroFactura: recibo_celda_(fila, fin.headers, c.nroFactura) || String(nroFactura).trim(),
    importe: recibo_aNumero_(recibo_celda_(fila, fin.headers, c.importe)),
    fecha: recibo_formatearFecha_(recibo_celdaRaw_(fila, fin.headers, c.fecha)),
    retIG: recibo_aNumero_(recibo_celda_(fila, fin.headers, c.retIG)),
    retIIBB: recibo_aNumero_(recibo_celda_(fila, fin.headers, c.retIIBB)),
    retSellos: recibo_aNumero_(recibo_celda_(fila, fin.headers, c.retSellos)),
    retSuss: recibo_aNumero_(recibo_celda_(fila, fin.headers, c.retSuss)),
    neto: recibo_aNumero_(recibo_celda_(fila, fin.headers, c.neto))
  };

  // Cruce con la tabla de clientes usando el nombre de la obra social.
  var clienteInfo = recibo_buscarCliente_(financiero.obraSocial);

  return {
    encontrada: true,
    financiero: financiero,
    clienteEncontrado: clienteInfo.encontrado,
    cliente: clienteInfo.encontrado ? clienteInfo.datos : null,
    mensajeCliente: clienteInfo.encontrado
      ? ""
      : "La obra social «" + financiero.obraSocial + "» no está en la tabla de clientes. " +
        "Completá Dirección, Localidad, CUIT e IVA manualmente."
  };
}

/**
 * Busca un cliente (obra social) por nombre en la hoja clientes.
 * @return {{encontrado:boolean, datos:Object|null}}
 */
function recibo_buscarCliente_(nombreObraSocial) {
  if (!nombreObraSocial) return { encontrado: false, datos: null };
  var cli = recibo_leerHoja_(CONFIG.SHEET_CLIENTES_ID, CONFIG.SHEET_CLIENTES_NOMBRE);
  var c = CONFIG.COLS_CLIENTES;
  var idxCliente = recibo_indiceColumna_(cli.headers, c.cliente);
  if (idxCliente === -1) return { encontrado: false, datos: null };

  var objetivo = recibo_normalizar_(nombreObraSocial);
  for (var i = 0; i < cli.rows.length; i++) {
    if (recibo_normalizar_(cli.rows[i][idxCliente]) === objetivo) {
      var fila = cli.rows[i];
      return {
        encontrado: true,
        datos: {
          cliente: recibo_celda_(fila, cli.headers, c.cliente),
          direccion: recibo_celda_(fila, cli.headers, c.direccion),
          localidad: recibo_celda_(fila, cli.headers, c.localidad),
          cuit: recibo_celda_(fila, cli.headers, c.cuit),
          iva: recibo_celda_(fila, cli.headers, c.iva),
          email: recibo_celda_(fila, cli.headers, c.email)
        }
      };
    }
  }
  return { encontrado: false, datos: null };
}


/* =========================================================================
 *  TRAZABILIDAD — registro correlativo de recibos
 * ========================================================================= */

/** Obtiene (creándola si hace falta) la hoja de log de recibos. */
function recibo_obtenerHojaLog_() {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_FINANCIERO_ID);
  var sheet = ss.getSheetByName(CONFIG.HOJA_LOG_RECIBOS);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.HOJA_LOG_RECIBOS);
    sheet.appendRow([
      "N° Recibo", "Fecha emisión", "N° Factura", "Cliente",
      "Importe", "Descuento", "Total", "Usuario"
    ]);
    sheet.getRange(1, 1, 1, 8).setFontWeight("bold");
  }
  return sheet;
}

/**
 * Extrae el número correlativo de un valor de la columna "N° Recibo".
 * Soporta tanto enteros (3041) como el formato "0001-00003041".
 */
function recibo_parseNumeroRecibo_(v) {
  if (typeof v === "number") return Math.floor(v);
  var s = String(v == null ? "" : v);
  var partes = s.split("-");
  var ultimo = partes[partes.length - 1].replace(/[^0-9]/g, "");
  var n = parseInt(ultimo, 10);
  return isNaN(n) ? 0 : n;
}

/**
 * Formatea el correlativo como PUNTO_VENTA-XXXXXXXX (8 dígitos).
 * Ej.: 3041 -> "0001-00003041".
 */
function recibo_formatearNumero_(n) {
  var num = String(n).replace(/[^0-9]/g, "");
  while (num.length < 8) num = "0" + num;
  return CONFIG.RECIBO_PUNTO_VENTA + "-" + num;
}

/**
 * Calcula el próximo N° de recibo (correlativo): el mayor entre el último
 * registrado y CONFIG.ULTIMO_NUMERO_PREVIO, más 1.
 */
function recibo_proximoNumero_() {
  var sheet = recibo_obtenerHojaLog_();
  var last = sheet.getLastRow();
  var max = Number(CONFIG.ULTIMO_NUMERO_PREVIO) || 0;
  if (last >= 2) {
    var valores = sheet.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < valores.length; i++) {
      var n = recibo_parseNumeroRecibo_(valores[i][0]);
      if (n > max) max = n;
    }
  }
  return max + 1;
}

/**
 * Registra un recibo emitido y devuelve el N° correlativo asignado.
 * Usa LockService para evitar números duplicados en emisiones simultáneas.
 *
 * @param {{nroFactura:string, cliente:string, importe:number,
 *          descuento:number, total:number}} datos
 * @return {{nroRecibo:number, usuario:string, fechaEmision:string}}
 */
function recibo_registrar(datos) {
  datos = datos || {};
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = recibo_obtenerHojaLog_();
    var nro = recibo_proximoNumero_();
    var nroFormateado = recibo_formatearNumero_(nro);
    var usuario = "";
    try { usuario = Session.getActiveUser().getEmail() || ""; } catch (e) { usuario = ""; }
    var fechaEmision = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");

    sheet.appendRow([
      nroFormateado,
      fechaEmision,
      datos.nroFactura || "",
      datos.cliente || "",
      Number(datos.importe) || 0,
      Number(datos.descuento) || 0,
      Number(datos.total) || 0,
      usuario
    ]);

    return { nroRecibo: nro, nroFormateado: nroFormateado, usuario: usuario, fechaEmision: fechaEmision };
  } finally {
    lock.releaseLock();
  }
}


/* =========================================================================
 *  PDF — fallback server-side
 *  (La opción principal es html2pdf.js en el cliente; ver Scripts.html.)
 * ========================================================================= */

/**
 * Convierte el HTML de un recibo a PDF en el servidor y devuelve el contenido
 * en base64 para que el cliente lo descargue. Fallback de html2pdf.js.
 *
 * @param {string} html  HTML completo del recibo (con estilos inline).
 * @param {string} nombreArchivo  Nombre sin extensión.
 * @return {{base64:string, nombre:string, tipo:string}}
 */
function recibo_generarPdfServidor(html, nombreArchivo) {
  nombreArchivo = (nombreArchivo || "Recibo").replace(/[\\/:*?"<>|]/g, "_");
  var blob = Utilities.newBlob(html, "text/html", nombreArchivo + ".html")
    .getAs("application/pdf");
  blob.setName(nombreArchivo + ".pdf");
  return {
    base64: Utilities.base64Encode(blob.getBytes()),
    nombre: blob.getName(),
    tipo: "application/pdf"
  };
}


/* =========================================================================
 *  EMAIL — envío del recibo al cliente con el PDF adjunto y plantilla HTML
 * ========================================================================= */

/**
 * Envía el recibo por email al cliente, con el PDF adjunto.
 *
 * @param {{html:string, nombreArchivo:string, destino:string, nroRecibo:string,
 *          nroFactura:string, cliente:string, total:string}} params
 * @return {{ok:boolean, destino:string}}
 */
function recibo_enviarPorEmail(params) {
  params = params || {};
  var destino = String(params.destino || "").trim();
  if (!destino || destino.indexOf("@") === -1) {
    throw new Error("Email de destino inválido o vacío.");
  }

  // PDF a partir del HTML del recibo.
  var nombre = String(params.nombreArchivo || "Recibo").replace(/[\\/:*?"<>|]/g, "_");
  var blob = Utilities.newBlob(params.html || "", "text/html", nombre + ".html")
    .getAs("application/pdf");
  blob.setName(nombre + ".pdf");

  var emp = CONFIG.EMPRESA;
  var em = CONFIG.EMAIL || {};

  var cuerpo = recibo_cuerpoEmail_({
    cliente: params.cliente || "",
    nroRecibo: params.nroRecibo || "",
    nroFactura: params.nroFactura || "",
    total: params.total || "",
    empresa: emp.razonSocial || "",
    direccion: emp.direccion || "",
    tel: emp.tel || ""
  });

  var asunto = (em.asuntoPrefijo || "Recibo de cobranza") +
    (params.nroRecibo ? " N° " + params.nroRecibo : "") + " - " + (emp.razonSocial || "");

  var opciones = {
    name: em.remitenteNombre || emp.razonSocial || "Recibos",
    htmlBody: cuerpo,
    attachments: [blob]
  };
  if (em.enviarCopiaA) opciones.cc = em.enviarCopiaA;
  if (em.replyTo) opciones.replyTo = em.replyTo;

  // Cuerpo de texto plano como fallback para clientes sin HTML.
  MailApp.sendEmail(destino, asunto, "Adjuntamos su recibo de cobranza.", opciones);

  return { ok: true, destino: destino };
}

/**
 * Renderiza la plantilla HTML del cuerpo del email con las variables del recibo.
 */
function recibo_cuerpoEmail_(vars) {
  var t = HtmlService.createTemplateFromFile("PlantillaEmail");
  t.cliente = vars.cliente;
  t.nroRecibo = vars.nroRecibo;
  t.nroFactura = vars.nroFactura;
  t.total = vars.total;
  t.empresa = vars.empresa;
  t.direccion = vars.direccion;
  t.tel = vars.tel;
  return t.evaluate().getContent();
}


/* =========================================================================
 *  NÚMERO EN LETRAS — español rioplatense, formato pesos
 * ========================================================================= */

// 0..29 escritos directamente (resuelve los casos especiales 11..29).
var RECIBO_UNIDADES_ = [
  "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
  "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete",
  "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés",
  "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"
];
var RECIBO_DECENAS_ = [
  "", "", "veinte", "treinta", "cuarenta", "cincuenta",
  "sesenta", "setenta", "ochenta", "noventa"
];
var RECIBO_CENTENAS_ = [
  "", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
  "seiscientos", "setecientos", "ochocientos", "novecientos"
];

/** Apócope para "uno"/"veintiuno" cuando preceden a "mil"/"millones". */
function recibo_apocopar_(texto) {
  if (/veintiuno$/.test(texto)) return texto.replace(/veintiuno$/, "veintiún");
  if (/uno$/.test(texto)) return texto.replace(/uno$/, "un");
  return texto;
}

/** 0..99 en letras. */
function recibo_decenasALetras_(n) {
  if (n < 30) return RECIBO_UNIDADES_[n];
  var d = Math.floor(n / 10);
  var u = n % 10;
  var out = RECIBO_DECENAS_[d];
  if (u > 0) out += " y " + RECIBO_UNIDADES_[u];
  return out;
}

/** 0..999 en letras. */
function recibo_centenasALetras_(n) {
  if (n === 0) return "";
  if (n === 100) return "cien";
  var c = Math.floor(n / 100);
  var resto = n % 100;
  var out = "";
  if (c > 0) out += RECIBO_CENTENAS_[c];
  if (resto > 0) out += (out ? " " : "") + recibo_decenasALetras_(resto);
  return out;
}

/** 0..999999 en letras (maneja el grupo de "mil"). */
function recibo_milesALetras_(n) {
  var miles = Math.floor(n / 1000);
  var resto = n % 1000;
  var out = "";
  if (miles > 0) {
    out += (miles === 1) ? "mil" : recibo_apocopar_(recibo_centenasALetras_(miles)) + " mil";
  }
  if (resto > 0) out += (out ? " " : "") + recibo_centenasALetras_(resto);
  return out;
}

/** Entero >= 0 en letras (soporta millones). */
function recibo_enteroALetras_(n) {
  if (n === 0) return "cero";
  var millones = Math.floor(n / 1000000);
  var resto = n % 1000000;
  var out = "";
  if (millones > 0) {
    out += (millones === 1)
      ? "un millón"
      : recibo_apocopar_(recibo_milesALetras_(millones)) + " millones";
  }
  if (resto > 0) out += (out ? " " : "") + recibo_milesALetras_(resto);
  return out;
}

/**
 * Convierte un monto a letras en español rioplatense, con sufijo "pesos" y,
 * si hay centavos, "con NN/100".
 *
 * Ejemplo obligatorio:
 *   numeroALetras(4582830)
 *     => "Cuatro millones quinientos ochenta y dos mil ochocientos treinta pesos"
 *
 * @param {number|string} monto
 * @return {string}
 */
function numeroALetras(monto) {
  var num = recibo_aNumero_(monto);
  var negativo = num < 0;
  num = Math.abs(num);
  var entero = Math.floor(num);
  var centavos = Math.round((num - entero) * 100);
  // Por redondeo, los centavos pueden "desbordar" a un peso entero.
  if (centavos === 100) { entero += 1; centavos = 0; }

  // Apócope ante el sustantivo: "un peso", "veintiún pesos", "ciento un pesos".
  var letras = recibo_apocopar_(recibo_enteroALetras_(entero));
  letras = letras.charAt(0).toUpperCase() + letras.slice(1); // Capitaliza
  var resultado = (negativo ? "Menos " : "") + letras + " pesos";

  if (centavos > 0) {
    var cc = centavos < 10 ? "0" + centavos : "" + centavos;
    resultado += " con " + cc + "/100";
  }
  return resultado;
}

/**
 * Test de numeroALetras. Ejecutar manualmente desde el editor de Apps Script
 * (Run > recibo_testNumeroALetras) y mirar el Logger. Lanza si el caso
 * obligatorio falla.
 */
function recibo_testNumeroALetras() {
  var casos = [
    { in: 4582830, out: "Cuatro millones quinientos ochenta y dos mil ochocientos treinta pesos" },
    { in: 0, out: "Cero pesos" },
    { in: 1, out: "Un pesos" },
    { in: 100, out: "Cien pesos" },
    { in: 101, out: "Ciento un pesos" },
    { in: 31, out: "Treinta y un pesos" },
    { in: 21000, out: "Veintiún mil pesos" },
    { in: 1000000, out: "Un millón pesos" },
    { in: 2000000, out: "Dos millones pesos" },
    { in: 1234.56, out: "Mil doscientos treinta y cuatro pesos con 56/100" }
  ];
  var ok = true;
  casos.forEach(function (caso) {
    var r = numeroALetras(caso.in);
    var pasa = r === caso.out;
    if (!pasa) ok = false;
    Logger.log((pasa ? "OK  ✓ " : "FALLÓ ✗ ") + caso.in + " => " + r +
      (pasa ? "" : "  (esperado: " + caso.out + ")"));
  });

  // Caso obligatorio del spec: debe pasar sí o sí.
  var obligatorio = numeroALetras(4582830);
  var esperado = "Cuatro millones quinientos ochenta y dos mil ochocientos treinta pesos";
  if (obligatorio !== esperado) {
    throw new Error("Test obligatorio de numeroALetras FALLÓ: " + obligatorio);
  }
  Logger.log(ok ? "TODOS LOS TESTS OK ✓" : "HAY TESTS QUE FALLARON ✗");
  return obligatorio;
}
