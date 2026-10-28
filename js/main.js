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
        .map((b) => `<div class="benefit reveal"><h3>${esc(b.title)}</h3><p>${esc(b.text)}</p></div>`).join('');
    });
    if (site.heroImage) {
      const hero = $('.hero');
      hero.classList.add('has-image');
      document.body.classList.add('hero-image');
      // 轉成完整網址，否則 CSS 會以 css/ 資料夾為基準去找圖片
      hero.style.setProperty('--hero-img', `url("${new URL(img(site.heroImage), location.href).href}")`);
    }
    if (site.reikiBg) $('#reiki').style.setProperty('--reiki-bg', `url("${new URL(img(site.reikiBg), location.href).href}")`);
    if (site.siteName) document.title = site.siteName;
    // Logo：後台有上傳就換掉導覽列與瀏覽器分頁的小圖示
    if (site.logo) {
      $('.brand-mark').src = img(site.logo);
      $$('link[rel="icon"], link[rel="apple-touch-icon"]').forEach((l) => { l.href = img(site.logo); l.removeAttribute('type'); });
    }

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

  /* ---------- 靈魂藍圖 ---------- */
  // 預覽模式：在自己電腦上，或網址加上 ?preview=1 時（例如給夥伴看的連結）
  // 這時就算後台把靈魂藍圖設成「不顯示」，也會顯示出來，並附上風格切換按鈕
  const isPreview = location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname)
    || new URLSearchParams(location.search).has('preview');

  function renderSoul(d) {
    const on = (d.show !== false || isPreview) && !!d.title;
    $('#soul').hidden = !on;
    $('#nav-soul').hidden = !on;
    if (!on) return;
    $('#soul-title').textContent = d.title;
    $('#soul-sub').textContent = d.subtitle || '';
    $('#soul-intro').innerHTML = md(d.intro);
    const pic = $('#soul-img');
    if (!d.image) pic.closest('figure').hidden = true;

    // 風格：site 統一風格（預設，和頌缽、大地靈氣同色系）／warm 溫暖淡雅／dreamy 夢幻星空／mystic 神秘高雅／fresh 清新自然
    // 深色風格會改用夜空版的配圖（有設定 imageDark 時）
    const THEMES = { site: '統一風格', warm: '溫暖淡雅', dreamy: '夢幻星空', mystic: '神秘高雅', fresh: '清新自然' };
    const section = $('#soul');
    const applyTheme = (t) => {
      if (!THEMES[t]) t = 'site';
      Object.keys(THEMES).forEach((k) => section.classList.toggle(`theme-${k}`, k === t && k !== 'warm'));
      const dark = t === 'dreamy' || t === 'mystic';
      if (d.image) pic.src = img(dark && d.imageDark ? d.imageDark : d.image);
      $$('.soul-switch button', section).forEach((b) => b.classList.toggle('is-active', b.dataset.theme === t));
    };
    // 只有預覽模式才顯示切換按鈕方便比較；一般訪客照後台設定的風格顯示
    if (isPreview && !$('.soul-switch', section)) {
      const bar = document.createElement('div');
      bar.className = 'soul-switch';
      bar.innerHTML = '<span>預覽風格（一般訪客看不到這排按鈕）：</span>'
        + Object.entries(THEMES).map(([k, v]) => `<button type="button" data-theme="${k}">${v}</button>`).join('');
      bar.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) applyTheme(b.dataset.theme); });
      $('.container', section).prepend(bar);
    }
    applyTheme(d.theme);
    $('#soul-aspects').innerHTML = (d.aspects || []).map((a) => `<li><strong>${esc(a.title)}</strong><span>${esc(a.text)}</span></li>`).join('');
    $('#soul-suitable').innerHTML = (d.suitable || []).map((t) => `<li>${esc(t)}</li>`).join('');
    $('#soul-steps').innerHTML = (d.steps || []).map((s) => `<li><strong>${esc(s.title)}</strong><span>${esc(s.text)}</span></li>`).join('');
    $('#soul-combo').innerHTML = d.combo ? md(d.combo) : '';
    const btn = $('#soul-btn');
    btn.hidden = !d.ctaLink;
    btn.href = d.ctaLink || '#';
    btn.textContent = d.ctaText || '私訊預約';
    $('#soul-note').textContent = d.note || '';
  }

  /* ---------- 最新活動 ---------- */
  // 沒有活動（或全部設為不顯示）時，整個區塊和導覽列連結一起隱藏，不留空白
  function renderEvents(data) {
    const items = (data.items || []).filter((ev) => ev.show !== false && (ev.title || ev.image));
    const section = $('#events');
    section.hidden = items.length === 0;
    $('#nav-events').hidden = items.length === 0;
    if (!items.length) return;
    const list = $('#event-list');
    list.classList.toggle('is-single', items.length === 1);
    list.innerHTML = items.map((ev) => {
      const meta = [['日期', ev.date], ['時間', ev.time], ['地點', ev.location]]
        .filter(([, v]) => v).map(([k, v]) => `<li data-label="${k}">${esc(v)}</li>`).join('');
      return `<article class="event-card reveal">
        ${ev.image ? `<div class="event-poster"><img src="${esc(img(ev.image))}" alt="${esc(ev.title)}" loading="lazy"></div>` : ''}
        <div class="event-body">
          ${ev.tag ? `<span class="badge">${esc(ev.tag)}</span>` : ''}
          <h3>${esc(ev.title)}</h3>
          ${meta ? `<ul class="course-meta">${meta}</ul>` : ''}
          ${ev.description ? `<div class="course-desc">${md(ev.description)}</div>` : ''}
          ${ev.link ? `<a class="btn btn-primary btn-small" href="${esc(ev.link)}" target="_blank" rel="noopener">${esc(ev.linkText || '了解更多')}</a>` : ''}
        </div>
      </article>`;
    }).join('');
  }

  /* ---------- 購物商城（銀行匯款） ---------- */
  const money = (n) => `NT$ ${Number(n || 0).toLocaleString('en-US')}`;
  const CART_KEY = 'bowl-shop-cart';
  const readCart = () => { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (e) { return []; } };
  const writeCart = (c) => { try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch (e) { /* 無痕模式等情況存不了，不影響本次購物 */ } };

  function renderShop(data, settings, site) {
    const products = (data.items || []).filter((p) => p.show !== false && p.name);
    $('#shop').hidden = products.length === 0;
    $('#nav-shop').hidden = products.length === 0;
    if (!products.length) return;
    if (settings.intro) $('#shop-intro').textContent = settings.intro;

    const byId = new Map(products.map((p, i) => [String(i), p]));
    const unitPrice = (p) => Number(p.salePrice || p.price || 0);
    let cart = readCart().filter((c) => byId.has(c.id) && byId.get(c.id).name === c.name && Number(byId.get(c.id).price) > 0);

    // 沒填售價（或填 0）的商品不能直接下單，改成「價格請洽詢」並導向私訊
    const askUrl = settings.messengerUrl || 'https://m.me/rekibowl988';
    const noPrice = (p) => !(Number(p.price) > 0);
    const priceTag = (p) => (noPrice(p) ? '<span class="price-now">價格請洽詢</span>'
      : p.salePrice ? `<span class="price-now">${money(p.salePrice)}</span><s>${money(p.price)}</s>` : `<span class="price-now">${money(p.price)}</span>`);

    $('#product-grid').innerHTML = products.map((p, i) => {
      const soldOut = p.status === '售完';
      const buyBtn = noPrice(p) && !soldOut
        ? `<a class="btn btn-primary btn-small" href="${esc(askUrl)}" target="_blank" rel="noopener">私訊詢問</a>`
        : `<button class="btn btn-primary btn-small" data-add="${i}" ${soldOut ? 'disabled' : ''}>${soldOut ? '已售完' : '加入購物車'}</button>`;
      return `<article class="product-card reveal" data-id="${i}">
        <button class="product-img" data-view="${i}" aria-label="查看 ${esc(p.name)}">
          ${p.image ? `<img src="${esc(img(p.image))}" alt="${esc(p.name)}" loading="lazy">` : ''}
          ${p.status && p.status !== '現貨' ? `<span class="badge ${soldOut ? 'ended' : ''}">${esc(p.status)}</span>` : ''}
        </button>
        <div class="product-body">
          <h3>${esc(p.name)}</h3>
          ${p.summary ? `<p class="product-summary">${esc(p.summary)}</p>` : ''}
          <div class="product-price">${priceTag(p)}</div>
          <div class="product-actions">
            <button class="btn btn-ghost btn-small" data-view="${i}">商品介紹</button>
            ${buyBtn}
          </div>
        </div>
      </article>`;
    }).join('');

    const updateFab = () => {
      const count = cart.reduce((s, c) => s + c.qty, 0);
      $('#cart-count').textContent = count;
      $('#cart-fab').hidden = count === 0;
      writeCart(cart);
    };
    const add = (id) => {
      const p = byId.get(id);
      const line = cart.find((c) => c.id === id);
      if (line) line.qty += 1; else cart.push({ id, name: p.name, qty: 1 });
      updateFab();
      const fab = $('#cart-fab');
      fab.classList.remove('bump'); void fab.offsetWidth; fab.classList.add('bump');
    };

    // 商品介紹（可放多張相片）
    const view = (id) => {
      const p = byId.get(id);
      const pics = [p.image, ...(p.images || [])].filter(Boolean);
      openModal(`
        ${pics.length ? `<div class="product-gallery">${pics.map((src) => `<img src="${esc(img(src))}" alt="">`).join('')}</div>` : ''}
        ${p.status ? `<span class="post-date">${esc(p.status)}</span>` : ''}
        <h2>${esc(p.name)}</h2>
        <div class="product-price">${priceTag(p)}</div>
        <div class="prose">${md(p.description || p.summary)}</div>
        ${p.status === '售完' ? '' : noPrice(p)
          ? `<p><a class="btn btn-primary" href="${esc(askUrl)}" target="_blank" rel="noopener">私訊詢問</a></p>`
          : `<p><button class="btn btn-primary" data-add-modal="${id}">加入購物車</button></p>`}`);
    };
    $('#product-grid').addEventListener('click', (e) => {
      const a = e.target.closest('[data-add]');
      if (a && !a.disabled) return add(a.dataset.add);
      const v = e.target.closest('[data-view]');
      if (v) view(v.dataset.view);
    });
    $('#post-modal').addEventListener('click', (e) => {
      const a = e.target.closest('[data-add-modal]');
      if (!a) return;
      add(a.dataset.addModal);
      a.textContent = '已加入購物車 ✓';
    });

    // 購物車／結帳
    const modal = $('#cart-modal');
    const body = $('#cart-body');
    const shippingFor = (subtotal, method) => {
      if (method === 'pickup') return 0;
      const fee = Number(settings.shippingFee || 0);
      const free = Number(settings.freeShippingOver || 0);
      return free && subtotal >= free ? 0 : fee;
    };
    const totals = (method) => {
      const subtotal = cart.reduce((s, c) => s + unitPrice(byId.get(c.id)) * c.qty, 0);
      const shipping = shippingFor(subtotal, method);
      return { subtotal, shipping, total: subtotal + shipping };
    };
    const pickupOn = settings.allowPickup !== false;

    const showCart = () => {
      if (!cart.length) {
        body.innerHTML = `<h2>購物車</h2><p class="empty">購物車是空的。</p>`;
        return;
      }
      const t = totals('delivery');
      body.innerHTML = `
        <h2>購物車</h2>
        <ul class="cart-lines">${cart.map((c) => {
          const p = byId.get(c.id);
          return `<li data-id="${c.id}">
            ${p.image ? `<img src="${esc(img(p.image))}" alt="">` : '<span class="cart-thumb"></span>'}
            <div class="cart-name">${esc(p.name)}<small>${money(unitPrice(p))}</small></div>
            <div class="qty"><button data-dec aria-label="減少">−</button><span>${c.qty}</span><button data-inc aria-label="增加">＋</button></div>
            <div class="cart-sub">${money(unitPrice(p) * c.qty)}</div>
            <button class="cart-del" data-del aria-label="移除">×</button>
          </li>`;
        }).join('')}</ul>
        <div class="cart-total"><span>商品小計</span><strong>${money(t.subtotal)}</strong></div>
        ${settings.shippingFee ? `<p class="cart-hint">宅配運費 ${money(settings.shippingFee)}${settings.freeShippingOver ? `，滿 ${money(settings.freeShippingOver)} 免運` : ''}${pickupOn ? '；面交自取免運費' : ''}</p>` : ''}
        <p><button class="btn btn-primary btn-block" data-checkout>前往結帳</button></p>`;
    };

    const showForm = () => {
      body.innerHTML = `
        <h2>填寫訂購資料</h2>
        <form class="order-form" novalidate>
          <label>姓名<input name="name" autocomplete="name" required></label>
          <label>手機<input name="phone" type="tel" autocomplete="tel" required placeholder="0912345678"></label>
          <fieldset><legend>取貨方式</legend>
            <label class="radio"><input type="radio" name="method" value="delivery" checked> 宅配</label>
            ${pickupOn ? `<label class="radio"><input type="radio" name="method" value="pickup"> 面交自取${settings.pickupNote ? `（${esc(settings.pickupNote)}）` : ''}</label>` : ''}
          </fieldset>
          <label class="addr">收件地址<input name="address" autocomplete="street-address"></label>
          <label>備註（可不填）<textarea name="note" rows="2"></textarea></label>
          <div class="cart-total" id="form-total"></div>
          <p class="form-error" id="form-error" hidden></p>
          <p class="form-btns"><button type="button" class="btn btn-ghost" data-back>回購物車</button><button class="btn btn-primary">送出訂單</button></p>
        </form>`;
      const form = $('.order-form', body);
      const refresh = () => {
        const method = form.method.value;
        $('.addr', form).hidden = method === 'pickup';
        const t = totals(method);
        $('#form-total').innerHTML = `<span>小計 ${money(t.subtotal)}＋運費 ${money(t.shipping)}</span><strong>合計 ${money(t.total)}</strong>`;
      };
      form.addEventListener('change', refresh);
      form.addEventListener('input', () => { $('#form-error').hidden = true; });
      refresh();
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(form));
        const errs = [];
        if (!f.name.trim()) errs.push('請填寫姓名');
        if (!/^0\d{8,9}$/.test(f.phone.replace(/[\s-]/g, ''))) errs.push('請填寫正確的手機號碼');
        if (f.method === 'delivery' && !f.address.trim()) errs.push('請填寫收件地址');
        if (errs.length) { $('#form-error').textContent = errs.join('、'); $('#form-error').hidden = false; return; }
        showDone(f);
      });
    };

    const showDone = (f) => {
      const t = totals(f.method);
      const now = new Date();
      const no = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      const lines = cart.map((c) => { const p = byId.get(c.id); return `・${p.name} × ${c.qty}　${money(unitPrice(p) * c.qty)}`; });
      const text = [
        `【網站訂單】編號 ${no}`,
        `姓名：${f.name}`, `手機：${f.phone}`,
        `取貨：${f.method === 'pickup' ? '面交自取' : `宅配　${f.address}`}`,
        '— 訂購商品 —', ...lines,
        `運費：${money(t.shipping)}`, `合計：${money(t.total)}`,
        f.note ? `備註：${f.note}` : '',
        '匯款帳號末五碼：（匯款後請填寫）',
      ].filter(Boolean).join('\n');
      const bank = [['銀行', [settings.bankName, settings.bankCode && `(${settings.bankCode})`].filter(Boolean).join(' ')], ['分行', settings.bankBranch], ['戶名', settings.accountName], ['帳號', settings.accountNumber]]
        .filter(([, v]) => v);
      const lineUrl = settings.lineUrl || ((site.contacts || []).find((c) => c.type === 'line') || {}).url;
      const fbUrl = settings.messengerUrl || 'https://m.me/rekibowl988';
      body.innerHTML = `
        <h2>訂單已建立</h2>
        <p class="done-lead">請在 ${esc(settings.payDays || '3')} 天內匯款 <strong>${money(t.total)}</strong>，並把下方訂單內容和<strong>匯款帳號末五碼</strong>傳給老師，確認收款後就會出貨。</p>
        <div class="bank-box">
          <h3>匯款資訊</h3>
          ${bank.length ? `<dl>${bank.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}<dt>金額</dt><dd><strong>${money(t.total)}</strong></dd></dl>`
            : '<p>匯款帳號請私訊老師索取。</p>'}
        </div>
        <h3 class="order-h">訂單內容</h3>
        <pre class="order-text" id="order-text">${esc(text)}</pre>
        <div class="order-actions">
          <button class="btn btn-primary" data-copy>複製訂單內容</button>
          ${lineUrl ? `<a class="btn btn-ghost" href="${esc(lineUrl)}" target="_blank" rel="noopener">開啟 LINE 傳給老師</a>` : ''}
          <a class="btn btn-ghost" href="${esc(fbUrl)}" target="_blank" rel="noopener">開啟 Messenger 傳給老師</a>
          ${settings.email ? `<a class="btn btn-ghost" href="mailto:${esc(settings.email)}?subject=${encodeURIComponent(`網站訂單 ${no}`)}&body=${encodeURIComponent(text)}">用 Email 寄給老師</a>` : ''}
        </div>
        <p class="cart-hint">先按「複製訂單內容」，再開啟 LINE 或 Messenger 貼上傳送即可。${settings.orderNote ? esc(settings.orderNote) : ''}</p>`;
      cart = [];
      updateFab();
    };

    body.addEventListener('click', (e) => {
      const li = e.target.closest('.cart-lines li');
      if (li) {
        const line = cart.find((c) => c.id === li.dataset.id);
        if (e.target.closest('[data-inc]')) line.qty += 1;
        else if (e.target.closest('[data-dec]')) line.qty = Math.max(1, line.qty - 1);
        else if (e.target.closest('[data-del]')) cart = cart.filter((c) => c !== line);
        else return;
        updateFab();
        return showCart();
      }
      if (e.target.closest('[data-checkout]')) return showForm();
      if (e.target.closest('[data-back]')) return showCart();
      if (e.target.closest('[data-copy]')) {
        const text = $('#order-text').textContent;
        const done = () => { e.target.textContent = '已複製 ✓'; };
        if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => selectText());
        else selectText();
      }
    });
    const selectText = () => {
      const r = document.createRange(); r.selectNodeContents($('#order-text'));
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    };
    $('#cart-fab').addEventListener('click', () => { showCart(); modal.showModal(); modal.scrollTop = 0; });
    updateFab();
  }

  /* ---------- 課程 ---------- */
  // 有早鳥價時：早鳥價放大、原價加刪除線；沒有就只顯示原價
  const priceHTML = (c) => {
    if (!c.earlyPrice) return `<span class="course-price">${c.price ? esc(c.price) : ''}</span>`;
    return `<div class="course-price has-early">
      <span class="price-early"><small>早鳥價</small>${esc(c.earlyPrice)}</span>
      ${c.price ? `<span class="price-original"><small>原價</small><s>${esc(c.price)}</s></span>` : ''}
      ${c.earlyDeadline ? `<span class="price-deadline">早鳥優惠至 ${esc(c.earlyDeadline)}</span>` : ''}
    </div>`;
  };

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
            ${priceHTML(c)}
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

  /* ---------- 學員分享 ---------- */
  // 頌缽、大地靈氣的心得：各放最新 5 篇，在介紹區塊裡自動輪播
  // 個案療癒的心得：放在「療癒分享」區塊，最多 5 篇；沒有時整個區塊隱藏
  const FB_PAGE = 'https://www.facebook.com/rekibowl988';
  const storyCard = (s, i, extra = '') => `
    <button class="story-card ${extra}" data-i="${i}">
      ${s.photo ? `<div class="story-photo"><img src="${esc(img(s.photo))}" alt="" loading="lazy"></div>` : ''}
      <span class="story-course">${esc(s.course)}</span>
      <blockquote>${esc(s.quote || s.title)}</blockquote>
      <p>${esc(s.summary)}</p>
      <span class="story-who">— ${esc(s.student || '學員')}</span>
    </button>`;

  function renderStories(data) {
    const all = (data.items || []).slice().sort(byDateDesc);

    $$('[data-story-slider]').forEach((box) => {
      const items = all.filter((s) => s.category === box.dataset.storySlider).slice(0, 5);
      box.hidden = items.length === 0;
      const navLink = $(`.nav-links a[href="#${box.id}"]`);
      if (navLink) navLink.hidden = items.length === 0;
      if (!items.length) return;
      box.innerHTML = `
        <div class="slider-head"><span class="eyebrow">Student Stories</span><h3>學員分享</h3></div>
        <div class="slides">${items.map((s, i) => storyCard(s, i, i === 0 ? 'is-active' : '')).join('')}</div>
        <div class="slider-foot">
          ${items.length > 1 ? `<div class="slider-dots">${items.map((_, i) => `<button class="${i === 0 ? 'is-active' : ''}" data-go="${i}" aria-label="第 ${i + 1} 篇"></button>`).join('')}</div>` : '<span></span>'}
          <a class="more-link" href="${FB_PAGE}" target="_blank" rel="noopener">到粉絲專頁看更多分享 →</a>
        </div>`;
      bindStoryModal(box, items);
      if (items.length > 1) startSlider(box, items.length);
    });

    const cases = all.filter((s) => s.category === '個案').slice(0, 5);
    $('#stories').hidden = cases.length === 0;
    const caseLink = $('.nav-links a[href="#stories"]');
    if (caseLink) caseLink.hidden = cases.length === 0;
    const grid = $('#story-grid');
    grid.innerHTML = cases.map((s, i) => storyCard(s, i, 'reveal')).join('');
    bindStoryModal(grid, cases);
  }

  // 自動輪播：6 秒換一篇；滑鼠移上去或手指按住時暫停；手機可左右滑動
  function startSlider(box, count) {
    const cards = $$('.story-card', box);
    const dots = $$('.slider-dots button', box);
    let cur = 0, timer = null, paused = false;
    const go = (n) => {
      cur = (n + count) % count;
      cards.forEach((c, i) => c.classList.toggle('is-active', i === cur));
      dots.forEach((d, i) => d.classList.toggle('is-active', i === cur));
    };
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = () => { if (!paused && !document.hidden) go(cur + 1); };
    if (!reduce) timer = setInterval(tick, 6000);
    box.addEventListener('mouseenter', () => { paused = true; });
    box.addEventListener('mouseleave', () => { paused = false; });
    dots.forEach((d) => d.addEventListener('click', () => go(+d.dataset.go)));
    let x0 = null;
    box.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; paused = true; }, { passive: true });
    box.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) go(cur + (dx < 0 ? 1 : -1));
      paused = false; x0 = null;
    });
    return timer;
  }

  function bindStoryModal(root, items) {
    root.addEventListener('click', (e) => {
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
      <button class="post-card reveal" data-i="${i}">
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
    const isMobileMenu = () => window.matchMedia('(max-width: 1180px)').matches;
    $$('.nav-links a').forEach((a) => a.addEventListener('click', (e) => {
      // 手機版：點「課程活動」「療癒分享」只展開／收合子選單，不跳頁
      if (a.classList.contains('nav-drop-top') && isMobileMenu()) {
        e.preventDefault();
        const drop = a.parentElement;
        const open = !drop.classList.contains('is-open');
        $$('.nav-drop').forEach((d) => d.classList.toggle('is-open', d === drop && open));
        return;
      }
      nav.classList.remove('is-open');
      $$('.nav-drop').forEach((d) => d.classList.remove('is-open'));
      a.blur(); // 收起桌機版的下拉選單
      // 下拉選單的分類：跳到該區塊並套用同名的分類篩選
      if (a.dataset.jump) {
        const chip = $(`[data-filter-group="${a.dataset.jump}"] [data-filter="${a.dataset.cat}"]`);
        if (chip) chip.click();
      }
    }));

    $$('dialog').forEach((d) => {
      $('.modal-close', d).addEventListener('click', () => d.close());
      d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    });
    $('#year').textContent = new Date().getFullYear();
  }

  function observeReveal() {
    const els = $$('.reveal:not(.is-visible)');
    // 同一排的卡片一張接一張淡入（最多延遲 0.45 秒）
    els.forEach((el) => {
      const sibs = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
      if (sibs.length > 1) el.style.transitionDelay = `${Math.min(sibs.indexOf(el) * 0.09, 0.45)}s`;
    });
    if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-visible')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach((el) => io.observe(el));

    // 粗體重點字：進到畫面中間時，螢光筆依序畫過去（同一段裡的字一個接一個）
    const marks = $$('.prose strong');
    if (!('IntersectionObserver' in window)) { marks.forEach((m) => m.classList.add('is-lit')); return; }
    const io2 = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const siblings = $$('strong', en.target.closest('.prose'));
        en.target.style.transitionDelay = `${0.3 + siblings.indexOf(en.target) * 0.35}s`;
        en.target.classList.add('is-lit');
        io2.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -25% 0px' });
    marks.forEach((m) => io2.observe(m));
  }

  /* ---------- 小動態：飄起的光點、捲動進度條 ---------- */
  function setupMotion() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // 光點：首頁 16 顆、大地靈氣區塊 10 顆，大小、速度、位置都隨機
    [['.hero', 16], ['#reiki', 22]].forEach(([sel, n]) => {
      const host = $(sel);
      if (!host) return;
      const box = document.createElement('div');
      box.className = 'motes';
      box.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < n; i++) {
        const m = document.createElement('i');
        const size = sel === '#reiki' ? 6 + Math.random() * 9 : 3 + Math.random() * 7;
        m.style.cssText = `left:${Math.random() * 100}%;width:${size}px;height:${size}px;`
          + `animation-duration:${14 + Math.random() * 16}s;animation-delay:${-Math.random() * 30}s;`
          + `--drift:${(Math.random() * 80 - 40).toFixed(0)}px`;
        box.appendChild(m);
      }
      host.prepend(box);
    });
    // 進度條
    const bar = document.createElement('div');
    bar.className = 'scroll-progress';
    document.body.appendChild(bar);
    let ticking = false;
    const update = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
      ticking = false;
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  setupUI();
  setupMotion();
  Promise.all(['site', 'events', 'courses', 'shop', 'shop-settings', 'stories', 'posts', 'gallery', 'soul'].map(loadJSON)).then(([site, events, courses, shop, shopSettings, stories, posts, gallery, soul]) => {
    renderSite(site);
    renderSoul(soul);
    renderEvents(events);
    renderShop(shop, shopSettings, site);
    renderCourses(courses);
    renderStories(stories);
    renderPosts(posts);
    renderGallery(gallery);
    observeReveal();
  });
})();
