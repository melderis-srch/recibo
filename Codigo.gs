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
    direccion: "San Martín 4041 – 3000 Santa Fe",
    tel: "(0342) 456 3173",
    email: "administracion@surcherie.com.ar",
    condicionIVA: "IVA Responsable Inscripto",
    cuit: "30-70932838-3",
    iibb: "Conv. Multi. 921-554855-1",
    derRegInsp: "89863",
    inicioActividades: "01/09/2025"
  },

  SHEET_FINANCIERO_ID: "<<< COMPLETAR ID de la planilla financiero >>>",
  SHEET_FINANCIERO_NOMBRE: "financiero",
  SHEET_CLIENTES_ID: "<<< COMPLETAR ID de la planilla de clientes >>>",
  SHEET_CLIENTES_NOMBRE: "clientes",

  // Encabezados esperados en la hoja financiero (ajustar al texto real de la
  // primera fila de la hoja). El mapeo es POR NOMBRE, no por posición.
  COLS_FINANCIERO: {
    paciente: "Paciente",
    obraSocial: "Obra Social",   // se usa para cruzar con la tabla de clientes
    nroFactura: "N° Factura",
    importe: "Importe",
    fecha: "Fecha",
    retIG: "IG",
    retIIBB: "IIBB",
    neto: "Neto"
  },

  // Encabezados esperados en la hoja clientes:
  COLS_CLIENTES: {
    cliente: "Cliente",
    direccion: "Dirección",
    localidad: "Localidad",
    cuit: "CUIT",
    iva: "IVA"
  },

  LOGO_BASE64: "<<< COMPLETAR data URI del logo (png, ideal fondo transparente) >>>",
  FIRMA_BASE64: "<<< COMPLETAR data URI de la firma >>>",

  HOJA_LOG_RECIBOS: "recibos" // hoja (dentro de la planilla financiero) donde se registra cada recibo emitido
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
  return recibo_render_();
}

/**
 * Devuelve el HtmlOutput del módulo de recibos.
 * Útil para enchufarlo a un router existente:
 *   if (e.parameter.page === 'recibos') return recibo_render_();
 */
function recibo_render_() {
  return HtmlService.createTemplateFromFile("Index")
    .evaluate()
    .setTitle("Recibos de Cobranza – Surcherie")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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
          iva: recibo_celda_(fila, cli.headers, c.iva)
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
 * Calcula el próximo N° de recibo (correlativo): último + 1.
 */
function recibo_proximoNumero_() {
  var sheet = recibo_obtenerHojaLog_();
  var last = sheet.getLastRow();
  if (last < 2) return 1;
  var valores = sheet.getRange(2, 1, last - 1, 1).getValues();
  var max = 0;
  for (var i = 0; i < valores.length; i++) {
    var n = parseInt(valores[i][0], 10);
    if (!isNaN(n) && n > max) max = n;
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
    var usuario = "";
    try { usuario = Session.getActiveUser().getEmail() || ""; } catch (e) { usuario = ""; }
    var fechaEmision = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");

    sheet.appendRow([
      nro,
      fechaEmision,
      datos.nroFactura || "",
      datos.cliente || "",
      Number(datos.importe) || 0,
      Number(datos.descuento) || 0,
      Number(datos.total) || 0,
      usuario
    ]);

    return { nroRecibo: nro, usuario: usuario, fechaEmision: fechaEmision };
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
