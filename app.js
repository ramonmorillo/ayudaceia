/**
 * AYUDA CEIA — app.js
 * Aplicación web estática para apoyo a la evaluación ética de protocolos CEI.
 * Sin backend. Persistencia: IndexedDB (casos) + localStorage (ajustes).
 * Compatible con GitHub Pages.
 *
 * Estructura:
 *  1. Configuración y constantes
 *  2. IndexedDB
 *  3. Ajustes (localStorage)
 *  4. Navegación / tabs
 *  5. Estado global (caso activo)
 *  6. Tab: Nuevo caso
 *  7. Tab: Lectura guiada
 *  8. Tab: Evaluación
 *  9. Tab: Preguntas
 * 10. Tab: Dictamen
 * 11. Tab: Historial
 * 12. Tab: Ajustes
 * 13. Exportación PDF
 * 14. Modal + Toast
 * 15. Arranque
 */

'use strict';

/* ============================================================
   1. CONFIGURACIÓN Y CONSTANTES
   ============================================================ */

const DB_NAME    = 'ayuda-ceia-db';
const DB_VERSION = 1;
const STORE_NAME = 'casos';

const DEFAULT_SETTINGS = {
  toolName:   'AYUDA CEIA',
  version:    'v0.1.0',
  autoria:    'Ramón Morillo',
  contacto:   '',
  disclaimer: 'Herramienta de apoyo para la evaluación ética de protocolos. No sustituye la deliberación del CEI ni los procedimientos oficiales. La información generada requiere revisión profesional.'
};

// Dominios de evaluación
const DOMINIOS = [
  { id: 'D01', titulo: 'Valor social / justificación científica' },
  { id: 'D02', titulo: 'Rigor metodológico mínimo' },
  { id: 'D03', titulo: 'Riesgos, carga y minimización' },
  { id: 'D04', titulo: 'Selección de participantes y equidad' },
  { id: 'D05', titulo: 'Consentimiento informado o exención justificada' },
  { id: 'D06', titulo: 'Privacidad y gobernanza de datos' },
  { id: 'D07', titulo: 'Muestras / biobanco (si aplica)' },
  { id: 'D08', titulo: 'Conflictos de interés y financiación' },
  { id: 'D09', titulo: 'Viabilidad y proporcionalidad' },
  { id: 'D10', titulo: 'Digital / IA (solo si aplica)' },
];

// Palabras clave para activar D10
const KW_IA = /\b(inteligencia artificial|machine learning|deep learning|algoritmo|modelo predictivo|IA|ML|DL|neural|NLP|chatbot|LLM)\b/i;

// Plantillas de preguntas por dominio (se rellenan si dominio ≠ verde)
const PLANTILLAS_PREGUNTAS = {
  D01: 'Se solicita que el equipo investigador justifique con mayor detalle el valor social o científico del estudio, clarificando de qué modo los resultados esperados contribuyen al conocimiento o a la práctica clínica.',
  D02: 'Se requiere que el protocolo detalle el diseño metodológico y el cálculo del tamaño muestral, incluyendo los criterios de elección del método estadístico principal.',
  D03: 'Se solicita una descripción más precisa de los riesgos y la carga previsibles para los participantes, así como de las medidas de minimización adoptadas.',
  D04: 'Se pide que el equipo justifique los criterios de inclusión y exclusión desde el punto de vista de la equidad, especificando si se han considerado grupos vulnerables y en qué condiciones.',
  D05: 'Se requiere que el equipo aclare el procedimiento operativo de obtención del consentimiento informado (CI) o, en su caso, justifique la exención solicitada con referencia a la normativa aplicable.',
  D06: 'Se solicita que el protocolo especifique el tipo de datos personales tratados, las medidas de seudonimización o anonimización aplicadas, los accesos autorizados y el plan de retención y destrucción de datos.',
  D07: 'Se requiere que el equipo indique si las muestras biológicas serán almacenadas y, de ser así, que describa las condiciones de custodia, el consentimiento específico para biobanco y la posible cesión a terceros.',
  D08: 'Se pide que todos los investigadores declaren posibles conflictos de interés y que se detalle la fuente de financiación del estudio, incluyendo cualquier vinculación con la industria.',
  D09: 'Se solicita que el equipo acredite la viabilidad del estudio en el centro o centros participantes (recursos, tiempo, reclutamiento previsto) y que justifique la proporcionalidad entre beneficios esperados y carga impuesta.',
  D10: 'Se requiere que el protocolo describa en detalle el algoritmo o sistema de IA/ML empleado, incluyendo: datos de entrenamiento, validación, posibles sesgos, interpretabilidad de resultados y responsabilidad en la toma de decisiones clínicas.',
};

// Secciones para la lectura guiada
const SECCIONES_LECTURA = [
  { key: 'objetivo',     label: 'Objetivo',                       full: false },
  { key: 'diseno',       label: 'Diseño',                         full: false },
  { key: 'poblacion',    label: 'Población y criterios',          full: false },
  { key: 'variables',    label: 'Variables principales',          full: false },
  { key: 'procedimientos', label: 'Procedimientos',               full: false },
  { key: 'riesgos',      label: 'Riesgos / carga y minimización', full: false },
  { key: 'consentimiento', label: 'Consentimiento o exención',    full: false },
  { key: 'datos',        label: 'Datos / privacidad',             full: false },
  { key: 'muestras',     label: 'Muestras / biobanco',            full: false },
  { key: 'financiacion', label: 'Financiación y COI',             full: false },
];

/* ============================================================
   2. INDEXEDDB
   ============================================================ */

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE_NAME)) {
        const store = d.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('titulo', 'titulo', { unique: false });
        store.createIndex('fecha', 'fechaCreado', { unique: false });
      }
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror   = (e) => reject(e.target.error);
  });
}

function dbGetAll() {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function dbGet(id) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function dbPut(record) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.put(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function dbDelete(id) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

/* ============================================================
   3. AJUSTES (localStorage)
   ============================================================ */

function getSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('ayuda-ceia-settings') || '{}');
    return Object.assign({}, DEFAULT_SETTINGS, s);
  } catch { return { ...DEFAULT_SETTINGS }; }
}

function saveSettings(s) {
  localStorage.setItem('ayuda-ceia-settings', JSON.stringify(s));
}

function applySettings() {
  const s = getSettings();
  // Header
  document.getElementById('header-tool-name').textContent = s.toolName;
  // Footer
  document.getElementById('footer-tool-name').textContent = s.toolName;
  document.getElementById('footer-version').textContent   = s.version;
  document.getElementById('footer-autoria').textContent   = s.autoria || '';
  const ct = document.getElementById('footer-contacto');
  ct.textContent = s.contacto || '';
  document.getElementById('footer-disclaimer').textContent = s.disclaimer;
  // Dictamen disclaimer
  const dd = document.getElementById('dictamen-disclaimer');
  if (dd) dd.textContent = s.disclaimer;
}

