// ============================================
// BITÁCORA — app.js
// ============================================

const SUPABASE_URL = 'https://xklnpwocvcnpyepnlsno.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_MJHMg_CeeQGJMkI5JFfkXQ_CAQA84VB';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- Utilidades ----------
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

function fmtFecha(iso) {
  const d = new Date(iso);
  return d.toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function esc(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

document.getElementById('headerDate').textContent =
  new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

// Comprime una foto de cámara (que puede pesar varios MB) antes de subirla,
// para que la subida sea rápida y confiable incluso en redes lentas.
function comprimirImagen(file, maxAncho = 1600, calidad = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.onerror = reject;
    img.onload = () => {
      let { width, height } = img;
      if (width > maxAncho) {
        height = Math.round((height * maxAncho) / width);
        width = maxAncho;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('No se pudo comprimir la imagen')); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }));
        },
        'image/jpeg',
        calidad
      );
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================
// NAVEGACIÓN ENTRE PESTAÑAS
// ============================================
const panels = {
  recordatorios: document.getElementById('tab-recordatorios'),
  evidencias: document.getElementById('tab-evidencias'),
  tutoriales: document.getElementById('tab-tutoriales'),
  voz: document.getElementById('tab-voz'),
};

let activeTab = 'recordatorios';

function setActiveTab(tab) {
  activeTab = tab;
  Object.entries(panels).forEach(([k, el]) => { el.style.display = k === tab ? '' : 'none'; });
  document.querySelectorAll('.tab-bar__item, .tab-rail__item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  loadTab(tab);
}

document.querySelectorAll('.tab-bar__item, .tab-rail__item').forEach((btn) => {
  btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
});

function loadTab(tab) {
  if (tab === 'recordatorios') cargarRecordatorios();
  if (tab === 'evidencias') cargarEvidencias();
  if (tab === 'tutoriales') cargarTutoriales();
  if (tab === 'voz') cargarNotasVoz();
}

// ============================================
// FAB — abre el formulario según la pestaña activa
// ============================================
document.getElementById('fabAdd').addEventListener('click', () => {
  if (activeTab === 'recordatorios') abrirNuevoRecordatorio();
  if (activeTab === 'evidencias') abrirNuevaEvidencia();
  if (activeTab === 'tutoriales') abrirNuevoTutorial();
  if (activeTab === 'voz') toast('Usa el botón de grabar 🎙️');
});

function openSheet(name) {
  document.getElementById('backdrop' + name).classList.add('open');
  document.getElementById('sheet' + name).classList.add('open');
}
function closeSheet(name) {
  document.getElementById('backdrop' + name).classList.remove('open');
  document.getElementById('sheet' + name).classList.remove('open');
}
['Recordatorio', 'Evidencia', 'Tutorial', 'VerTutorial'].forEach((name) => {
  const backdrop = document.getElementById('backdrop' + name);
  if (backdrop) backdrop.addEventListener('click', () => closeSheet(name));
});

// segmented controls genéricos
document.querySelectorAll('.segmented').forEach((group) => {
  group.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') return;
    [...group.children].forEach((b) => b.classList.remove('active'));
    e.target.classList.add('active');
  });
});
function segVal(id) {
  const active = document.querySelector('#' + id + ' .active');
  return active ? active.dataset.val : null;
}

// ============================================
// RECORDATORIOS
// ============================================
document.getElementById('cancelarRecordatorio').addEventListener('click', () => { editandoRecordatorioId = null; closeSheet('Recordatorio'); });

document.getElementById('rRecurrente').addEventListener('change', (e) => {
  document.getElementById('rRecurrenciaWrap').style.display = e.target.checked ? '' : 'none';
});

let editandoRecordatorioId = null;

function setSegVal(groupId, val) {
  const group = document.getElementById(groupId);
  if (!group) return;
  [...group.children].forEach((b) => b.classList.toggle('active', b.dataset.val === val));
}

function abrirNuevoRecordatorio() {
  editandoRecordatorioId = null;
  clearRecordatorioForm();
  document.querySelector('#sheetRecordatorio .sheet__title').textContent = '// Nuevo recordatorio';
  document.getElementById('guardarRecordatorio').textContent = 'Guardar recordatorio';
  openSheet('Recordatorio');
}

