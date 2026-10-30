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
  try {
    savedTheme = window.localStorage.getItem('ulandu-theme');
  } catch (_) {}

  if (savedTheme === 'light' || savedTheme === 'dark') {
    root.dataset.theme = savedTheme;
  }

  let savedBrandSettings = {};

  const updateThemeControl = () => {
    const light = root.dataset.theme === 'light';

    $$('.brand-logo').forEach(img => {
      img.src = (light ? savedBrandSettings.logo_light : savedBrandSettings.logo_dark) ||
        (light ? '/assets/images/ulandu-logo-color.png' : '/assets/images/ulandu-logo-white.png');
    });

    const icon = $('.theme-icon', themeBtn || document);

    if (icon) icon.textContent = light ? '☀' : '☾';

    if (themeBtn) {
      themeBtn.setAttribute('aria-label', light ? 'Mudar para tema escuro' : 'Mudar para tema claro');
      themeBtn.title = light ? 'Mudar para tema escuro' : 'Mudar para tema claro';
    }
  };

  const applyBrandSettings = settings => {
    savedBrandSettings = settings || {};
    updateThemeControl();
  };

  fetch('/api/brand-settings')
    .then(response => response.ok ? response.json() : {})
    .then(applyBrandSettings)
    .catch(() => updateThemeControl());

  // Mobile navigation and backdrop.
  let backdrop = $('.nav-backdrop');

  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'nav-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.append(backdrop);
  }

  const closeMoreMenu = () => {
    $$('.nav-dropdown.dropdown-open').forEach(wrap => {
      wrap.classList.remove('dropdown-open');
      wrap.querySelector(':scope > button')?.setAttribute('aria-expanded', 'false');
    });
  };

  const closeMenu = () => {
    nav?.classList.remove('open');
    document.body.classList.remove('menu-panel-open');
    backdrop.classList.remove('visible');

    menuBtn?.setAttribute('aria-expanded', 'false');
    menuBtn?.setAttribute('aria-label', 'Abrir menu');
    menuBtn?.setAttribute('title', 'Abrir menu');

    closeMoreMenu();
  };

  const openMenu = () => {
    if (!nav) return;

    nav.classList.add('open');
    document.body.classList.add('menu-panel-open');
    backdrop.classList.add('visible');

    menuBtn?.setAttribute('aria-expanded', 'true');
    menuBtn?.setAttribute('aria-label', 'Fechar menu');
    menuBtn?.setAttribute('title', 'Fechar menu');
  };

  menuBtn?.addEventListener('click', event => {
    event.preventDefault();

    if (nav?.classList.contains('open')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  backdrop.addEventListener('click', closeMenu);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeMenu();
      closeMoreMenu();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 1180) closeMenu();
  });

  // Event delegation for navigation loaded asynchronously.
  document.addEventListener('click', event => {
    const moreButton = event.target.closest('.nav-dropdown > button');

    if (moreButton) {
      event.preventDefault();
      event.stopPropagation();

      const wrap = moreButton.closest('.nav-dropdown');
      const willOpen = !wrap.classList.contains('dropdown-open');

      closeMoreMenu();

      wrap.classList.toggle('dropdown-open', willOpen);
      moreButton.setAttribute('aria-expanded', String(willOpen));

      return;
    }

    const closeMoreButton = event.target.closest('.dropdown-close');

    if (closeMoreButton) {
      event.preventDefault();
      closeMoreMenu();
      return;
    }

    const navLink = event.target.closest('.nav a');

    if (navLink) closeMenu();
  });

  // Build navigation from the server.
  fetch('/api/navigation')
    .then(response => response.ok ? response.json() : [])
    .then(items => {
      if (!Array.isArray(items) || !items.length || !nav) return;

      const dropdownItems = items.filter(item => item.menu_group === 'more');
      const visibleItems = items.filter(item => item.menu_group !== 'more');

      nav.replaceChildren();

      const makeLink = item => {
        const link = document.createElement('a');
        link.href = item.href;
        link.textContent = item.label;
        return link;
      };

      visibleItems.forEach(item => nav.append(makeLink(item)));

      if (dropdownItems.length) {
        const wrap = document.createElement('div');
        wrap.className = 'nav-dropdown';

        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Mais ▾';
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-haspopup', 'true');

        const menu = document.createElement('div');
        menu.className = 'dropdown-menu';

        dropdownItems.forEach(item => menu.append(makeLink(item)));

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'dropdown-close';
        closeButton.textContent = 'Fechar menu ×';

        menu.append(closeButton);
        wrap.append(button, menu);
        nav.append(wrap);
      }

      // Mark the current page.
      const currentFile = location.pathname.split('/').pop() || 'index.html';

      $$('a[href]', nav).forEach(link => {
        try {
          const target = new URL(link.getAttribute('href'), location.href);

          if (
            target.origin === location.origin &&
            target.pathname.split('/').pop() === currentFile
          ) {
            link.classList.add('active');

            if (link.closest('.dropdown-menu')) {
              link.closest('.nav-dropdown')?.classList.add('has-active');
            }
          }
        } catch (_) {}
      });
    })
    .catch(() => {});

  // Theme toggle.
  themeBtn?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';

    try {
      window.localStorage.setItem('ulandu-theme', root.dataset.theme);
    } catch (_) {}

    updateThemeControl();
  });

  updateThemeControl();

  // Current page state and page transition.
  const currentFile = location.pathname.split('/').pop() || 'index.html';

  $$('a[href]').forEach(link => {
    const href = link.getAttribute('href');

    if (!href) return;

    try {
      const target = new URL(href, location.href);

      if (
        target.origin === location.origin &&
        target.pathname.split('/').pop() === currentFile
      ) {
        link.classList.add('active');

        if (link.closest('.dropdown-menu')) {
          link.closest('.nav-dropdown')?.classList.add('has-active');
        }
      }
    } catch (_) {}

    link.addEventListener('click', event => {
      closeMenu();

      const raw = link.getAttribute('href');

      if (
        !raw ||
        raw.startsWith('#') ||
        link.target === '_blank' ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      ) return;

      let target;

      try {
        target = new URL(raw, location.href);
      } catch (_) {
        return;
      }

      if (
        target.origin !== location.origin ||
        (target.pathname === location.pathname && target.search === location.search)
      ) return;

      if (reduceMotion || (!document.startViewTransition && !document.body.animate)) return;

      event.preventDefault();
      document.body.classList.add('page-leaving');

      window.setTimeout(() => {
        location.href = target.href;
      }, 170);
    });
  });

  document.body.classList.add('page-enter');

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.classList.add('page-entered');
    });
  });

  window.addEventListener('pageshow', () => {
    document.body.classList.remove('page-leaving');
    document.body.classList.add('page-entered');
  });

  // Scroll reveal.
  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      }, {
        threshold: .10,
        rootMargin: '0px 0px -20px 0px'
      })
    : null;

  $$('.reveal').forEach(element => {
    if (observer) {
      observer.observe(element);
    } else {
      element.classList.add('visible');
    }
  });

  // Official logo fallback.
  $$('.brand-logo').forEach(img => {
    img.addEventListener('error', () => {
      img.hidden = true;

      const fallback = img.nextElementSibling;

      if (fallback?.classList.contains('brand-mark-fallback')) {
        fallback.style.display = 'grid';
      }
    }, { once: true });
  });

  // Image fallback.
  $$('img:not(.brand-logo)').forEach(img => {
    img.addEventListener('error', () => {
      if (!img.dataset.localFallback) {
        img.dataset.localFallback = '1';
        img.src = new URL('assets/images/comunicacao.svg', document.baseURI).href;
      }
    }, { once: true });
  });

  // Published content.
  const escapeText = value => String(value || '').trim();

  const observerForContent = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observerForContent.unobserve(entry.target);
          }
        });
      }, { threshold: .1 })
    : null;

  const makeContentCard = item => {
    const article = document.createElement('article');
    article.className = 'card reveal';

    if (
      item.media_url &&
      (/\.(mp4|webm)(\?|$)/i.test(item.media_url) || /^data:video\//i.test(item.media_url))
    ) {
      const video = document.createElement('video');
      video.controls = true;
      video.preload = 'metadata';
      video.playsInline = true;
      video.src = item.media_url;
      video.style.width = '100%';
      video.style.aspectRatio = '16/9';
      video.style.objectFit = 'cover';

      article.append(video);
    } else if (item.image) {
      const imageWrap = document.createElement('div');
      imageWrap.className = 'card-image';

      const img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = escapeText(item.title) +
        ' — imagem ilustrativa; consultar a publicação original para o registo oficial';
      img.src = item.image;

      img.addEventListener('error', () => {
        if (!img.dataset.fallback) {
          img.dataset.fallback = '1';
          img.src = 'assets/images/comunicacao.svg';
        }
      }, { once: true });

      imageWrap.append(img);
      article.append(imageWrap);
    }

    const body = document.createElement('div');
    body.className = 'card-body';

    if (item.category) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = escapeText(item.category);
      body.append(tag);
    }

    const title = document.createElement('h3');
    title.textContent = escapeText(item.title) || 'Conteúdo Ulandu';
    body.append(title);

    const summary = document.createElement('p');
    summary.textContent = escapeText(item.summary || item.body);
    body.append(summary);

    if (item.body && item.summary && item.body !== item.summary) {
      const details = document.createElement('details');

      const summaryLabel = document.createElement('summary');
      summaryLabel.textContent = 'Ler descrição completa';

      const description = document.createElement('p');
      description.textContent = escapeText(item.body);

      details.append(summaryLabel, description);
      body.append(details);
    }

    if (
      item.media_url &&
      !(/\.(mp4|webm)(\?|$)/i.test(item.media_url) || /^data:video\//i.test(item.media_url))
    ) {
      const media = document.createElement('a');
      media.className = 'text-link';
      media.href = item.media_url;
      media.target = '_blank';
      media.rel = 'noopener noreferrer';
      media.textContent = 'Ver vídeo / publicação ↗';

      body.append(media);
    }

    article.append(body);

    if (observerForContent) {
      observerForContent.observe(article);
    } else {
      article.classList.add('visible');
    }

    return article;
  };

  const contentTargets = [
    { selector: '#latest-news', type: 'news', limit: 3 },
    { selector: '#latest-projects', type: 'project', limit: 3 },
    { selector: '#latest-media', type: 'media', limit: 3 },
    { selector: '#page-content-news', type: 'news', limit: 1000 },
    { selector: '#page-content-project', type: 'project', limit: 1000 },
    { selector: '#page-content-blog', type: 'blog', limit: 1000 },
    { selector: '#page-content-media', type: 'media', limit: 1000 }
  ];

  const showEmptyContent = target => {
    target.replaceChildren();

    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent =
      'Ainda não há publicações. Novos conteúdos serão apresentados aqui quando forem publicados pela administração.';

    target.append(empty);
  };

  const loadLocalPublishedContent = (selector, type) => {
    const target = $(selector);

    if (!target) return;

    try {
      const items = JSON.parse(localStorage.getItem('ulandu-local-content-v1') || '[]')
        .filter(item =>
          item.type === type &&
          (item.published === true || item.published === 1 || item.published === '1')
        );

      if (items.length) {
        target.replaceChildren(
          ...items.slice(0, selector.startsWith('#latest-') ? 3 : items.length)
            .map(makeContentCard)
        );
      } else {
        showEmptyContent(target);
      }
    } catch (_) {
      showEmptyContent(target);
    }
  };

  if (location.protocol === 'file:') {
    contentTargets.forEach(({ selector, type }) => {
      loadLocalPublishedContent(selector, type);
    });
  } else {
    contentTargets.forEach(({ selector, type }) => {
      const target = $(selector);

      if (!target) return;

      showEmptyContent(target);

      fetch(`/api/content?type=${encodeURIComponent(type)}`, {
        headers: { Accept: 'application/json' }
      })
        .then(response => {
          if (!response.ok) throw new Error('API indisponível');
          return response.json();
        })
        .then(items => {
          if (!Array.isArray(items) || !items.length) {
            showEmptyContent(target);
            return;
          }

          const targetConfig = contentTargets.find(item => item.selector === selector);

          target.replaceChildren(
            ...items.slice(0, targetConfig?.limit || 3).map(makeContentCard)
          );
        })
        .catch(() => showEmptyContent(target));
    });
  }

  // Content filters.
  $$('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.filter-btn').forEach(other => {
        other.classList.toggle('active', other === btn);
      });

      const filter = btn.dataset.filter || 'all';

      $$('.filterable').forEach(item => {
        item.classList.toggle(
          'hidden',
          filter !== 'all' && item.dataset.category !== filter
        );
      });
    });
  });

  // Contact form.
  const contactForm = $('#contact-form');

  contactForm?.addEventListener('submit', event => {
    event.preventDefault();

    const msg = $('#form-message');
    const name = $('#name')?.value.trim() || '';
    const email = $('#email')?.value.trim() || '';
    const subject = $('#subject')?.value || 'Contacto através do website';
    const message = $('#message')?.value.trim() || '';

    const body =
      `Nome: ${name}\nEmail: ${email}\nAssunto: ${subject}\n\nMensagem:\n${message}`;

    const mailto =
      `mailto:ulandu23@gmail.com?subject=${encodeURIComponent('[Website Ulandu] ' + subject)}&body=${encodeURIComponent(body)}`;

    if (msg) {
      msg.replaceChildren();
      msg.append(document.createTextNode('A mensagem está pronta. '));

      const link = document.createElement('a');
      link.href = mailto;
      link.textContent = 'Abrir a aplicação de email para enviar';

      msg.append(link, document.createTextNode('.'));
    }
  });

  // Academy catalogue and enrolment.
  const courseList = $('#course-list');
  let academyCourses = [];
  const modal = $('#enrolment-modal');

  const openEnrolment = () => {
    modal?.classList.remove('hidden');
    $('#enrol-name')?.focus();
  };

  const renderCourses = () => {
    if (!courseList) return;

    const query = ($('#course-search')?.value || '').trim().toLowerCase();

    const filtered = academyCourses.filter(course =>
      `${course.title} ${course.description} ${course.category}`
        .toLowerCase()
        .includes(query)
    );

    courseList.replaceChildren();

    filtered.forEach(course => {
      const card = document.createElement('article');
      card.className = 'course-card reveal';

      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = course.category || 'Formação';

      const title = document.createElement('h3');
      title.textContent = course.title;

      const description = document.createElement('p');
      description.textContent =
        course.description || 'Programa de formação da Academia Ulandu.';

      card.append(tag, title, description);

      if (course.duration) {
        const duration = document.createElement('p');
        duration.textContent = 'Duração: ' + course.duration;
        card.append(duration);
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-primary';
      button.textContent = 'Inscreva-se';

      button.addEventListener('click', () => {
        const input = $('#enrol-course');

        if (input) input.value = course.title;

        openEnrolment();
      });

      card.append(button);
      courseList.append(card);
    });

    $('#course-empty')?.classList.toggle('hidden', filtered.length !== 0);

    const datalist = $('#course-options');

    if (datalist) {
      datalist.replaceChildren();

      academyCourses.forEach(course => {
        const option = document.createElement('option');
        option.value = course.title;
        datalist.append(option);
      });
    }
  };

  async function loadCourses() {
    if (!courseList) return;

    try {
      const response = await fetch('/api/courses');

      if (!response.ok) throw new Error('API indisponível');

      academyCourses = await response.json();

      if (!Array.isArray(academyCourses)) academyCourses = [];
    } catch (_) {
      academyCourses = [];
    }

    renderCourses();
  }

  $('#course-search')?.addEventListener('input', renderCourses);

  loadCourses();

  if (location.hash === '#enrolment-modal') openEnrolment();

  $('#open-enrolment')?.addEventListener('click', openEnrolment);

  $('#close-enrolment')?.addEventListener('click', () => {
    modal?.classList.add('hidden');
  });

  modal?.addEventListener('click', event => {
    if (event.target === modal) modal.classList.add('hidden');
  });

  $$('a[href="academia.html#enrolment-modal"]').forEach(link => {
    link.addEventListener('click', event => {
      if (location.pathname.endsWith('academia.html')) {
        event.preventDefault();
        openEnrolment();
      }
    });
  });

  $('#enrolment-form')?.addEventListener('submit', async event => {
    event.preventDefault();

    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const msg = $('#enrolment-message');

    try {
      const response = await fetch('/api/course-registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Não foi possível enviar a inscrição.');
      }

      if (msg) {
        msg.textContent = result.message;
        msg.classList.remove('hidden');
      }

      form.reset();
    } catch (error) {
      if (msg) {
        msg.textContent = location.protocol === 'file:'
          ? 'Para enviar a inscrição, inicia o site com INICIAR-ULANDU.bat.'
          : error.message;

        msg.classList.remove('hidden');
      }
    }
  });

  // Animated statistics.
  async function animateStats() {
    const nodes = $$('[data-stat]');

    if (!nodes.length) return;

    let values = {
      courses_completed: 8,
      professionals_trained: 75,
      events_dialogues: 8
    };

    try {
      const response = await fetch('/api/site-stats');

      if (response.ok) {
        values = { ...values, ...await response.json() };
      }
    } catch (_) {}

    nodes.forEach(element => {
      element.dataset.target = String(
        Number(values[element.dataset.stat] ?? element.dataset.target ?? 0)
      );

      element.textContent = '0';
    });

    const run = element => {
      if (element.dataset.counted) return;

      element.dataset.counted = '1';

      const target = Math.max(0, Number(element.dataset.target) || 0);

      if (reduceMotion) {
        element.textContent = target.toLocaleString('pt-PT') + '+';
        return;
      }

      const start = performance.now();
      const duration = 1350;

      const tick = now => {
        const progress = Math.min(1, (now - start) / duration);

        element.textContent =
          Math.floor(target * (1 - Math.pow(1 - progress, 3)))
            .toLocaleString('pt-PT') +
          (progress === 1 ? '+' : '');

        if (progress < 1) requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    };

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            run(entry.target);
            io.unobserve(entry.target);
          }
        });
      }, { threshold: .45 });

      nodes.forEach(node => io.observe(node));
    } else {
      nodes.forEach(run);
    }
  }

  animateStats();

  // Global search.
  const searchForm = $('#global-search');
  const searchInput = $('#global-search-input');
  const searchResults = $('#global-search-results');

  searchForm?.addEventListener('submit', async event => {
    event.preventDefault();

    const query = (searchInput?.value || '').trim();

    if (!query || !searchResults) return;

    searchResults.classList.remove('hidden');
    searchResults.textContent = 'A pesquisar…';

    const results = [];

    const add = (title, description, url) => {
      if ((title + ' ' + description).toLowerCase().includes(query.toLowerCase())) {
        results.push({ title, description, url });
      }
    };

    const staticItems = [
      ['Serviços', 'Comunicação estratégica, assessoria de imprensa, eventos e formação', 'servicos.html'],
      ['Academia Ulandu', 'Cursos e programas de formação profissional', 'academia.html'],
      ['Quem Somos', 'História, missão e visão da Ulandu', 'sobre.html'],
      ['Contacto', 'Fale com a equipa da Ulandu', 'contacto.html'],
      ['Fórum CIAI', 'Fórum, comunicação e diálogo', 'forum-ciai.html'],
      ['Diálogos', 'Encontros e conversas profissionais', 'dialogos.html']
    ];

    staticItems.forEach(item => add(...item));

    try {
      const [contentResponse, coursesResponse] = await Promise.all([
        fetch('/api/content'),
        fetch('/api/courses')
      ]);

      if (contentResponse.ok) {
        (await contentResponse.json()).forEach(item => {
          add(
            item.title,
            item.summary || item.body,
            ({
              news: 'noticias.html',
              blog: 'blog.html',
              project: 'projetos.html',
              media: 'multimedia.html'
            })[item.type] || 'noticias.html'
          );
        });
      }

      if (coursesResponse.ok) {
        (await coursesResponse.json()).forEach(item => {
          add(item.title, item.description, 'academia.html');
        });
      }
    } catch (_) {}

    searchResults.replaceChildren();

    if (!results.length) {
      searchResults.textContent =
        'Não foram encontrados resultados. Tenta outras palavras.';
      return;
    }

    results.slice(0, 8).forEach(item => {
      const link = document.createElement('a');
      link.href = item.url;

      const strong = document.createElement('strong');
      strong.textContent = item.title;

      const small = document.createElement('div');
      small.textContent = item.description;

      link.append(strong, small);
      searchResults.append(link);
    });
  });

  // Current year.
  $$('[data-year]').forEach(element => {
    element.textContent = new Date().getFullYear();
  });
})();