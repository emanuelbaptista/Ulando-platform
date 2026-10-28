(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const root = document.documentElement;
  const themeBtn = $('#theme-toggle');
  const menuBtn = $('#menu-toggle');
  const nav = $('.nav');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Theme persists between all pages and always shows the action's icon.
  let savedTheme = null;
  try { savedTheme = window.localStorage.getItem('ulandu-theme'); } catch (_) { /* file:// or restricted browser storage */ }
  if (savedTheme === 'light' || savedTheme === 'dark') root.dataset.theme = savedTheme;
  let savedBrandSettings = {};
  const updateThemeControl = () => {
    const light = root.dataset.theme === 'light';
    $$('.brand-logo').forEach(img => { img.src = (light ? savedBrandSettings.logo_light : savedBrandSettings.logo_dark) || (light ? '/assets/images/ulandu-logo-color.png' : '/assets/images/ulandu-logo-white.png'); });
    const icon = $('.theme-icon', themeBtn || document);
    if (icon) icon.textContent = light ? '☀' : '☾';
    if (themeBtn) {
      themeBtn.setAttribute('aria-label', light ? 'Mudar para tema escuro' : 'Mudar para tema claro');
      themeBtn.title = light ? 'Mudar para tema escuro' : 'Mudar para tema claro';
    }
  };
  const defaultLogoLight='/assets/images/ulandu-logo-color.png', defaultLogoDark='/assets/images/ulandu-logo-white.png';
  const applyBrandSettings = settings => { savedBrandSettings=settings||{}; updateThemeControl(); };
  fetch('/api/brand-settings').then(r=>r.ok?r.json():{}).then(applyBrandSettings).catch(()=>{});
  const wrapCloseIfNeeded=()=>document.querySelectorAll('.nav-dropdown').forEach(w=>{w.classList.remove('dropdown-open');w.querySelector('button')?.setAttribute('aria-expanded','false')});
  fetch('/api/navigation').then(r=>r.ok?r.json():[]).then(items=>{ if(!Array.isArray(items)||!items.length)return; const navEl=$('.nav'); if(!navEl)return; const dropdownItems=items.filter(x=>x.menu_group==='more'); const visible=items.filter(x=>x.menu_group!=='more'); navEl.replaceChildren(); const makeLink=x=>{const a=document.createElement('a');a.href=x.href;a.textContent=x.label;a.addEventListener('click',()=>{wrapCloseIfNeeded();navEl.classList.remove('open')});return a}; visible.forEach(x=>navEl.append(makeLink(x))); if(dropdownItems.length){const wrap=document.createElement('div');wrap.className='nav-dropdown';const b=document.createElement('button');b.type='button';b.textContent='Mais ▾';b.setAttribute('aria-expanded','false');const menu=document.createElement('div');menu.className='dropdown-menu';dropdownItems.forEach(x=>menu.append(makeLink(x)));const close=document.createElement('button');close.type='button';close.className='dropdown-close';close.textContent='Fechar menu ×';close.addEventListener('click',()=>{wrap.classList.remove('dropdown-open');b.setAttribute('aria-expanded','false')});menu.append(close);b.addEventListener('click',e=>{e.stopPropagation();const open=wrap.classList.toggle('dropdown-open');b.setAttribute('aria-expanded',String(open))});wrap.append(b,menu);navEl.append(wrap);document.addEventListener('click',e=>{if(!wrap.contains(e.target)){wrap.classList.remove('dropdown-open');b.setAttribute('aria-expanded','false')}});document.addEventListener('keydown',e=>{if(e.key==='Escape'){wrap.classList.remove('dropdown-open');b.setAttribute('aria-expanded','false')}}); } }).catch(()=>{});
  themeBtn?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    try { window.localStorage.setItem('ulandu-theme', root.dataset.theme); } catch (_) { /* Theme still changes for this page. */ }
    updateThemeControl();
  });

  // Mobile menu is opened/closed reliably and closes after a destination is chosen.
  const closeMenu = () => {
    nav?.classList.remove('open');
    menuBtn?.setAttribute('aria-expanded', 'false');
    menuBtn?.setAttribute('aria-label', 'Abrir menu');
  };
  menuBtn?.addEventListener('click', () => {
    const open = !nav?.classList.contains('open');
    nav?.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  });
  window.addEventListener('resize', () => { if (window.innerWidth > 1180) closeMenu(); });
  const dropdown = $('.nav-dropdown');
  const dropdownBtn = $('.nav-dropdown > button');
  dropdownBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const expanded = dropdown?.classList.toggle('dropdown-open');
    dropdownBtn.setAttribute('aria-expanded', String(Boolean(expanded)));
  });
  document.addEventListener('click', (event) => {
    document.querySelectorAll('.nav-dropdown.dropdown-open').forEach((wrap) => {
      if (!wrap.contains(event.target)) {
        wrap.classList.remove('dropdown-open');
        wrap.querySelector(':scope > button')?.setAttribute('aria-expanded', 'false');
      }
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') document.querySelectorAll('.nav-dropdown.dropdown-open').forEach((wrap) => {
      wrap.classList.remove('dropdown-open');
      wrap.querySelector(':scope > button')?.setAttribute('aria-expanded', 'false');
    });
  });
  document.querySelectorAll('.dropdown-menu a').forEach((link) => link.addEventListener('click', () => {
    const wrap = link.closest('.nav-dropdown');
    wrap?.classList.remove('dropdown-open');
    wrap?.querySelector(':scope > button')?.setAttribute('aria-expanded', 'false');
  }));

  // Current page state and soft cross-page transition. Links remain normal browser links.
  const currentFile = location.pathname.split('/').pop() || 'index.html';
  $$('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;
    try {
      const target = new URL(href, location.href);
      if (target.origin === location.origin && target.pathname.split('/').pop() === currentFile) {
        link.classList.add('active');
        if (link.closest('.dropdown-menu')) link.closest('.nav-dropdown')?.classList.add('has-active');
      }
    } catch (_) {}
    link.addEventListener('click', event => {
      closeMenu();
      const raw = link.getAttribute('href');
      if (!raw || raw.startsWith('#') || link.target === '_blank' || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      let target;
      try { target = new URL(raw, location.href); } catch (_) { return; }
      if (target.origin !== location.origin || target.pathname === location.pathname && target.search === location.search) return;
      if (reduceMotion || !document.startViewTransition && !document.body.animate) return;
      event.preventDefault();
      document.body.classList.add('page-leaving');
      window.setTimeout(() => { location.href = target.href; }, 170);
    });
  });
  document.body.classList.add('page-enter');
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('page-entered')));
  window.addEventListener('pageshow', () => { document.body.classList.remove('page-leaving'); document.body.classList.add('page-entered'); });

  // Scroll reveal, with a safe fallback for older browsers.
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
    });
  }, { threshold: .10, rootMargin: '0px 0px -20px 0px' }) : null;
  $$('.reveal').forEach(el => observer ? observer.observe(el) : el.classList.add('visible'));


  // Official logo fallback if the external logo host is unavailable.
  $$('.brand-logo').forEach(img => img.addEventListener('error', () => {
    img.hidden = true;
    const fallback = img.nextElementSibling;
    if (fallback?.classList.contains('brand-mark-fallback')) fallback.style.display = 'grid';
  }, { once: true }));
  // Ensure any remaining third-party image failure gets a local editorial cover.
  $$('img:not(.brand-logo)').forEach(img => img.addEventListener('error', () => {
    if (!img.dataset.localFallback) { img.dataset.localFallback = '1'; img.src = new URL('assets/images/comunicacao.svg', document.baseURI).href; }
  }, { once: true }));

  // Load published content from the Node/Express API when the server is running.
  // Cards are built with DOM APIs and textContent to avoid injecting HTML from content fields.
  const escapeText = value => String(value || '').trim();
  const makeContentCard = item => {
    const article = document.createElement('article'); article.className = 'card reveal';
    if (item.media_url && (/\.(mp4|webm)(\?|$)/i.test(item.media_url) || /^data:video\//i.test(item.media_url))) {
      const video = document.createElement('video'); video.controls = true; video.preload = 'metadata'; video.playsInline = true; video.src = item.media_url; video.style.width = '100%'; video.style.aspectRatio = '16/9'; video.style.objectFit = 'cover'; article.append(video);
    } else if (item.image) {
      const imageWrap = document.createElement('div'); imageWrap.className = 'card-image';
      const img = document.createElement('img'); img.loading = 'lazy'; img.alt = escapeText(item.title) + ' — imagem ilustrativa; consultar a publicação original para o registo oficial'; img.src = item.image;
      img.addEventListener('error', () => { if(!img.dataset.fallback){img.dataset.fallback='1';img.src = 'assets/images/comunicacao.svg';} }, { once: true }); imageWrap.append(img); article.append(imageWrap);
    }
    const body = document.createElement('div'); body.className = 'card-body';
    if (item.category) { const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = escapeText(item.category); body.append(tag); }
    const title = document.createElement('h3'); title.textContent = escapeText(item.title) || 'Conteúdo Ulandu'; body.append(title);
    const summary = document.createElement('p'); summary.textContent = escapeText(item.summary || item.body); body.append(summary);
    if(item.body && item.summary && item.body !== item.summary){const desc=document.createElement('details');const sum=document.createElement('summary');sum.textContent='Ler descrição completa';const text=document.createElement('p');text.textContent=escapeText(item.body);desc.append(sum,text);body.append(desc);}
    if(item.media_url && !(/\.(mp4|webm)(\?|$)/i.test(item.media_url) || /^data:video\//i.test(item.media_url))){const media=document.createElement('a');media.className='text-link';media.href=item.media_url;media.target='_blank';media.rel='noopener noreferrer';media.textContent='Ver vídeo / publicação ↗';body.append(media);}
    article.append(body); if (observerForContent) observerForContent.observe(article); else article.classList.add('visible'); return article;
  };
  const observerForContent = 'IntersectionObserver' in window ? new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('visible'); observerForContent.unobserve(entry.target); }
  }), { threshold: .1 }) : null;
  const contentTargets = [
    { selector: '#latest-news', type: 'news', limit: 3 },
    { selector: '#latest-projects', type: 'project', limit: 3 },
    { selector: '#latest-media', type: 'media', limit: 3 },
    { selector: '#page-content-news', type: 'news', limit: 1000 },
    { selector: '#page-content-project', type: 'project', limit: 1000 },
    { selector: '#page-content-blog', type: 'blog', limit: 1000 },
    { selector: '#page-content-media', type: 'media', limit: 1000 }
  ];
  // No demo/starter publications: only content explicitly published by the administrator appears.
  const showEmptyContent = target => {
    target.replaceChildren();
    const empty = document.createElement('div'); empty.className = 'empty-state';
    empty.textContent = 'Ainda não há publicações. Novos conteúdos serão apresentados aqui quando forem publicados pela administração.';
    target.append(empty);
  };
  const loadLocalPublishedContent = (selector, type) => {
    const target = $(selector); if (!target) return;
    try {
      const items = JSON.parse(localStorage.getItem('ulandu-local-content-v1') || '[]')
        .filter(item => item.type === type && (item.published === true || item.published === 1 || item.published === '1'));
      if (items.length) target.replaceChildren(...items.slice(0, selector.startsWith('#latest-') ? 3 : items.length).map(makeContentCard));
      else showEmptyContent(target);
    } catch (_) { showEmptyContent(target); }
  };
  if (location.protocol === 'file:') {
    contentTargets.forEach(({selector,type}) => loadLocalPublishedContent(selector,type));
  } else {
    contentTargets.forEach(({ selector, type }) => {
      const target = $(selector);
      if (!target) return;
      showEmptyContent(target);
      fetch(`/api/content?type=${encodeURIComponent(type)}`, { headers: { Accept: 'application/json' } })
        .then(response => { if (!response.ok) throw new Error('API indisponível'); return response.json(); })
        .then(items => {
          if (!Array.isArray(items) || !items.length) { showEmptyContent(target); return; }
          const targetConfig = contentTargets.find(x => x.selector === selector);
          target.replaceChildren(...items.slice(0, targetConfig?.limit || 3).map(makeContentCard));
        })
        .catch(() => showEmptyContent(target));
    });
  }

  // Content filters.
  $$('.filter-btn').forEach(btn => btn.addEventListener('click', () => {
    $$('.filter-btn').forEach(other => other.classList.toggle('active', other === btn));
    const filter = btn.dataset.filter || 'all';
    $$('.filterable').forEach(item => item.classList.toggle('hidden', filter !== 'all' && item.dataset.category !== filter));
  }));

  // Contact form message: no false claim that an email has been sent.
  const form = $('#contact-form');
  form?.addEventListener('submit', event => {
    event.preventDefault();
    const msg = $('#form-message');
    const name = $('#name')?.value.trim() || '';
    const email = $('#email')?.value.trim() || '';
    const subject = $('#subject')?.value || 'Contacto através do website';
    const message = $('#message')?.value.trim() || '';
    const body = `Nome: ${name}\nEmail: ${email}\nAssunto: ${subject}\n\nMensagem:\n${message}`;
    const mailto = `mailto:ulandu23@gmail.com?subject=${encodeURIComponent('[Website Ulandu] ' + subject)}&body=${encodeURIComponent(body)}`;
    if (msg) {
      msg.replaceChildren();
      msg.append(document.createTextNode('A mensagem está pronta. '));
      const link = document.createElement('a'); link.href = mailto; link.textContent = 'Abrir a aplicação de email para enviar';
      msg.append(link, document.createTextNode('.'));
    }
  });

  // Academy catalogue, sign-up modal and server-backed animated statistics.
  const courseList = $('#course-list'); let academyCourses = [];
  const renderCourses = () => {
    if (!courseList) return;
    const q = ($('#course-search')?.value || '').trim().toLowerCase();
    const filtered = academyCourses.filter(c => `${c.title} ${c.description} ${c.category}`.toLowerCase().includes(q));
    courseList.replaceChildren();
    filtered.forEach(c => {
      const card=document.createElement('article');card.className='course-card reveal';
      const tag=document.createElement('span');tag.className='tag';tag.textContent=c.category||'Formação';
      const title=document.createElement('h3');title.textContent=c.title;
      const desc=document.createElement('p');desc.textContent=c.description||'Programa de formação da Academia Ulandu.';
      card.append(tag,title,desc);
      if(c.duration){const duration=document.createElement('p');duration.textContent='Duração: '+c.duration;card.append(duration)}
      const btn=document.createElement('button');btn.type='button';btn.className='btn btn-primary';btn.textContent='Inscreva-se';btn.addEventListener('click',()=>{const input=$('#enrol-course');if(input)input.value=c.title;openEnrolment()});card.append(btn);courseList.append(card);
    });
    $('#course-empty')?.classList.toggle('hidden',filtered.length!==0);
    const datalist=$('#course-options');if(datalist){datalist.replaceChildren();academyCourses.forEach(c=>{const option=document.createElement('option');option.value=c.title;datalist.append(option)})}
  };
  async function loadCourses(){if(!courseList)return;try{const r=await fetch('/api/courses');if(!r.ok)throw new Error('API indisponível');academyCourses=await r.json()}catch(_){academyCourses=[]}renderCourses()}
  $('#course-search')?.addEventListener('input',renderCourses);loadCourses();
  const modal=$('#enrolment-modal');const openEnrolment=()=>{modal?.classList.remove('hidden');$('#enrol-name')?.focus()};
  if(location.hash==='#enrolment-modal') openEnrolment();
  $('#open-enrolment')?.addEventListener('click',openEnrolment);$('#close-enrolment')?.addEventListener('click',()=>modal?.classList.add('hidden'));modal?.addEventListener('click',e=>{if(e.target===modal)modal.classList.add('hidden')});
  $$('a[href="academia.html#enrolment-modal"]').forEach(a=>a.addEventListener('click',e=>{if(location.pathname.endsWith('academia.html')){e.preventDefault();openEnrolment()}}));
  $('#enrolment-form')?.addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;const data=Object.fromEntries(new FormData(form).entries());const msg=$('#enrolment-message');try{const r=await fetch('/api/course-registrations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await r.json();if(!r.ok)throw new Error(result.error||'Não foi possível enviar a inscrição.');msg.textContent=result.message;msg.classList.remove('hidden');form.reset()}catch(err){msg.textContent=location.protocol==='file:'?'Para enviar a inscrição, inicia o site com INICIAR-ULANDU.bat.':err.message;msg.classList.remove('hidden')}});
  // Animate numbers only when the statistic cards enter the viewport.
  async function animateStats(){const nodes=$$('[data-stat]');if(!nodes.length)return;let values={courses_completed:8,professionals_trained:75,events_dialogues:8};try{const r=await fetch('/api/site-stats');if(r.ok)values={...values,...await r.json()}}catch(_){}nodes.forEach(el=>{el.dataset.target=String(Number(values[el.dataset.stat]??el.dataset.target??0));el.textContent='0'});const run=el=>{if(el.dataset.counted)return;el.dataset.counted='1';const target=Math.max(0,Number(el.dataset.target)||0);if(reduceMotion){el.textContent=target.toLocaleString('pt-PT')+'+';return}const start=performance.now(),duration=1350;const tick=now=>{const progress=Math.min(1,(now-start)/duration);el.textContent=Math.floor(target*(1-Math.pow(1-progress,3))).toLocaleString('pt-PT')+(progress===1?'+':'');if(progress<1)requestAnimationFrame(tick)};requestAnimationFrame(tick)};if('IntersectionObserver'in window){const io=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){run(entry.target);io.unobserve(entry.target)}}),{threshold:.45});nodes.forEach(n=>io.observe(n))}else nodes.forEach(run)}
  animateStats();
  // Homepage global search across published news, blog, projects, courses and static services.
  const searchForm=$('#global-search'),searchInput=$('#global-search-input'),searchResults=$('#global-search-results');
  searchForm?.addEventListener('submit',async e=>{e.preventDefault();const q=(searchInput?.value||'').trim();if(!q||!searchResults)return;searchResults.classList.remove('hidden');searchResults.textContent='A pesquisar…';const results=[];const add=(title,description,url)=>{if((title+' '+description).toLowerCase().includes(q.toLowerCase()))results.push({title,description,url})};
    const staticItems=[['Serviços','Comunicação estratégica, assessoria de imprensa, eventos e formação','servicos.html'],['Academia Ulandu','Cursos e programas de formação profissional','academia.html'],['Quem Somos','História, missão e visão da Ulandu','sobre.html'],['Contacto','Fale com a equipa da Ulandu','contacto.html'],['Fórum CIAI','Fórum, comunicação e diálogo','forum-ciai.html'],['Diálogos','Encontros e conversas profissionais','dialogos.html']];staticItems.forEach(x=>add(...x));
    try{const [contentRes,coursesRes]=await Promise.all([fetch('/api/content'),fetch('/api/courses')]);if(contentRes.ok)(await contentRes.json()).forEach(x=>add(x.title,x.summary||x.body,({news:'noticias.html',blog:'blog.html',project:'projetos.html',media:'multimedia.html'})[x.type]||'noticias.html'));if(coursesRes.ok)(await coursesRes.json()).forEach(x=>add(x.title,x.description,'academia.html'))}catch(_){}
    searchResults.replaceChildren();if(!results.length){searchResults.textContent='Não foram encontrados resultados. Tenta outras palavras.';return}results.slice(0,8).forEach(x=>{const a=document.createElement('a');a.href=x.url;a.innerHTML='';const strong=document.createElement('strong');strong.textContent=x.title;const small=document.createElement('div');small.textContent=x.description;a.append(strong,small);searchResults.append(a)});
  });

  $$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
})();