async function editarRecordatorio(id) {
  const { data: r, error } = await sb.from('recordatorios').select('*').eq('id', id).single();
  if (error || !r) { toast('No se pudo cargar el recordatorio'); return; }

  editandoRecordatorioId = id;
  document.getElementById('rTitulo').value = r.titulo || '';
  document.getElementById('rDescripcion').value = r.descripcion || '';
  document.getElementById('rFecha').value = toLocalDatetimeInput(r.fecha_hora);
  setSegVal('rPrioridad', r.prioridad);
  setSegVal('rCategoria', r.categoria);
  document.getElementById('rRecurrente').checked = !!r.recurrente;
  document.getElementById('rRecurrenciaWrap').style.display = r.recurrente ? '' : 'none';
  if (r.tipo_recurrencia) setSegVal('rRecurrencia', r.tipo_recurrencia);

  document.querySelector('#sheetRecordatorio .sheet__title').textContent = '// Editar recordatorio';
  document.getElementById('guardarRecordatorio').textContent = 'Guardar cambios';
  openSheet('Recordatorio');
}

function toLocalDatetimeInput(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

document.getElementById('guardarRecordatorio').addEventListener('click', async () => {
  const titulo = document.getElementById('rTitulo').value.trim();
  const fecha = document.getElementById('rFecha').value;
  if (!titulo || !fecha) { toast('Falta título o fecha'); return; }

  const recurrente = document.getElementById('rRecurrente').checked;
  const payload = {
    titulo,
    descripcion: document.getElementById('rDescripcion').value.trim() || null,
    fecha_hora: new Date(fecha).toISOString(),
    prioridad: segVal('rPrioridad'),
    categoria: segVal('rCategoria'),
    recurrente,
    tipo_recurrencia: recurrente ? segVal('rRecurrencia') : null,
  };

  const { error } = editandoRecordatorioId
    ? await sb.from('recordatorios').update(payload).eq('id', editandoRecordatorioId)
    : await sb.from('recordatorios').insert(payload);
  if (error) { console.error(error); toast('Error al guardar'); return; }

  toast(editandoRecordatorioId ? 'Recordatorio actualizado ✓' : 'Recordatorio guardado ✓');
  editandoRecordatorioId = null;
  closeSheet('Recordatorio');
  clearRecordatorioForm();
  cargarRecordatorios();
});

function clearRecordatorioForm() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  set('rTitulo', '');
  set('rDescripcion', '');
  set('rFecha', '');
  const chk = document.getElementById('rRecurrente');
  if (chk) chk.checked = false;
  const wrap = document.getElementById('rRecurrenciaWrap');
  if (wrap) wrap.style.display = 'none';
}

async function cargarRecordatorios() {
  const cont = document.getElementById('listaRecordatorios');
  cont.innerHTML = '<div class="empty-state">Cargando...</div>';

  const { data, error } = await sb.from('recordatorios')
    .select('*')
    .order('completado', { ascending: true })
    .order('fecha_hora', { ascending: true });

  if (error) { cont.innerHTML = '<div class="empty-state">Error al cargar</div>'; console.error(error); return; }

  if (!data || data.length === 0) {
    cont.innerHTML = `<div class="empty-state"><div class="empty-state__icon">📌</div><div class="empty-state__text">Sin recordatorios todavía</div></div>`;
    return;
  }

  const ahora = new Date();
  cont.innerHTML = data.map((r) => {
    const vencido = !r.completado && new Date(r.fecha_hora) < ahora;
    return `
    <div class="card ${r.completado ? 'card--done' : ''} ${r.categoria === 'trienergy' ? 'card--trienergy' : ''}">
      <div class="card__top">
        <div>
          <div class="card__title"><span class="priority-dot priority-${r.prioridad}"></span>${esc(r.titulo)}</div>
          <div class="card__meta">${fmtFecha(r.fecha_hora)} ${vencido ? '· <span style="color:var(--danger)">VENCIDO</span>' : ''} ${r.recurrente ? '· 🔁 ' + r.tipo_recurrencia : ''}</div>
        </div>
        <span class="card__tag">${r.categoria}</span>
      </div>
      ${r.descripcion ? `<div class="card__desc">${esc(r.descripcion)}</div>` : ''}
      <div class="card__actions">
        <button onclick="toggleCompletado('${r.id}', ${!r.completado})">${r.completado ? '↺ Reabrir' : '✓ Marcar hecho'}</button>
        <button onclick="editarRecordatorio('${r.id}')">✏️ Editar</button>
        <button class="danger" onclick="eliminarRecordatorio('${r.id}')">🗑 Eliminar</button>
      </div>
    </div>`;
  }).join('');
}

