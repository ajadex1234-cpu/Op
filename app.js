// js/app.js - shared interactions: header shadow, animated labels, forms, gsap animations & RSS loader
document.addEventListener('DOMContentLoaded', () => {
  // AOS init
  if (window.AOS) AOS.init({ duration: 700, once: true, easing: 'ease-out-cubic', offset: 80 });

  // GSAP scroll animations
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.utils.toArray('.card, .work, .service, .testimonial').forEach((el) => {
      gsap.fromTo(el, { autoAlpha: 0, y: 20 }, {
        duration: 0.9, autoAlpha: 1, y: 0, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' }
      });
    });
  }

  // year
  document.getElementById('year') && (document.getElementById('year').textContent = new Date().getFullYear());

  // header shadow
  const header = document.querySelector('.site-header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 8) header.classList.add('shadow'); else header.classList.remove('shadow');
    });
  }

  // animated labels
  function bindLabel(id) {
    const wrap = document.getElementById(id);
    if (!wrap) return;
    const input = wrap.querySelector('input,textarea,select');
    if (!input) return;
    const toggle = () => input.value && input.value.trim() !== '' ? wrap.classList.add('active') : wrap.classList.remove('active');
    input.addEventListener('focus', () => wrap.classList.add('active'));
    input.addEventListener('blur', toggle);
    input.addEventListener('input', toggle);
    toggle();
  }
  ['lf-name','lf-email','lf-service','lf-msg','cf-name','cf-email','cf-msg'].forEach(bindLabel);

  // Formspree endpoint
  const FORMSPREE = 'https://formspree.io/f/myzbgdle';

  async function postForm(payload) {
    const r = await fetch(FORMSPREE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return r.ok;
  }

  // lead form
  const leadForm = document.getElementById('leadForm');
  if (leadForm) {
    leadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('leadBtn');
      btn && btn.classList.add('loading');
      const payload = {
        name: document.getElementById('leadName').value.trim(),
        email: document.getElementById('leadEmail').value.trim(),
        service: document.getElementById('leadService').value,
        message: document.getElementById('leadMsg').value.trim(),
        _subject: 'New lead — Ajadex'
      };
      if (!payload.name || !payload.email) { alert('Please provide name and email'); btn && btn.classList.remove('loading'); return; }
      try {
        const ok = await postForm(payload);
        if (ok) { alert('Thanks — we received your request.'); leadForm.reset(); ['lf-name','lf-email','lf-service','lf-msg'].forEach(id => document.getElementById(id)?.classList.remove('active')); }
        else alert('Could not send — email: expertajadex@gmail.com');
      } catch (err) { console.error(err); alert('Network error'); }
      btn && btn.classList.remove('loading');
    });
  }

  // contact form
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('contactBtn');
      btn && btn.classList.add('loading');
      const payload = {
        name: document.getElementById('cname').value.trim(),
        email: document.getElementById('cemail').value.trim(),
        message: document.getElementById('cmsg').value.trim(),
        _subject: 'Contact form — Ajadex'
      };
      if (!payload.name || !payload.email || !payload.message) { alert('All fields required'); btn && btn.classList.remove('loading'); return; }
      try {
        const ok = await postForm(payload);
        if (ok) { alert('Message sent — thank you.'); contactForm.reset(); ['cf-name','cf-email','cf-msg'].forEach(id => document.getElementById(id)?.classList.remove('active')); }
        else alert('Could not send — email: expertajadex@gmail.com');
      } catch (err) { console.error(err); alert('Network error'); }
      btn && btn.classList.remove('loading');
    });
  }

  // FAQ accordion
  document.querySelectorAll('.faq-q').forEach(q => {
    q.addEventListener('click', () => {
      const item = q.closest('.faq-item');
      const open = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
      if (!open) item.classList.add('open');
    });
  });

  // RSS feed loader via serverless proxy
  const RSS_SOURCES = [
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
    { name: 'Wired', url: 'https://www.wired.com/feed/rss' },
    { name: 'HubSpot', url: 'https://blog.hubspot.com/marketing/rss.xml' },
    { name: 'SearchEngineJournal', url: 'https://www.searchenginejournal.com/category/seo/feed/' }
  ];

  async function fetchViaProxy(url) {
    // Try Vercel path first, fallback to Netlify functions path
    const tryPaths = [
      `/api/rss-proxy?url=${encodeURIComponent(url)}`,
      `/.netlify/functions/rss-proxy?url=${encodeURIComponent(url)}`
    ];
    for (const p of tryPaths) {
      try {
        const r = await fetch(p);
        if (!r.ok) continue;
        const txt = await r.text();
        return txt;
      } catch (err) {
        // continue to next
      }
    }
    throw new Error('proxy failed');
  }

  function parseRss(xmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    const items = Array.from(doc.querySelectorAll('item')).slice(0,3);
    return items.map(it => {
      const title = it.querySelector('title')?.textContent || '';
      const link = it.querySelector('link')?.textContent || it.querySelector('guid')?.textContent || '#';
      const pubDate = it.querySelector('pubDate')?.textContent || '';
      const desc = it.querySelector('description')?.textContent || '';
      let img = '';
      const media = it.querySelector('media\\:content, enclosure, image');
      if (media && media.getAttribute) img = media.getAttribute('url') || '';
      if (!img) {
        const m = desc.match(/<img[^>]+src="([^">]+)"/i);
        if (m) img = m[1];
      }
      const snippet = desc.replace(/<[^>]*>/g,'').trim().slice(0,180);
      return { title, link, pubDate, img, snippet };
    });
  }

  async function loadBlogGrid(selector = '#blogGrid') {
    const grid = document.querySelector(selector);
    if (!grid) return;
    grid.innerHTML = '<div style="grid-column:1/-1;color:var(--muted)">Loading latest articles…</div>';
    const posts = [];
    for (const s of RSS_SOURCES) {
      try {
        const xml = await fetchViaProxy(s.url);
        const items = parseRss(xml);
        items.forEach(it => posts.push({ ...it, source: s.name }));
      } catch (err) {
        console.warn('feed failed', s.name, err);
      }
    }
    if (posts.length === 0) { grid.innerHTML = '<div style="grid-column:1/-1;color:var(--muted)">Could not fetch external feeds — try again later.</div>'; return; }
    posts.sort((a,b) => (Date.parse(b.pubDate)||0) - (Date.parse(a.pubDate)||0));
    const top = posts.slice(0,6);
    grid.innerHTML = '';
    top.forEach(p => {
      const el = document.createElement('article');
      el.className = 'card post';
      el.innerHTML = `
        <a href="${p.link}" target="_blank" rel="noopener noreferrer">
          <div style="height:140px;overflow:hidden;border-radius:8px;background:#f2f6fb">${p.img? `<img src="${p.img}" alt="">` : `<div style="height:140px;display:flex;align-items:center;justify-content:center;color:var(--muted)">No image</div>`}</div>
        </a>
        <h4 style="margin:10px 0 6px;font-size:16px"><a href="${p.link}" target="_blank">${p.title}</a></h4>
        <div class="small muted">${p.source} · ${p.pubDate ? new Date(p.pubDate).toLocaleDateString() : ''}</div>
        <p class="small muted" style="margin-top:8px">${p.snippet}...</p>
      `;
      grid.appendChild(el);
    });
    window.AOS && AOS.refresh();
  }

  // run blog load if grid exists
  loadBlogGrid('#blogGrid');
});