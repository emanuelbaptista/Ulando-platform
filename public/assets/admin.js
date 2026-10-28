
(() => {
 const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
 const loginForm=$('#login-form'), loginPanel=$('#login-panel'), dashboard=$('#dashboard');
 const themeBtn=$('#theme-toggle');
 const themeRoot=document.documentElement;
 try { const saved=localStorage.getItem('ulandu-theme'); if(saved==='light'||saved==='dark') themeRoot.dataset.theme=saved; } catch (_) {}
 const updateTheme=()=>{const light=themeRoot.dataset.theme==='light';$$('.brand-logo').forEach(img=>{img.src=light?'assets/images/ulandu-logo-color.png':'assets/images/ulandu-logo-white.png'});const icon=$('.theme-icon');if(icon)icon.textContent=light?'☀':'☾';if(themeBtn){themeBtn.title=light?'Mudar para tema escuro':'Mudar para tema claro';themeBtn.setAttribute('aria-label',themeBtn.title);}};
 updateTheme(); themeBtn?.addEventListener('click',()=>{themeRoot.dataset.theme=themeRoot.dataset.theme==='light'?'dark':'light';try{localStorage.setItem('ulandu-theme',themeRoot.dataset.theme);}catch(_){}updateTheme();});
 const loginError=$('#login-error'), notice=$('#admin-message');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const localMode = location.protocol === 'file:';
 const LOCAL_KEY = 'ulandu-local-content-v1';
 const LOCAL_SESSION = 'ulandu-local-admin-session';
 const readLocal = () => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch (_) { return []; } };
 const writeLocal = items => localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
 const localApi = async (url, opts={}) => {
  const method = (opts.method || 'GET').toUpperCase();
  const path = new URL(url, location.href).pathname;
  if (path.endsWith('/api/admin/login') && method === 'POST') {
   const d=JSON.parse(opts.body||'{}');
   const users=[{email:'admin@ulandu.online',password:'UlanduAdmin2026!Admin'},{email:'conteudos@ulandu.online',password:'UlanduConteudos2026!Equipe'},{email:'media@ulandu.online',password:'UlanduMedia2026!Equipa'},...JSON.parse(localStorage.getItem('ulandu-local-admin-users-v1')||'[]')];
   const match=users.find(u=>u.email.toLowerCase()===String(d.email||'').toLowerCase() && u.password===d.password);
   if(!match) throw new Error('E-mail ou palavra-passe incorrectos. Usa uma das contas de demonstração indicadas no README.');
   localStorage.setItem(LOCAL_SESSION,match.email); return {ok:true,admin:{email:match.email}};
  }
  if (path.endsWith('/api/admin/logout')) { localStorage.removeItem(LOCAL_SESSION); return {ok:true}; }
  if (path.endsWith('/api/admin/me')) return localStorage.getItem(LOCAL_SESSION) ? {authenticated:true,admin:{email:localStorage.getItem(LOCAL_SESSION)}} : {authenticated:false};
  if (path.endsWith('/api/admin/content') && method === 'GET') return readLocal();
  if (path.endsWith('/api/admin/content') && method === 'POST') {
   const items=readLocal(), d=JSON.parse(opts.body||'{}'); const item={...d,id:Date.now().toString(),created_at:new Date().toISOString()}; items.unshift(item); writeLocal(items); return item;
  }
  const itemMatch=path.match(/\/api\/admin\/content\/([^/]+)$/);
  if (itemMatch && method === 'PUT') { const items=readLocal(), d=JSON.parse(opts.body||'{}'), i=items.findIndex(x=>String(x.id)===itemMatch[1]); if(i<0) throw new Error('Conteúdo não encontrado.'); items[i]={...items[i],...d}; writeLocal(items); return items[i]; }
  if (itemMatch && method === 'DELETE') { writeLocal(readLocal().filter(x=>String(x.id)!==itemMatch[1])); return {ok:true}; }
  if (path.endsWith('/api/admin/upload') && method === 'POST') {
   const file=opts.body?.get?.('file'); if(!file) throw new Error('Escolhe primeiro um ficheiro.');
   if(file.size>4*1024*1024) throw new Error('No modo HTML local, escolhe um ficheiro até 4 MB.');
   const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Não foi possível ler o ficheiro.'));reader.readAsDataURL(file);});
   return {url:dataUrl,path:dataUrl,filename:file.name};
  }
  throw new Error('Esta função não está disponível no modo HTML local.');
 };
 async function api(url,opts={}) {
  if(localMode) return localApi(url,opts);
  const headers={...(opts.body instanceof FormData?{}:{'Content-Type':'application/json'}),...(opts.headers||{})};
  const r=await fetch(url,{credentials:'same-origin',...opts,headers});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error||data.message||'Não foi possível concluir a operação.');
  return data;
 }
 function message(text){if(notice){notice.textContent=text;notice.classList.remove('hidden');}}
 function showDashboard(admin){loginPanel?.classList.add('hidden');dashboard?.classList.remove('hidden');$('#welcome').textContent=admin?.email?`Sessão iniciada: ${admin.email}`:'Sessão iniciada';refresh();}
 loginForm?.addEventListener('submit',async e=>{
  e.preventDefault();loginError?.classList.add('hidden');
  try{const d=await api('/api/admin/login',{method:'POST',body:JSON.stringify({email:$('#admin-email').value,password:$('#admin-password').value})});showDashboard(d.admin||d);}
  catch(err){if(loginError){loginError.textContent=err.message;loginError.classList.remove('hidden');}}
 });
 $('#logout')?.addEventListener('click',async()=>{try{await api('/api/admin/logout',{method:'POST'});}catch{}location.reload();});
 async function refresh(){
  const container=$('#content-items');if(!container)return;
  try{
   const d=await api('/api/admin/content');const items=Array.isArray(d)?d:(d.items||d.content||[]);
   container.innerHTML=items.length?items.map(x=>`<article class="panel" style="padding:14px;margin:10px 0;display:flex;justify-content:space-between;gap:12px;align-items:center"><div><strong>${esc(x.title)}</strong><p style="margin:4px 0">${esc(x.type)} · ${x.published?'Publicado':'Rascunho'}</p><small>${esc(x.category)}</small></div><div style="display:flex;gap:8px"><button class="btn btn-soft" data-edit="${x.id}">Editar</button><button class="btn btn-outline" data-delete="${x.id}">Eliminar</button></div></article>`).join(''):'<p>Ainda não há conteúdos. Usa o formulário para criar o primeiro.</p>';
   const stats=$('#stats');if(stats)stats.innerHTML=[['Total',items.length],['Publicados',items.filter(x=>x.published).length],['Rascunhos',items.filter(x=>!x.published).length],['Tipos',new Set(items.map(x=>x.type)).size]].map(([l,n])=>`<div class="panel" style="padding:18px"><p>${l}</p><strong style="font-size:1.8rem">${n}</strong></div>`).join('');
   $$('[data-delete]').forEach(b=>b.onclick=async()=>{if(confirm('Tens a certeza de que queres eliminar este conteúdo?'))try{await api('/api/admin/content/'+b.dataset.delete,{method:'DELETE'});refresh();}catch(e){message(e.message)}});
   $$('[data-edit]').forEach(b=>b.onclick=()=>{const x=items.find(i=>String(i.id)===b.dataset.edit);if(!x)return;$('#content-id').value=x.id;['type','title','category','summary','body','image','media-url'].forEach(k=>{const el=$('#'+k);if(el)el.value=x[k.replace('-','_')]||x[k]||''});$('#published').checked=!!x.published;$('#editor-title').textContent='Editar conteúdo';window.scrollTo({top:0,behavior:'smooth'});});
   const search=$('#search-content');search?.addEventListener('input',()=>{$$('#content-items article').forEach(el=>el.classList.toggle('hidden',!el.textContent.toLowerCase().includes(search.value.toLowerCase())));},{once:true});
  }catch(e){container.innerHTML=`<p>${esc(e.message)}</p>`;}
 }
 $('#refresh')?.addEventListener('click',refresh);
 $('#reset-form')?.addEventListener('click',()=>{$('#content-form')?.reset();$('#content-id').value='';$('#editor-title').textContent='Adicionar conteúdo';});
 $('#upload-button')?.addEventListener('click',async()=>{
  const file=$('#upload-file')?.files?.[0];if(!file){$('#upload-status').textContent='Escolhe primeiro um ficheiro.';return}
  const fd=new FormData();fd.append('file',file);
  try{const d=await api('/api/admin/upload',{method:'POST',body:fd});if(file.type.startsWith('video/')){$('#media-url').value=d.url||d.path||d.filename||'';$('#upload-status').textContent='Vídeo carregado e associado à publicação.'}else{$('#image').value=d.url||d.path||d.filename||'';$('#upload-status').textContent='Imagem carregada.'}}
  catch(e){$('#upload-status').textContent=e.message}
 });
 $('#content-form')?.addEventListener('submit',async e=>{
  e.preventDefault();const id=$('#content-id').value;
  const payload={type:$('#type').value,title:$('#title').value,category:$('#category').value,summary:$('#summary').value,body:$('#body').value,image:$('#image').value,media_url:$('#media-url').value,published:$('#published').checked?1:0};
  try{await api(id?'/api/admin/content/'+id:'/api/admin/content',{method:id?'PUT':'POST',body:JSON.stringify(payload)});message('Conteúdo guardado com sucesso.');$('#content-form').reset();$('#content-id').value='';$('#editor-title').textContent='Adicionar conteúdo';refresh();}
  catch(err){message(err.message);}
 });
 async function refreshAdmins(){
  const list=$('#admin-users-list'); if(!list) return;
  if(localMode){ const users=JSON.parse(localStorage.getItem('ulandu-local-admin-users-v1')||'[]'); list.innerHTML='<p>Contas de demonstração neste navegador. Não são contas seguras nem partilhadas entre dispositivos.</p>'+users.map((u,i)=>`<div class="panel" style="padding:12px;margin:8px 0;display:flex;justify-content:space-between;gap:12px;align-items:center"><span>${esc(u.email)}</span><button class="btn btn-outline" data-local-remove="${i}">Remover</button></div>`).join(''); list.querySelectorAll('[data-local-remove]').forEach(btn=>btn.addEventListener('click',()=>{const a=JSON.parse(localStorage.getItem('ulandu-local-admin-users-v1')||'[]');a.splice(Number(btn.dataset.localRemove),1);localStorage.setItem('ulandu-local-admin-users-v1',JSON.stringify(a));refreshAdmins()})); return; }
  try{const users=await api('/api/admin/admins');list.innerHTML=users.map(u=>`<div class="panel" style="padding:12px;margin:8px 0;display:flex;justify-content:space-between;gap:12px;align-items:center"><span>${esc(u.email)}</span><button class="btn btn-outline" data-remove-admin="${u.id}">Remover</button></div>`).join('');list.querySelectorAll('[data-remove-admin]').forEach(btn=>btn.addEventListener('click',async()=>{if(!confirm('Remover esta conta administrativa?'))return;try{await api('/api/admin/admins/'+btn.dataset.removeAdmin,{method:'DELETE'});refreshAdmins()}catch(e){adminUsersMessage(e.message)}}));}catch(e){list.textContent=e.message;}
 }
 function adminUsersMessage(t){const el=$('#admin-users-message');if(el){el.textContent=t;el.classList.remove('hidden')}}
 $('#admin-user-form')?.addEventListener('submit',async e=>{e.preventDefault();try{const email=$('#new-admin-email').value.trim().toLowerCase(),password=$('#new-admin-password').value;if(localMode){const a=JSON.parse(localStorage.getItem('ulandu-local-admin-users-v1')||'[]');if(a.some(u=>u.email===email))throw new Error('Já existe uma conta com esse e-mail.');a.push({email,password});localStorage.setItem('ulandu-local-admin-users-v1',JSON.stringify(a));adminUsersMessage('Conta de demonstração criada neste navegador. Não dá acesso a outros computadores.');}else{await api('/api/admin/admins',{method:'POST',body:JSON.stringify({email,password})});adminUsersMessage('Conta criada. Entrega as credenciais ao respectivo utilizador de forma privada.');}$('#admin-user-form').reset();refreshAdmins()}catch(err){adminUsersMessage(err.message)}});

 // Server-backed course editor, public metric controls and basic activity dashboard.
 async function loadCourseAdmin(){const list=$('#course-admin-list');if(!list||localMode){if(list)list.textContent='A gestão de cursos requer o servidor iniciado com INICIAR-ULANDU.bat.';return}try{const courses=await api('/api/admin/courses');list.replaceChildren();if(!courses.length){list.textContent='Ainda não há cursos. Adiciona o primeiro formulário acima.';return}courses.forEach(c=>{const row=document.createElement('article');row.className='panel';row.style.cssText='padding:14px;margin:10px 0;display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap';const info=document.createElement('div');const title=document.createElement('strong');title.textContent=c.title;const detail=document.createElement('p');detail.textContent=`${c.category||'Formação'} · ${c.duration||'Duração por definir'} · ${c.published?'Publicado':'Rascunho'}`;info.append(title,detail);const actions=document.createElement('div');actions.style.cssText='display:flex;gap:8px';const edit=document.createElement('button');edit.className='btn btn-soft';edit.type='button';edit.textContent='Editar';edit.onclick=()=>{$('#course-admin-id').value=c.id;$('#course-admin-title').value=c.title;$('#course-admin-category').value=c.category||'';$('#course-admin-duration').value=c.duration||'';$('#course-admin-description').value=c.description||'';$('#course-admin-published').checked=!!c.published;$('#course-admin-title').focus()};const del=document.createElement('button');del.className='btn btn-outline';del.type='button';del.textContent='Eliminar';del.onclick=async()=>{if(confirm('Eliminar este curso?')){try{await api('/api/admin/courses/'+c.id,{method:'DELETE'});loadCourseAdmin()}catch(err){courseMessage(err.message)}}};actions.append(edit,del);row.append(info,actions);list.append(row)})}catch(e){list.textContent=e.message}}
 function courseMessage(t){const el=$('#course-admin-message');if(el){el.textContent=t;el.classList.remove('hidden')}}
 $('#course-admin-form')?.addEventListener('submit',async e=>{e.preventDefault();const id=$('#course-admin-id').value;const payload={title:$('#course-admin-title').value,category:$('#course-admin-category').value, duration:$('#course-admin-duration').value,description:$('#course-admin-description').value,published:$('#course-admin-published').checked};try{await api(id?'/api/admin/courses/'+id:'/api/admin/courses',{method:id?'PUT':'POST',body:JSON.stringify(payload)});courseMessage('Curso guardado com sucesso.');$('#course-admin-form').reset();$('#course-admin-id').value='';$('#course-admin-published').checked=true;loadCourseAdmin()}catch(err){courseMessage(err.message)}});
 $('#course-admin-reset')?.addEventListener('click',()=>{$('#course-admin-form')?.reset();$('#course-admin-id').value='';$('#course-admin-published').checked=true});
 async function loadAnalytics(){if(localMode)return;try{const d=await api('/api/admin/analytics');const cards=[['Cursos no catálogo',d.courses],['Inscrições recebidas',d.registrations],['Conteúdos totais',d.content],['Conteúdos publicados',d.published]];const root=$('#analytics-cards');if(root)root.innerHTML=cards.map(([label,value])=>`<article class="panel" style="padding:16px"><p>${esc(label)}</p><strong style="font-size:1.8rem">${Number(value)||0}</strong></article>`).join('');if(d.metrics){$('#metric-courses').value=d.metrics.courses_completed??8;$('#metric-professionals').value=d.metrics.professionals_trained??75;$('#metric-events').value=d.metrics.events_dialogues??8}const recent=$('#recent-registrations');if(recent){recent.replaceChildren();if(!d.recentRegistrations?.length){recent.textContent='Ainda não há inscrições.'}else d.recentRegistrations.forEach(r=>{const el=document.createElement('div');el.className='panel';el.style.cssText='padding:10px;margin:8px 0';const b=document.createElement('strong');b.textContent=r.name;const p=document.createElement('p');p.textContent=`${r.course_title} · ${r.email} · ${r.created_at}`;el.append(b,p);recent.append(el)})}}catch(e){const root=$('#analytics-cards');if(root)root.textContent=e.message}}
 $('#site-stats-form')?.addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/admin/site-stats',{method:'PUT',body:JSON.stringify({courses_completed:Number($('#metric-courses').value),professionals_trained:Number($('#metric-professionals').value),events_dialogues:Number($('#metric-events').value)})});const m=$('#stats-save-message');m.textContent='Indicadores atualizados. Os novos números serão apresentados no site.';m.classList.remove('hidden');loadAnalytics()}catch(err){const m=$('#stats-save-message');m.textContent=err.message;m.classList.remove('hidden')}});

 // Editable navigation and theme-specific logos (server-backed).
 const navForm=$('#nav-admin-form');
 async function loadNavItems(){const list=$('#nav-admin-list');if(!list||localMode){if(list)list.textContent='A gestão do menu requer o servidor iniciado.';return}try{const items=await api('/api/admin/navigation');list.replaceChildren();if(!items.length){list.textContent='Ainda não existem itens guardados. Adiciona o primeiro item acima.';return}items.forEach(item=>{const row=document.createElement('article');row.className='panel';row.style.cssText='padding:12px;margin:8px 0;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap';const info=document.createElement('div');const title=document.createElement('strong');title.textContent=item.label;const detail=document.createElement('p');detail.textContent=`${item.href} · ${item.menu_group==='more'?'Mais':'Principal'} · ${item.visible?'Visível':'Oculto'} · Ordem ${item.position}`;info.append(title,detail);const actions=document.createElement('div');actions.style.cssText='display:flex;gap:8px';const edit=document.createElement('button');edit.type='button';edit.className='btn btn-soft';edit.textContent='Editar';edit.onclick=()=>{$('#nav-admin-id').value=item.id;$('#nav-admin-label').value=item.label;$('#nav-admin-href').value=item.href;$('#nav-admin-group').value=item.menu_group||'main';$('#nav-admin-position').value=item.position||0;$('#nav-admin-visible').checked=!!item.visible;$('#nav-admin-label').focus()};const del=document.createElement('button');del.type='button';del.className='btn btn-outline';del.textContent='Remover';del.onclick=async()=>{if(confirm(`Remover “${item.label}” do menu?`)){try{await api('/api/admin/navigation/'+item.id,{method:'DELETE'});loadNavItems()}catch(e){navAdminMessage(e.message)}}};actions.append(edit,del);row.append(info,actions);list.append(row)})}catch(e){list.textContent=e.message}}
 function navAdminMessage(t){const el=$('#nav-admin-message');if(el){el.textContent=t;el.classList.remove('hidden')}}
 navForm?.addEventListener('submit',async e=>{e.preventDefault();const id=$('#nav-admin-id').value;const payload={label:$('#nav-admin-label').value,href:$('#nav-admin-href').value,menu_group:$('#nav-admin-group').value,position:Number($('#nav-admin-position').value)||0,visible:$('#nav-admin-visible').checked};try{await api(id?'/api/admin/navigation/'+id:'/api/admin/navigation',{method:id?'PUT':'POST',body:JSON.stringify(payload)});navAdminMessage('Item de navegação guardado. O site irá atualizar o menu ao recarregar.');navForm.reset();$('#nav-admin-id').value='';$('#nav-admin-position').value='0';$('#nav-admin-visible').checked=true;loadNavItems()}catch(err){navAdminMessage(err.message)}});
 $('#nav-admin-reset')?.addEventListener('click',()=>{navForm?.reset();$('#nav-admin-id').value='';$('#nav-admin-position').value='0';$('#nav-admin-visible').checked=true});
 async function loadBrandSettings(){if(localMode)return;try{const d=await api('/api/brand-settings');$('#brand-logo-light').value=d.logo_light||'assets/images/ulandu-logo-color.png';$('#brand-logo-dark').value=d.logo_dark||'assets/images/ulandu-logo-white.png'}catch(_){}}
 $('#brand-admin-form')?.addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/admin/brand-settings',{method:'PUT',body:JSON.stringify({logo_light:$('#brand-logo-light').value.trim(),logo_dark:$('#brand-logo-dark').value.trim()})});const el=$('#brand-admin-message');el.textContent='Logótipos guardados. Recarrega o website para ver as alterações.';el.classList.remove('hidden')}catch(err){const el=$('#brand-admin-message');el.textContent=err.message;el.classList.remove('hidden')}});
 $('#brand-logo-upload')?.addEventListener('click',async()=>{const file=$('#brand-logo-file')?.files?.[0];if(!file){$('#brand-logo-upload-status').textContent='Escolhe uma imagem primeiro.';return}const fd=new FormData();fd.append('file',file);try{const d=await api('/api/admin/upload',{method:'POST',body:fd});const url=d.url||d.path||d.filename||'';if(!url)throw new Error('O servidor não devolveu o caminho da imagem.');const field=$('#brand-logo-target').value==='dark'?$('#brand-logo-dark'):$('#brand-logo-light');field.value=url;$('#brand-logo-upload-status').textContent='Imagem carregada. Define o campo de tema pretendido e guarda.'}catch(err){$('#brand-logo-upload-status').textContent=err.message}});
 loadNavItems();loadBrandSettings();

 const oldRefresh=refresh;refresh=async function(){await oldRefresh();await loadCourseAdmin();await loadAnalytics();await loadNavItems();await loadBrandSettings()};

 const oldShowDashboard=showDashboard;
 // Refresh account list after login and when dashboard opens.
 const observer=new MutationObserver(()=>{if(dashboard && !dashboard.classList.contains('hidden'))refreshAdmins()});
 if(dashboard)observer.observe(dashboard,{attributes:true,attributeFilter:['class']});
 api('/api/admin/me').then(d=>{if(d.authenticated)showDashboard(d.admin||d)}).catch(()=>{});
})();