async function toggleCompletado(id, val) {
  await sb.from('recordatorios').update({ completado: val }).eq('id', id);
  cargarRecordatorios();
}

async function eliminarRecordatorio(id) {
  if (!confirm('¿Eliminar este recordatorio?')) return;
  await sb.from('recordatorios').delete().eq('id', id);
  toast('Eliminado');
  cargarRecordatorios();
}

// ============================================
// EVIDENCIAS
// ============================================
let evidenciaFile = null;
let editandoEvidenciaId = null;
let evidenciaFotoUrlExistente = null;

function abrirNuevaEvidencia() {
  editandoEvidenciaId = null;
  evidenciaFotoUrlExistente = null;
  clearEvidenciaForm();
  document.querySelector('#sheetEvidencia .sheet__title').textContent = '// Nueva evidencia';
  document.getElementById('guardarEvidencia').textContent = 'Guardar evidencia';
  openSheet('Evidencia');
}

async function editarEvidencia(id) {
  const { data: ev, error } = await sb.from('evidencias').select('*').eq('id', id).single();
  if (error || !ev) { toast('No se pudo cargar la evidencia'); return; }

  editandoEvidenciaId = id;
  evidenciaFotoUrlExistente = ev.foto_url;
  evidenciaFile = null;

  document.getElementById('eTitulo').value = ev.titulo || '';
  document.getElementById('eNota').value = ev.nota || '';
  document.getElementById('eEtiqueta').value = ev.etiqueta || '';
  setSegVal('eCategoria', ev.categoria);

  const preview = document.getElementById('ePreview');
  preview.src = ev.foto_url;
  preview.style.display = 'block';
  document.getElementById('captureLabelText').textContent = '📷 Cambiar foto';

  document.querySelector('#sheetEvidencia .sheet__title').textContent = '// Editar evidencia';
  document.getElementById('guardarEvidencia').textContent = 'Guardar cambios';
  openSheet('Evidencia');
}

document.getElementById('eFoto').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  evidenciaFile = file;
  const preview = document.getElementById('ePreview');
  preview.src = URL.createObjectURL(file);
  preview.style.display = 'block';
  document.getElementById('captureLabelText').textContent = '📷 Cambiar foto';
});

document.getElementById('cancelarEvidencia').addEventListener('click', () => { editandoEvidenciaId = null; evidenciaFotoUrlExistente = null; closeSheet('Evidencia'); });

document.getElementById('guardarEvidencia').addEventListener('click', async () => {
  if (!evidenciaFile && !evidenciaFotoUrlExistente) { toast('Toma una foto primero'); return; }

  const btn = document.getElementById('guardarEvidencia');
  btn.disabled = true;

  try {
    let foto_url = evidenciaFotoUrlExistente;

    if (evidenciaFile) {
      btn.textContent = 'Comprimiendo foto...';
      const fotoComprimida = await comprimirImagen(evidenciaFile);
      btn.textContent = 'Subiendo...';
      const path = `evidencias/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`;
      const { error: upErr } = await sb.storage.from('evidencias').upload(path, fotoComprimida, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
      });
      if (upErr) throw upErr;
      const { data: pub } = sb.storage.from('evidencias').getPublicUrl(path);
      foto_url = pub.publicUrl;
    }

    const payload = {
      titulo: document.getElementById('eTitulo').value.trim() || null,
      nota: document.getElementById('eNota').value.trim() || null,
      etiqueta: document.getElementById('eEtiqueta').value.trim() || null,
      categoria: segVal('eCategoria'),
      foto_url,
    };

    const { error } = editandoEvidenciaId
      ? await sb.from('evidencias').update(payload).eq('id', editandoEvidenciaId)
      : await sb.from('evidencias').insert(payload);
    if (error) throw error;

    toast(editandoEvidenciaId ? 'Evidencia actualizada ✓' : 'Evidencia guardada ✓');
    editandoEvidenciaId = null;
    evidenciaFotoUrlExistente = null;
    closeSheet('Evidencia');
    clearEvidenciaForm();
    cargarEvidencias();
  } catch (err) {
    console.error('Error al guardar evidencia:', err);
    toast('Error: ' + (err.message || 'no se pudo guardar. Revisa tu conexión.'));
  } finally {
    btn.textContent = editandoEvidenciaId ? 'Guardar cambios' : 'Guardar evidencia';
    btn.disabled = false;
  }
});