/* ============================================================
   4. NAVEGACIÓN / TABS
   ============================================================ */

const tabs = document.querySelectorAll('.nav-btn');
const sections = document.querySelectorAll('.tab-section');

function activateTab(tabId) {
  tabs.forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  sections.forEach(s => s.classList.toggle('active', s.id === tabId));

  // Al cambiar de tab, refrescar contenido relevante
  if (tabId === 'tab-lectura')    renderLectura();
  if (tabId === 'tab-evaluacion') renderEvaluacion();
  if (tabId === 'tab-preguntas')  renderPreguntas();
  if (tabId === 'tab-dictamen')   renderDictamen();
  if (tabId === 'tab-historial')  renderHistorial();
  if (tabId === 'tab-ajustes')    renderAjustes();
}

tabs.forEach(btn => {
  btn.addEventListener('click', () => activateTab(btn.dataset.tab));
});

/* ============================================================
   5. ESTADO GLOBAL (caso activo)
   ============================================================ */

// currentCase: objeto con todos los datos del caso abierto
let currentCase = null;

function setCurrentCase(c) {
  currentCase = c;
}

function requireCase(sectionId) {
  const noCase = document.getElementById(sectionId + '-no-case');
  const content = document.getElementById(sectionId + '-content');
  if (!currentCase) {
    if (noCase)  noCase.style.display  = '';
    if (content) content.style.display = 'none';
    return false;
  }
  if (noCase)  noCase.style.display  = 'none';
  if (content) content.style.display = '';
  return true;
}

function caseInfoBar(elementId) {
  const el = document.getElementById(elementId);
  if (el && currentCase) {
    el.innerHTML = `<strong>${esc(currentCase.id)}</strong> &mdash; ${esc(currentCase.titulo)}
      &nbsp;&bull;&nbsp; ${esc(currentCase.tipo)} &nbsp;&bull;&nbsp;
      Evaluador: ${esc(currentCase.evaluador)}`;
  }
}

function addAuditLog(c, accion) {
  if (!c.auditLog) c.auditLog = [];
  c.auditLog.push({ accion, ts: new Date().toISOString() });
}

/* ============================================================
   6. TAB: NUEVO CASO
   ============================================================ */

function renderNuevoCaso() {
  const notice = document.getElementById('editing-notice');
  const eid    = document.getElementById('editing-case-id');
  if (currentCase) {
    notice.style.display = '';
    eid.textContent = currentCase.id + ' — ' + currentCase.titulo;
    fillNuevoCasoForm(currentCase);
  } else {
    notice.style.display = 'none';
    clearNuevoCasoForm();
  }
}

function fillNuevoCasoForm(c) {
  document.getElementById('campo-id').value        = c.id || '';
  document.getElementById('campo-titulo').value    = c.titulo || '';
  document.getElementById('campo-evaluador').value = c.evaluador || '';
  document.getElementById('campo-tipo').value      = c.tipo || '';
  document.getElementById('campo-ambito').value    = c.ambito || '';
  document.getElementById('campo-datos').value     = c.datos || '';
  document.getElementById('campo-texto').value     = c.texto || '';
  document.getElementById('campo-vulnerable-texto').value = c.vulnerableTexto || '';
  const vRadios = document.querySelectorAll('input[name="vulnerable"]');
  vRadios.forEach(r => r.checked = (r.value === (c.vulnerable || 'no')));
}

function clearNuevoCasoForm() {
  document.getElementById('form-nuevo-caso').reset();
  document.getElementById('campo-vulnerable-texto').value = '';
}

function getCasoFromForm() {
  const vulnerable = document.querySelector('input[name="vulnerable"]:checked')?.value || 'no';
  return {
    id:              document.getElementById('campo-id').value.trim(),
    titulo:          document.getElementById('campo-titulo').value.trim(),
    evaluador:       document.getElementById('campo-evaluador').value.trim(),
    tipo:            document.getElementById('campo-tipo').value,
    ambito:          document.getElementById('campo-ambito').value,
    datos:           document.getElementById('campo-datos').value,
    vulnerable,
    vulnerableTexto: document.getElementById('campo-vulnerable-texto').value.trim(),
    texto:           document.getElementById('campo-texto').value.trim(),
  };
}

function validateForm(c) {
  const errors = [];
  if (!c.id)        errors.push({ field: 'campo-id',        msg: 'El ID es obligatorio' });
  if (!c.titulo)    errors.push({ field: 'campo-titulo',    msg: 'El título es obligatorio' });
  if (!c.evaluador) errors.push({ field: 'campo-evaluador', msg: 'El evaluador es obligatorio' });
  if (!c.tipo)      errors.push({ field: 'campo-tipo',      msg: 'El tipo de estudio es obligatorio' });
  if (!c.ambito)    errors.push({ field: 'campo-ambito',    msg: 'El ámbito es obligatorio' });
  if (!c.datos)     errors.push({ field: 'campo-datos',     msg: 'El tipo de datos es obligatorio' });
  return errors;
}

async function guardarCaso(irALectura = false) {
  // Limpiar errores previos
  document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));

  const form = getCasoFromForm();
  const errors = validateForm(form);

  if (errors.length) {
    errors.forEach(e => document.getElementById(e.field)?.classList.add('error'));
    showToast(errors[0].msg, 'error');
    return;
  }

  // Comprobar ID duplicado solo si es caso nuevo
  if (!currentCase || currentCase.id !== form.id) {
    const existing = await dbGet(form.id);
    if (existing) {
      showToast('Ya existe un caso con ese ID. Usa otro ID o edítalo desde Historial.', 'error');
      document.getElementById('campo-id').classList.add('error');
      return;
    }
  }

  // Construir objeto caso
  const isNew = !currentCase;
  const caso  = currentCase ? { ...currentCase } : { auditLog: [], evaluacion: {}, lectura: {}, preguntas: [], dictamen: '' };

  // Si el ID cambia (edición), borrar el antiguo
  if (!isNew && currentCase.id !== form.id) {
    await dbDelete(currentCase.id);
  }

  Object.assign(caso, form);
  if (isNew) caso.fechaCreado = new Date().toISOString();
  caso.fechaEditado = new Date().toISOString();
  addAuditLog(caso, isNew ? 'Creado' : 'Editado');

  await dbPut(caso);
  setCurrentCase(caso);

  showToast(isNew ? 'Caso guardado correctamente.' : 'Caso actualizado.', 'success');
  renderNuevoCaso();

  if (irALectura) {
    activateTab('tab-lectura');
  }
}

