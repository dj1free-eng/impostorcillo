
(() => {
  'use strict';
  // Consola interna
function log(msg) {
  try {
    const panel = document.getElementById('internalConsole');
    if (panel) {
      const time = new Date().toISOString().slice(11,19);
      panel.innerHTML += "[" + time + "] " + msg + "<br>";
      panel.scrollTop = panel.scrollHeight;
    }
  } catch (e) {}
  console.log(msg);
}

window.log = log;

// Activar / desactivar consola
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("consoleToggle");
  const panel = document.getElementById("internalConsole");

  if (toggle) {
    toggle.addEventListener("click", () => {
      panel.style.display = panel.style.display === "none" ? "block" : "none";
    });
  }
});
log(">>> app.js INICIADO <<<");
  // ----- Helpers -----
  const STORAGE_KEY = 'ecoApp_v11c_state';

  let state = {
    ingresosBase: { juan: 0, saray: 0, otros: 0 },
    fijos: [],              // {id, nombre, importe}
    sobres: [],             // {id, nombre, presupuesto}
    huchas: [],             // {id, nombre, objetivo, saldo}
    ingresosPuntuales: [],  // {id, fecha, desc, importe}
    gastos: [],             // {id, fecha, categoria, desc, importe}
    notasPorMes: {}         // { 'YYYY-MM': 'texto' }
  };
  const monthNames = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
  ];

  let currentYear, currentMonth; // month 0-11

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Error guardando estado', e);
      showToast('No se pudo guardar en este dispositivo.');
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed) {
          state = Object.assign(state, parsed);
        }
      }
    } catch (e) {
      console.error('Error leyendo estado', e);
    }  
  }

  function monthKey(year, month) {
    return year + '-' + String(month + 1).padStart(2, '0');
  }

  function parseDateToYm(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d)) return null;
    return { y: d.getFullYear(), m: d.getMonth() };
  }

  function getCurrentMonthKey() {
    return monthKey(currentYear, currentMonth);
  }

  function formatCurrency(value) {
    const v = Number(value) || 0;
    return v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
  }

  function showToast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2200);
  }

  // ----- Modal confirmación -----
  let pendingConfirm = null;
  function openConfirm(message, onOk) {
    const overlay = document.getElementById('confirmModal');
    const msgEl = document.getElementById('confirmMessage');
    if (!overlay || !msgEl) return;
    msgEl.textContent = message || '¿Seguro que quieres eliminar este elemento?';
    pendingConfirm = typeof onOk === 'function' ? onOk : null;
    overlay.classList.add('active');
  }
  function closeConfirm() {
    const overlay = document.getElementById('confirmModal');
    if (overlay) overlay.classList.remove('active');
    pendingConfirm = null;
  }

  // ----- Navegación por meses -----
  function updateMonthDisplay() {
    const span = document.getElementById('monthDisplay');
    if (!span) return;
    span.textContent = monthNames[currentMonth] + ' ' + currentYear;
    const pickerYear = document.getElementById('pickerYear');
    if (pickerYear) pickerYear.textContent = currentYear;
    const mk = getCurrentMonthKey();
    const monthsGrid = document.getElementById('monthsGrid');
    if (monthsGrid) {
      monthsGrid.querySelectorAll('.month-btn').forEach((btn, idx) => {
        const btnKey = monthKey(currentYear, idx);
        btn.classList.toggle('selected', btnKey === mk);
      });
    }
  }

  function changeMonth(diff) {
    currentMonth += diff;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear -= 1;
    } else if (currentMonth > 11) {
      currentMonth = 0;
      currentYear += 1;
    }
    updateMonthDisplay();
    renderAll();
  }

  function setupMonthPicker() {
    const dropdown = document.getElementById('monthPickerDropdown');
    const display = document.getElementById('monthDisplay');
    const monthsGrid = document.getElementById('monthsGrid');
    const yearPrev = document.getElementById('yearPrev');
    const yearNext = document.getElementById('yearNext');

    if (!dropdown || !display || !monthsGrid || !yearPrev || !yearNext) return;

    // construir botones meses
    monthsGrid.innerHTML = '';
    monthNames.forEach((name, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'month-btn';
      btn.textContent = name.slice(0, 3);
      btn.dataset.monthIndex = String(idx);
      monthsGrid.appendChild(btn);
    });

    display.addEventListener('click', () => {
      dropdown.classList.toggle('active');
    });

    yearPrev.addEventListener('click', () => {
      currentYear -= 1;
      updateMonthDisplay();
    });
    yearNext.addEventListener('click', () => {
      currentYear += 1;
      updateMonthDisplay();
    });

    monthsGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.month-btn');
      if (!btn) return;
      const idx = Number(btn.dataset.monthIndex || '0');
      currentMonth = idx;
      updateMonthDisplay();
      dropdown.classList.remove('active');
      renderAll();
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== display) {
        dropdown.classList.remove('active');
      }
    });
  }

  // ----- Tabs (botones inferiores) -----
  function activateTab(tab, animateDirection) {
    const sections = Array.from(document.querySelectorAll('.tab-section'));
    const btns = Array.from(document.querySelectorAll('.tab-btn'));
    sections.forEach(sec => {
      const isActive = sec.dataset.tab === tab;
      sec.classList.toggle('active', isActive);
    });
    btns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tabTarget === tab);
    });
  }
  window.activateTab = activateTab;

  function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tabTarget;
        if (!tab) return;
        activateTab(tab);
      });
    });
  }

  // ----- Cálculos por mes -----
  function getIngresosBaseTotal() {
    const ib = state.ingresosBase || {};
    return (Number(ib.juan) || 0) + (Number(ib.saray) || 0) + (Number(ib.otros) || 0);
  }

  function getIngresosPuntualesMes(year, month) {
    const mk = monthKey(year, month);
    return state.ingresosPuntuales.filter(ip => {
      const ym = parseDateToYm(ip.fecha);
      return ym && monthKey(ym.y, ym.m) === mk;
    });
  }

  function getGastosMes(year, month) {
    const mk = monthKey(year, month);
    return state.gastos.filter(g => {
      const ym = parseDateToYm(g.fecha);
      return ym && monthKey(ym.y, ym.m) === mk;
    });
  }

  function getTotalFijos() {
    return state.fijos.reduce((s, f) => s + (Number(f.importe) || 0), 0);
  }

  function updateResumenYChips() {
    const mk = getCurrentMonthKey();
    const ingresosBase = getIngresosBaseTotal();
    const ingresosPuntualesMes = getIngresosPuntualesMes(currentYear, currentMonth);
    const totalIngPuntuales = ingresosPuntualesMes.reduce((s, ip) => s + (Number(ip.importe) || 0), 0);
    const ingresosTotales = ingresosBase + totalIngPuntuales;

    const gastosMes = getGastosMes(currentYear, currentMonth);
    const totalGastosVar = gastosMes.reduce((s, g) => s + (Number(g.importe) || 0), 0);
    const totalFijos = getTotalFijos();
    const totalGastos = totalFijos + totalGastosVar;
    const balance = ingresosTotales - totalGastos;

    const chipIngresos = document.getElementById('chipIngresos');
    const chipGastos = document.getElementById('chipGastos');
    const chipBalance = document.getElementById('chipBalance');
    const chipBalanceWrap = document.getElementById('chipBalanceWrap');
    const chipHuchasTotal = document.getElementById('chipHuchasTotal');

    if (chipIngresos) chipIngresos.textContent = formatCurrency(ingresosTotales);
    if (chipGastos) chipGastos.textContent = formatCurrency(totalGastos);
    if (chipBalance) chipBalance.textContent = formatCurrency(balance);
    if (chipBalanceWrap) {
      chipBalanceWrap.classList.remove('balance-pos', 'balance-neg');
      chipBalanceWrap.classList.add(balance >= 0 ? 'balance-pos' : 'balance-neg');
    }

    const totalHuchas = state.huchas.reduce((s, h) => s + (Number(h.saldo) || 0), 0);
    if (chipHuchasTotal) {
      chipHuchasTotal.textContent = 'Huchas: ' + formatCurrency(totalHuchas);
    }

    // Resumen detalle
    const resIngMes = document.getElementById('resIngMes');
    const resFijosMes = document.getElementById('resFijosMes');
    const resVarMes = document.getElementById('resVarMes');
    const resBalMes = document.getElementById('resBalMes');
    if (resIngMes) resIngMes.textContent = formatCurrency(ingresosTotales);
    if (resFijosMes) resFijosMes.textContent = formatCurrency(totalFijos);
    if (resVarMes) resVarMes.textContent = formatCurrency(totalGastosVar);
    if (resBalMes) resBalMes.textContent = formatCurrency(balance);
  }

  // ----- Ingresos base -----
  function setupIngresosBase() {
    const ingJuan = document.getElementById('ingJuan');
    const ingSaray = document.getElementById('ingSaray');
    const ingOtros = document.getElementById('ingOtros');
    const btnSave = document.getElementById('btnSaveIngresos');

    if (ingJuan) ingJuan.value = state.ingresosBase.juan || '';
    if (ingSaray) ingSaray.value = state.ingresosBase.saray || '';
    if (ingOtros) ingOtros.value = state.ingresosBase.otros || '';

    if (btnSave) {
      btnSave.addEventListener('click', () => {
        state.ingresosBase = {
          juan: Number(ingJuan && ingJuan.value) || 0,
          saray: Number(ingSaray && ingSaray.value) || 0,
          otros: Number(ingOtros && ingOtros.value) || 0
        };
        saveState();
        updateResumenYChips();
        showToast('Ingresos base guardados.');
      });
    }
  }

  // ----- Ingresos puntuales -----
  function renderIngresosPuntualesLista() {
    const cont = document.getElementById('ingresosPuntualesLista');
    if (!cont) return;
    const list = getIngresosPuntualesMes(currentYear, currentMonth);
    if (!list.length) {
      cont.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💶</div>No hay ingresos puntuales este mes.</div>';
      return;
    }
    cont.innerHTML = '';
    list
      .sort((a,b) => (a.fecha || '').localeCompare(b.fecha || ''))
      .forEach(ip => {
        const item = document.createElement('div');
        item.className = 'expense-item';
        item.innerHTML = `
          <div class="expense-main">
            <div class="expense-line1">+ ${formatCurrency(ip.importe)}</div>
            <div class="expense-line2">${ip.fecha || ''} · ${ip.desc || ''}</div>
          </div>
          <div class="expense-actions">
            <button class="btn btn-danger-chip" data-action="del" data-id="${ip.id}">🗑</button>
          </div>
        `;
        cont.appendChild(item);
      });

    cont.querySelectorAll('button[data-action="del"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        openConfirm('¿Eliminar este ingreso puntual?', () => {
          state.ingresosPuntuales = state.ingresosPuntuales.filter(ip => String(ip.id) !== String(id));
          saveState();
          renderIngresosPuntualesLista();
          updateResumenYChips();
          showToast('Ingreso puntual eliminado.');
        });
      });
    });
  }

  function setupIngresosPuntuales() {
    const fechaEl = document.getElementById('ingresoPuntualFecha');
    const descEl = document.getElementById('ingresoPuntualDesc');
    const impEl = document.getElementById('ingresoPuntualImporte');
    const btnAdd = document.getElementById('btnAddIngresoPuntual');

    if (fechaEl && !fechaEl.value) {
      const today = new Date();
      fechaEl.value = today.toISOString().slice(0,10);
    }

    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        const fecha = fechaEl && fechaEl.value;
        const desc = descEl && descEl.value.trim();
        const importe = Number(impEl && impEl.value);
        if (!fecha) {
          showToast('Pon una fecha.');
          return;
        }
        if (!(importe > 0)) {
          showToast('El importe debe ser mayor que 0.');
          return;
        }
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
        state.ingresosPuntuales.push({ id, fecha, desc, importe });
        saveState();
        if (descEl) descEl.value = '';
        if (impEl) impEl.value = '';
        renderIngresosPuntualesLista();
        updateResumenYChips();
        showToast('Ingreso puntual añadido.');
      });
    }
  }

  // ----- Gastos fijos -----
  function renderFijosTable() {
    const cont = document.getElementById('fijosTableContainer');
    const totalEl = document.getElementById('totalFijosDisplay');
    if (!cont) return;
    const list = state.fijos || [];
    const total = getTotalFijos();
    if (totalEl) totalEl.textContent = formatCurrency(total);

    if (!list.length) {
      cont.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏠</div>No hay gastos fijos configurados.</div>';
      return;
    }
let html = '<table class="fixed-expense-table"><thead><tr><th>Gasto</th><th>Categoría</th><th>Importe mensual</th><th></th></tr></thead><tbody>';
list.forEach(f => {
  html += `<tr data-id="${f.id}">
    <td>${f.nombre || ''}</td>
    <td>${f.categoria || 'Varios'}</td>
    <td>${formatCurrency(f.importe)}</td>
    <td style="text-align:right;">
      <button class="btn btn-edit" data-action="edit" data-id="${f.id}">✏</button>
      <button class="btn btn-danger-chip" data-action="del" data-id="${f.id}">🗑</button>
    </td>
  </tr>`;
});
    html += '</tbody></table>';
    cont.innerHTML = html;

    cont.querySelectorAll('button[data-action="del"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        openConfirm('¿Eliminar este gasto fijo?', () => {
          state.fijos = state.fijos.filter(f => String(f.id) !== String(id));
          saveState();
          renderFijosTable();
          updateResumenYChips();
          showToast('Gasto fijo eliminado.');
        });
      });
    });

    cont.querySelectorAll('button[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const fijo = state.fijos.find(f => String(f.id) === String(id));
        if (!fijo) return;
        openEditModal('fijo', fijo);
      });
    });
  }

