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
    iva: "IVA"
  },

  LOGO_BASE64: "data:image/png;base64,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",
  FIRMA_BASE64: "", // se completa cuando la firma sea fija; por ahora se usa el campo editable "Firmado por"

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