document.getElementById('form-nuevo-caso').addEventListener('submit', (e) => {
  e.preventDefault();
  guardarCaso(false);
});

document.getElementById('btn-preview-lectura').addEventListener('click', () => {
  guardarCaso(true);
});

document.getElementById('btn-new-case-clear').addEventListener('click', () => {
  setCurrentCase(null);
  clearNuevoCasoForm();
  document.getElementById('editing-notice').style.display = 'none';
  showToast('Formulario listo para un nuevo caso.', 'info');
});

/* ============================================================
   7. TAB: LECTURA GUIADA
   ============================================================ */

// Heurísticas de extracción de secciones desde texto libre
const HEURISTICAS = {
  objetivo: [
    /objetivo(?:s)?[:\s]+([^\n]{30,300})/i,
    /hipótesis[:\s]+([^\n]{30,300})/i,
    /finalidad[:\s]+([^\n]{30,300})/i,
    /propósito[:\s]+([^\n]{30,300})/i,
  ],
  diseno: [
    /diseño[:\s]+([^\n]{15,200})/i,
    /tipo de estudio[:\s]+([^\n]{15,200})/i,
    /metodología[:\s]+([^\n]{15,200})/i,
    /estudio\s+(observacional|de cohortes|transversal|caso-control|ensayo|aleatori)[^\n]*/i,
  ],
  poblacion: [
    /criterios de inclusi[oó]n[:\s]+([\s\S]{30,400}?)(?:\n\n|\n[A-Z])/i,
    /criterios de exclusi[oó]n[:\s]+([\s\S]{30,400}?)(?:\n\n|\n[A-Z])/i,
    /poblaci[oó]n[:\s]+([^\n]{30,300})/i,
    /participantes[:\s]+([^\n]{30,300})/i,
    /muestra[:\s]+([^\n]{30,300})/i,
  ],
  variables: [
    /variable(?:s)?\s+principal(?:es)?[:\s]+([\s\S]{20,400}?)(?:\n\n|\n[A-Z])/i,
    /variable(?:s)?\s+resultado[:\s]+([\s\S]{20,300}?)(?:\n\n|\n[A-Z])/i,
    /desenlace(?:s)?[:\s]+([\s\S]{20,300}?)(?:\n\n|\n[A-Z])/i,
    /outcome[:\s]+([\s\S]{20,300}?)(?:\n\n|\n[A-Z])/i,
  ],
  procedimientos: [
    /procedimiento(?:s)?[:\s]+([\s\S]{30,400}?)(?:\n\n|\n[A-Z])/i,
    /intervenci[oó]n[:\s]+([\s\S]{30,400}?)(?:\n\n|\n[A-Z])/i,
    /visita(?:s)?[:\s]+([\s\S]{30,300}?)(?:\n\n|\n[A-Z])/i,
    /recogida de datos[:\s]+([\s\S]{30,300}?)(?:\n\n|\n[A-Z])/i,
  ],
  riesgos: [
    /riesgo(?:s)?[:\s]+([\s\S]{30,400}?)(?:\n\n|\n[A-Z])/i,
    /carga[:\s]+([\s\S]{20,300}?)(?:\n\n|\n[A-Z])/i,
    /molestia(?:s)?[:\s]+([\s\S]{20,300}?)(?:\n\n|\n[A-Z])/i,
    /beneficio(?:s)?[:\s]+([\s\S]{20,300}?)(?:\n\n|\n[A-Z])/i,
  ],
  consentimiento: [
    /consentimiento informado[:\s]+([\s\S]{30,400}?)(?:\n\n|\n[A-Z])/i,
    /hoja de informaci[oó]n[:\s]+([\s\S]{30,300}?)(?:\n\n|\n[A-Z])/i,
    /exenci[oó]n de consentimiento[:\s]+([\s\S]{30,300}?)(?:\n\n|\n[A-Z])/i,
    /asentimiento[:\s]+([\s\S]{20,300}?)(?:\n\n|\n[A-Z])/i,
  ],
  datos: [
    /datos personales[:\s]+([\s\S]{20,300}?)(?:\n\n|\n[A-Z])/i,
    /protecci[oó]n de datos[:\s]+([\s\S]{20,300}?)(?:\n\n|\n[A-Z])/i,
    /seudonimizaci[oó]n[:\s]+([\s\S]{20,300}?)(?:\n\n|\n[A-Z])/i,
    /anonimizaci[oó]n[:\s]+([\s\S]{20,300}?)(?:\n\n|\n[A-Z])/i,
    /RGPD|LOPD[^\n]*/i,
    /privacidad[:\s]+([\s\S]{20,300}?)(?:\n\n|\n[A-Z])/i,
  ],
  muestras: [
    /muestra(?:s)?\s+biol[oó]gic[ao](?:s)?[:\s]+([\s\S]{20,300}?)(?:\n\n|\n[A-Z])/i,
    /biobanco[:\s]+([\s\S]{20,300}?)(?:\n\n|\n[A-Z])/i,
    /biomuestra[:\s]+([\s\S]{20,300}?)(?:\n\n|\n[A-Z])/i,
    /sangre|plasma|tejido|biopsia|orina[^\n]*/i,
  ],
  financiacion: [
    /financiaci[oó]n[:\s]+([\s\S]{20,300}?)(?:\n\n|\n[A-Z])/i,
    /fuente de financiaci[oó]n[:\s]+([\s\S]{20,300}?)(?:\n\n|\n[A-Z])/i,
    /conflicto(?:s)?\s+de inter[eé]s[:\s]+([\s\S]{20,300}?)(?:\n\n|\n[A-Z])/i,
    /COI[:\s]+([\s\S]{20,200}?)(?:\n\n|\n[A-Z])/i,
    /patrocinador[:\s]+([\s\S]{20,200}?)(?:\n\n|\n[A-Z])/i,
  ],
};

function extraerSeccion(texto, regexList) {
  for (const re of regexList) {
    const m = texto.match(re);
    if (m && m[1]) return m[1].trim().substring(0, 500);
    if (m && m[0]) return m[0].trim().substring(0, 500);
  }
  return '';
}

function generarLectura(texto) {
  const lectura = {};
  for (const sec of SECCIONES_LECTURA) {
    const regs = HEURISTICAS[sec.key] || [];
    lectura[sec.key] = extraerSeccion(texto, regs);
  }
  return lectura;
}