function clearEvidenciaForm() {
  evidenciaFile = null;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  set('eTitulo', '');
  set('eNota', '');
  set('eEtiqueta', '');
  const preview = document.getElementById('ePreview');
  if (preview) preview.style.display = 'none';
  const label = document.getElementById('captureLabelText');
  if (label) label.textContent = '📷 Toca para tomar foto';
  set('eFoto', '');
}

async function cargarEvidencias() {
  const cont = document.getElementById('listaEvidencias');
  cont.innerHTML = '<div class="empty-state">Cargando...</div>';

  const { data, error } = await sb.from('evidencias').select('*').order('created_at', { ascending: false });
  if (error) { cont.innerHTML = '<div class="empty-state">Error al cargar</div>'; console.error(error); return; }

  if (!data || data.length === 0) {
    cont.innerHTML = `<div class="empty-state"><div class="empty-state__icon">📷</div><div class="empty-state__text">Sin evidencias todavía</div></div>`;
    return;
  }

  cont.innerHTML = data.map((e) => `
    <div class="card ${e.categoria === 'trienergy' ? 'card--trienergy' : ''}">
      <div class="card__top">
        <div>
          <div class="card__title">${esc(e.titulo) || 'Sin título'}</div>
          <div class="card__meta">${fmtFecha(e.created_at)}</div>
        </div>
        ${e.etiqueta ? `<span class="card__tag">${esc(e.etiqueta)}</span>` : ''}
      </div>
      ${e.nota ? `<div class="card__desc">${esc(e.nota)}</div>` : ''}
      <img class="card__photo" src="${e.foto_url}" loading="lazy" />
      <div class="card__actions">
        <button onclick="editarEvidencia('${e.id}')">✏️ Editar</button>
        <button class="danger" onclick="eliminarEvidencia('${e.id}')">🗑 Eliminar</button>
      </div>
    </div>
  `).join('');
}

async function eliminarEvidencia(id) {
  if (!confirm('¿Eliminar esta evidencia?')) return;
  await sb.from('evidencias').delete().eq('id', id);
  toast('Eliminada');
  cargarEvidencias();
}

// ============================================
// TUTORIALES
// ============================================
let pasosTemp = [];
let editandoTutorialId = null;

function abrirNuevoTutorial() {
  editandoTutorialId = null;
  openTutorialSheet();
  document.querySelector('#sheetTutorial .sheet__title').textContent = '// Nuevo tutorial';
  document.getElementById('guardarTutorial').textContent = 'Guardar tutorial';
}

async function editarTutorial(id) {
  const { data: tut, error: e1 } = await sb.from('tutoriales').select('*').eq('id', id).single();
  const { data: pasos, error: e2 } = await sb.from('pasos_tutorial').select('*').eq('tutorial_id', id).order('numero_paso');
  if (e1 || e2 || !tut) { toast('No se pudo cargar el tutorial'); return; }

  editandoTutorialId = id;
  document.getElementById('tTitulo').value = tut.titulo || '';
  document.getElementById('tDescripcion').value = tut.descripcion || '';
  setSegVal('tCategoria', tut.categoria);

  pasosTemp = (pasos || []).map((p) => ({ descripcion: p.descripcion, file: null, foto_url: p.foto_url }));
  if (pasosTemp.length === 0) pasosTemp.push({ descripcion: '', file: null, foto_url: null });
  renderPasosForm();

  document.querySelector('#sheetTutorial .sheet__title').textContent = '// Editar tutorial';
  document.getElementById('guardarTutorial').textContent = 'Guardar cambios';
  openSheet('Tutorial');
}

function openTutorialSheet() {
  pasosTemp = [];
  document.getElementById('tTitulo').value = '';
  document.getElementById('tDescripcion').value = '';
  renderPasosForm();
  agregarPasoForm();
  openSheet('Tutorial');
}

document.getElementById('cancelarTutorial').addEventListener('click', () => { editandoTutorialId = null; closeSheet('Tutorial'); });
document.getElementById('btnAgregarPaso').addEventListener('click', agregarPasoForm);

function agregarPasoForm() {
  pasosTemp.push({ descripcion: '', file: null });
  renderPasosForm();
}

