(function () {
  'use strict';

  const LANG = document.documentElement.lang === 'en' ? 'en' : 'de';
  const HOME = LANG === 'en' ? 'index-en.html' : 'index.html';

  const I18N = {
    de: {
      authNeedLogin: 'Bitte anmelden, um Audits auszuführen.',
      supabaseMissing: 'Supabase nicht geladen',
      urlOrHtml: 'URL oder HTML angeben',
      urlBad: 'URL nicht erreichbar',
      saved: 'Automatisch gespeichert.',
      saveFail: 'Speichern fehlgeschlagen: ',
      savedManual: 'Gespeichert.',
      magicSent: 'Magic Link gesendet — bitte Postfach prüfen.',
      magicFail: 'Magic Link konnte nicht gesendet werden.',
      pwShort: 'Passwort mindestens 8 Zeichen.',
      checkEmail: 'Checken Sie Ihr Postfach zur Bestätigung (falls aktiviert).',
      demoRunning: 'Analyse läuft…',
      demoError: 'Audit fehlgeschlagen. URL prüfen oder später erneut versuchen.',
      termsAgree: 'Mit der Anmeldung akzeptieren Sie unsere',
      dimensions: { seo: 'SEO', performance: 'Performance', security: 'Security', structure: 'Struktur' },
      bandHigh: 'Enterprise‑tauglich',
      bandMid: 'Solide — nachschärfen',
      bandLow: 'Handlungsbedarf',
      noCritical: 'Keine kritischen Warnungen.',
      actionTitle: 'Handlungs‑Checkliste',
      compareTitle: 'Wettbewerbs‑Vergleich',
      compareColYou: 'Ihre Seite',
      compareColComp: 'Konkurrenz',
      compareScore: 'Gesamt‑Score',
      compareDim: 'Dimension',
      pdfGenerating: 'PDF wird erstellt…',
      pdfFail: 'PDF‑Export fehlgeschlagen.',
      embedCopy: 'Snippet kopiert',
    },
    en: {
      authNeedLogin: 'Please sign in to run audits.',
      supabaseMissing: 'Supabase not loaded',
      urlOrHtml: 'Enter a URL or HTML',
      urlBad: 'URL unreachable',
      saved: 'Saved automatically.',
      saveFail: 'Save failed: ',
      savedManual: 'Saved.',
      magicSent: 'Magic link sent — check your inbox.',
      magicFail: 'Could not send magic link.',
      pwShort: 'Password must be at least 8 characters.',
      checkEmail: 'Check your inbox to confirm (if enabled).',
      demoRunning: 'Analyzing…',
      demoError: 'Audit failed. Check the URL or try again later.',
      termsAgree: 'By signing in you agree to our',
      dimensions: { seo: 'SEO', performance: 'Performance', security: 'Security', structure: 'Structure' },
      bandHigh: 'Enterprise-ready',
      bandMid: 'Solid — room to improve',
      bandLow: 'Needs work',
      noCritical: 'No critical warnings.',
      actionTitle: 'Action checklist',
      compareTitle: 'Competitive benchmark',
      compareColYou: 'Your site',
      compareColComp: 'Competitor',
      compareScore: 'Overall score',
      compareDim: 'Dimension',
      pdfGenerating: 'Building PDF…',
      pdfFail: 'PDF export failed.',
      embedCopy: 'Snippet copied',
    },
  };

  const t = (k) => I18N[LANG][k] || k;
  const td = (k) => I18N[LANG].dimensions[k] || k;

  const SUPABASE_URL = 'https://hqzudwrvfwucwijiztlt.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_xbdT5jumnRVp4KdZs3nI0w_QvzwV172';
  const CONFIG = { USE_PUBLIC_CORS_BRIDGE: true };

  const STATE = { view: 'landing', authTab: 'signin', user: null, lastScores: null, lastCompare: null };
  let sb = null;

  const $ = (id) => document.getElementById(id);

  function icons() {
    if (window.lucide) lucide.createIcons();
  }

  function openAuthModal() {
    const el = $('authModal');
    if (el) {
      el.classList.remove('hidden');
      el.setAttribute('aria-hidden', 'false');
      document.body.classList.add('overflow-hidden');
      showAuthTab('signin');
      showAuthView('main');
      icons();
    }
  }

  function showAuthView(which) {
    $('authViewMain')?.classList.toggle('hidden', which !== 'main');
    $('authViewMagic')?.classList.toggle('hidden', which !== 'magic');
    $('authViewPass')?.classList.toggle('hidden', which !== 'pass');
    $('authViewConfirm')?.classList.toggle('hidden', which !== 'confirm');
    icons();
  }

  function closeAuthModal() {
    const el = $('authModal');
    if (el) {
      el.classList.add('hidden');
      el.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('overflow-hidden');
    }
    $('authError')?.classList.add('hidden');
    $('authErrorUp')?.classList.add('hidden');
  }

  function setView(name) {
    STATE.view = name;
    document.querySelectorAll('.view').forEach((el) => {
      el.classList.toggle('active', el.id === 'view-' + name);
    });
    document.querySelectorAll('.nav-landing-only').forEach((el) => {
      el.classList.toggle('hidden', name !== 'landing');
    });
    document.querySelectorAll('.nav-dash-only').forEach((el) => {
      el.classList.toggle('hidden', !STATE.user);
    });
    const signOut = $('btnNavSignOut');
    if (signOut) signOut.classList.toggle('hidden', !STATE.user);
    const authBtn = $('btnNavAuth');
    if (authBtn) authBtn.classList.toggle('hidden', !!STATE.user);
    const cta = $('btnNavCta');
    if (cta) {
      if (LANG === 'en') {
        cta.textContent = STATE.user && name === 'landing' ? 'Dashboard' : 'Start auditing';
      } else {
        cta.textContent = STATE.user && name === 'landing' ? 'Zum Dashboard' : 'Audit starten';
      }
    }
    icons();
  }

  function initSupabase() {
    if (!window.supabase?.createClient) return;
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
    sb.auth.onAuthStateChange((_e, session) => {
      STATE.user = session?.user ?? null;
      syncUserUi();
    });
  }

  async function syncUserUi() {
    const u = STATE.user;
    const ne = $('navUserEmail');
    if (ne) ne.textContent = u?.email || '';
    $('btnNavSignOut')?.classList.toggle('hidden', !u);
    $('btnNavAuth')?.classList.toggle('hidden', !!u);
    if (u) closeAuthModal();
    if (u) await loadDashHistory();
    icons();
  }

  async function refreshUser() {
    if (!sb) return;
    const { data: { session } } = await sb.auth.getSession();
    STATE.user = session?.user ?? null;
    syncUserUi();
  }

  async function fetchBridge(url) {
    const u = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const t0 = performance.now();
    const r = await fetch(u);
    const t1 = performance.now();
    const j = await r.json();
    const httpCode = j.status?.http_code ?? null;
    return { text: j.contents || '', status: r.status, pageStatus: httpCode, ms: Math.round(t1 - t0) };
  }

  async function fetchPage(url) {
    const t0 = performance.now();
    try {
      const r = await fetch(url, { mode: 'cors', credentials: 'omit', headers: { Accept: 'text/html' } });
      const t1 = performance.now();
      const pageStatus = r.status;
      if (r.ok) {
        const html = await r.text();
        const t2 = performance.now();
        return {
          html,
          via: 'direct',
          pageStatus,
          timings: { ttfbMs: Math.round(t1 - t0), bodyMs: Math.round(t2 - t1), totalMs: Math.round(t2 - t0), bytesApprox: new Blob([html]).size },
        };
      }
    } catch (_) {}
    if (CONFIG.USE_PUBLIC_CORS_BRIDGE) {
      const t0b = performance.now();
      const b = await fetchBridge(url);
      const t2 = performance.now();
      return {
        html: b.text,
        via: 'cors-bridge',
        pageStatus: b.pageStatus,
        timings: { ttfbMs: Math.round(b.ms * 0.4), bodyMs: Math.round(b.ms * 0.6), totalMs: Math.round(t2 - t0b), bytesApprox: new Blob([b.text]).size, note: 'Bridge' },
      };
    }
    throw new Error(t('urlBad'));
  }

  async function fetchTextAny(url) {
    try {
      const r = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (r.ok) return await r.text();
    } catch (_) {}
    const b = await fetchBridge(url);
    return b.text;
  }

  async function probeSecurityHeaders(url) {
    const out = { ok: false, headers: {}, note: null };
    try {
      const r = await fetch(url, { method: 'HEAD', mode: 'cors', credentials: 'omit' });
      r.headers.forEach((v, k) => { out.headers[k.toLowerCase()] = v; });
      out.ok = true;
    } catch {
      out.note = LANG === 'en' ? 'Headers not readable (CORS).' : 'Header nicht lesbar (CORS).';
    }
    return out;
  }

  const STOP = new Set('der die das und oder mit von zu im auf ist sind ein eine den dem des für wird wirds nicht als auch noch nur kann man wie bei aus an um über unter the and for with from that this are was were been has have had or not any your our their its they them will can may would should could'.split(/\s+/));

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function keywordDensityFromText(text) {
    const words = (text || '').toLowerCase().replace(/[^a-zäöüß0-9\s]/gi, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
    const total = words.length || 1;
    const freq = {};
    words.forEach((w) => { freq[w] = (freq[w] || 0) + 1; });
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8);
    return top.map(([w, c]) => ({ word: w, count: c, density: ((c / total) * 100).toFixed(2) }));
  }

  function parseDomAudit(html, pageUrl) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const findings = { seo: [], performance: [], security: [], structure: [], ux: [] };

    const title = doc.querySelector('title')?.textContent?.trim() || '';
    const metas = [...doc.querySelectorAll('meta')];
    const gm = (n, a = 'name') => metas.find((m) => (m.getAttribute(a) || '').toLowerCase() === n)?.getAttribute('content')?.trim();
    const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim();
    const desc = gm('description') || gm('og:description', 'property');

    if (!title) findings.seo.push({ l: 'e', m: LANG === 'en' ? 'Missing <title>' : 'Fehlender <title>' });
    if (!desc) findings.seo.push({ l: 'e', m: LANG === 'en' ? 'Missing meta description' : 'Fehlende Meta‑Description' });
    if (canonical) findings.seo.push({ l: 'o', m: `Canonical: ${canonical}` });
    else findings.seo.push({ l: 'w', m: LANG === 'en' ? 'No canonical link' : 'Kein canonical Link' });
    if (gm('robots')?.toLowerCase().includes('noindex')) findings.seo.push({ l: 'w', m: 'robots: noindex' });

    const imgs = [...doc.querySelectorAll('img')];
    const noAlt = imgs.filter((i) => !i.hasAttribute('alt')).length;
    if (noAlt) findings.structure.push({ l: 'e', m: LANG === 'en' ? `${noAlt} images missing alt` : `${noAlt} Bilder ohne alt` });

    const webpish = imgs.filter((i) => /\.webp|type="image\/webp"/i.test(i.srcset || i.src || '')).length;
    const legacy = imgs.length - webpish;
    if (imgs.length && legacy / imgs.length > 0.6) findings.performance.push({ l: 'w', m: LANG === 'en' ? 'Many images not WebP/AVIF' : 'Viele Bilder nicht als WebP/AVIF signalisiert' });

    const blockHead = [...doc.querySelectorAll('head script[src]')].filter((s) => !s.async && !s.defer).length;
    if (blockHead) findings.performance.push({ l: 'w', m: LANG === 'en' ? `${blockHead} render-blocking scripts in <head>` : `${blockHead} blockierende Skripte im <head>` });
    const cssN = doc.querySelectorAll('link[rel="stylesheet"]').length;
    const estCssKb = cssN * 35;
    findings.performance.push({ l: 'o', m: LANG === 'en' ? `Stylesheets: ${cssN} (~${estCssKb} KB est.)` : `Stylesheets: ${cssN} (~${estCssKb} KB geschätzt)` });

    const bodyText = doc.body?.innerText || '';
    const kd = keywordDensityFromText(bodyText);
    if (kd[0] && parseFloat(kd[0].density) > 5) findings.seo.push({ l: 'w', m: LANG === 'en' ? `High keyword density "${kd[0].word}": ${kd[0].density}%` : `Hohe Keyword‑Dichte „${kd[0].word}“: ${kd[0].density}%` });
    else findings.seo.push({ l: 'o', m: (LANG === 'en' ? 'Keyword top: ' : 'Keyword‑Top: ') + kd.slice(0, 3).map((k) => `${k.word} (${k.density}%)`).join(', ') });

    let tlsNA = !/^https?:\/\//i.test(pageUrl);
    let https = true;
    if (!tlsNA) {
      try { https = new URL(pageUrl).protocol === 'https:'; } catch { https = false; }
    }
    if (tlsNA) findings.security.push({ l: 'o', m: LANG === 'en' ? 'TLS N/A (pasted HTML)' : 'TLS nicht bewertbar' });
    else if (!https) findings.security.push({ l: 'e', m: LANG === 'en' ? 'Not HTTPS' : 'Kein HTTPS' });
    else findings.security.push({ l: 'o', m: LANG === 'en' ? 'HTTPS URL' : 'HTTPS‑URL' });

    const emptyA = [...doc.querySelectorAll('a[href]')].filter((a) => !(a.textContent || '').trim() && !a.querySelector('img,svg')).length;
    if (emptyA) findings.ux.push({ l: 'w', m: LANG === 'en' ? `${emptyA} empty links` : `${emptyA} leere Link(s)` });
    if (!doc.querySelector('main')) findings.ux.push({ l: 'w', m: LANG === 'en' ? 'No <main> landmark' : 'Kein <main> Landmark' });
    else findings.ux.push({ l: 'o', m: '<main> ok' });

    const h1n = doc.querySelectorAll('h1').length;
    if (!h1n) findings.seo.push({ l: 'e', m: LANG === 'en' ? 'Missing H1' : 'Fehlender H1' });
    else if (h1n > 1) findings.seo.push({ l: 'w', m: LANG === 'en' ? `${h1n} H1 tags (prefer one)` : `${h1n} H1‑Tags` });
    else findings.seo.push({ l: 'o', m: 'H1 ok' });

    return { doc, findings, kd, title, canonical, metaDesc: desc, hasTitle: !!title, hasMetaDesc: !!desc, hasH1: h1n > 0 };
  }

  async function auditRobotsSitemap(origin) {
    const seo = [];
    let robots = '';
    try {
      robots = await fetchTextAny(origin + '/robots.txt');
    } catch {
      seo.push({ l: 'w', m: LANG === 'en' ? 'robots.txt unreachable' : 'robots.txt nicht abrufbar' });
      return { seo, sitemapUrls: 0 };
    }
    if (!robots.trim()) {
      seo.push({ l: 'w', m: LANG === 'en' ? 'robots.txt empty' : 'robots.txt leer' });
      return { seo, sitemapUrls: 0 };
    }
    seo.push({ l: 'o', m: LANG === 'en' ? `robots.txt loaded (${robots.length} chars)` : `robots.txt geladen (${robots.length} Zeichen)` });
    const smLines = robots.split('\n').map((l) => l.trim()).filter((l) => /^sitemap\s*:/i.test(l));
    if (!smLines.length) seo.push({ l: 'w', m: LANG === 'en' ? 'No sitemap in robots.txt' : 'Keine Sitemap in robots.txt' });
    let sitemapUrls = 0;
    if (smLines[0]) {
      const smUrl = smLines[0].split(/:\s*/i).slice(1).join(':').trim();
      try {
        const xml = await fetchTextAny(smUrl);
        sitemapUrls = (xml.match(/<loc>/gi) || []).length;
        seo.push({ l: 'o', m: LANG === 'en' ? `Sitemap: ${sitemapUrls} URLs` : `Sitemap: ${sitemapUrls} URLs` });
      } catch {
        seo.push({ l: 'w', m: LANG === 'en' ? 'Sitemap unreadable' : 'Sitemap nicht lesbar' });
      }
    }
    return { seo, sitemapUrls };
  }

  function scoreList(arr) {
    let s = 100;
    (arr || []).forEach((f) => {
      if (f.l === 'e') s -= 18;
      if (f.l === 'w') s -= 7;
    });
    return Math.max(0, Math.min(100, Math.round(s)));
  }

  function mergeFindings(a, b) {
    Object.keys(b).forEach((k) => { a[k] = [...(a[k] || []), ...b[k]]; });
  }

  async function runDeepAuditProtocol(pageUrl, html, timings, opts = {}) {
    const skipRemote = !!opts.skipRemote;
    let origin = '';
    try { origin = new URL(pageUrl).origin; } catch { /* noop */ }

    const { findings, kd, title, canonical, metaDesc } = parseDomAudit(html, pageUrl);
    let robotsData = { seo: [], sitemapUrls: 0 };

    if (!skipRemote && origin && /^https?:\/\//i.test(pageUrl)) {
      robotsData = await auditRobotsSitemap(origin);
      mergeFindings(findings, { seo: robotsData.seo });
    } else {
      findings.seo.push({ l: 'o', m: LANG === 'en' ? 'robots/sitemap skipped' : 'robots.txt / Sitemap übersprungen' });
    }

    let secProbe = { ok: false, headers: {}, note: null };
    if (!skipRemote && /^https?:\/\//i.test(pageUrl)) {
      secProbe = await probeSecurityHeaders(pageUrl);
    } else {
      findings.security.push({ l: 'w', m: LANG === 'en' ? 'Header audit needs HTTPS URL' : 'Header‑Audit nur mit https‑URL' });
    }

    if (secProbe.ok) {
      const h = secProbe.headers;
      if (h['strict-transport-security']) findings.security.push({ l: 'o', m: 'HSTS' });
      else findings.security.push({ l: 'w', m: 'No HSTS' });
      if (h['content-security-policy']) findings.security.push({ l: 'o', m: 'CSP' });
      else findings.security.push({ l: 'w', m: 'No CSP' });
      if ((h['x-frame-options'] || '').toLowerCase() || (h['content-security-policy'] || '').includes('frame-ancestors')) {
        findings.security.push({ l: 'o', m: 'XFO/frame-ancestors' });
      } else findings.security.push({ l: 'w', m: 'No XFO' });
      if (h['x-content-type-options']?.toLowerCase() === 'nosniff') findings.security.push({ l: 'o', m: 'nosniff' });
      else findings.security.push({ l: 'w', m: 'No nosniff' });
    } else if (!skipRemote && /^https?:\/\//i.test(pageUrl)) {
      findings.security.push({ l: 'w', m: secProbe.note || 'CORS' });
    }

    if (timings) {
      if (timings.totalMs > 5000) findings.performance.push({ l: 'w', m: LANG === 'en' ? `Slow fetch: ${timings.totalMs} ms` : `Langsamer Abruf: ${timings.totalMs} ms` });
      else findings.performance.push({ l: 'o', m: (LANG === 'en' ? 'Fetch: ' : 'Abruf: ') + timings.totalMs + ' ms' });
    }

    const dims = {
      seo: scoreList(findings.seo),
      performance: scoreList(findings.performance),
      security: scoreList(findings.security),
      structure: scoreList([...findings.structure, ...findings.ux]),
    };
    const allF = [...findings.seo, ...findings.performance, ...findings.security, ...findings.structure, ...findings.ux];
    const total = scoreList(allF);

    return {
      version: 4,
      pageUrl,
      timings: timings || null,
      keywordDensity: kd,
      title,
      canonical,
      metaDesc,
      sitemapUrlCount: robotsData.sitemapUrls,
      dimensions: dims,
      total,
      findings,
    };
  }

  function renderF(msg) {
    return msg.map((x) => `<li class="${x.l === 'e' ? 'text-red-400' : x.l === 'w' ? 'text-amber-300' : 'text-emerald-400'}">${escapeHtml(x.m)}</li>`).join('');
  }

  function buildActionItems(findings) {
    const flat = [...findings.seo, ...findings.performance, ...findings.security, ...findings.structure, ...findings.ux];
    return flat.map((f) => {
      const icon = f.l === 'e' ? '🔴 ' + (LANG === 'en' ? 'CRITICAL: ' : 'KRITISCH: ') : f.l === 'w' ? '🟡 ' + (LANG === 'en' ? 'WARNING: ' : 'WARNUNG: ') : '🟢 ' + (LANG === 'en' ? 'OK: ' : 'OPTIMAL: ');
      return { level: f.l, html: icon + escapeHtml(f.m) };
    });
  }

  // ============================================================================
  // PREMIUM AUDIT FUNCTIONS
  // ============================================================================
  function estimateCoreWebVitals(html, timings) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    let lcp = 2500, cls = 0.1, fid = 100;
    const imgs = doc.querySelectorAll('img[src]').length;
    if (imgs > 5) lcp = 4000; else if (imgs > 0) lcp = 2500; else lcp = 1500;
    const noSize = [...doc.querySelectorAll('img, iframe, video')].filter(e => !e.getAttribute('width') && !e.getAttribute('height')).length;
    cls = Math.min(0.5, noSize * 0.05);
    const blockScripts = doc.querySelectorAll('head script[src]:not([async]):not([defer])').length;
    fid = 50 + blockScripts * 30;
    return { lcp, cls, fid, ttfb: timings?.totalMs || 500 };
  }
  function assessAccessibility(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    let score = 100;
    const imgsNoAlt = [...doc.querySelectorAll('img:not([alt])')].length;
    if (imgsNoAlt > 0) score -= imgsNoAlt * 3;
    if (!doc.querySelector('h1')) score -= 15;
    const inputsNoLabel = [...doc.querySelectorAll('input:not([type="hidden"])')].filter(i => !i.closest('label') && !i.getAttribute('aria-label')).length;
    if (inputsNoLabel > 0) score -= inputsNoLabel * 5;
    return Math.max(0, Math.min(100, score));
  }
  function analyzeResources(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return {
      scripts: doc.querySelectorAll('script[src]').length,
      stylesheets: doc.querySelectorAll('link[rel="stylesheet"]').length,
      images: doc.querySelectorAll('img[src]').length,
      fonts: [...doc.querySelectorAll('link[href*="font"]')].length,
    };
  }

  function renderDashboardResult(data, compare) {
    STATE.lastScores = data;
    STATE.lastCompare = compare || null;
    const f = data.findings;
    const flat = [...f.seo, ...f.performance, ...f.security, ...f.structure, ...f.ux];
    const bad = flat.filter((x) => x.l === 'e' || x.l === 'w').map((x) => x.m);
    const g = $('dashGauge');
    if (g) g.innerHTML = `<span class="text-5xl font-bold font-mono text-lime">${data.total}</span>`;
    const band = $('dashBand');
    if (band) band.textContent = data.total >= 75 ? t('bandHigh') : data.total >= 55 ? t('bandMid') : t('bandLow');
    const rows = ['seo', 'performance', 'security', 'structure'];
    const dimsEl = $('dashDims');
    if (dimsEl) {
      dimsEl.innerHTML = rows.map((k) => `<div><div class="flex justify-between text-[11px] font-mono text-zinc-400 mb-1"><span>${td(k)}</span><span class="text-lime">${data.dimensions[k]}</span></div><div class="h-1.5 rounded-full bg-zinc-800"><div class="h-full bg-lime/90 rounded-full" style="width:${data.dimensions[k]}%"></div></div></div>`).join('');
    }
    const pr = $('dashPriority');
    if (pr) pr.innerHTML = bad.length ? bad.slice(0, 20).map((m) => `<li>${escapeHtml(m)}</li>`).join('') : `<li class="text-zinc-500">${t('noCritical')}</li>`;

    const act = $('dashActions');
    if (act) {
      const items = buildActionItems(f);
      act.innerHTML = items.map((i) => `<li class="text-sm text-zinc-300 border-b border-zinc-800/80 py-2">${i.html}</li>`).join('');
    }

    const cmp = $('dashCompare');
    if (cmp) {
      if (compare && compare.b) {
        const A = compare.a;
        const B = compare.b;
        const dk = ['seo', 'performance', 'security', 'structure'];
        cmp.classList.remove('hidden');
        cmp.innerHTML = `
          <p class="text-xs font-mono text-lime uppercase mb-3">${t('compareTitle')}</p>
          <div class="overflow-x-auto">
            <table class="w-full text-xs text-left border border-zinc-800 rounded-xl overflow-hidden">
              <thead class="bg-zinc-900 text-zinc-500 font-mono uppercase">
                <tr><th class="p-2">${t('compareDim')}</th><th class="p-2">${t('compareColYou')}</th><th class="p-2">${t('compareColComp')}</th></tr>
              </thead>
              <tbody>
                <tr class="border-t border-zinc-800"><td class="p-2 font-medium text-white">${t('compareScore')}</td><td class="p-2 text-lime font-mono">${A.total}</td><td class="p-2 text-zinc-400 font-mono">${B.total}</td></tr>
                ${dk.map((k) => `<tr class="border-t border-zinc-800"><td class="p-2">${td(k)}</td><td class="p-2 font-mono">${A.dimensions[k]}</td><td class="p-2 font-mono text-zinc-400">${B.dimensions[k]}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>`;
      } else {
        cmp.classList.add('hidden');
        cmp.innerHTML = '';
      }
    }

    const deep = $('dashDeepBody');
    if (deep) {
      const kw = (data.keywordDensity || []).slice(0, 5).map((k) => escapeHtml(k.word + ' ' + k.density + '%')).join(', ');
      deep.innerHTML = `
        <div class="space-y-6">
          <div><p class="text-zinc-300 font-semibold mb-2">${td('seo')}</p><ul class="list-disc pl-4">${renderF(f.seo)}</ul></div>
          <div><p class="text-zinc-300 font-semibold mb-2">${td('performance')}</p><ul class="list-disc pl-4">${renderF(f.performance)}</ul></div>
          <div><p class="text-zinc-300 font-semibold mb-2">${td('security')}</p><ul class="list-disc pl-4">${renderF(f.security)}</ul></div>
          <div><p class="text-zinc-300 font-semibold mb-2">${td('structure')}</p><ul class="list-disc pl-4">${renderF(f.structure)}</ul></div>
          <div><p class="text-zinc-300 font-semibold mb-2">UX</p><ul class="list-disc pl-4">${renderF(f.ux)}</ul></div>
          <p class="text-zinc-500">${LANG === 'en' ? 'Keyword top: ' : 'Keyword‑Top: '}${kw || '—'}</p>
        </div>`;
    }

    // PREMIUM PANELS
    if (data.html) {
      const cwv = estimateCoreWebVitals(data.html, data.timings);
      const a11y = assessAccessibility(data.html);
      const res = analyzeResources(data.html);
      
      const cwvPanel = $('dashCoreWebVitals');
      if (cwvPanel) {
        cwvPanel.innerHTML = `
          <div class="bg-void/40 rounded p-3">
            <p class="text-zinc-500 text-[10px]">LCP</p>
            <p class="text-lg font-bold ${cwv.lcp <= 2500 ? 'text-emerald-400' : cwv.lcp <= 4000 ? 'text-amber-300' : 'text-red-400'} mt-1">${cwv.lcp}ms</p>
          </div>
          <div class="bg-void/40 rounded p-3">
            <p class="text-zinc-500 text-[10px]">CLS</p>
            <p class="text-lg font-bold ${cwv.cls <= 0.1 ? 'text-emerald-400' : cwv.cls <= 0.25 ? 'text-amber-300' : 'text-red-400'} mt-1">${cwv.cls.toFixed(2)}</p>
          </div>
          <div class="bg-void/40 rounded p-3">
            <p class="text-zinc-500 text-[10px]">FID</p>
            <p class="text-lg font-bold ${cwv.fid <= 100 ? 'text-emerald-400' : cwv.fid <= 300 ? 'text-amber-300' : 'text-red-400'} mt-1">${cwv.fid}ms</p>
          </div>
          <div class="bg-void/40 rounded p-3">
            <p class="text-zinc-500 text-[10px]">TTFB</p>
            <p class="text-lg font-bold ${cwv.ttfb <= 600 ? 'text-emerald-400' : 'text-amber-300'} mt-1">${cwv.ttfb}ms</p>
          </div>
        `;
      }
      
      const a11yPanel = $('dashAccessibility');
      if (a11yPanel) {
        a11yPanel.innerHTML = `
          <div class="inline-flex items-center justify-center w-24 h-24 rounded-full ${a11y >= 75 ? 'bg-emerald-500/10 border border-emerald-500/30' : a11y >= 55 ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-red-500/10 border border-red-500/30'} mb-3">
            <span class="text-3xl font-bold ${a11y >= 75 ? 'text-emerald-400' : a11y >= 55 ? 'text-amber-300' : 'text-red-400'}">${a11y}</span>
          </div>
          <p class="text-xs text-zinc-400">WCAG 2.1 Score</p>
        `;
      }
      
      const resPanel = $('dashResources');
      if (resPanel) {
        resPanel.innerHTML = `
          <div class="flex justify-between"><span class="text-zinc-400">Scripts:</span><span class="text-white font-mono">${res.scripts}</span></div>
          <div class="flex justify-between"><span class="text-zinc-400">Stylesheets:</span><span class="text-white font-mono">${res.stylesheets}</span></div>
          <div class="flex justify-between"><span class="text-zinc-400">${LANG === 'en' ? 'Images' : 'Bilder'}:</span><span class="text-white font-mono">${res.images}</span></div>
          <div class="flex justify-between"><span class="text-zinc-400">Fonts:</span><span class="text-white font-mono">${res.fonts}</span></div>
          <div class="flex justify-between border-t border-zinc-800 pt-2 mt-2"><span class="text-zinc-300 font-semibold">${LANG === 'en' ? 'Total' : 'Gesamt'}:</span><span class="text-lime font-mono font-bold">${res.scripts + res.stylesheets + res.images + res.fonts}</span></div>
        `;
      }
    }

    $('dashResults')?.classList.remove('hidden');
    // Lighthouse-Panel rendern
    renderLighthousePanel(data);
    icons();
  }

  async function performAudit() {
    if (!sb) { toast(t('supabaseMissing')); return; }
    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      openAuthModal();
      const er = $('authError');
      if (er) { er.textContent = t('authNeedLogin'); er.classList.remove('hidden'); }
      return;
    }

    const rawUrl = $('dashUrl')?.value.trim() || '';
    const compUrl = $('dashUrlComp')?.value.trim() || '';
    const htmlPaste = $('dashHtml')?.value.trim() || '';
    if (!rawUrl && !htmlPaste) {
      toast(t('urlOrHtml'));
      return;
    }

    // Skeleton-Loader anzeigen
    $('dashSkeleton')?.classList.remove('hidden');
    $('dashResults')?.classList.add('hidden');
    $('lighthousePanel')?.classList.add('hidden');
    const list = $('dashProgressList');
    if (list) list.innerHTML = '';
    const add = (x) => { const li = document.createElement('li'); li.textContent = '✓ ' + x; list?.appendChild(li); };

    let pageUrl = rawUrl || 'about:client-html';
    let html = htmlPaste;
    let timings = null;
    let compareResult = null;

    if (rawUrl && !htmlPaste) {
      $('dashProgressLabel').textContent = LANG === 'en' ? 'Loading page…' : 'Lade Seite…';
      const pack = await fetchPage(rawUrl);
      html = pack.html;
      pageUrl = rawUrl;
      timings = pack.timings;
      add(LANG === 'en' ? 'HTML loaded (' + pack.via + ')' : 'HTML geladen (' + pack.via + ')');

      if (compUrl && /^https?:\/\//i.test(compUrl)) {
        try {
          $('dashProgressLabel').textContent = LANG === 'en' ? 'Loading competitor…' : 'Lade Konkurrenz…';
          const packB = await fetchPage(compUrl);
          const resA = await runDeepAuditProtocol(pageUrl, html, timings, { skipRemote: false });
          const resB = await runDeepAuditProtocol(compUrl, packB.html, packB.timings, { skipRemote: false });
          compareResult = { a: resA, b: resB };
          $('dashProgressLabel').textContent = LANG === 'en' ? 'Comparing…' : 'Vergleiche…';
          add(LANG === 'en' ? 'Comparison ready' : 'Vergleich fertig');
    $('dashSkeleton')?.classList.add('hidden');
      renderDashboardResult(resA, compareResult);
          try {
            await sb.from('audits').insert({ user_id: user.id, url: rawUrl + ' vs ' + compUrl, scores_json: { primary: resA, competitor: resB } });
            $('dashSaveMsg').textContent = t('saved');
            await loadDashHistory();
          } catch (e) {
            $('dashSaveMsg').textContent = t('saveFail') + (e.message || e);
          }
        } catch (e) {
          $('dashProgress')?.classList.add('hidden');
          toast((e && e.message) || t('urlBad'));
        }
        return;
      }
    } else {
      add(LANG === 'en' ? 'HTML from input' : 'HTML aus Eingabe');
    }

    $('dashProgressLabel').textContent = 'Deep Protocol…';
    const skipRemote = !rawUrl;
    const result = await runDeepAuditProtocol(pageUrl, html, timings, { skipRemote });
    add(LANG === 'en' ? 'Analysis complete' : 'Analyse abgeschlossen');
    $('dashSkeleton')?.classList.add('hidden');
    renderDashboardResult(result, null);

    try {
      await sb.from('audits').insert({ user_id: user.id, url: rawUrl || '[HTML]', scores_json: result });
      $('dashSaveMsg').textContent = t('saved');
      await loadDashHistory();
    } catch (e) {
      $('dashSaveMsg').textContent = t('saveFail') + (e.message || e);
    }
  }

  async function loadDashHistory() {
    if (!sb || !STATE.user) return;
    const { data, error } = await sb.from('audits').select('url, created_at, scores_json').order('created_at', { ascending: false }).limit(12);
    const ul = $('dashHistory');
    if (!ul) return;
    ul.innerHTML = '';
    if (error) { ul.innerHTML = '<li class="text-red-400">' + error.message + '</li>'; return; }
    (data || []).forEach((row) => {
      const sc = row.scores_json?.total ?? row.scores_json?.primary?.total ?? '—';
      const li = document.createElement('li');
      li.className = 'truncate border-b border-zinc-800 pb-1';
      li.textContent = `${sc} · ${row.url}`;
      ul.appendChild(li);
    });
  }

  function toast(m) {
    const er = $('authError');
    if (er) {
      er.textContent = m;
      er.classList.remove('hidden');
      setTimeout(() => er.classList.add('hidden'), 4000);
    }
  }

  function showAuthTab(which) {
    STATE.authTab = which;
    $('formSignIn')?.classList.toggle('hidden', which !== 'signin');
    $('formSignUp')?.classList.toggle('hidden', which !== 'signup');
    $('tabSignIn')?.classList.toggle('bg-zinc-800', which === 'signin');
    $('tabSignIn')?.classList.toggle('text-white', which === 'signin');
    $('tabSignIn')?.classList.toggle('text-zinc-400', which !== 'signin');
    $('tabSignUp')?.classList.toggle('bg-zinc-800', which === 'signup');
    $('tabSignUp')?.classList.toggle('text-white', which === 'signup');
    $('tabSignUp')?.classList.toggle('text-zinc-400', which !== 'signup');
  }

  async function runLandingDemo() {
    const inp = $('demoUrl');
    const out = $('demoResults');
    const err = $('demoError');
    if (!inp || !out) return;
    err?.classList.add('hidden');
    const url = inp.value.trim();
    if (!url) return;
    out.innerHTML = `<p class="text-sm text-zinc-500 font-mono">${escapeHtml(t('demoRunning'))}</p>`;
    try {
      const pack = await fetchPage(url);
      const doc = new DOMParser().parseFromString(pack.html, 'text/html');
      const hasTitle = !!doc.querySelector('title')?.textContent?.trim();
      const metas = [...doc.querySelectorAll('meta')];
      const hasMeta = metas.some((m) => (m.getAttribute('name') || '').toLowerCase() === 'description' && m.getAttribute('content')?.trim());
      const hasH1 = !!doc.querySelector('h1');
      let https = false;
      try { https = new URL(url).protocol === 'https:'; } catch (_) {}
      const code = pack.pageStatus != null ? String(pack.pageStatus) : '—';

      const L = LANG === 'en';
      const rows = [
        ['HTTPS', https ? (L ? 'Yes' : 'Ja') : (L ? 'No' : 'Nein')],
        [L ? 'Page title' : 'Seitentitel', hasTitle ? (L ? 'Found' : 'Gefunden') : (L ? 'Missing' : 'Fehlt')],
        [L ? 'Meta description' : 'Meta‑Description', hasMeta ? (L ? 'Found' : 'Gefunden') : (L ? 'Missing' : 'Fehlt')],
        ['H1', hasH1 ? (L ? 'Found' : 'Gefunden') : (L ? 'Missing' : 'Fehlt')],
        [L ? 'HTTP status' : 'HTTP‑Status', code],
      ];
      out.innerHTML = `
        <div class="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          ${rows.map(([k, v]) => `<div class="rounded-xl border border-zinc-800 bg-void/80 p-4"><p class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">${escapeHtml(k)}</p><p class="text-lg font-semibold text-white">${escapeHtml(v)}</p></div>`).join('')}
        </div>
        <p class="mt-4 text-xs text-zinc-500">${L ? 'Full report available after sign-in.' : 'Vollständiger Report mit Login verfügbar.'}</p>`;
    } catch (e) {
      out.innerHTML = '';
      if (err) { err.textContent = t('demoError'); err.classList.remove('hidden'); }
    }
  }

  function initHeaderShrink() {
    const header = $('siteHeader');
    if (!header) return;
    const onScroll = () => {
      header.classList.toggle('is-compact', window.scrollY > 48);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function initBackToTop() {
    const btn = $('btnBackTop');
    if (!btn) return;
    window.addEventListener('scroll', () => {
      btn.classList.toggle('opacity-0', window.scrollY < 400);
      btn.classList.toggle('pointer-events-none', window.scrollY < 400);
    }, { passive: true });
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  function initFaq() {
    document.querySelectorAll('[data-faq-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('aria-controls');
        const panel = id && $(id);
        const open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', open ? 'false' : 'true');
        panel?.classList.toggle('hidden', open);
      });
    });
  }

  function initHeroAnim() {
    const urlEl = $('animUrl');
    const statusEl = $('animStatus');
    const gridEl = $('animGrid');
    if (!urlEl || !statusEl || !gridEl) return;

    const fullUrl = LANG === 'en' ? 'https://client.com' : 'https://kunde.de';
    const steps = [
      { t: 0, run: () => { urlEl.textContent = ''; statusEl.textContent = LANG === 'en' ? 'Enter a URL…' : 'URL eingeben…'; gridEl.classList.add('opacity-0'); } },
      { t: 400, run: () => { let i = 0; const tick = () => { if (i <= fullUrl.length) { urlEl.textContent = fullUrl.slice(0, i++); setTimeout(tick, 38); } }; tick(); } },
      { t: 2200, run: () => { statusEl.textContent = LANG === 'en' ? 'Auditing…' : 'Audit läuft…'; } },
      { t: 2800, run: () => { statusEl.textContent = LANG === 'en' ? 'Done' : 'Fertig'; gridEl.classList.remove('opacity-0'); } },
    ];

    let timers = [];
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    function play() {
      clearTimers();
      steps.forEach((s) => timers.push(setTimeout(s.run, s.t)));
    }
    play();
    setInterval(play, 5200);
  }

  async function exportPdfWow() {
    if (!STATE.lastScores) return;
    const msg = $('dashSaveMsg');
    if (msg) msg.textContent = t('pdfGenerating');
    const loadLib = () => new Promise((resolve, reject) => {
      if (window.html2pdf) return resolve();
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    try {
      await loadLib();
      const d = STATE.lastScores;
      const cover = LANG === 'en' ? 'Confidential technical audit' : 'Vertrauliches technisches Audit';
      const toc = ['1. Cover', '2. Overview', '3. Findings', '4. Glossary'];
      const gloss = LANG === 'en'
        ? 'Scores are heuristic estimates based on fetch + DOM analysis; not a substitute for lab performance testing.'
        : 'Scores sind heuristische Schätzungen auf Basis von Abruf + DOM; kein Ersatz für Lab‑Performance‑Tests.';
      const root = document.createElement('div');
      root.style.cssText = 'font-family:Inter,system-ui,sans-serif;padding:40px;color:#111;background:#fff;width:720px;';
      root.innerHTML = `
        <div style="min-height:400px;display:flex;flex-direction:column;justify-content:center;border-bottom:3px solid #c8f135;margin-bottom:32px;padding-bottom:40px;">
          <h1 style="font-size:28px;margin:0;">AuditFlow</h1>
          <p style="color:#666;margin:12px 0 0;">${cover}</p>
          <p style="font-size:36px;font-weight:800;margin:24px 0 0;color:#3d4f00;">${d.total}<span style="font-size:14px;color:#666;font-weight:600"> /100</span></p>
          <p style="color:#444;margin:8px 0 0;">${escapeHtml(d.pageUrl)}</p>
        </div>
        <h2 style="font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#888;">Contents</h2>
        <ul style="font-size:11px;color:#333;line-height:1.8;">${toc.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
        <h2 style="font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#888;margin-top:28px;">Overview</h2>
        <p style="font-size:11px;">SEO ${d.dimensions.seo} · Performance ${d.dimensions.performance} · Security ${d.dimensions.security} · Structure ${d.dimensions.structure}</p>
        <h2 style="font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#888;margin-top:28px;">Findings (excerpt)</h2>
        <div style="font-size:10px;color:#333;">${buildActionItems(d.findings).slice(0, 12).map((i) => `<p style="margin:6px 0;border-bottom:1px solid #eee;padding-bottom:4px;">${i.html}</p>`).join('')}</div>
        <h2 style="font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#888;margin-top:28px;">Glossary</h2>
        <p style="font-size:10px;color:#555;">${escapeHtml(gloss)}</p>
        <p style="margin-top:40px;font-size:9px;color:#aaa;">AuditFlow · White-label export</p>`;
      document.body.appendChild(root);
      await window.html2pdf().set({ margin: 10, filename: 'auditflow-report.pdf', image: { type: 'jpeg', quality: 0.95 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4' } }).from(root).save();
      root.remove();
      if (msg) msg.textContent = LANG === 'en' ? 'PDF downloaded.' : 'PDF heruntergeladen.';
    } catch (e) {
      if (msg) msg.textContent = t('pdfFail');
    }
  }

  // ===== Lighthouse Panel =====
  function renderLighthousePanel(scores) {
    const panel = $('lighthousePanel');
    const grid = $('lhScoreGrid');
    const catList = $('lhCategoryList');
    if (!panel || !grid || !catList) return;

    const lhScores = [
      { key: 'performance', label: 'Performance', icon: 'zap', val: scores.dimensions?.performance ?? 0 },
      { key: 'seo', label: 'SEO', icon: 'search', val: scores.dimensions?.seo ?? 0 },
      { key: 'security', label: 'Security', icon: 'shield', val: scores.dimensions?.security ?? 0 },
      { key: 'structure', label: 'Structure', icon: 'layout', val: scores.dimensions?.structure ?? 0 },
    ];

    function scoreClass(v) {
      if (v >= 90) return 'lh-score-good';
      if (v >= 50) return 'lh-score-mid';
      return 'lh-score-bad';
    }
    function ringClass(v) {
      if (v >= 90) return 'lh-ring-good';
      if (v >= 50) return 'lh-ring-mid';
      return 'lh-ring-bad';
    }

    const circumference = 2 * Math.PI * 20;
    grid.innerHTML = lhScores.map(({ label, val }) => {
      const offset = circumference * (1 - val / 100);
      const cls = scoreClass(val);
      const rcls = ringClass(val);
      return `
        <div class="rounded-xl border border-zinc-800 bg-void/60 p-3 flex flex-col items-center">
          <svg width="52" height="52" viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="20" fill="none" stroke="#27272a" stroke-width="3"/>
            <circle cx="26" cy="26" r="20" fill="none" class="lh-gauge-ring ${rcls}" stroke-width="3"
              stroke-dasharray="${circumference.toFixed(2)}"
              stroke-dashoffset="${offset.toFixed(2)}"
              stroke-linecap="round"
              transform="rotate(-90 26 26)"/>
            <text x="26" y="30" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor" class="${cls}">${val}</text>
          </svg>
          <p class="text-[10px] text-zinc-500 mt-1 text-center">${label}</p>
        </div>`;
    }).join('');

    const categories = [
      { label: LANG === 'en' ? 'Overall' : 'Gesamt', val: scores.total ?? 0 },
      { label: LANG === 'en' ? 'Critical issues' : 'Kritische Probleme',
        val: scores.findings ? Object.values(scores.findings).flat().filter(f => f.l === 'e').length : 0,
        isCount: true },
      { label: LANG === 'en' ? 'Warnings' : 'Warnungen',
        val: scores.findings ? Object.values(scores.findings).flat().filter(f => f.l === 'w').length : 0,
        isCount: true },
    ];

    catList.innerHTML = categories.map(({ label, val, isCount }) => {
      const cls = isCount ? (val === 0 ? 'text-lime' : val < 5 ? 'text-amber-400' : 'text-red-400') : scoreClass(val);
      return `<div class="flex items-center justify-between">
        <span class="text-[11px] text-zinc-400">${label}</span>
        <span class="text-sm font-mono font-semibold ${cls}">${val}${isCount ? '' : '/100'}</span>
      </div>`;
    }).join('');

    panel.classList.remove('hidden');
    icons();
  }

  function initPageLoader() {
    const loader = $('pageLoader');
    if (!loader) return;
    // Loader ausblenden sobald Seite bereit ist
    const hide = () => {
      loader.classList.add('fade-out');
      setTimeout(() => { loader.style.display = 'none'; }, 450);
    };
    if (document.readyState === 'complete') {
      setTimeout(hide, 200);
    } else {
      window.addEventListener('load', () => setTimeout(hide, 200));
    }
  }

  function init() {
    icons();
    initSupabase();
    initPageLoader();

    $('navLogo')?.addEventListener('click', () => { setView('landing'); closeAuthModal(); });
    $('btnNavAuth')?.addEventListener('click', () => openAuthModal());
    $('btnNavCta')?.addEventListener('click', () => {
      if (STATE.view === 'landing') {
        if (STATE.user) setView('dashboard');
        else openAuthModal();
        return;
      }
      if (STATE.user) setView('dashboard');
      else openAuthModal();
    });
    $('btnNavDashboard')?.addEventListener('click', () => setView('dashboard'));
    $('btnNavSignOut')?.addEventListener('click', async () => {
      if (!sb) return;
      await sb.auth.signOut();
      STATE.user = null;
      setView('landing');
      syncUserUi();
    });

    document.querySelectorAll('[data-open-auth]').forEach((el) => el.addEventListener('click', (e) => {
      e.preventDefault();
      if (STATE.user) setView('dashboard');
      else openAuthModal();
    }));
    $('authModalClose')?.addEventListener('click', () => closeAuthModal());
    $('authModalBackdrop')?.addEventListener('click', () => closeAuthModal());

    // Auswahl-Buttons
    $('btnSelectMagic')?.addEventListener('click', () => showAuthView('magic'));
    $('btnSelectPass')?.addEventListener('click', () => showAuthView('pass'));
    document.querySelectorAll('.btnAuthBackToSelection').forEach(btn => {
      btn.addEventListener('click', () => showAuthView('main'));
    });

    $('formMagic')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const em = $('magicEmail')?.value.trim();
      if (!sb || !em) return;
      // Spinner anzeigen
      const btnText = $('btnMagicText');
      const btnSpinner = $('btnMagicSpinner');
      const btnSubmit = $('btnMagicSubmit');
      if (btnText) btnText.textContent = LANG === 'en' ? 'Sending…' : 'Wird gesendet…';
      if (btnSpinner) btnSpinner.classList.remove('hidden');
      if (btnSubmit) btnSubmit.disabled = true;

      const redir = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, HOME)}`;
      const { error } = await sb.auth.signInWithOtp({ email: em, options: { emailRedirectTo: redir } });

      // Spinner zurücksetzen
      if (btnText) btnText.textContent = LANG === 'en' ? 'Send Magic Link' : 'Magic Link senden';
      if (btnSpinner) btnSpinner.classList.add('hidden');
      if (btnSubmit) btnSubmit.disabled = false;

      if (error) {
        toast(error.message);
        const box = $('magicMsg');
        if (box) { box.textContent = error.message; box.classList.remove('hidden', 'text-lime'); box.classList.add('text-red-400'); }
      } else {
        // Bestätigungsansicht zeigen
        const confirmEl = $('confirmEmail');
        if (confirmEl) confirmEl.textContent = em;
        showAuthView('confirm');
        icons();
      }
    });

    $('btnConfirmBack')?.addEventListener('click', () => {
      showAuthView('main');
      const magicInput = $('magicEmail');
      if (magicInput) magicInput.value = '';
      const box = $('magicMsg');
      if (box) { box.textContent = ''; box.classList.add('hidden'); }
    });

    $('formSignIn')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!sb) return;
      $('authError')?.classList.add('hidden');
      const { error } = await sb.auth.signInWithPassword({
        email: $('inEmail')?.value.trim(),
        password: $('inPass')?.value,
      });
      if (error) {
        const er = $('authError');
        if (er) { er.textContent = error.message; er.classList.remove('hidden'); }
      } else await refreshUser();
    });

    $('formSignUp')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!sb) return;
      const er = $('authErrorUp');
      er?.classList.remove('text-lime');
      er?.classList.add('text-red-400', 'hidden');
      const pw = $('upPass')?.value;
      if ((pw || '').length < 8) {
        if (er) { er.textContent = t('pwShort'); er.classList.remove('hidden'); }
        return;
      }
      const redir = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, HOME)}`;
      const { error } = await sb.auth.signUp({
        email: $('upEmail')?.value.trim(),
        password: pw,
        options: { emailRedirectTo: redir },
      });
      if (error) {
        if (er) { er.textContent = error.message; er.classList.remove('hidden'); }
      } else if (er) {
        er.textContent = t('checkEmail');
        er.classList.remove('hidden', 'text-red-400');
        er.classList.add('text-lime');
      }
    });

    $('tabSignIn')?.addEventListener('click', () => showAuthTab('signin'));
    $('tabSignUp')?.addEventListener('click', () => showAuthTab('signup'));
    $('authBack')?.addEventListener('click', () => { setView('landing'); closeAuthModal(); });

    document.querySelectorAll('[data-nav="landing"]').forEach((b) => b.addEventListener('click', () => {
      setView('landing');
      document.getElementById('features')?.scrollIntoView();
    }));
    document.querySelectorAll('[data-nav="pricing"]').forEach((b) => b.addEventListener('click', () => {
      setView('landing');
      document.getElementById('pricing')?.scrollIntoView();
    }));
    document.querySelectorAll('[data-nav="faq"]').forEach((b) => b.addEventListener('click', () => {
      setView('landing');
      document.getElementById('faq')?.scrollIntoView();
    }));
    $('authOpenSignUp')?.addEventListener('click', () => showAuthTab('signup'));

    $('btnPerformAudit')?.addEventListener('click', () => performAudit());
    $('btnSaveAudit')?.addEventListener('click', async () => {
      if (!STATE.lastScores || !STATE.user || !sb) return;
      try {
        await sb.from('audits').insert({ user_id: STATE.user.id, url: STATE.lastScores.pageUrl, scores_json: STATE.lastScores });
        $('dashSaveMsg').textContent = t('savedManual');
        loadDashHistory();
      } catch (e) {
        $('dashSaveMsg').textContent = e.message;
      }
    });
    $('btnPrint')?.addEventListener('click', () => window.print());
    $('btnPdfPremium')?.addEventListener('click', () => {
      if (!STATE.lastScores) return;
      const win = window.open('', '', 'width=900,height=700');
      const data = STATE.lastScores;
      if (!data) return;
      const cwv = estimateCoreWebVitals(data.html || '', data.timings);
      const a11y = assessAccessibility(data.html || '');
      const res = analyzeResources(data.html || '');
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; line-height: 1.6; }
    .page { page-break-after: always; padding: 40px; min-height: 100vh; }
    .cover { background: linear-gradient(135deg, #030303 0%, #1a1a1a 100%); color: white; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
    .cover h1 { font-size: 48px; margin-bottom: 20px; }
    .cover .score { font-size: 72px; font-weight: bold; color: #c8f135; margin: 30px 0; }
    h2 { font-size: 28px; margin: 30px 0 15px; color: #000; border-bottom: 3px solid #c8f135; padding-bottom: 10px; }
    .metric { display: inline-block; margin-right: 40px; margin-bottom: 20px; }
    .metric-label { font-size: 12px; color: #666; text-transform: uppercase; }
    .metric-value { font-size: 32px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #f5f5f5; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; }
    td { padding: 12px; border-bottom: 1px solid #eee; }
    .finding { margin: 15px 0; padding: 15px; border-left: 4px solid #ddd; background: #f9f9f9; }
    .finding.critical { border-left-color: #ff4e42; background: #fff5f5; }
    .finding.warning { border-left-color: #ffa400; background: #fffbf0; }
    .finding.ok { border-left-color: #0cce6b; background: #f0fdf4; }
    footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #999; text-align: center; }
  </style>
</head>
<body>
  <div class="page cover">
    <h1>Audit Report</h1>
    <div class="score">${data.total}</div>
    <p><strong>${LANG === 'en' ? 'URL' : 'URL'}:</strong> ${data.pageUrl}</p>
    <p><strong>${LANG === 'en' ? 'Date' : 'Datum'}:</strong> ${new Date().toLocaleDateString()}</p>
  </div>

  <div class="page">
    <h2>${LANG === 'en' ? 'Core Web Vitals' : 'Core Web Vitals'}</h2>
    <div class="metric"><div class="metric-label">LCP</div><div class="metric-value">${cwv.lcp}ms</div></div>
    <div class="metric"><div class="metric-label">CLS</div><div class="metric-value">${cwv.cls.toFixed(2)}</div></div>
    <div class="metric"><div class="metric-label">FID</div><div class="metric-value">${cwv.fid}ms</div></div>
    <div class="metric"><div class="metric-label">TTFB</div><div class="metric-value">${cwv.ttfb}ms</div></div>
    
    <h2>${LANG === 'en' ? 'Accessibility' : 'Barrierefreiheit'}</h2>
    <div class="metric"><div class="metric-label">WCAG 2.1 Score</div><div class="metric-value">${a11y}</div></div>
    
    <h2>${LANG === 'en' ? 'Resources' : 'Ressourcen'}</h2>
    <table>
      <tr><th>${LANG === 'en' ? 'Type' : 'Typ'}</th><th>${LANG === 'en' ? 'Count' : 'Anzahl'}</th></tr>
      <tr><td>Scripts</td><td>${res.scripts}</td></tr>
      <tr><td>Stylesheets</td><td>${res.stylesheets}</td></tr>
      <tr><td>${LANG === 'en' ? 'Images' : 'Bilder'}</td><td>${res.images}</td></tr>
      <tr><td>Fonts</td><td>${res.fonts}</td></tr>
    </table>
    
    <h2>${LANG === 'en' ? 'Scores' : 'Bewertungen'}</h2>
    <div class="metric"><div class="metric-label">SEO</div><div class="metric-value">${data.dimensions.seo}</div></div>
    <div class="metric"><div class="metric-label">Performance</div><div class="metric-value">${data.dimensions.performance}</div></div>
    <div class="metric"><div class="metric-label">Security</div><div class="metric-value">${data.dimensions.security}</div></div>
    <div class="metric"><div class="metric-label">Structure</div><div class="metric-value">${data.dimensions.structure}</div></div>
    
    <footer>
      <p>© 2026 AuditFlow — Technical Web Intelligence</p>
      <p>${LANG === 'en' ? 'Generated on' : 'Erstellt am'} ${new Date().toLocaleString()}</p>
    </footer>
  </div>
</body>
</html>
      `;
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 250);
    });
    $('btnToggleDeep')?.addEventListener('click', () => {
      $('dashDeepBody')?.classList.toggle('hidden');
      const ic = $('iconDeep');
      if (ic) ic.style.transform = $('dashDeepBody')?.classList.contains('hidden') ? '' : 'rotate(180deg)';
    });

    $('btnDemoStart')?.addEventListener('click', () => runLandingDemo());
    $('btnEmbedCopy')?.addEventListener('click', async () => {
      const ta = $('embedSnippet');
      if (!ta) return;
      try {
        await navigator.clipboard.writeText(ta.value);
        toast(t('embedCopy'));
      } catch (_) {}
    });

    initHeaderShrink();
    initBackToTop();
    initFaq();
    initHeroAnim();

    refreshUser().then(() => {
      if (STATE.user) setView('dashboard');
      else setView('landing');
      icons();
    });
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
