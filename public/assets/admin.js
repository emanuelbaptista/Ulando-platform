(() => {
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const loginForm = $('#login-form'), loginPanel = $('#login-panel'), dashboard = $('#dashboard');
const themeBtn = $('#theme-toggle');
const themeRoot = document.documentElement;
try { const saved = localStorage.getItem('ulando-theme'); if (saved === 'light' || saved === 'dark') themeRoot.dataset.theme = saved; } catch (_) {}
const updateTheme = () => {
  const light = themeRoot.dataset.theme === 'light';
  $$('.brand-logo').forEach(img => { img.src = light ? 'assets/images/ulando-logo-color.png' : 'assets/images/ulando-logo-white.png'; });
  const icon = $('.theme-icon'); if (icon) icon.textContent = light ? '☀️' : '🌙';
  if (themeBtn) {
    themeBtn.title = light ? 'Mudar para tema escuro' : 'Mudar para tema claro';
    themeBtn.setAttribute('aria-label', themeBtn.title);
  }
};
updateTheme(); 
themeBtn?.addEventListener('click', () => {
  themeRoot.dataset.theme = themeRoot.dataset.theme === 'light' ? 'dark' : 'light';
  try { localStorage.setItem('ulando-theme', themeRoot.dataset.theme); } catch (_) {}
  updateTheme();
});
const loginError = $('#login-error'), notice = $('#admin-message');
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
const localMode = location.protocol === 'file:';
const LOCAL_KEY = 'ulando-local-content-v1';
const LOCAL_SESSION = 'ulando-local-admin-session';
const readLocal = () => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch (_) { return []; } };
const writeLocal = items => localStorage.setItem(LOCAL_KEY, JSON.stringify(items));

const localApi = async (url, opts = {}) => {
  const method = (opts.method || 'GET').toUpperCase();
  const path = new URL(url, location.href).pathname;
  if (path.endsWith('/api/admin/login') && method === 'POST') {
    const d = JSON.parse(opts.body || '{}');
    const users = [
      { email: 'admin@ulando.online', password: 'UlanduAdmin2026!Admin' },
      { email: 'conteudos@ulando.online', password: 'UlanduConteudos2026!Equipe' },
      { email: 'media@ulando.online', password: 'UlanduMedia2026!Equipe' },
      ...JSON.parse(localStorage.getItem('ulando-local-admin-users-v1') || '[]')
    ];
    const match = users.find(u => u.email.toLowerCase() === String(d.email || "").toLowerCase() && u.password === d.password);
    if (!match) throw new Error('E-mail ou palavra-passe incorretos.');
    localStorage.setItem(LOCAL_SESSION, match.email); 
    return { ok: true, admin: { email: match.email } };
  }
  if (path.endsWith('/api/admin/logout')) { localStorage.removeItem(LOCAL_SESSION); return { ok: true }; }
  if (path.endsWith('/api/admin/me')) return localStorage.getItem(LOCAL_SESSION) ? { authenticated: true, admin: { email: localStorage.getItem(LOCAL_SESSION) } } : { authenticated: false };
  if (path.endsWith('/api/admin/content') && method === 'GET') return readLocal();
  if (path.endsWith('/api/admin/content') && method === 'POST') {
    const items = readLocal(), d = JSON.parse(opts.body || '{}'); 
    const item = { ...d, id: Date.now().toString(), created_at: new Date().toISOString() };
    items.unshift(item); writeLocal(items); return item;
  }
  const itemMatch = path.match(/\/api\/admin\/content\/([^\/]+)$/);
  if (itemMatch && method === 'PUT') { 
    const items = readLocal(), d = JSON.parse(opts.body || '{}'), i = items.findIndex(x => String(x.id) === itemMatch[1]);
    if (i < 0) throw new Error('Conteúdo não encontrado.'); 
    items[i] = { ...items[i], ...d }; writeLocal(items); return items[i]; 
  }
  if (itemMatch && method === 'DELETE') { writeLocal(readLocal().filter(x => String(x.id) !== itemMatch[1])); return { ok: true }; }
  if (path.endsWith('/api/admin/upload') && method === 'POST') {
    const file = opts.body?.get('file'); if (!file) throw new Error('Escolhe primeiro um ficheiro.');
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Não foi possível ler o ficheiro.'));
      reader.readAsDataURL(file);
    });
    return { url: dataUrl, path: dataUrl, filename: file.name };
  }
  throw new Error('Função indisponível.');
};

async function api(url, opts = {}) {
  if (localMode) return localApi(url, opts);
  
  const headers = {
    ...(opts.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(opts.headers || {})
  };
const r = await fetch(url, {
  credentials: 'same-origin',
  ...opts,
  headers: headers
});

  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || data.message || 'Não foi possível concluir a operação.');
  return data;
}
function message(text) { if (notice) { notice.textContent = text; notice.classList.remove('hidden'); } }
function showDashboard(admin) {
  loginPanel?.classList.add('hidden');
  dashboard?.classList.remove('hidden');
  $('#welcome').textContent = admin?.email ? `Sessão iniciada: ${admin.email}` : 'Sessão iniciada';
  refresh();
}

