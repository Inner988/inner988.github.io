// 網站內容全部放在 content/*.json，由後台 (/admin) 編輯；這支程式負責讀取並顯示。
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const md = (s) => (window.marked ? marked.parse(String(s || ''), { breaks: true }) : `<p>${esc(s).replace(/\n/g, '<br>')}</p>`);
  // 後台存的圖片路徑可能是 "/images/uploads/x.jpg"，改成相對路徑，放在任何網址底下都能顯示
  const img = (p) => (!p ? '' : /^(https?:)?\/\//.test(p) ? p : p.replace(/^\//, ''));
  // 直接雙擊 index.html 時瀏覽器不允許讀取 json，改用 content/local-data.js 裡的備份
  const localData = (name) => (window.LOCAL_CONTENT || {})[name] || {};
  const loadJSON = (name) => (location.protocol === 'file:'
    ? Promise.resolve(localData(name))
    : fetch(`content/${name}.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : localData(name))).catch(() => localData(name)));
  const formatDate = (d) => {
    if (!d) return '';
    const t = new Date(d);
    return isNaN(t) ? esc(d) : `${t.getFullYear()}.${String(t.getMonth() + 1).padStart(2, '0')}.${String(t.getDate()).padStart(2, '0')}`;
  };

  /* ---------- 網站基本資料 ---------- */
  function renderSite(site) {
    $$('[data-site]').forEach((el) => {
      const v = site[el.dataset.site];
      if (v) el.innerHTML = esc(v).replace(/\n/g, '<br>');
    });
    $$('[data-site-md]').forEach((el) => { el.innerHTML = md(site[el.dataset.siteMd]); });
    $$('[data-site-img]').forEach((el) => {
      const v = site[el.dataset.siteImg];
      if (v) { el.src = img(v); el.hidden = false; }
    });
    $$('[data-site-list]').forEach((el) => {
      el.innerHTML = (site[el.dataset.siteList] || []).map((t) => `<li>${esc(t)}</li>`).join('');
    });
    $$('[data-site-benefits]').forEach((el) => {
      el.innerHTML = (site[el.dataset.siteBenefits] || [])
        .map((b) => `<div class="benefit"><h3>${esc(b.title)}</h3><p>${esc(b.text)}</p></div>`).join('');
    });
    if (site.heroImage) {
      const hero = $('.hero');
      hero.classList.add('has-image');
      document.body.classList.add('hero-image');
      // 轉成完整網址，否則 CSS 會以 css/ 資料夾為基準去找圖片
      hero.style.setProperty('--hero-img', `url("${new URL(img(site.heroImage), location.href).href}")`);
    }
    if (site.siteName) document.title = site.siteName;

    const icons = { phone: '電話', line: 'LINE', email: 'Mail', facebook: 'FB', instagram: 'IG', address: '地址', other: '…' };
    $('#contact-list').innerHTML = (site.contacts || []).map((c) => {
      const href = c.url || (c.type === 'phone' ? `tel:${c.value}` : c.type === 'email' ? `mailto:${c.value}` : '');
      const inner = `<span class="contact-icon">${icons[c.type] || '…'}</span><span><small>${esc(c.label)}</small>${esc(c.value)}</span>`;
      return `<li>${href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${inner}</a>` : `<a>${inner}</a>`}</li>`;
    }).join('');

    // QR Code：有上傳圖片就用圖片；臉書／LINE 只填了連結的話，自動產生
    const qrTitles = { facebook: '掃描前往粉絲專頁', line: '掃描加入 LINE 官方帳號' };
    $('#qr-list').innerHTML = (site.contacts || []).map((c) => {
      let code = '';
      if (c.qr) code = `<img src="${esc(img(c.qr))}" alt="${esc(c.label)} QR Code" onerror="this.closest('.qr-card').remove()">`;
      else if (c.url && qrTitles[c.type] && window.qrcode) {
        const q = qrcode(0, 'M');
        q.addData(c.url);
        q.make();
        code = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
      }
      if (!code) return '';
      const title = qrTitles[c.type] || c.label;
      return `<figure class="qr-card"><div class="qr-code">${code}</div><figcaption>${esc(title)}</figcaption></figure>`;
    }).join('');
  }

  /* ---------- 課程 ---------- */
  function renderCourses(data) {
    const order = { '招生中': 0, '即將開課': 1, '已額滿': 2, '已結束': 3 };
    const items = (data.items || []).filter((c) => c.show !== false)
      .map((c, i) => ({ ...c, _i: i }))
      .sort((a, b) => (order[a.status] ?? 1) - (order[b.status] ?? 1) || a._i - b._i);
    const list = $('#course-list');
    list.innerHTML = items.map((c) => {
      const badgeClass = c.status === '已額滿' ? 'full' : c.status === '已結束' ? 'ended' : '';
      const meta = [['日期', c.date], ['時間', c.time], ['時長', c.duration], ['地點', c.location]]
        .filter(([, v]) => v).map(([k, v]) => `<li data-label="${k}">${esc(v)}</li>`).join('');
      const canSignup = c.link && c.status !== '已結束' && c.status !== '已額滿';
      return `<article class="course reveal${c.status === '已結束' ? ' is-ended' : ''}" data-cat="${esc(c.category)}">
        <div class="course-media">${c.image ? `<img src="${esc(img(c.image))}" alt="${esc(c.title)}" loading="lazy">` : ''}
          ${c.status ? `<span class="badge ${badgeClass}">${esc(c.status)}</span>` : ''}</div>
        <div class="course-body">
          <span class="course-cat">${esc(c.category)}</span>
          <h3>${esc(c.title)}</h3>
          <ul class="course-meta">${meta}</ul>
          <div class="course-desc">${md(c.description)}</div>
          <div class="course-foot">
            <span class="course-price">${esc(c.price)}</span>
            ${canSignup ? `<a class="btn btn-primary btn-small" href="${esc(c.link)}" target="_blank" rel="noopener">我要報名</a>` : ''}
          </div>
        </div></article>`;
    }).join('');
    setupFilter('[data-filter-group="courses"]', $$('.course', list), (el) => el.dataset.cat, $('#course-empty'));
  }

  const byDateDesc = (a, b) => String(b.date || '').localeCompare(String(a.date || ''));
  const openModal = (html) => {
    $('#post-modal-body').innerHTML = html;
    $('#post-modal').showModal();
    $('#post-modal').scrollTop = 0;
  };

  /* ---------- 療癒分享（學員心得） ---------- */
  function renderStories(data) {
    const items = (data.items || []).slice().sort(byDateDesc);
    const grid = $('#story-grid');
    const more = $('#story-more');
    const PAGE = 6;
    let shown = PAGE;
    const draw = () => {
      grid.innerHTML = items.slice(0, shown).map((s, i) => `
        <button class="story-card reveal is-visible" data-i="${i}">
          ${s.photo ? `<div class="story-photo"><img src="${esc(img(s.photo))}" alt="" loading="lazy"></div>` : ''}
          <span class="story-course">${esc(s.course)}</span>
          <blockquote>${esc(s.quote || s.title)}</blockquote>
          <p>${esc(s.summary)}</p>
          <span class="story-who">— ${esc(s.student || '學員')}</span>
        </button>`).join('');
      more.hidden = shown >= items.length;
    };
    draw();
    more.addEventListener('click', () => { shown += PAGE; draw(); });
    grid.addEventListener('click', (e) => {
      const card = e.target.closest('.story-card');
      if (!card) return;
      const s = items[+card.dataset.i];
      openModal(`
        ${s.photo ? `<img class="post-hero" src="${esc(img(s.photo))}" alt="">` : ''}
        <span class="post-date">${esc(s.course)}${s.date ? `　${formatDate(s.date)}` : ''}</span>
        <h2>${esc(s.title)}</h2>
        <div class="prose">${md(s.body || s.summary)}</div>
        <p class="story-who">— ${esc(s.student || '學員')}</p>
        ${s.link ? `<p><a class="btn btn-ghost btn-small" href="${esc(s.link)}" target="_blank" rel="noopener">閱讀完整原文</a></p>` : ''}`);
    });
  }

  /* ---------- 老師隨筆 ---------- */
  function renderPosts(data) {
    // 網站只放最新 3 篇，其他文章引導到臉書粉專
    const items = (data.items || []).slice().sort(byDateDesc).slice(0, 3);
    const grid = $('#post-grid');
    $('#post-empty').hidden = items.length > 0;
    grid.innerHTML = items.map((p, i) => `
      <button class="post-card reveal is-visible" data-i="${i}">
        <div class="post-cover">${p.cover ? `<img src="${esc(img(p.cover))}" alt="" loading="lazy">` : ''}</div>
        <div class="post-info"><span class="post-date">${formatDate(p.date)}</span>
          <h3>${esc(p.title)}</h3><p>${esc(p.summary)}</p></div>
      </button>`).join('');
    grid.addEventListener('click', (e) => {
      const card = e.target.closest('.post-card');
      if (!card) return;
      const p = items[+card.dataset.i];
      openModal(`
        ${p.cover ? `<img class="post-hero" src="${esc(img(p.cover))}" alt="">` : ''}
        <span class="post-date">${formatDate(p.date)}</span>
        <h2>${esc(p.title)}</h2>
        <div class="prose">${md(p.body || p.summary)}</div>`);
    });
  }

  /* ---------- 相簿 ---------- */
  function renderGallery(data) {
    const items = (data.items || []).filter((g) => g.image);
    const grid = $('#gallery-grid');
    grid.innerHTML = items.map((g, i) => `
      <figure class="reveal" data-i="${i}" data-album="${esc(g.album || '')}">
        <img src="${esc(img(g.image))}" alt="${esc(g.caption)}" loading="lazy">
        ${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ''}
      </figure>`).join('');
    $('#gallery-empty').hidden = items.length > 0;

    const albums = [...new Set(items.map((g) => g.album).filter(Boolean))];
    if (albums.length > 1) {
      $('#gallery-filters').innerHTML = `<button class="chip is-active" data-filter="all">全部</button>` +
        albums.map((a) => `<button class="chip" data-filter="${esc(a)}">${esc(a)}</button>`).join('');
      setupFilter('#gallery-filters', $$('figure', grid), (el) => el.dataset.album);
    }

    // 看大圖（只在目前篩選後可見的相片間切換）
    const lb = $('#lightbox');
    let visible = [], cur = 0;
    const show = () => {
      const g = items[visible[cur]];
      $('#lb-img').src = img(g.image);
      $('#lb-img').alt = g.caption || '';
      $('#lb-cap').textContent = g.caption || '';
    };
    grid.addEventListener('click', (e) => {
      const fig = e.target.closest('figure');
      if (!fig) return;
      visible = $$('figure', grid).filter((f) => !f.hidden).map((f) => +f.dataset.i);
      cur = visible.indexOf(+fig.dataset.i);
      show();
      lb.showModal();
    });
    const step = (d) => { cur = (cur + d + visible.length) % visible.length; show(); };
    $('.lb-prev', lb).addEventListener('click', () => step(-1));
    $('.lb-next', lb).addEventListener('click', () => step(1));
    lb.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') step(-1); if (e.key === 'ArrowRight') step(1); });
  }

  function setupFilter(groupSel, els, getCat, emptyEl) {
    const group = $(groupSel);
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      $$('.chip', group).forEach((c) => c.classList.toggle('is-active', c === btn));
      const f = btn.dataset.filter;
      let count = 0;
      els.forEach((el) => {
        const ok = f === 'all' || getCat(el) === f;
        el.hidden = !ok;
        if (ok) { count++; el.classList.add('is-visible'); }
      });
      if (emptyEl) emptyEl.hidden = count > 0;
    });
    if (emptyEl) emptyEl.hidden = els.length > 0;
  }

  /* ---------- 互動：導覽列、彈窗、淡入 ---------- */
  function setupUI() {
    const nav = $('#nav');
    const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    const toggle = $('.nav-toggle');
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open);
    });
    $$('.nav-links a').forEach((a) => a.addEventListener('click', () => nav.classList.remove('is-open')));

    $$('dialog').forEach((d) => {
      $('.modal-close', d).addEventListener('click', () => d.close());
      d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    });
    $('#year').textContent = new Date().getFullYear();
  }

  function observeReveal() {
    const els = $$('.reveal:not(.is-visible)');
    if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-visible')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach((el) => io.observe(el));
  }

  setupUI();
  Promise.all(['site', 'courses', 'stories', 'posts', 'gallery'].map(loadJSON)).then(([site, courses, stories, posts, gallery]) => {
    renderSite(site);
    renderCourses(courses);
    renderStories(stories);
    renderPosts(posts);
    renderGallery(gallery);
    observeReveal();
  });
})();