function renderPasosForm() {
  const cont = document.getElementById('pasosContainer');
  cont.innerHTML = pasosTemp.map((p, i) => `
    <div class="step-item">
      <div class="step-number">${i + 1}.</div>
      <div class="step-body">
        <textarea placeholder="Describe este paso..." data-idx="${i}" class="paso-desc" style="width:100%;border:1.5px solid var(--kraft-border);border-radius:3px;padding:8px;font-size:13px;min-height:44px;">${esc(p.descripcion)}</textarea>
        ${p.foto_url && !p.file ? `<img src="${p.foto_url}" class="step-photo" style="max-width:120px;" />` : ''}
        <label class="capture-btn" style="padding:10px;font-size:11px;margin-top:6px;">
          ${p.file ? '📷 Foto nueva añadida ✓' : (p.foto_url ? '📷 Cambiar foto' : '📷 Añadir foto (opcional)')}
          <input type="file" accept="image/*" capture="environment" style="display:none;" class="paso-foto" data-idx="${i}" />
        </label>
        ${pasosTemp.length > 1 ? `<button type="button" class="btn btn--ghost" data-idx="${i}" style="margin-top:6px;padding:6px 10px;font-size:11px;" onclick="eliminarPasoForm(${i})">✕ Quitar este paso</button>` : ''}
      </div>
    </div>
  `).join('');

  cont.querySelectorAll('.paso-desc').forEach((el) => {
    el.addEventListener('input', (e) => { pasosTemp[e.target.dataset.idx].descripcion = e.target.value; });
  });
  cont.querySelectorAll('.paso-foto').forEach((el) => {
    el.addEventListener('change', (e) => {
      const idx = e.target.dataset.idx;
      pasosTemp[idx].file = e.target.files[0];
      renderPasosForm();
    });
  });
}

function eliminarPasoForm(idx) {
  pasosTemp.splice(idx, 1);
  renderPasosForm();
}

document.getElementById('guardarTutorial').addEventListener('click', async () => {
  const titulo = document.getElementById('tTitulo').value.trim();
  if (!titulo) { toast('Falta el título'); return; }
  if (pasosTemp.length === 0 || !pasosTemp.some(p => p.descripcion.trim())) {
    toast('Agrega al menos un paso'); return;
  }

  const btn = document.getElementById('guardarTutorial');
  btn.textContent = 'Guardando...';
  btn.disabled = true;

  try {
    let tutorialId = editandoTutorialId;

    if (editandoTutorialId) {
      const { error: updErr } = await sb.from('tutoriales').update({
        titulo,
        descripcion: document.getElementById('tDescripcion').value.trim() || null,
        categoria: segVal('tCategoria'),
        updated_at: new Date().toISOString(),
      }).eq('id', editandoTutorialId);
      if (updErr) throw updErr;

      // Reemplazamos todos los pasos: más simple y confiable que hacer un diff.
      const { error: delErr } = await sb.from('pasos_tutorial').delete().eq('tutorial_id', editandoTutorialId);
      if (delErr) throw delErr;
    } else {
      const { data: tut, error: tutErr } = await sb.from('tutoriales').insert({
        titulo,
        descripcion: document.getElementById('tDescripcion').value.trim() || null,
        categoria: segVal('tCategoria'),
      }).select().single();
      if (tutErr) throw tutErr;
      tutorialId = tut.id;
    }

    let numero = 1;
    for (const paso of pasosTemp) {
      if (!paso.descripcion.trim()) continue;
      let foto_url = paso.foto_url || null;
      if (paso.file) {
        const fotoComprimida = await comprimirImagen(paso.file);
        const path = `tutoriales/${tutorialId}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`;
        const { error: upErr } = await sb.storage.from('tutoriales').upload(path, fotoComprimida, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
        });
        if (!upErr) {
          const { data: pub } = sb.storage.from('tutoriales').getPublicUrl(path);
          foto_url = pub.publicUrl;
        } else {
          console.error('Error subiendo foto del paso:', upErr);
        }
      }
      await sb.from('pasos_tutorial').insert({
        tutorial_id: tutorialId,
        numero_paso: numero++,
        descripcion: paso.descripcion.trim(),
        foto_url,
      });
    }

    toast(editandoTutorialId ? 'Tutorial actualizado ✓' : 'Tutorial guardado ✓');
    editandoTutorialId = null;
    closeSheet('Tutorial');
    cargarTutoriales();
  } catch (err) {
    console.error(err);
    toast('Error al guardar tutorial');
  } finally {
    btn.textContent = 'Guardar tutorial';
    btn.disabled = false;
  }
});