function detectarAlertas(texto, lectura) {
  const alertas = [];
  if (!lectura.objetivo)
    alertas.push('Objetivo principal no identificado claramente.');
  if (!lectura.variables)
    alertas.push('Variable principal no definida o no encontrada.');
  if (!lectura.riesgos)
    alertas.push('Riesgos y carga no descritos o no localizados.');
  if (!lectura.consentimiento)
    alertas.push('Procedimiento de consentimiento informado no operativo o no identificado.');
  if (!lectura.datos)
    alertas.push('Privacidad / gobernanza de datos no especificada.');
  if (!lectura.poblacion)
    alertas.push('Criterios de inclusión/exclusión no encontrados.');
  if (!/RGPD|LOPD|protecci[oó]n de datos/i.test(texto))
    alertas.push('No se menciona la normativa de protección de datos (RGPD/LOPD).');
  if (!/consentimiento/i.test(texto) && !/exenci[oó]n/i.test(texto))
    alertas.push('El protocolo no menciona consentimiento informado ni exención.');
  return alertas;
}

function renderLectura() {
  if (!requireCase('lectura')) return;
  caseInfoBar('lectura-case-bar');

  const c = currentCase;
  // Si no hay lectura guardada, generar desde texto
  if (!c.lectura || Object.keys(c.lectura).length === 0) {
    c.lectura = generarLectura(c.texto || '');
  }

  const alertas = detectarAlertas(c.texto || '', c.lectura);
  const alertBox = document.getElementById('lectura-alertas');
  const listaAlertas = document.getElementById('lista-alertas');
  if (alertas.length > 0) {
    alertBox.style.display = '';
    listaAlertas.innerHTML = alertas.map(a => `<li>${esc(a)}</li>`).join('');
  } else {
    alertBox.style.display = 'none';
  }

  // Renderizar campos
  const container = document.getElementById('lectura-campos');
  container.innerHTML = '';
  for (const sec of SECCIONES_LECTURA) {
    const div = document.createElement('div');
    div.className = 'lectura-campo' + (sec.full ? ' full' : '');
    div.innerHTML = `
      <label>${esc(sec.label)}</label>
      <textarea id="lec-${sec.key}" rows="4" placeholder="(No detectado automáticamente — escribe aquí tu resumen)">${esc(c.lectura[sec.key] || '')}</textarea>
    `;
    container.appendChild(div);
  }
}

function getLecturaFromForm() {
  const lectura = {};
  for (const sec of SECCIONES_LECTURA) {
    const el = document.getElementById('lec-' + sec.key);
    if (el) lectura[sec.key] = el.value.trim();
  }
  return lectura;
}

document.getElementById('btn-guardar-lectura').addEventListener('click', async () => {
  if (!currentCase) return;
  currentCase.lectura = getLecturaFromForm();
  currentCase.fechaEditado = new Date().toISOString();
  addAuditLog(currentCase, 'Lectura guiada guardada');
  await dbPut(currentCase);
  showToast('Resumen guardado.', 'success');
});

document.getElementById('btn-regenerar-lectura').addEventListener('click', () => {
  if (!currentCase) return;
  currentCase.lectura = generarLectura(currentCase.texto || '');
  renderLectura();
  showToast('Resumen regenerado desde el texto.', 'info');
});

document.getElementById('btn-ir-evaluacion').addEventListener('click', () => {
  activateTab('tab-evaluacion');
});

/* ============================================================
   8. TAB: EVALUACIÓN POR DOMINIOS
   ============================================================ */

