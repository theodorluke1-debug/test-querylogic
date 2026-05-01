/**
 * auditflow.js
 * Zentrales Skript für Landing Page UND Dashboard.
 * Kombiniert präzise Audit-Logik mit Supabase & LocalStorage Persistenz.
 */

(function () {
  'use strict';

  const LANG = document.documentElement.lang === 'en' ? 'en' : 'de';
  const DASH = 'auditflow.html';
  const HOME = LANG === 'en' ? 'index-en.html' : 'index.html';

  const SUPABASE_URL  = 'https://hqzudwrvfwucwijiztlt.supabase.co';
  const SUPABASE_ANON = 'sb_publishable_xbdT5jumnRVp4KdZs3nI0w_QvzwV172';

  const STATE = {
    user: null,
    sb: null,
    lastResult: null,
    history: [],
    plan: 'free',
    auditCount: 0
  };

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  function icons() { if (window.lucide) lucide.createIcons(); }

  // ── STORAGE HELPERS ──────────────────────────────────
  const Storage = {
    saveLastAudit: (data) => {
      localStorage.setItem('af_last_audit', JSON.stringify(data));
    },
    getLastAudit: () => {
      const d = localStorage.getItem('af_last_audit');
      return d ? JSON.parse(d) : null;
    },
    saveHistory: (list) => {
      localStorage.setItem('af_audit_history', JSON.stringify(list.slice(0, 20)));
    },
    getHistory: () => {
      const d = localStorage.getItem('af_audit_history');
      return d ? JSON.parse(d) : [];
    }
  };

  // ── INITIALISIERUNG ──────────────────────────────────
  async function init() {
    initPageLoader();
    initSupabase();
    
    STATE.lastResult = Storage.getLastAudit();
    STATE.history = Storage.getHistory();
    
    if (window.location.pathname.includes(DASH)) {
      if (STATE.lastResult && typeof renderResults === 'function') {
        renderResults(STATE.lastResult, STATE.lastResult.htmlRaw || '');
      }
      updateHistoryUi();
    }

    initLandingEvents();
  }

  function initPageLoader() {
    const loader = $('pageLoader');
    if (!loader) return;
    const hide = () => {
      loader.classList.add('fade-out');
      setTimeout(() => { if (loader) loader.style.display = 'none'; }, 450);
    };
    if (document.readyState === 'complete') setTimeout(hide, 200);
    else window.addEventListener('load', () => setTimeout(hide, 200));
  }

  function initSupabase() {
    if (!window.supabase?.createClient) return;
    STATE.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: true, autoRefreshToken: true }
    });

    STATE.sb.auth.onAuthStateChange(async (_e, session) => {
      STATE.user = session?.user ?? null;
      syncUserUi();
      
      if (STATE.user) {
        await syncWithSupabase();
      }
    });
  }

  async function syncWithSupabase() {
    if (!STATE.sb || !STATE.user) return;

    try {
      const { data: audits } = await STATE.sb.from('audits').select('*').eq('user_id', STATE.user.id).order('created_at', { ascending: false });
      const { data: prof } = await STATE.sb.from('profiles').select('plan').eq('id', STATE.user.id).single();
      
      STATE.auditCount = audits?.length || 0;
      STATE.plan = prof?.plan || 'free';
      STATE.history = audits || [];
      
      Storage.saveHistory(STATE.history);
      updateCounterUi();
      updateHistoryUi();

      if (STATE.history.length > 0 && !STATE.lastResult) {
        const latest = STATE.history[0].scores_json;
        if (latest) {
          STATE.lastResult = latest;
          Storage.saveLastAudit(latest);
          if (window.location.pathname.includes(DASH) && typeof renderResults === 'function') {
            renderResults(latest, latest.htmlRaw || '');
          }
        }
      }
    } catch (e) {
      console.warn("Supabase Sync Error:", e);
    }
  }

  function syncUserUi() {
    const u = STATE.user;
    $('btnNavAuth')?.classList.toggle('hidden', !!u);
    $('btnNavSignOut')?.classList.toggle('hidden', !u);
    $('btnNavDashboard')?.classList.toggle('hidden', !u);
    
    const ne = $('navUserEmail') || $('navEmail');
    if (ne) ne.textContent = u?.email || '';
    
    $('btnSignOut')?.classList.toggle('hidden', !u);
    
    const cta = $('btnNavCta');
    if (cta) {
      cta.textContent = LANG === 'en' ? (u ? 'Dashboard' : 'Start auditing') : (u ? 'Zum Dashboard' : 'Audit starten');
      cta.onclick = () => { window.location.href = u ? DASH : '#'; if(!u) openAuthModal(); };
    }
    icons();
  }

  function updateCounterUi() {
    const el = $('auditCounter');
    if (el) {
      const limit = STATE.plan === 'free' ? '5' : '∞';
      el.textContent = `${STATE.auditCount}/${limit}`;
    }
  }

  function updateHistoryUi() {
    const ul = $('dashHistory');
    if (!ul) return;
    
    if (STATE.history.length === 0) {
      ul.innerHTML = `<li class="text-xs text-zinc-600 italic">${LANG === 'en' ? 'No audits yet' : 'Noch keine Audits'}</li>`;
      return;
    }

    ul.innerHTML = STATE.history.map(row => {
      const res = row.scores_json;
      const sc = res?.total ?? res?.primary?.total ?? '—';
      const url = (row.url || '').replace(/^https?:\/\//, '').slice(0, 25);
      const date = new Date(row.created_at).toLocaleDateString(LANG === 'en' ? 'en-US' : 'de-DE');
      const col = sc >= 75 ? 'text-lime' : sc >= 55 ? 'text-amber-300' : 'text-red-400';
      
      return `
        <li class="hist-item rounded-lg px-2 py-2 -mx-2 group" onclick="window.loadAuditFromHistory('${row.id}')">
          <div class="flex items-center justify-between mb-0.5">
            <span class="font-mono font-bold ${col} text-sm">${sc}</span>
            <span class="text-[10px] text-zinc-600">${date}</span>
          </div>
          <span class="text-xs text-zinc-500 truncate block group-hover:text-zinc-300 transition">${esc(url)}</span>
        </li>`;
    }).join('');
  }

  window.loadAuditFromHistory = (id) => {
    const audit = STATE.history.find(h => h.id === id);
    if (audit && audit.scores_json) {
      STATE.lastResult = audit.scores_json;
      Storage.saveLastAudit(audit.scores_json);
      if (typeof renderResults === 'function') {
        renderResults(audit.scores_json, audit.scores_json.htmlRaw || '');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  // ── AUTH MODAL ───────────────────────────────────────
  function openAuthModal() {
    const el = $('authModal');
    if (el) {
      el.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
      icons();
    } else {
      window.location.href = DASH;
    }
  }

  window.closeAuthModal = () => {
    $('authModal')?.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  };

  // ── LANDING EVENTS ───────────────────────────────────
  function initLandingEvents() {
    $('btnNavAuth')?.addEventListener('click', openAuthModal);
    $('btnNavSignOut')?.addEventListener('click', async () => {
      await STATE.sb.auth.signOut();
      window.location.reload();
    });
    
    initFaq();
    initHeaderShrink();
  }

  function initFaq() {
    document.querySelectorAll('[data-faq-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('aria-controls');
        const panel = id && $(id);
        const open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', open ? 'false' : 'true');
        panel?.classList.toggle('hidden', open);
        const icon = btn.querySelector('[data-faq-icon]');
        if (icon) icon.style.transform = open ? '' : 'rotate(180deg)';
      });
    });
  }

  function initHeaderShrink() {
    const header = $('siteHeader');
    if (!header) return;
    window.addEventListener('scroll', () => {
      header.classList.toggle('is-compact', window.scrollY > 48);
    }, { passive: true });
  }

  // ── FETCH HELPERS ────────────────────────────────────
  async function fetchBridge(url) {
    const u = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const t0 = performance.now();
    const r = await fetch(u);
    const t1 = performance.now();
    const j = await r.json();
    return { text: j.contents || '', status: r.status, pageStatus: j.status?.http_code ?? null, ms: Math.round(t1 - t0) };
  }

  async function fetchPage(url) {
    const t0 = performance.now();
    try {
      const r = await fetch(url, { mode: 'cors', credentials: 'omit', headers: { Accept: 'text/html' }});
      const t1 = performance.now();
      if (r.ok) {
        const html = await r.text();
        const t2 = performance.now();
        return { html, via: 'direct', pageStatus: r.status, timings: { ttfbMs: Math.round(t1-t0), totalMs: Math.round(t2-t0), bytesApprox: new Blob([html]).size }};
      }
    } catch(_) {}
    const t0b = performance.now();
    const b = await fetchBridge(url);
    const t2 = performance.now();
    return { html: b.text, via: 'bridge', pageStatus: b.pageStatus, timings: { ttfbMs: Math.round(b.ms*.4), totalMs: Math.round(t2-t0b), bytesApprox: new Blob([b.text]).size, note:'Bridge' }};
  }

  async function fetchTextAny(url) {
    try { const r = await fetch(url,{mode:'cors',credentials:'omit'}); if(r.ok) return r.text(); } catch(_){}
    const b = await fetchBridge(url); return b.text;
  }

  async function probeHeaders(url) {
    const out = { ok:false, headers:{}, note:null };
    try {
      const r = await fetch(url,{method:'HEAD',mode:'cors',credentials:'omit'});
      r.headers.forEach((v,k) => { out.headers[k.toLowerCase()] = v; });
      out.ok = true;
    } catch { out.note = 'Header nicht lesbar (CORS).'; }
    return out;
  }

  // ── AUDIT ENGINE ─────────────────────────────────────
  const STOP = new Set('der die das und oder mit von zu im auf ist sind ein eine den dem des für wird nicht als auch noch nur kann man wie bei aus an um über unter the and for with from that this are was were been has have had or not any your our'.split(' '));

  function kwDensity(text) {
    const words = (text||'').toLowerCase().replace(/[^a-zäöüß0-9\s]/gi,' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
    const total = words.length || 1;
    const freq = {};
    words.forEach(w => { freq[w] = (freq[w]||0)+1; });
    return Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([w,c])=>({word:w,count:c,density:((c/total)*100).toFixed(2)}));
  }

  function scoreList(arr) {
    let s = 100;
    (arr||[]).forEach(f => { if(f.l==='e') s-=18; if(f.l==='w') s-=7; });
    return Math.max(0, Math.min(100, Math.round(s)));
  }

  function parseDom(html, pageUrl) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const F = { seo:[], performance:[], security:[], structure:[], ux:[] };
    const gm = n => [...doc.querySelectorAll('meta')].find(m=>(m.getAttribute('name')||m.getAttribute('property')||'').toLowerCase()===n)?.getAttribute('content')?.trim();

    const title = doc.querySelector('title')?.textContent?.trim() || '';
    const desc = gm('description') || gm('og:description');
    const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim();

    if (!title) F.seo.push({l:'e',m:'Fehlender <title>'});
    else F.seo.push({l:'o',m:`Title: "${esc(title.slice(0,60))}"`});
    if (!desc) F.seo.push({l:'e',m:'Fehlende Meta-Description'});
    else F.seo.push({l:'o',m:`Meta-Desc: ${desc.length} Zeichen`});
    if (canonical) F.seo.push({l:'o',m:`Canonical: ${esc(canonical.slice(0,60))}`});
    else F.seo.push({l:'w',m:'Kein canonical Link'});
    
    const h1n = doc.querySelectorAll('h1').length;
    if (!h1n) F.seo.push({l:'e',m:'Fehlender H1'});
    else if (h1n > 1) F.seo.push({l:'w',m:`${h1n} H1-Tags (besser: einer)`});
    else F.seo.push({l:'o',m:'H1 vorhanden'});

    const imgs = [...doc.querySelectorAll('img')];
    const noAlt = imgs.filter(i => !i.hasAttribute('alt')).length;
    if (noAlt) F.structure.push({l:'e',m:`${noAlt} Bilder ohne alt-Text`});
    
    const blockHead = [...doc.querySelectorAll('head script[src]')].filter(s=>!s.async&&!s.defer).length;
    if (blockHead) F.performance.push({l:'w',m:`${blockHead} render-blocking Scripts im <head>`});

    const kd = kwDensity(doc.body?.innerText || '');
    
    let https = true;
    try { https = new URL(pageUrl).protocol === 'https:'; } catch{ https = false; }
    if (!/^https?:\/\//i.test(pageUrl)) F.security.push({l:'o',m:'TLS nicht bewertbar (eingefügtes HTML)'});
    else if (!https) F.security.push({l:'e',m:'Kein HTTPS!'});
    else F.security.push({l:'o',m:'HTTPS aktiv'});

    return { doc, findings:F, kd, title, canonical, metaDesc:desc };
  }

  async function deepAudit(pageUrl, html, timings, skip=false) {
    const { findings, kd, title, canonical, metaDesc } = parseDom(html, pageUrl);

    if (!skip && /^https?:\/\//i.test(pageUrl)) {
      try {
        const origin = new URL(pageUrl).origin;
        const robots = await fetchTextAny(origin+'/robots.txt');
        if (robots.trim()) {
          findings.seo.push({l:'o',m:`robots.txt (${robots.length} Zeichen)`});
        }
      } catch {}

      const sec = await probeHeaders(pageUrl);
      if (sec.ok) {
        const h = sec.headers;
        findings.security.push({l:h['strict-transport-security']?'o':'w', m:h['strict-transport-security']?'HSTS ✓':'Kein HSTS'});
        findings.security.push({l:h['content-security-policy']?'o':'w', m:h['content-security-policy']?'CSP ✓':'Kein CSP'});
      }
    }

    if (timings) {
      if (timings.totalMs > 5000) findings.performance.push({l:'w',m:`Langsamer Abruf: ${timings.totalMs}ms`});
      else findings.performance.push({l:'o',m:`Abruf: ${timings.totalMs}ms`});
    }

    const dims = {
      seo: scoreList(findings.seo),
      performance: scoreList(findings.performance),
      security: scoreList(findings.security),
      structure: scoreList([...findings.structure,...findings.ux])
    };
    const total = scoreList([...findings.seo,...findings.performance,...findings.security,...findings.structure,...findings.ux]);

    return { version:5, pageUrl, timings, kd, title, canonical, metaDesc, dimensions:dims, total, findings, htmlRaw: html };
  }

  // Export
  window.AF_STATE = STATE;
  window.AF_STORAGE = Storage;
  window.AF_DEEP_AUDIT = deepAudit;
  window.AF_FETCH_PAGE = fetchPage;

  init();

})();