async function cargarTutoriales() {
  const cont = document.getElementById('listaTutoriales');
  cont.innerHTML = '<div class="empty-state">Cargando...</div>';

  const { data, error } = await sb.from('tutoriales').select('*').order('created_at', { ascending: false });
  if (error) { cont.innerHTML = '<div class="empty-state">Error al cargar</div>'; console.error(error); return; }

  if (!data || data.length === 0) {
    cont.innerHTML = `<div class="empty-state"><div class="empty-state__icon">📖</div><div class="empty-state__text">Sin tutoriales todavía</div></div>`;
    return;
  }

  cont.innerHTML = data.map((t) => `
    <div class="card ${t.categoria === 'trienergy' ? 'card--trienergy' : ''}">
      <div class="card__top">
        <div>
          <div class="card__title">${esc(t.titulo)}</div>
          <div class="card__meta">${fmtFecha(t.created_at)}</div>
        </div>
        <span class="card__tag">${t.categoria}</span>
      </div>
      ${t.descripcion ? `<div class="card__desc">${esc(t.descripcion)}</div>` : ''}
      <div class="card__actions">
        <button onclick="verTutorial('${t.id}')">👁 Ver pasos</button>
        <button onclick="editarTutorial('${t.id}')">✏️ Editar</button>
        <button class="danger" onclick="eliminarTutorial('${t.id}')">🗑 Eliminar</button>
      </div>
    </div>
  `).join('');
}

async function eliminarTutorial(id) {
  if (!confirm('¿Eliminar este tutorial y todos sus pasos?')) return;
  await sb.from('tutoriales').delete().eq('id', id);
  toast('Eliminado');
  cargarTutoriales();
}

let tutorialActivo = null;

async function verTutorial(id) {
  const { data: tut } = await sb.from('tutoriales').select('*').eq('id', id).single();
  const { data: pasos } = await sb.from('pasos_tutorial').select('*').eq('tutorial_id', id).order('numero_paso');

  tutorialActivo = { ...tut, pasos: pasos || [] };

  document.getElementById('verTutorialTitulo').textContent = '// ' + tut.titulo;
  document.getElementById('verTutorialDesc').textContent = tut.descripcion || '';
  document.getElementById('verTutorialPasos').innerHTML = (pasos || []).map((p) => `
    <div class="step-item">
      <div class="step-number">${p.numero_paso}.</div>
      <div class="step-body">
        <div>${esc(p.descripcion)}</div>
        ${p.foto_url ? `<img class="step-photo" src="${p.foto_url}" loading="lazy" />` : ''}
      </div>
    </div>
  `).join('');

  openSheet('VerTutorial');
}

document.getElementById('cerrarVerTutorial').addEventListener('click', () => closeSheet('VerTutorial'));

document.getElementById('exportarTutorialPDF').addEventListener('click', async () => {
  if (!tutorialActivo) return;
  const btn = document.getElementById('exportarTutorialPDF');
  btn.textContent = 'Generando...';
  btn.disabled = true;

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(16);
    doc.text(tutorialActivo.titulo, 15, y);
    y += 8;

    if (tutorialActivo.descripcion) {
      doc.setFontSize(10);
      const desc = doc.splitTextToSize(tutorialActivo.descripcion, 180);
      doc.text(desc, 15, y);
      y += desc.length * 5 + 6;
    }

    for (const paso of tutorialActivo.pasos) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(`Paso ${paso.numero_paso}`, 15, y);
      y += 6;
      doc.setFont(undefined, 'normal');
      doc.setFontSize(10);
      const texto = doc.splitTextToSize(paso.descripcion, 180);
      doc.text(texto, 15, y);
      y += texto.length * 5 + 4;

      if (paso.foto_url) {
        try {
          const imgData = await urlToDataUrl(paso.foto_url);
          if (y > 180) { doc.addPage(); y = 20; }
          doc.addImage(imgData, 'JPEG', 15, y, 80, 60);
          y += 65;
        } catch (e) { /* si falla la imagen, seguimos sin ella */ }
      }
      y += 4;
    }

    doc.save(`${tutorialActivo.titulo.replace(/[^a-z0-9]/gi, '_')}.pdf`);
    toast('PDF descargado ✓');
  } catch (err) {
    console.error(err);
    toast('Error al generar PDF');
  } finally {
    btn.textContent = 'Descargar como PDF';
    btn.disabled = false;
  }
});