function renderEvaluacion() {
  if (!requireCase('evaluacion')) return;
  caseInfoBar('evaluacion-case-bar');

  const c = currentCase;
  if (!c.evaluacion) c.evaluacion = {};

  // Determinar si D10 aplica
  const texto = c.texto || '';
  const d10Aplica = KW_IA.test(texto);

  const container = document.getElementById('dominios-container');
  container.innerHTML = '';

  DOMINIOS.forEach((dom) => {
    // D10: solo si aplica
    if (dom.id === 'D10' && !d10Aplica) return;

    const ev = c.evaluacion[dom.id] || { semaforo: 'nd', comentario: '', evidencia: '', seccion: '' };
    const card = document.createElement('div');
    card.className = 'dominio-card';
    card.id = 'card-' + dom.id;

    const badge = semaforoBadge(ev.semaforo);

    card.innerHTML = `
      <div class="dominio-header" onclick="toggleDominio('${dom.id}')">
        <span class="dominio-num">${dom.id.replace('D', '')}</span>
        <span class="dominio-title">${esc(dom.titulo)}</span>
        ${dom.id === 'D10' ? '<span class="tag" title="Solo si el protocolo incluye IA/ML">IA/ML</span>' : ''}
        <span class="semaforo-badge semaforo-${ev.semaforo}" id="badge-${dom.id}">${badge}</span>
      </div>
      <div class="dominio-body" id="body-${dom.id}">
        <div>
          <label style="display:block;margin-bottom:6px;font-size:.83rem;font-weight:600;color:#374151">Semáforo</label>
          <div class="semaforo-selector">
            <button class="semaforo-btn verde ${ev.semaforo==='verde'?'active':''}" onclick="setSemaforo('${dom.id}','verde')">● Verde</button>
            <button class="semaforo-btn amber ${ev.semaforo==='amber'?'active':''}" onclick="setSemaforo('${dom.id}','amber')">● Ámbar</button>
            <button class="semaforo-btn rojo  ${ev.semaforo==='rojo' ?'active':''}" onclick="setSemaforo('${dom.id}','rojo')">● Rojo</button>
          </div>
        </div>
        <div class="dominio-field">
          <label for="ev-com-${dom.id}">Comentario <span style="color:#6b7280;font-weight:400">(obligatorio si ámbar o rojo)</span></label>
          <textarea id="ev-com-${dom.id}" rows="3" placeholder="Observaciones sobre este dominio...">${esc(ev.comentario)}</textarea>
        </div>
        <div class="dominio-field">
          <label for="ev-evi-${dom.id}">Evidencia del protocolo <span style="color:#6b7280;font-weight:400">(1-3 frases textuales)</span></label>
          <textarea id="ev-evi-${dom.id}" rows="2" placeholder="Cita textual del protocolo que sustenta la valoración...">${esc(ev.evidencia)}</textarea>
        </div>
        <div class="dominio-field">
          <label for="ev-sec-${dom.id}">Sección / página (opcional)</label>
          <input type="text" id="ev-sec-${dom.id}" placeholder="ej. Sección 4.2, pág. 12" value="${esc(ev.seccion)}" />
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function toggleDominio(domId) {
  const body = document.getElementById('body-' + domId);
  if (body) body.classList.toggle('open');
}

function setSemaforo(domId, valor) {
  const badge = document.getElementById('badge-' + domId);
  if (badge) {
    badge.className = `semaforo-badge semaforo-${valor}`;
    badge.textContent = semaforoBadge(valor);
  }
  // Actualizar botones
  const btns = document.querySelectorAll(`#body-${domId} .semaforo-btn`);
  btns.forEach(b => b.classList.toggle('active', b.classList.contains(valor)));
}

function semaforoBadge(v) {
  if (v === 'verde') return '● Verde';
  if (v === 'amber') return '● Ámbar';
  if (v === 'rojo')  return '● Rojo';
  return '○ No evaluado';
}

function getEvaluacionFromUI() {
  const ev = {};
  DOMINIOS.forEach(dom => {
    const badge = document.getElementById('badge-' + dom.id);
    if (!badge) return; // dominio no renderizado (D10 inactivo)
    // Leer semáforo desde clases del badge
    let sem = 'nd';
    if (badge.classList.contains('semaforo-verde')) sem = 'verde';
    else if (badge.classList.contains('semaforo-amber')) sem = 'amber';
    else if (badge.classList.contains('semaforo-rojo'))  sem = 'rojo';
    ev[dom.id] = {
      semaforo:   sem,
      comentario: document.getElementById('ev-com-' + dom.id)?.value.trim() || '',
      evidencia:  document.getElementById('ev-evi-' + dom.id)?.value.trim() || '',
      seccion:    document.getElementById('ev-sec-' + dom.id)?.value.trim() || '',
    };
  });
  return ev;
}

function validateEvaluacion(ev) {
  const warnings = [];
  for (const [id, val] of Object.entries(ev)) {
    if ((val.semaforo === 'amber' || val.semaforo === 'rojo') && !val.comentario) {
      const dom = DOMINIOS.find(d => d.id === id);
      warnings.push(`Dominio ${id} (${dom?.titulo}): comentario obligatorio cuando es ámbar o rojo.`);
    }
  }
  return warnings;
}

document.getElementById('btn-guardar-evaluacion').addEventListener('click', async () => {
  if (!currentCase) return;
  const ev = getEvaluacionFromUI();
  const warns = validateEvaluacion(ev);
  if (warns.length) {
    showToast(warns[0], 'error');
    return;
  }
  currentCase.evaluacion = ev;
  currentCase.fechaEditado = new Date().toISOString();
  addAuditLog(currentCase, 'Evaluación guardada');
  await dbPut(currentCase);
  showToast('Evaluación guardada.', 'success');
});

document.getElementById('btn-ir-preguntas').addEventListener('click', async () => {
  if (!currentCase) return;
  // Guardar primero
  const ev = getEvaluacionFromUI();
  const warns = validateEvaluacion(ev);
  if (warns.length) {
    showToast(warns[0], 'error');
    return;
  }
  currentCase.evaluacion = ev;
  currentCase.fechaEditado = new Date().toISOString();
  addAuditLog(currentCase, 'Evaluación guardada');
  await dbPut(currentCase);
  // Generar preguntas automáticas si aún no hay
  if (!currentCase.preguntas || currentCase.preguntas.length === 0) {
    currentCase.preguntas = generarPreguntasAuto(ev);
    await dbPut(currentCase);
  }
  activateTab('tab-preguntas');
});

/* ============================================================
   9. TAB: PREGUNTAS AL INVESTIGADOR
   ============================================================ */

function generarPreguntasAuto(ev) {
  const preguntas = [];
  for (const dom of DOMINIOS) {
    const val = ev[dom.id];
    if (!val) continue;
    if (val.semaforo === 'amber' || val.semaforo === 'rojo') {
      const plantilla = PLANTILLAS_PREGUNTAS[dom.id] || '';
      preguntas.push({
        id:      'P-' + dom.id + '-' + Date.now(),
        dominio: dom.id,
        texto:   plantilla,
      });
    }
  }
  return preguntas;
}

let preguntasOrden = []; // array de ids

function renderPreguntas() {
  if (!requireCase('preguntas')) return;
  caseInfoBar('preguntas-case-bar');

  const c = currentCase;
  if (!c.preguntas) c.preguntas = [];
  preguntasOrden = c.preguntas.map(p => p.id);

  const lista = document.getElementById('preguntas-lista');
  lista.innerHTML = '';

  if (c.preguntas.length === 0) {
    lista.innerHTML = '<p style="color:#6b7280;margin-bottom:16px">No hay preguntas generadas. Completa la Evaluación con dominios ámbar/rojo y vuelve aquí, o añade preguntas manualmente.</p>';
    return;
  }

  c.preguntas.forEach((p, idx) => {
    const dom = DOMINIOS.find(d => d.id === p.dominio);
    const item = document.createElement('div');
    item.className = 'pregunta-item';
    item.dataset.id = p.id;
    item.innerHTML = `
      <span class="pregunta-num">${idx + 1}.</span>
      <div style="flex:1">
        ${dom ? `<span class="pregunta-dominio-tag">${esc(dom.id)} · ${esc(dom.titulo)}</span>` : ''}
        <textarea class="pregunta-texto" rows="3" data-pid="${p.id}">${esc(p.texto)}</textarea>
      </div>
      <div class="pregunta-actions">
        <button class="btn-icon" title="Subir" onclick="moverPregunta('${p.id}', -1)">▲</button>
        <button class="btn-icon" title="Bajar" onclick="moverPregunta('${p.id}', 1)">▼</button>
        <button class="btn-icon" title="Eliminar" style="color:var(--rojo)" onclick="eliminarPregunta('${p.id}')">✕</button>
      </div>
    `;
    lista.appendChild(item);
  });
}

window.moverPregunta = function(id, dir) {
  const c = currentCase;
  const idx = c.preguntas.findIndex(p => p.id === id);
  if (idx === -1) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= c.preguntas.length) return;
  [c.preguntas[idx], c.preguntas[newIdx]] = [c.preguntas[newIdx], c.preguntas[idx]];
  renderPreguntas();
};

window.eliminarPregunta = function(id) {
  const c = currentCase;
  c.preguntas = c.preguntas.filter(p => p.id !== id);
  renderPreguntas();
};

function getPreguntasFromForm() {
  const items = document.querySelectorAll('.pregunta-item');
  const preguntas = [];
  items.forEach(item => {
    const pid = item.dataset.id;
    const ta  = item.querySelector('.pregunta-texto');
    const orig = currentCase.preguntas.find(p => p.id === pid);
    preguntas.push({
      id:      pid || 'P-new-' + Date.now(),
      dominio: orig?.dominio || '',
      texto:   ta?.value.trim() || '',
    });
  });
  return preguntas;
}

document.getElementById('btn-add-pregunta').addEventListener('click', () => {
  if (!currentCase) return;
  if (!currentCase.preguntas) currentCase.preguntas = [];
  currentCase.preguntas.push({
    id:      'P-manual-' + Date.now(),
    dominio: '',
    texto:   '',
  });
  renderPreguntas();
});

document.getElementById('btn-guardar-preguntas').addEventListener('click', async () => {
  if (!currentCase) return;
  currentCase.preguntas = getPreguntasFromForm();
  currentCase.fechaEditado = new Date().toISOString();
  addAuditLog(currentCase, 'Preguntas guardadas');
  await dbPut(currentCase);
  showToast('Preguntas guardadas.', 'success');
});

document.getElementById('btn-ir-dictamen').addEventListener('click', async () => {
  if (!currentCase) return;
  currentCase.preguntas = getPreguntasFromForm();
  await dbPut(currentCase);
  // Generar dictamen si no existe
  if (!currentCase.dictamen) {
    currentCase.dictamen = generarBorradorDictamen(currentCase);
    await dbPut(currentCase);
  }
  activateTab('tab-dictamen');
});

/* ============================================================
   10. TAB: DICTAMEN
   ============================================================ */

function sugerirRecomendacion(ev) {
  if (!ev) return 'Favorable';
  const vals = Object.values(ev);
  if (vals.some(v => v.semaforo === 'rojo'))  return 'No favorable';
  if (vals.some(v => v.semaforo === 'amber')) return 'Favorable condicionado';
  return 'Favorable';
}

function generarBorradorDictamen(c) {
  const s        = getSettings();
  const fecha    = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  const ev       = c.evaluacion || {};
  const lectura  = c.lectura || {};
  const preguntas = c.preguntas || [];
  const recom    = sugerirRecomendacion(ev);

  // Resumen ejecutivo desde lectura
  const resumen = lectura.objetivo
    ? `El protocolo tiene como objetivo: ${lectura.objetivo.substring(0, 300)}.`
    : '(Descripción del protocolo no disponible. Completar desde la Lectura guiada.)';

  // Fortalezas: dominios verdes
  const fortalezas = DOMINIOS.filter(d => ev[d.id]?.semaforo === 'verde')
    .map(d => `  · ${d.titulo}`)
    .join('\n');

  // Debilidades: dominios amber/rojo
  const debilidades = DOMINIOS.filter(d => ev[d.id]?.semaforo === 'amber' || ev[d.id]?.semaforo === 'rojo')
    .map(d => {
      const v = ev[d.id];
      const icono = v.semaforo === 'rojo' ? '[ROJO]' : '[ÁMBAR]';
      const com = v.comentario ? `\n    Observación: ${v.comentario}` : '';
      const evi = v.evidencia ? `\n    Evidencia: "${v.evidencia.substring(0, 200)}"` : '';
      return `  · ${icono} ${d.titulo}${com}${evi}`;
    })
    .join('\n\n');

  // Preguntas numeradas
  const preguntasTxt = preguntas
    .filter(p => p.texto)
    .map((p, i) => `  ${i + 1}. ${p.texto}`)
    .join('\n\n');

  const nd = DOMINIOS.filter(d => !ev[d.id] || ev[d.id].semaforo === 'nd');
  const ndTxt = nd.length ? `\nNota: Los siguientes dominios no han sido evaluados: ${nd.map(d=>d.id).join(', ')}.` : '';

  return `═══════════════════════════════════════════════════════
${s.toolName} — BORRADOR DE DICTAMEN DE EVALUACIÓN ÉTICA
═══════════════════════════════════════════════════════

ID del caso:          ${c.id}
Título del protocolo: ${c.titulo}
Tipo de estudio:      ${c.tipo}
Ámbito:               ${c.ambito}
Evaluador/a:          ${c.evaluador}
Fecha del borrador:   ${fecha}

───────────────────────────────────────────────────────
RESUMEN EJECUTIVO
───────────────────────────────────────────────────────
${resumen}

───────────────────────────────────────────────────────
FORTALEZAS
───────────────────────────────────────────────────────
${fortalezas || '  (Ningún dominio evaluado como verde todavía.)'}

───────────────────────────────────────────────────────
DEBILIDADES / ASPECTOS A ACLARAR
───────────────────────────────────────────────────────
${debilidades || '  (No se han identificado debilidades.)'}
${ndTxt}

───────────────────────────────────────────────────────
PREGUNTAS Y/O CONDICIONES AL EQUIPO INVESTIGADOR
───────────────────────────────────────────────────────
${preguntasTxt || '  (Sin preguntas generadas. Completa la Evaluación y las Preguntas.)'}

───────────────────────────────────────────────────────
RECOMENDACIÓN DEL EVALUADOR/A
───────────────────────────────────────────────────────
  ▶  ${recom.toUpperCase()}

(Sugerencia automática basada en los semáforos. El/la evaluador/a debe confirmar esta recomendación.)

═══════════════════════════════════════════════════════
AVISO LEGAL / DISCLAIMER
═══════════════════════════════════════════════════════
${s.disclaimer}

Herramienta: ${s.toolName} ${s.version} · ${s.autoria}${s.contacto ? ' · ' + s.contacto : ''}
═══════════════════════════════════════════════════════`;
}

function renderDictamen() {
  if (!requireCase('dictamen')) return;
  caseInfoBar('dictamen-case-bar');
  applySettings(); // actualizar disclaimer

  const c    = currentCase;
  const ev   = c.evaluacion || {};
  const sug  = sugerirRecomendacion(ev);

  // Sugerencia
  const sugEl = document.getElementById('sugerencia-recomendacion');
  sugEl.textContent = `Sugerencia automática según semáforos: ${sug}.`;

  // Radio recomendación
  const recoVal = c.recomendacion || sug;
  document.querySelectorAll('input[name="recomendacion"]').forEach(r => {
    r.checked = (r.value === recoVal);
    r.addEventListener('change', () => {
      if (r.checked) currentCase.recomendacion = r.value;
    });
  });

  // Dictamen texto
  if (!c.dictamen) c.dictamen = generarBorradorDictamen(c);
  document.getElementById('dictamen-texto').value = c.dictamen;
}

document.getElementById('btn-regenerar-dictamen').addEventListener('click', () => {
  if (!currentCase) return;
  currentCase.dictamen = generarBorradorDictamen(currentCase);
  document.getElementById('dictamen-texto').value = currentCase.dictamen;
  showToast('Borrador regenerado.', 'info');
});

document.getElementById('btn-guardar-dictamen').addEventListener('click', async () => {
  if (!currentCase) return;
  currentCase.dictamen     = document.getElementById('dictamen-texto').value;
  currentCase.recomendacion = document.querySelector('input[name="recomendacion"]:checked')?.value || '';
  currentCase.fechaEditado  = new Date().toISOString();
  addAuditLog(currentCase, 'Dictamen guardado');
  await dbPut(currentCase);
  showToast('Dictamen guardado.', 'success');
});

document.getElementById('btn-copy-dictamen').addEventListener('click', () => {
  const txt = document.getElementById('dictamen-texto').value;
  navigator.clipboard.writeText(txt).then(() => {
    showToast('Dictamen copiado al portapapeles.', 'success');
  }).catch(() => {
    showToast('No se pudo copiar. Selecciona el texto manualmente.', 'error');
  });
});

document.getElementById('btn-export-pdf').addEventListener('click', () => {
  if (!currentCase) return;
  const txt = document.getElementById('dictamen-texto').value;
  exportarPDF(txt, currentCase);
});

/* ============================================================
   11. TAB: HISTORIAL
   ============================================================ */

async function renderHistorial() {
  const lista   = document.getElementById('historial-lista');
  const allCasos = await dbGetAll();

  // Ordenar por fecha (más reciente primero)
  allCasos.sort((a, b) => (b.fechaCreado || '').localeCompare(a.fechaCreado || ''));

  const query = (document.getElementById('historial-search').value || '').toLowerCase();
  const filtrados = allCasos.filter(c =>
    !query ||
    c.id.toLowerCase().includes(query) ||
    (c.titulo || '').toLowerCase().includes(query)
  );

  if (filtrados.length === 0) {
    lista.innerHTML = `<div class="historial-empty"><p>${allCasos.length === 0 ? 'No hay casos guardados.' : 'No se encontraron casos con ese criterio.'}</p></div>`;
    return;
  }

  const table = document.createElement('table');
  table.className = 'historial-tabla';
  table.innerHTML = `
    <thead>
      <tr>
        <th>ID</th>
        <th>Título</th>
        <th>Tipo</th>
        <th>Evaluador</th>
        <th>Fecha</th>
        <th>Rec.</th>
        <th>Acciones</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');

  for (const c of filtrados) {
    const recom = c.recomendacion || '';
    const recomClass = recom === 'Favorable' ? 'text-verde'
                     : recom === 'No favorable' ? 'text-rojo'
                     : recom ? 'text-amber' : '';
    const fecha = c.fechaCreado ? new Date(c.fechaCreado).toLocaleDateString('es-ES') : '—';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${esc(c.id)}</strong></td>
      <td>${esc(c.titulo || '')}</td>
      <td>${esc(c.tipo || '')}</td>
      <td>${esc(c.evaluador || '')}</td>
      <td>${fecha}</td>
      <td class="${recomClass}">${esc(recom || '—')}</td>
      <td>
        <button class="btn-icon" title="Abrir / editar" onclick="abrirCaso('${esc(c.id)}')">✏ Editar</button>
        <button class="btn-icon" title="Duplicar" onclick="duplicarCaso('${esc(c.id)}')">⧉ Dup.</button>
        <button class="btn-icon" title="Exportar PDF" onclick="exportarCasoHistorial('${esc(c.id)}')">↓ PDF</button>
        <button class="btn-icon" title="Ver log" onclick="toggleAuditLog('${esc(c.id)}')">📋 Log</button>
        <button class="btn-icon" title="Eliminar" style="color:var(--rojo)" onclick="pedirEliminar('${esc(c.id)}')">✕</button>
      </td>
    `;
    // Audit log (oculto)
    const trLog = document.createElement('tr');
    trLog.id = 'audit-' + c.id;
    trLog.style.display = 'none';
    const logHtml = (c.auditLog || []).map(l =>
      `${new Date(l.ts).toLocaleString('es-ES')} — ${esc(l.accion)}`
    ).join('\n') || 'Sin registros.';
    trLog.innerHTML = `<td colspan="7"><div class="audit-log">${logHtml}</div></td>`;

    tbody.appendChild(tr);
    tbody.appendChild(trLog);
  }

  lista.innerHTML = '';
  lista.appendChild(table);
}