function setupFijos() {
  const nombreEl = document.getElementById('fijoNombre');
  const impEl = document.getElementById('fijoImporte');
  const btnAdd = document.getElementById('btnAddFijo');

  const catHidden = document.getElementById('fijoCategoria');
  const chipsWrap = document.getElementById('fijoCategoriaChips');

  // Gestión de selección de chips
  if (chipsWrap && catHidden) {
    chipsWrap.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.chip');
      if (!btn) return;
      const value = btn.dataset.cat || '';
      catHidden.value = value;

      chipsWrap.querySelectorAll('.chip').forEach(ch => {
        ch.classList.toggle('chip-selected', ch === btn);
      });
    });
  }

  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      const nombre = nombreEl && nombreEl.value.trim();
      const importe = Number(impEl && impEl.value);
      const categoria = catHidden && catHidden.value ? catHidden.value : '';

      if (!nombre) {
        showToast('Pon un nombre al gasto fijo.');
        return;
      }
      if (!categoria) {
        showToast('Selecciona una categoría.');
        return;
      }
      if (!(importe >= 0)) {
        showToast('El importe debe ser un número válido.');
        return;
      }

      const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
      state.fijos.push({ id, nombre, categoria, importe });
      saveState();

      if (nombreEl) nombreEl.value = '';
      if (impEl) impEl.value = '';
      if (catHidden) catHidden.value = '';
      if (chipsWrap) {
        chipsWrap.querySelectorAll('.chip').forEach(ch => ch.classList.remove('chip-selected'));
      }

      renderFijosTable();
      updateResumenYChips();
      showToast('Gasto fijo añadido.');
    });
  }
}

  // ----- Gastos variables -----
  function rebuildCategoriasSugerencias() {
    const dl = document.getElementById('catSugerencias');
    if (!dl) return;
    const cats = new Set();
    state.gastos.forEach(g => {
      if (g.categoria) cats.add(g.categoria);
    });
    state.sobres.forEach(s => {
      if (s.nombre) cats.add(s.nombre);
    });
    dl.innerHTML = '';
    Array.from(cats).sort().forEach(c => {
      const o = document.createElement('option');
      o.value = c;
      dl.appendChild(o);
    });
  }

  function renderGastosLista() {
    const cont = document.getElementById('gastosLista');
    if (!cont) return;
    const list = getGastosMes(currentYear, currentMonth);
    if (!list.length) {
      cont.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🛒</div>No hay gastos registrados este mes.</div>';
      return;
    }
    cont.innerHTML = '';
    list
      .sort((a,b) => (a.fecha || '').localeCompare(b.fecha || ''))
      .forEach(g => {
        const item = document.createElement('div');
        item.className = 'expense-item';
        item.innerHTML = `
          <div class="expense-main">
            <div class="expense-line1"><span class="amount-neg">- ${formatCurrency(g.importe)}</span> · ${g.categoria || 'Sin categoría'}</div>
            <div class="expense-line2">${g.fecha || ''} · ${g.desc || ''}</div>
          </div>
          <div class="expense-actions">
            <button class="btn btn-edit" data-action="edit" data-id="${g.id}">✏</button>
            <button class="btn btn-danger-chip" data-action="del" data-id="${g.id}">🗑</button>
          </div>
        `;
        cont.appendChild(item);
      });

    cont.querySelectorAll('button[data-action="del"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        openConfirm('¿Eliminar este gasto?', () => {
          state.gastos = state.gastos.filter(g => String(g.id) !== String(id));
          saveState();
          renderGastosLista();
          renderSobresLista();
          updateResumenYChips();
          showToast('Gasto eliminado.');
        });
      });
    });

    cont.querySelectorAll('button[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const gasto = state.gastos.find(g => String(g.id) === String(id));
        if (!gasto) return;
        openEditModal('gasto', gasto);
      });
    });
  }

  function setupGastos() {
    const fechaEl = document.getElementById('gastoFecha');
    const catEl = document.getElementById('gastoCategoria');
    const descEl = document.getElementById('gastoDesc');
    const impEl = document.getElementById('gastoImporte');
    const btnAdd = document.getElementById('btnAddGasto');

    if (fechaEl && !fechaEl.value) {
      const today = new Date();
      fechaEl.value = today.toISOString().slice(0,10);
    }

    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        const fecha = fechaEl && fechaEl.value;
        const categoria = catEl && catEl.value.trim();
        const desc = descEl && descEl.value.trim();
        const importe = Number(impEl && impEl.value);
        if (!fecha) {
          showToast('Pon una fecha.');
          return;
        }
        if (!categoria) {
          showToast('Pon una categoría.');
          return;
        }
        if (!(importe > 0)) {
          showToast('El importe debe ser mayor que 0.');
          return;
        }
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
        state.gastos.push({ id, fecha, categoria, desc, importe });
        saveState();
        if (descEl) descEl.value = '';
        if (impEl) impEl.value = '';
        renderGastosLista();
        renderSobresLista();
        rebuildCategoriasSugerencias();
        updateResumenYChips();
        showToast('Gasto añadido.');
      });
    }
  }

  // ----- Sobres / presupuestos -----
  function renderSobresLista() {
    const cont = document.getElementById('sobresLista');
    if (!cont) return;
    const sobres = state.sobres || [];
    if (!sobres.length) {
      cont.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📩</div>No hay presupuestos creados.</div>';
      return;
    }
    const gastosMes = getGastosMes(currentYear, currentMonth);
    cont.innerHTML = '';
    sobres.forEach(s => {
      const totalGastado = gastosMes
        .filter(g => (g.categoria || '').toLowerCase() === (s.nombre || '').toLowerCase())
        .reduce((sum, g) => sum + (Number(g.importe) || 0), 0);
      const presupuesto = Number(s.presupuesto) || 0;
      const restante = presupuesto - totalGastado;
      let statusClass = 'good';
      let statusText = 'Dentro de presupuesto';
      const ratio = presupuesto > 0 ? totalGastado / presupuesto : 0;
      if (presupuesto === 0) {
        statusClass = 'warning';
        statusText = 'Sin presupuesto definido';
      } else if (ratio >= 0.9 && ratio < 1) {
        statusClass = 'warning';
        statusText = 'A punto de agotar presupuesto';
      } else if (ratio >= 1) {
        statusClass = 'over';
        statusText = 'Presupuesto superado';
      }

      const pct = presupuesto > 0 ? Math.min(100, (totalGastado / presupuesto) * 100) : 0;
      const card = document.createElement('div');
      card.className = 'budget-card';
      card.innerHTML = `
        <div class="budget-card-header">
          <div class="budget-name">📩 ${s.nombre || 'Sin nombre'}</div>
          <div>
            <button class="btn btn-edit" data-action="edit" data-id="${s.id}">✏</button>
            <button class="btn btn-danger-chip" data-action="del" data-id="${s.id}">🗑</button>
          </div>
        </div>
        <div class="budget-amounts">
          <div class="budget-amount-item">
            <div class="budget-amount-label">Presupuesto</div>
            <div class="budget-amount-value">${formatCurrency(presupuesto)}</div>
          </div>
          <div class="budget-amount-item">
            <div class="budget-amount-label">Gastado</div>
            <div class="budget-amount-value">${formatCurrency(totalGastado)}</div>
          </div>
        </div>
        <div class="budget-progress-bar">
          <div class="budget-progress-fill ${ratio >= 1 ? 'over' : ''}" style="width:${pct}%;"></div>
        </div>
        <div class="budget-status ${statusClass}">
          ${statusText} · Restante: ${formatCurrency(restante)}
        </div>
      `;
      cont.appendChild(card);
    });

    cont.querySelectorAll('button[data-action="del"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        openConfirm('¿Eliminar este sobre/presupuesto?', () => {
          state.sobres = state.sobres.filter(s => String(s.id) !== String(id));
          saveState();
          renderSobresLista();
          rebuildCategoriasSugerencias();
          showToast('Presupuesto eliminado.');
        });
      });
    });

    cont.querySelectorAll('button[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const sobre = state.sobres.find(s => String(s.id) === String(id));
        if (!sobre) return;
        openEditModal('sobre', sobre);
      });
    });
  }

  function setupSobres() {
    const nombreEl = document.getElementById('sobreNombre');
    const impEl = document.getElementById('sobreImporte');
    const btnAdd = document.getElementById('btnAddSobre');

    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        const nombre = nombreEl && nombreEl.value.trim();
        const presupuesto = Number(impEl && impEl.value);
        if (!nombre) {
          showToast('Pon un nombre al sobre.');
          return;
        }
        if (!(presupuesto >= 0)) {
          showToast('El presupuesto debe ser un número válido.');
          return;
        }
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
        state.sobres.push({ id, nombre, presupuesto });
        saveState();
        if (nombreEl) nombreEl.value = '';
        if (impEl) impEl.value = '';
        renderSobresLista();
        rebuildCategoriasSugerencias();
        showToast('Presupuesto creado.');
      });
    }
  }

  // ----- Huchas -----
  function renderHuchas() {
    const cont = document.getElementById('huchasLista');
    const select = document.getElementById('huchaSelect');
    if (select) {
      select.innerHTML = '<option value="">-- Elige una hucha --</option>';
    }
    const list = state.huchas || [];
    if (!cont) return;
    if (!list.length) {
      cont.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🐷</div>No has creado ninguna hucha todavía.</div>';
    } else {
      cont.innerHTML = '';
      list.forEach(h => {
        const objetivo = Number(h.objetivo) || 0;
        const saldo = Number(h.saldo) || 0;
        const ratio = objetivo > 0 ? Math.min(1, saldo / objetivo) : 0;
        const pct = objetivo > 0 ? Math.min(100, (saldo / objetivo) * 100) : 0;
        const card = document.createElement('div');
        card.className = 'budget-card';
        card.innerHTML = `
          <div class="budget-card-header">
            <div class="budget-name">🐷 ${h.nombre || 'Sin nombre'}</div>
            <div>
              <button class="btn btn-edit" data-action="edit" data-id="${h.id}">✏</button>
              <button class="btn btn-danger-chip" data-action="del" data-id="${h.id}">🗑</button>
            </div>
          </div>
          <div class="budget-amounts">
            <div class="budget-amount-item">
              <div class="budget-amount-label">Saldo</div>
              <div class="budget-amount-value">${formatCurrency(saldo)}</div>
            </div>
            <div class="budget-amount-item">
              <div class="budget-amount-label">Objetivo</div>
              <div class="budget-amount-value">${objetivo ? formatCurrency(objetivo) : '—'}</div>
            </div>
          </div>
          <div class="budget-progress-bar">
            <div class="budget-progress-fill" style="width:${pct}%;"></div>
          </div>
          <div class="budget-status ${ratio >= 1 ? 'good' : 'warning'}">
            ${objetivo ? (ratio >= 1 ? '¡Objetivo conseguido!' : 'Progreso hacia objetivo') : 'Hucha sin objetivo fijo'}
          </div>
        `;
        cont.appendChild(card);

        if (select) {
          const opt = document.createElement('option');
          opt.value = h.id;
          opt.textContent = `${h.nombre} (${formatCurrency(saldo)})`;
          select.appendChild(opt);
        }
      });

      cont.querySelectorAll('button[data-action="del"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          openConfirm('¿Eliminar esta hucha? El saldo se perderá en el control.', () => {
            state.huchas = state.huchas.filter(h => String(h.id) !== String(id));
            saveState();
            renderHuchas();
            updateResumenYChips();
            showToast('Hucha eliminada.');
          });
        });
      });

      cont.querySelectorAll('button[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const hucha = state.huchas.find(h => String(h.id) === String(id));
          if (!hucha) return;
          openEditModal('hucha', hucha);
        });
      });
    }
  }

  function setupHuchas() {
    const nombreEl = document.getElementById('huchaNombre');
    const objEl = document.getElementById('huchaObjetivo');
    const saldoEl = document.getElementById('huchaSaldoInicial');
    const btnAdd = document.getElementById('btnAddHucha');

    const select = document.getElementById('huchaSelect');
    const impMovEl = document.getElementById('huchaImporte');
    const accionEl = document.getElementById('huchaAccion');
    const btnMov = document.getElementById('btnHuchaMovimiento');

    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        const nombre = nombreEl && nombreEl.value.trim();
        const objetivo = Number(objEl && objEl.value) || 0;
        const saldoInicial = Number(saldoEl && saldoEl.value) || 0;
        if (!nombre) {
          showToast('Pon un nombre a la hucha.');
          return;
        }
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
        state.huchas.push({ id, nombre, objetivo, saldo: saldoInicial });
        saveState();
        if (nombreEl) nombreEl.value = '';
        if (objEl) objEl.value = '';
        if (saldoEl) saldoEl.value = '';
        renderHuchas();
        updateResumenYChips();
        rebuildCategoriasSugerencias();
        showToast('Hucha creada.');
      });
    }

    if (btnMov) {
      btnMov.addEventListener('click', () => {
        const huchaId = select && select.value;
        const importe = Number(impMovEl && impMovEl.value);
        const accion = accionEl && accionEl.value;
        if (!huchaId) {
          showToast('Elige una hucha.');
          return;
        }
        if (!(importe > 0)) {
          showToast('El importe debe ser mayor que 0.');
          return;
        }
        const hucha = state.huchas.find(h => String(h.id) === String(huchaId));
        if (!hucha) {
          showToast('Hucha no encontrada.');
          return;
        }
        if (accion === 'aportar') {
          hucha.saldo = (Number(hucha.saldo) || 0) + importe;
          // Registrar gasto categoría "Huchas" en mes actual
          const today = new Date();
          const fecha = today.toISOString().slice(0,10);
          const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
          state.gastos.push({
            id,
            fecha,
            categoria: 'Huchas',
            desc: 'Ahorro en ' + (hucha.nombre || ''),
            importe
          });
          showToast('Aportación registrada en la hucha y como gasto.');
        } else {
          const saldoActual = Number(hucha.saldo) || 0;
          if (importe > saldoActual) {
            showToast('No hay saldo suficiente en la hucha.');
            return;
          }
          hucha.saldo = saldoActual - importe;
          showToast('Retirada registrada en la hucha.');
        }
        saveState();
        if (impMovEl) impMovEl.value = '';
        renderHuchas();
        renderGastosLista();
        renderSobresLista();
        updateResumenYChips();
      });
    }
  }

  // ----- Notas -----
  function loadNotasMes() {
    const area = document.getElementById('notasMes');
    if (!area) return;
    const mk = getCurrentMonthKey();
    area.value = state.notasPorMes[mk] || '';
  }

  function setupNotas() {
    const area = document.getElementById('notasMes');
    const btn = document.getElementById('btnSaveNotas');
    if (!area || !btn) return;
    btn.addEventListener('click', () => {
      const mk = getCurrentMonthKey();
      state.notasPorMes[mk] = area.value || '';
      saveState();
      showToast('Notas del mes guardadas.');
    });
  }

 // ----- Export / Import JSON -----
  function setupExportImportJson() {
    const btnExport = document.getElementById('btnExportJson');
    const fileInput = document.getElementById('importFile');
    const btnImportFile = document.getElementById('btnImportJsonFile');
    const textArea = document.getElementById('importJsonText');
    const btnImportText = document.getElementById('btnImportJsonText');

    if (btnExport) {
      btnExport.addEventListener('click', () => {
        const dataStr = JSON.stringify(state, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const mk = getCurrentMonthKey();
        a.href = url;
        a.download = 'economia_familiar_' + mk + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Copia de seguridad descargada.');
      });
    }

    if (btnImportFile && fileInput) {
      btnImportFile.addEventListener('click', () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) {
          showToast('Selecciona un archivo JSON primero.');
          return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target.result);
            applyBackupPayload(data);
            saveState();
            renderAll();
            showToast('Datos importados correctamente.');
          } catch (e) {
            console.error(e);
            showToast('Error al leer el JSON.');
          }
        };
        reader.readAsText(file, 'utf-8');
      });
    }

    if (btnImportText && textArea) {
      btnImportText.addEventListener('click', () => {
        const content = textArea.value.trim();
        if (!content) {
          showToast('Pega el contenido JSON primero.');
          return;
        }
        try {
          const data = JSON.parse(content);
          applyBackupPayload(data);
          saveState();
          renderAll();
          showToast('Datos importados correctamente.');
        } catch (e) {
          console.error(e);
          showToast('El texto no es un JSON válido.');
        }
      });
    }
  }

  // Acepta backups antiguos y nuevos y los mapea al schema actual de "state"
  function applyBackupPayload(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Backup inválido');
    }

    const newState = {
      ingresosBase: { juan: 0, saray: 0, otros: 0 },
      fijos: [],
      sobres: [],
      huchas: [],
      ingresosPuntuales: [],
      gastos: [],
      notasPorMes: {}
    };

    // 1) Ingresos base: formato nuevo (ingresosBase) o antiguo (baseConfig)
    if (data.ingresosBase && typeof data.ingresosBase === 'object') {
      newState.ingresosBase = {
        juan: Number(data.ingresosBase.juan || 0),
        saray: Number(data.ingresosBase.saray || 0),
        otros: Number(data.ingresosBase.otros || 0)
      };
    } else if (data.baseConfig && typeof data.baseConfig === 'object') {
      newState.ingresosBase = {
        juan: Number(data.baseConfig.juan || 0),
        saray: Number(data.baseConfig.saray || 0),
        otros: Number(data.baseConfig.otros || 0)
      };
    }

    // 2) Gastos fijos: array "fijos" o antiguo "gastosFijos"
   if (Array.isArray(data.fijos)) {
  newState.fijos = data.fijos.map(f => ({
    id: f.id,
    nombre: f.nombre,
    // 👉 recuperamos la categoría si existe en el JSON
    categoria: (typeof f.categoria === 'string' && f.categoria.trim() !== '')
      ? f.categoria
      : 'Varios',
    importe: Number(f.importe) || 0
  }));
} else if (Array.isArray(data.gastosFijos)) {
      newState.fijos = data.gastosFijos.map(f => ({
        id: String(f.id || (Date.now().toString(36) + Math.random().toString(36).slice(2))),
        nombre: f.nombre || '',
        importe: Number(f.importe || 0)
      }));
    }

    // 3) Sobres / presupuestos
    if (Array.isArray(data.sobres)) {
      // Formato nuevo: array de sobres
      newState.sobres = data.sobres.map(s => ({
        id: String(s.id || (Date.now().toString(36) + Math.random().toString(36).slice(2))),
        nombre: s.nombre || '',
        presupuesto: Number(s.presupuesto || s.importe || 0)
      }));
    } else if (data.sobres && typeof data.sobres === 'object') {
      // Formato antiguo: objeto { nombre: importe }
      newState.sobres = Object.keys(data.sobres).map(nombre => ({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        nombre,
        presupuesto: Number(data.sobres[nombre] || 0)
      }));
    }

    // 4) Huchas
    if (Array.isArray(data.huchas)) {
      newState.huchas = data.huchas.map(h => ({
        id: String(h.id || (Date.now().toString(36) + Math.random().toString(36).slice(2))),
        nombre: h.nombre || '',
        objetivo: Number(h.objetivo || 0),
        saldo: Number(h.saldo || 0)
      }));
    }

    // 5) Ingresos puntuales
    if (Array.isArray(data.ingresosPuntuales)) {
      newState.ingresosPuntuales = data.ingresosPuntuales.map(ip => ({
        id: String(ip.id || (Date.now().toString(36) + Math.random().toString(36).slice(2))),
        fecha: ip.fecha || '',
        desc: ip.desc || '',
        importe: Number(ip.importe || 0)
      }));
    }

    // 6) Gastos
    if (Array.isArray(data.gastos)) {
      newState.gastos = data.gastos.map(g => ({
        id: String(g.id || (Date.now().toString(36) + Math.random().toString(36).slice(2))),
        fecha: g.fecha || '',
        categoria: g.categoria || 'Otros',
        desc: g.desc || '',
        importe: Number(g.importe || 0)
      }));
    } else if (Array.isArray(data.movimientos)) {
      newState.gastos = data.movimientos.map(g => ({
        id: String(g.id || (Date.now().toString(36) + Math.random().toString(36).slice(2))),
        fecha: g.fecha || '',
        categoria: g.categoria || 'Otros',
        desc: g.desc || '',
        importe: Number(g.importe || 0)
      }));
    }

 // 7) Notas por mes