function urlToDataUrl(url) {
  return new Promise((resolve, reject) => {
    fetch(url)
      .then((res) => res.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      })
      .catch(reject);
  });
}

// ============================================
// NOTAS DE VOZ
// ============================================
let mediaRecorder = null;
let audioChunks = [];
let recording = false;
let recordStartTime = null;

document.getElementById('btnGrabar').addEventListener('click', async () => {
  if (!recording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
      mediaRecorder.onstop = handleRecordingStop;
      mediaRecorder.start();
      recording = true;
      recordStartTime = Date.now();
      document.getElementById('btnGrabar').classList.add('recording');
      document.getElementById('btnGrabar').textContent = '■';
      document.getElementById('estadoGrabacion').textContent = 'Grabando... toca para detener';
    } catch (err) {
      console.error(err);
      toast('No se pudo acceder al micrófono');
    }
  } else {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach((t) => t.stop());
    recording = false;
    document.getElementById('btnGrabar').classList.remove('recording');
    document.getElementById('btnGrabar').textContent = '●';
    document.getElementById('estadoGrabacion').textContent = 'Subiendo...';
  }
});

async function handleRecordingStop() {
  const duracion = Math.round((Date.now() - recordStartTime) / 1000);
  const blob = new Blob(audioChunks, { type: 'audio/webm' });
  const file = new File([blob], `nota_${Date.now()}.webm`, { type: 'audio/webm' });

  try {
    const path = `notas-voz/${file.name}`;
    const { error: upErr } = await sb.storage.from('notas-voz').upload(path, file);
    if (upErr) throw upErr;

    const { data: pub } = sb.storage.from('notas-voz').getPublicUrl(path);

    await sb.from('notas_voz').insert({
      titulo: `Nota de voz - ${new Date().toLocaleString('es-CO')}`,
      audio_url: pub.publicUrl,
      duracion_seg: duracion,
    });

    toast('Nota de voz guardada ✓');
    document.getElementById('estadoGrabacion').textContent = 'Toca para grabar';
    cargarNotasVoz();
  } catch (err) {
    console.error(err);
    toast('Error al guardar audio');
    document.getElementById('estadoGrabacion').textContent = 'Toca para grabar';
  }
}

async function cargarNotasVoz() {
  const cont = document.getElementById('listaNotasVoz');
  cont.innerHTML = '<div class="empty-state">Cargando...</div>';

  const { data, error } = await sb.from('notas_voz').select('*').order('created_at', { ascending: false });
  if (error) { cont.innerHTML = '<div class="empty-state">Error al cargar</div>'; console.error(error); return; }

  if (!data || data.length === 0) {
    cont.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🎙️</div><div class="empty-state__text">Sin notas de voz todavía</div></div>`;
    return;
  }

  cont.innerHTML = data.map((n) => `
    <div class="card">
      <div class="card__top">
        <div>
          <div class="card__title">${esc(n.titulo)}</div>
          <div class="card__meta">${fmtFecha(n.created_at)} · ${n.duracion_seg || 0}s</div>
        </div>
      </div>
      <audio controls src="${n.audio_url}" style="width:100%;margin-top:8px;"></audio>
      <div class="card__actions">
        <button class="danger" onclick="eliminarNotaVoz('${n.id}')">🗑 Eliminar</button>
      </div>
    </div>
  `).join('');
}

async function eliminarNotaVoz(id) {
  if (!confirm('¿Eliminar esta nota de voz?')) return;
  await sb.from('notas_voz').delete().eq('id', id);
  toast('Eliminada');
  cargarNotasVoz();
}

// ============================================
// BANNER DE RECORDATORIOS VENCIDOS/PENDIENTES HOY
// ============================================
async function chequearPendientes() {
  const finDia = new Date(); finDia.setHours(23, 59, 59, 999);

  const { data } = await sb.from('recordatorios')
    .select('id')
    .eq('completado', false)
    .lte('fecha_hora', finDia.toISOString());

  const host = document.getElementById('pendingBannerRecordatorios');
  if (data && data.length > 0) {
    host.innerHTML = `<div class="pending-banner">⚠️ Tienes ${data.length} recordatorio(s) vencido(s) o para hoy</div>`;
  } else {
    host.innerHTML = '';
  }
}

// ============================================
// INICIO
// ============================================
cargarRecordatorios();
chequearPendientes();