window.abrirCaso = async function(id) {
  const c = await dbGet(id);
  if (!c) { showToast('Caso no encontrado.', 'error'); return; }
  setCurrentCase(c);
  fillNuevoCasoForm(c);
  renderNuevoCaso();
  activateTab('tab-nuevo');
  showToast('Caso cargado: ' + c.id, 'info');
};

window.duplicarCaso = async function(id) {
  const orig = await dbGet(id);
  if (!orig) return;
  const newId = orig.id + '-copia-' + Date.now().toString().slice(-4);
  const copy = { ...JSON.parse(JSON.stringify(orig)), id: newId, fechaCreado: new Date().toISOString(), auditLog: [] };
  addAuditLog(copy, 'Duplicado desde ' + orig.id);
  await dbPut(copy);
  showToast('Caso duplicado como ' + newId, 'success');
  renderHistorial();
};

window.exportarCasoHistorial = async function(id) {
  const c = await dbGet(id);
  if (!c) return;
  const txt = c.dictamen || generarBorradorDictamen(c);
  exportarPDF(txt, c);
  addAuditLog(c, 'PDF exportado');
  await dbPut(c);
};

window.toggleAuditLog = function(id) {
  const row = document.getElementById('audit-' + id);
  if (row) row.style.display = row.style.display === 'none' ? '' : 'none';
};