if (data.notasPorMes && typeof data.notasPorMes === 'object') {
  newState.notasPorMes = data.notasPorMes;
} else if (data.notasByMonth && typeof data.notasByMonth === 'object') {
  newState.notasPorMes = data.notasByMonth;
}

state = newState;

}
// ----- Reset total -----
function setupReset() {
  const btn = document.getElementById('btnResetAll');
  if (!btn) return;

  btn.addEventListener('click', () => {
    openConfirm(
      'Se borrarán todos los datos de la app en este dispositivo. ¿Seguro?',
      () => {
        state = {
          ingresosBase: { juan: 0, saray: 0, otros: 0 },
          fijos: [],
          sobres: [],
          huchas: [],
          ingresosPuntuales: [],
          gastos: [],
          notasPorMes: {}
        };
        saveState();
        renderAll();
        showToast('Datos eliminados. Empezamos de cero.');
      }
    );
  });
}
// genérica -----
  function openEditModal(type, data) {
    const overlay = document.getElementById('editModal');
    const titleEl = document.getElementById('modalTitle');
    const contentEl = document.getElementById('modalContent');
    const saveBtn = document.getElementById('modalSave');
    if (!overlay || !titleEl || !contentEl || !saveBtn) return;

    let html = '';
if (type === 'fijo') {
  titleEl.textContent = 'Editar gasto fijo';
  html = `
    <div class="field-group">
      <label>Nombre</label>
      <input type="text" id="editNombre" value="${data.nombre || ''}" />
    </div>

    <div class="field-group">
      <label>Categoría</label>
      <div class="chips-row" id="editCategoriaChips">
        <button type="button"
                class="chip chip-small ${data.categoria === 'Suministros' ? 'chip-selected' : ''}"
                data-cat="Suministros">💡 Suministros</button>
        <button type="button
                "class="chip chip-small ${data.categoria === 'Préstamos' ? 'chip-selected' : ''}"
                data-cat="Préstamos">💳 Préstamos</button>
        <button type="button"
                class="chip chip-small ${data.categoria === 'Suscripciones' ? 'chip-selected' : ''}"
                data-cat="Suscripciones">📺 Suscripciones</button>
        <button type="button"
                class="chip chip-small ${data.categoria === 'Varios' ? 'chip-selected' : ''}"
                data-cat="Varios">📦 Varios</button>
      </div>
      <input type="hidden" id="editCategoria" value="${data.categoria || ''}">
    </div>

    <div class="field-group">
      <label>Importe mensual (€)</label>
      <input type="number" id="editImporte" step="0.01" inputmode="decimal" value="${data.importe}" />
    </div>
  `;
} else if (type === 'gasto') {
      titleEl.textContent = 'Editar gasto';
      html = `
        <div class="field-group">
          <label>Fecha</label>
          <input type="date" id="editFecha" value="${data.fecha || ''}" />
        </div>
        <div class="field-group">
          <label>Categoría</label>
          <input type="text" id="editCategoria" value="${data.categoria || ''}" />
        </div>
        <div class="field-group">
          <label>Descripción</label>
          <input type="text" id="editDesc" value="${data.desc || ''}" />
        </div>
        <div class="field-group">
          <label>Importe (€)</label>
          <input type="number" id="editImporte" step="0.01" inputmode="decimal" value="${data.importe}" />
        </div>
      `;
    } else if (type === 'sobre') {
      titleEl.textContent = 'Editar presupuesto';
      html = `
        <div class="field-group">
          <label>Nombre del sobre</label>
          <input type="text" id="editNombre" value="${data.nombre || ''}" />
        </div>
        <div class="field-group">
          <label>Presupuesto mensual (€)</label>
          <input type="number" id="editImporte" step="0.01" inputmode="decimal" value="${data.presupuesto}" />
        </div>
      `;
    } else if (type === 'hucha') {
      titleEl.textContent = 'Editar hucha';
      html = `
        <div class="field-group">
          <label>Nombre</label>
          <input type="text" id="editNombre" value="${data.nombre || ''}" />
        </div>
        <div class="field-group">
          <label>Objetivo (€)</label>
          <input type="number" id="editObjetivo" step="0.01" inputmode="decimal" value="${data.objetivo || 0}" />
        </div>
        <div class="field-group">
          <label>Saldo actual (€)</label>
          <input type="number" id="editSaldo" step="0.01" inputmode="decimal" value="${data.saldo || 0}" />
        </div>
      `;
    } else {
      titleEl.textContent = 'Editar';
      html = '<p>No hay campos para editar.</p>';
    }

    contentEl.innerHTML = html;
    saveBtn.dataset.editType = type;
    saveBtn.dataset.editId = data.id;
    overlay.classList.add('active');
        // Activar chips de categoría en modal de gasto fijo
    if (type === 'fijo') {
      const chipsWrap = document.getElementById('editCategoriaChips');
      const catHidden = document.getElementById('editCategoria');
      if (chipsWrap && catHidden) {
        chipsWrap.addEventListener('click', (ev) => {
          const btn = ev.target.closest('.chip');
          if (!btn) return;
          const value = btn.dataset.cat || '';
          catHidden.value = value;
          chipsWrap.querySelectorAll('.chip').forEach(ch => {
            ch.classList.toggle('chip-selected', ch === btn);
          });
        });
      }
    }
  }

  function closeEditModal() {
    const overlay = document.getElementById('editModal');
    const contentEl = document.getElementById('modalContent');
    const saveBtn = document.getElementById('modalSave');
    if (overlay) overlay.classList.remove('active');
    if (contentEl) contentEl.innerHTML = '';
    if (saveBtn) {
      saveBtn.dataset.editType = '';
      saveBtn.dataset.editId = '';
    }
  }

  function setupEditModalEvents() {
    const modalClose = document.getElementById('modalClose');
    const modalCancel = document.getElementById('modalCancel');
    const modalSave = document.getElementById('modalSave');
    const overlay = document.getElementById('editModal');

    if (modalClose) modalClose.addEventListener('click', closeEditModal);
    if (modalCancel) modalCancel.addEventListener('click', closeEditModal);
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeEditModal();
      });
    }
    if (modalSave) {
      modalSave.addEventListener('click', () => {
        const type = modalSave.dataset.editType;
        const id = modalSave.dataset.editId;
        if (!type || !id) {
          closeEditModal();
          return;
        }
       if (type === 'fijo') {
  const nombreEl = document.getElementById('editNombre');
  const catEl = document.getElementById('editCategoria');
  const impEl = document.getElementById('editImporte');
  const fijo = state.fijos.find(f => String(f.id) === String(id));
  if (fijo && nombreEl && impEl && catEl) {
    fijo.nombre = nombreEl.value.trim();
    const nuevaCat = catEl.value.trim();
    if (nuevaCat) {
      fijo.categoria = nuevaCat;
    }
    fijo.importe = Number(impEl.value) || 0;
    saveState();
    renderFijosTable();
    updateResumenYChips();
    showToast('Gasto fijo actualizado.');
  }
}
       else if (type === 'gasto') {
          const fechaEl = document.getElementById('editFecha');
          const catEl = document.getElementById('editCategoria');
          const descEl = document.getElementById('editDesc');
          const impEl = document.getElementById('editImporte');
          const gasto = state.gastos.find(g => String(g.id) === String(id));
          if (gasto && fechaEl && catEl && descEl && impEl) {
            gasto.fecha = fechaEl.value || gasto.fecha;
            gasto.categoria = catEl.value.trim() || gasto.categoria;
            gasto.desc = descEl.value.trim();
            gasto.importe = Number(impEl.value) || 0;
            saveState();
            renderGastosLista();
            renderSobresLista();
            rebuildCategoriasSugerencias();
            updateResumenYChips();
            showToast('Gasto actualizado.');
          }
        } else if (type === 'sobre') {
          const nombreEl = document.getElementById('editNombre');
          const impEl = document.getElementById('editImporte');
          const sobre = state.sobres.find(s => String(s.id) === String(id));
          if (sobre && nombreEl && impEl) {
            sobre.nombre = nombreEl.value.trim() || sobre.nombre;
            sobre.presupuesto = Number(impEl.value) || 0;
            saveState();
            renderSobresLista();
            rebuildCategoriasSugerencias();
            showToast('Presupuesto actualizado.');
          }
        } else if (type === 'hucha') {
          const nombreEl = document.getElementById('editNombre');
          const objEl = document.getElementById('editObjetivo');
          const saldoEl = document.getElementById('editSaldo');
          const hucha = state.huchas.find(h => String(h.id) === String(id));
          if (hucha && nombreEl && objEl && saldoEl) {
            hucha.nombre = nombreEl.value.trim() || hucha.nombre;
            hucha.objetivo = Number(objEl.value) || 0;
            hucha.saldo = Number(saldoEl.value) || 0;
            saveState();
            renderHuchas();
            updateResumenYChips();
            showToast('Hucha actualizada.');
          }
        }
        closeEditModal();
      });
    }
  }

  // ----- Eventos modal confirm -----
  function setupConfirmModalEvents() {
    const overlay = document.getElementById('confirmModal');
    const btnOk = document.getElementById('confirmOk');
    const btnCancel = document.getElementById('confirmCancel');
    const btnClose = document.getElementById('confirmClose');
    if (btnOk) {
      btnOk.addEventListener('click', () => {
        if (pendingConfirm) pendingConfirm();
        closeConfirm();
      });
    }
    if (btnCancel) btnCancel.addEventListener('click', closeConfirm);
    if (btnClose) btnClose.addEventListener('click', closeConfirm);
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeConfirm();
      });
    }
  }

  // ----- Render general -----
  function renderAll() {
    console.log(">>> renderAll() INICIO <<<");
    setupIngresosBase(); // repinta inputs
    renderIngresosPuntualesLista();
    renderFijosTable();
    renderGastosLista();
    renderSobresLista();
    renderHuchas();
    rebuildCategoriasSugerencias();
    loadNotasMes();
    updateResumenYChips();
    console.log(">>> renderAll() FIN <<<");
  }

  // ----- Init -----
  document.addEventListener('DOMContentLoaded', () => {

    log(">>> DOMContentLoaded DISPARADO <<<");  
    loadState();

    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();

    log("Año actual:", currentYear, "Mes actual:", currentMonth);
    log(">>> Ejecutando setup inicial <<<");
    setupTabs();
    setupMonthPicker();
    updateMonthDisplay();

    document.getElementById('btnPrevMonth')?.addEventListener('click', () => changeMonth(-1));
    document.getElementById('btnNextMonth')?.addEventListener('click', () => changeMonth(1));

    setupIngresosBase();
    setupIngresosPuntuales();
    setupFijos();
    setupGastos();
    setupSobres();
    setupHuchas();
    setupNotas();
    setupExportImportJson();
    //setupImportCsv();
    setupReset();
    setupEditModalEvents();
    setupConfirmModalEvents();

    renderAll();
    log(">>> renderAll() ejecutado <<<");
  });
})();