loginForm?.addEventListener('submit', async e => {
  e.preventDefault(); loginError?.classList.add('hidden');
  try {
    const d = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ email: $('#admin-email').value, password: $('#admin-password').value }) });
    showDashboard(d.admin || d);
  } catch (err) {
    if (loginError) { loginError.textContent = err.message; loginError.classList.remove('hidden'); }
  }
});

$('#logout')?.addEventListener('click', async () => {
  try { await api('/api/admin/logout', { method: 'POST' }); } catch {}
  location.reload();
});

async function refresh() {
  const container = $('#content-items'); if (!container) return;
  try {
    const d = await api('/api/admin/content'); 
    const items = Array.isArray(d) ? d : (d.content || []);
    container.innerHTML = items.length ? items.map(x => `<article class="panel" style="padding:14px;margin:10px 0;display:flex;justify-content:space-between;gap:12px;align-items:center"><div><strong>${esc(x.title)}</strong><p style="margin:4px 0">${esc(x.type)} · ${x.published ? 'Publicado' : 'Rascunho'}</p><small>${esc(x.category)}</small></div><div style="display:flex;gap:8px"><button class="btn btn-soft" data-edit="${x.id}">Editar</button><button class="btn btn-outline" data-delete="${x.id}">Eliminar</button></div></article>`).join('') : '<p>Ainda não há conteúdos.</p>';
    
    const stats = $('#stats');
    if (stats) stats.innerHTML = [['Total', items.length], ['Publicados', items.filter(x => x.published).length], ['Rascunhos', items.filter(x => !x.published).length], ['Tipos', new Set(items.map(x => x.type)).size]].map(([l, n]) => `<div class="panel" style="padding:18px"><p>${l}</p><strong style="font-size:1.8rem">${n}</strong></div>`).join('');
    
    $$('[data-delete]').forEach(b => {
      b.onclick = async () => {
        if (confirm('Eliminar conteúdo?')) try { await api('/api/admin/content/' + b.dataset.delete, { method: 'DELETE' }); refresh(); } catch (e) { message(e.message); }
      };
    });
    
    $$('[data-edit]').forEach(b => {
      b.onclick = () => {
        const x = items.find(i => String(i.id) === b.dataset.edit); if (!x) return;
        $('#content-id').value = x.id;
        ['type', 'title', 'category', 'summary', 'body', 'image', 'media-url'].forEach(k => {
          const el = $('#' + k); if (el) el.value = x[k.replace('-', '_')] || x[k] || '';
        });
        $('#published').checked = !!x.published;
        $('#editor-title').textContent = 'Editar conteúdo';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
    });
  } catch (e) { container.innerHTML = `<p>${esc(e.message)}</p>`; }
}

$('#refresh')?.addEventListener('click', refresh);
$('#reset-form')?.addEventListener('click', () => { $('#content-form')?.reset(); $('#content-id').value = ''; $('#editor-title').textContent = 'Adicionar conteúdo'; });

$('#upload-button')?.addEventListener('click', async () => {
  const file = $('#upload-file')?.files[0]; if (!file) { $('#upload-status').textContent = 'Escolhe primeiro um ficheiro.'; return; }
  const fd = new FormData(); fd.append('file', file);
  try {
    const d = await api('/api/admin/upload', { method: 'POST', body: fd });
    if (file.type.startsWith('video/')) {
      $('#media-url').value = d.url || d.path || d.filename || '';
      $('#upload-status').textContent = 'Vídeo carregado com sucesso.';
    } else {
      $('#image').value = d.url || d.path || d.filename || '';
      $('#upload-status').textContent = 'Imagem carregada com sucesso.';
    }
  } catch (e) { $('#upload-status').textContent = e.message; }
});

$('#content-form')?.addEventListener('submit', async e => {
  e.preventDefault(); const id = $('#content-id').value;
  const payload = { type: $('#type').value, title: $('#title').value, category: $('#category').value, summary: $('#summary').value, body: $('#body').value, image: $('#image').value, media_url: $('#media-url').value, published: $('#published').checked ? 1 : 0 };
  try {
    await api(id ? '/api/admin/content/' + id : '/api/admin/content', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    message('Conteúdo guardado com sucesso.');
    $('#content-form').reset(); $('#content-id').value = ''; $('#editor-title').textContent = 'Adicionar conteúdo'; refresh();
  } catch (err) { message(err.message); }
});

api('/api/admin/me').then(d => { if (d.authenticated) showDashboard(d.admin || d); }).catch(() => {});
})();