window.pedirEliminar = function(id) {
  showModal(
    '¿Eliminar caso?',
    `Se eliminará permanentemente el caso "${id}". Esta acción no se puede deshacer.`,
    async () => {
      await dbDelete(id);
      if (currentCase && currentCase.id === id) setCurrentCase(null);
      renderHistorial();
      showToast('Caso eliminado.', 'info');
    }
  );
};

document.getElementById('historial-search').addEventListener('input', renderHistorial);
document.getElementById('btn-refresh-historial').addEventListener('click', renderHistorial);

/* ============================================================
   12. TAB: AJUSTES
   ============================================================ */

function renderAjustes() {
  const s = getSettings();
  document.getElementById('aj-nombre').value     = s.toolName;
  document.getElementById('aj-version').value    = s.version;
  document.getElementById('aj-autoria').value    = s.autoria;
  document.getElementById('aj-contacto').value   = s.contacto;
  document.getElementById('aj-disclaimer').value = s.disclaimer;
}

document.getElementById('form-ajustes').addEventListener('submit', (e) => {
  e.preventDefault();
  const s = {
    toolName:   document.getElementById('aj-nombre').value.trim() || DEFAULT_SETTINGS.toolName,
    version:    document.getElementById('aj-version').value.trim() || DEFAULT_SETTINGS.version,
    autoria:    document.getElementById('aj-autoria').value.trim(),
    contacto:   document.getElementById('aj-contacto').value.trim(),
    disclaimer: document.getElementById('aj-disclaimer').value.trim() || DEFAULT_SETTINGS.disclaimer,
  };
  saveSettings(s);
  applySettings();
  showToast('Ajustes guardados.', 'success');
});

document.getElementById('btn-reset-ajustes').addEventListener('click', () => {
  saveSettings(DEFAULT_SETTINGS);
  renderAjustes();
  applySettings();
  showToast('Ajustes restaurados.', 'info');
});

/* ============================================================
   13. EXPORTACIÓN PDF (jsPDF, client-side)
   ============================================================ */

function exportarPDF(texto, caso) {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const s   = getSettings();

    const marginL = 20;
    const marginR = 20;
    const pageW   = doc.internal.pageSize.getWidth();
    const pageH   = doc.internal.pageSize.getHeight();
    const usableW = pageW - marginL - marginR;
    let y = 20;

    // Función auxiliar para añadir texto con saltos de página automáticos
    function addText(txt, fontSize, bold, color, indent) {
      doc.setFontSize(fontSize || 10);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      if (color) doc.setTextColor(...color);
      else doc.setTextColor(30, 30, 30);
      const lines = doc.splitTextToSize(txt, usableW - (indent || 0));
      lines.forEach(line => {
        if (y + 6 > pageH - 20) {
          doc.addPage();
          y = 20;
          addHeaderFooter();
        }
        doc.text(line, marginL + (indent || 0), y);
        y += fontSize ? fontSize * 0.45 : 5;
      });
    }

    function addHeaderFooter() {
      // Encabezado de página
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.setFont('helvetica', 'italic');
      doc.text(`${s.toolName} ${s.version} · ${s.autoria}`, marginL, 12);
      doc.text(`${caso.id} — ${(caso.titulo || '').substring(0, 60)}`, pageW / 2, 12, { align: 'center' });
      const pg = doc.internal.getCurrentPageInfo().pageNumber;
      doc.text(`Pág. ${pg}`, pageW - marginR, 12, { align: 'right' });
      // Línea separadora
      doc.setDrawColor(37, 99, 168);
      doc.setLineWidth(0.5);
      doc.line(marginL, 14, pageW - marginR, 14);
    }

    // Primera página: encabezado visual
    doc.setFillColor(26, 58, 92);
    doc.rect(0, 0, pageW, 38, 'F');
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(s.toolName, marginL, 16);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Borrador de dictamen de evaluación ética', marginL, 24);
    doc.setFontSize(8);
    doc.text(`${s.autoria}${s.contacto ? ' · ' + s.contacto : ''}`, marginL, 32);
    doc.text(`${s.version}`, pageW - marginR, 32, { align: 'right' });

    y = 48;

    // Render del texto del dictamen línea a línea
    const lineas = texto.split('\n');
    for (const linea of lineas) {
      if (y + 6 > pageH - 22) { doc.addPage(); y = 20; addHeaderFooter(); }
      // Detectar líneas de título (═══)
      if (/^[═─]/.test(linea)) {
        doc.setDrawColor(37, 99, 168);
        doc.setLineWidth(0.3);
        doc.line(marginL, y, pageW - marginR, y);
        y += 3;
        continue;
      }
      // Línea en mayúsculas → encabezado de sección
      const isTitleLine = linea.trim().length > 0 && linea.trim() === linea.trim().toUpperCase() && linea.trim().length > 4;
      if (isTitleLine && !/^\d/.test(linea.trim())) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(26, 58, 92);
        const wrapped = doc.splitTextToSize(linea, usableW);
        wrapped.forEach(l => { doc.text(l, marginL, y); y += 5; });
      } else if (linea.trim() === '') {
        y += 3;
      } else {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 30, 30);
        const wrapped = doc.splitTextToSize(linea, usableW);
        wrapped.forEach(l => { doc.text(l, marginL, y); y += 4.5; });
      }
    }

    // Página final: disclaimer
    if (y + 30 > pageH - 20) { doc.addPage(); y = 20; addHeaderFooter(); }
    y += 8;
    doc.setFillColor(240, 244, 248);
    const discLines = doc.splitTextToSize(s.disclaimer, usableW - 8);
    const discH = discLines.length * 4.5 + 10;
    doc.roundedRect(marginL, y, usableW, discH, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(80, 80, 80);
    discLines.forEach(l => { y += 4.5; doc.text(l, marginL + 4, y); });

    // Nombre de fichero seguro
    const safeId = (caso.id || 'dictamen').replace(/[^a-zA-Z0-9_\-]/g, '_');
    doc.save(`dictamen_${safeId}.pdf`);
    showToast('PDF exportado correctamente.', 'success');
  } catch (err) {
    console.error('Error al exportar PDF:', err);
    showToast('Error al generar el PDF. Asegúrate de que jsPDF está disponible.', 'error');
  }
}

/* ============================================================
   14. MODAL + TOAST
   ============================================================ */

let _modalCallback = null;

function showModal(title, msg, onConfirm) {
  document.getElementById('modal-title').textContent   = title;
  document.getElementById('modal-message').textContent = msg;
  document.getElementById('modal-overlay').style.display = '';
  _modalCallback = onConfirm;
}

document.getElementById('modal-confirm').addEventListener('click', () => {
  document.getElementById('modal-overlay').style.display = 'none';
  if (typeof _modalCallback === 'function') _modalCallback();
  _modalCallback = null;
});

document.getElementById('modal-cancel').addEventListener('click', () => {
  document.getElementById('modal-overlay').style.display = 'none';
  _modalCallback = null;
});

let _toastTimer = null;
function showToast(msg, type = 'info', duration = 3500) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className   = `toast ${type}`;
  toast.style.display = '';
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { toast.style.display = 'none'; }, duration);
}

/* ============================================================
   15. UTILIDADES
   ============================================================ */

// Escapa HTML para prevenir XSS en innerHTML
function esc(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ============================================================
   16. ARRANQUE
   ============================================================ */

async function init() {
  try {
    await openDB();
  } catch (err) {
    showToast('Error al inicializar la base de datos. Comprueba los permisos de tu navegador.', 'error', 8000);
    console.error('IndexedDB error:', err);
  }

  applySettings();
  renderNuevoCaso();

  // Activar tab inicial
  activateTab('tab-nuevo');
}

init();
