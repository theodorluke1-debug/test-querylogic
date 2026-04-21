/**
 * auditflow.js
 * Wird NUR von index.html (Landing Page) verwendet.
 * auditflow.html hat sein eigenes inline Script — diese Datei nicht dort einbinden.
 *
 * Enthält:
 * - Supabase Auth für Landing Page
 * - Live-Demo (öffentliche Schnellprüfung)
 * - Hero-Animation
 * - FAQ Accordion
 * - Header Shrink / Back-to-Top
 * - Embed-Snippet-Kopieren
 * - Navigation zwischen Landing-Views
 */

(function () {
  'use strict';

  const LANG = document.documentElement.lang === 'en' ? 'en' : 'de';
  const HOME = LANG === 'en' ? 'index-en.html' : 'index.html';
  const DASH = 'auditflow.html';

  const SUPABASE_URL  = 'https://hqzudwrvfwucwijiztlt.supabase.co';
  const SUPABASE_ANON = 'sb_publishable_xbdT5jumnRVp4KdZs3nI0w_QvzwV172';

  const STATE = { user: null };
  let sb = null;

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  function icons() { if (window.lucide) lucide.createIcons(); }

  // ── PAGE LOADER ──────────────────────────────────────
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

  // ── SUPABASE ─────────────────────────────────────────
  function initSupabase() {
    if (!window.supabase?.createClient) return;
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
    sb.auth.onAuthStateChange((_e, session) => {
      STATE.user = session?.user ?? null;
      syncUserUi();
      // Wenn eingeloggt und auf Landing → zum Dashboard weiterleiten
      if (session?.user) {
        window.location.href = DASH;
      }
    });
  }

  function syncUserUi() {
    const u = STATE.user;
    // Nav-Elemente
    $('btnNavAuth')?.classList.toggle('hidden', !!u);
    $('btnNavSignOut')?.classList.toggle('hidden', !u);
    const ne = $('navUserEmail');
    if (ne) ne.textContent = u?.email || '';
    // CTA Button Text
    const cta = $('btnNavCta');
    if (cta) cta.textContent = LANG === 'en' ? (u ? 'Dashboard' : 'Start auditing') : (u ? 'Zum Dashboard' : 'Audit starten');
    icons();
  }

  // ── AUTH MODAL (Landing-Page only) ──────────────────
  function openAuthModal() {
    const el = $('authModal');
    if (!el) {
      // Kein Auth-Modal auf Landing → direkt zum Dashboard
      window.location.href = DASH;
      return;
    }
    el.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    icons();
  }

  function closeAuthModal() {
    $('authModal')?.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
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
      const r = await fetch(url, { mode: 'cors', credentials: 'omit', headers: { Accept: 'text/html' } });
      const t1 = performance.now();
      if (r.ok) {
        const html = await r.text();
        const t2 = performance.now();
        return { html, via: 'direct', pageStatus: r.status, timings: { ttfbMs: Math.round(t1-t0), totalMs: Math.round(t2-t0) } };
      }
    } catch(_) {}
    const t0b = performance.now();
    const b = await fetchBridge(url);
    const t2 = performance.now();
    return { html: b.text, via: 'bridge', pageStatus: b.pageStatus, timings: { ttfbMs: Math.round(b.ms*.4), totalMs: Math.round(t2-t0b) } };
  }

  // ── LIVE DEMO (Landing) ──────────────────────────────
  async function runLandingDemo() {
    const inp = $('demoUrl');
    const out = $('demoResults');
    const errEl = $('demoError');
    const btn = $('btnDemoStart');
    if (!inp || !out) return;

    const url = inp.value.trim();
    if (!url) { inp.focus(); return; }

    errEl?.classList.add('hidden');
    out.innerHTML = `<p class="text-sm text-zinc-500 font-mono animate-pulse">${LANG === 'en' ? 'Analyzing…' : 'Analyse läuft…'}</p>`;
    if (btn) { btn.textContent = LANG === 'en' ? 'Analyzing…' : 'Läuft…'; btn.disabled = true; }

    try {
      const pack = await fetchPage(url);
      const doc = new DOMParser().parseFromString(pack.html, 'text/html');
      const hasTitle = !!doc.querySelector('title')?.textContent?.trim();
      const hasMeta  = [...doc.querySelectorAll('meta')].some(m => (m.getAttribute('name')||'').toLowerCase() === 'description' && m.getAttribute('content')?.trim());
      const hasH1    = !!doc.querySelector('h1');
      let https = false;
      try { https = new URL(url).protocol === 'https:'; } catch(_) {}
      const code = pack.pageStatus != null ? String(pack.pageStatus) : '—';
      const ms = pack.timings?.totalMs ?? '—';

      const L = LANG === 'en';
      const rows = [
        { label: 'HTTPS',                value: https ? (L?'Yes ✓':'Ja ✓') : (L?'No ✗':'Nein ✗'),   ok: https },
        { label: L?'Page title':'Titel', value: hasTitle ? (L?'Found':'Gefunden') : (L?'Missing':'Fehlt'), ok: hasTitle },
        { label: 'Meta Description',     value: hasMeta ? (L?'Found':'Gefunden') : (L?'Missing':'Fehlt'),  ok: hasMeta },
        { label: 'H1',                   value: hasH1 ? (L?'Found':'Gefunden') : (L?'Missing':'Fehlt'),    ok: hasH1 },
        { label: L?'Status':'HTTP-Status', value: code, ok: code === '200' },
        { label: L?'Load time':'Ladezeit', value: ms + ' ms', ok: parseInt(ms) < 3000 },
      ];

      out.innerHTML = `
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
          ${rows.map(r => `
            <div class="rounded-xl border ${r.ok ? 'border-lime/20 bg-lime/5' : 'border-red-500/20 bg-red-500/5'} p-3 text-center">
              <p class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">${esc(r.label)}</p>
              <p class="text-sm font-semibold ${r.ok ? 'text-lime' : 'text-red-400'}">${esc(r.value)}</p>
            </div>`).join('')}
        </div>
        <p class="text-xs text-zinc-600">${L ? 'Full report with login.' : 'Vollständiger Report nach Anmeldung verfügbar.'}</p>`;
    } catch(e) {
      out.innerHTML = '';
      if (errEl) {
        errEl.textContent = LANG === 'en' ? 'Audit failed. Check URL.' : 'Audit fehlgeschlagen. URL prüfen.';
        errEl.classList.remove('hidden');
      }
    } finally {
      if (btn) { btn.textContent = LANG === 'en' ? 'Analyze' : 'Analysieren'; btn.disabled = false; }
    }
  }

  // ── HERO ANIMATION ───────────────────────────────────
  function initHeroAnim() {
    const urlEl   = $('animUrl');
    const statusEl = $('animStatus');
    const gridEl   = $('animGrid');
    if (!urlEl || !statusEl || !gridEl) return;

    const fullUrl = LANG === 'en' ? 'https://client.com' : 'https://kunde.de';
    const steps = [
      { t: 0,    run: () => { urlEl.textContent = ''; statusEl.textContent = LANG==='en'?'Enter a URL…':'URL eingeben…'; gridEl.classList.add('opacity-0'); } },
      { t: 400,  run: () => { let i=0; const tick=()=>{ if(i<=fullUrl.length){urlEl.textContent=fullUrl.slice(0,i++);setTimeout(tick,38);} }; tick(); } },
      { t: 2200, run: () => { statusEl.textContent = LANG==='en'?'Auditing…':'Audit läuft…'; } },
      { t: 2800, run: () => { statusEl.textContent = LANG==='en'?'Done ✓':'Fertig ✓'; gridEl.classList.remove('opacity-0'); } },
    ];

    let timers = [];
    function play() {
      timers.forEach(clearTimeout); timers = [];
      steps.forEach(s => timers.push(setTimeout(s.run, s.t)));
    }
    play();
    setInterval(play, 5500);
  }

  // ── FAQ ACCORDION ────────────────────────────────────
  function initFaq() {
    document.querySelectorAll('[data-faq-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('aria-controls');
        const panel = id && $(id);
        const open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', open ? 'false' : 'true');
        panel?.classList.toggle('hidden', open);
        // rotate arrow icon
        const icon = btn.querySelector('[data-faq-icon]');
        if (icon) icon.style.transform = open ? '' : 'rotate(180deg)';
      });
    });
  }

  // ── HEADER SHRINK ────────────────────────────────────
  function initHeaderShrink() {
    const header = $('siteHeader');
    if (!header) return;
    const onScroll = () => header.classList.toggle('is-compact', window.scrollY > 48);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ── BACK TO TOP ──────────────────────────────────────
  function initBackToTop() {
    const btn = $('btnBackTop');
    if (!btn) return;
    window.addEventListener('scroll', () => {
      btn.classList.toggle('opacity-0', window.scrollY < 400);
      btn.classList.toggle('pointer-events-none', window.scrollY < 400);
    }, { passive: true });
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // ── EMBED SNIPPET COPY ───────────────────────────────
  function initEmbedCopy() {
    $('btnEmbedCopy')?.addEventListener('click', async () => {
      const ta = $('embedSnippet');
      if (!ta) return;
      try {
        await navigator.clipboard.writeText(ta.value);
        const btn = $('btnEmbedCopy');
        if (btn) {
          const orig = btn.textContent;
          btn.textContent = LANG === 'en' ? '✓ Copied!' : '✓ Kopiert!';
          setTimeout(() => { btn.textContent = orig; }, 2000);
        }
      } catch(_) {}
    });
  }

  // ── SMOOTH SCROLL NAV ────────────────────────────────
  function initNav() {
    // Anchor links
    document.querySelectorAll('[data-scroll]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        const target = document.querySelector(el.getAttribute('data-scroll'));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    // Nav buttons (Produkt / Preise / FAQ)
    document.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-nav');
        const el = $(target) || document.getElementById(target);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    // CTA Buttons → Auth oder Dashboard
    $('btnNavCta')?.addEventListener('click', () => {
      if (STATE.user) window.location.href = DASH;
      else openAuthModal();
    });

    // [data-open-auth] → öffnet Auth
    document.querySelectorAll('[data-open-auth]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        if (STATE.user) window.location.href = DASH;
        else openAuthModal();
      });
    });

    // Auth Modal schließen
    $('authModalClose')?.addEventListener('click', closeAuthModal);
    $('authModalBackdrop')?.addEventListener('click', closeAuthModal);
    $('btnNavAuth')?.addEventListener('click', openAuthModal);
    $('btnNavSignOut')?.addEventListener('click', async () => {
      await sb?.auth.signOut();
      STATE.user = null;
      syncUserUi();
    });

    // Auth-Auswahl Buttons (falls Landing-Page ein Auth-Modal hat)
    $('btnSelectMagic')?.addEventListener('click', () => {
      $('authViewMain')?.classList.add('hidden');
      $('authViewMagic')?.classList.remove('hidden');
    });
    $('btnSelectPass')?.addEventListener('click', () => {
      $('authViewMain')?.classList.add('hidden');
      $('authViewPass')?.classList.remove('hidden');
    });
    document.querySelectorAll('.btnAuthBackToSelection').forEach(btn => {
      btn.addEventListener('click', () => {
        $('authViewMain')?.classList.remove('hidden');
        $('authViewMagic')?.classList.add('hidden');
        $('authViewPass')?.classList.add('hidden');
        $('authViewConfirm')?.classList.add('hidden');
      });
    });
  }

  // ── MAGIC LINK (Landing Auth Modal) ─────────────────
  function initMagicLink() {
    $('formMagic')?.addEventListener('submit', async e => {
      e.preventDefault();
      const email = $('magicEmail')?.value.trim();
      if (!sb || !email) return;
      const btn = $('btnMagicSubmit');
      if (btn) { btn.disabled = true; btn.textContent = LANG==='en'?'Sending…':'Wird gesendet…'; }
      const redir = window.location.origin + '/' + DASH;
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redir } });
      if (btn) { btn.disabled = false; btn.textContent = LANG==='en'?'Send Magic Link':'Magic Link senden'; }
      if (error) {
        const box = $('magicMsg');
        if (box) { box.textContent = error.message; box.classList.remove('hidden'); }
      } else {
        const ce = $('confirmEmail');
        if (ce) ce.textContent = email;
        $('authViewMagic')?.classList.add('hidden');
        $('authViewConfirm')?.classList.remove('hidden');
      }
    });

    $('btnConfirmBack')?.addEventListener('click', () => {
      $('authViewMagic')?.classList.remove('hidden');
      $('authViewConfirm')?.classList.add('hidden');
    });
  }

  // ── PASSWORD AUTH (Landing) ──────────────────────────
  function initPasswordAuth() {
    // Sign In
    $('formSignIn')?.addEventListener('submit', async e => {
      e.preventDefault();
      if (!sb) return;
      const { error } = await sb.auth.signInWithPassword({
        email: $('inEmail')?.value.trim(),
        password: $('inPass')?.value
      });
      if (error) {
        const el = $('authError');
        if (el) { el.textContent = error.message; el.classList.remove('hidden'); }
      }
    });

    // Sign Up
    $('formSignUp')?.addEventListener('submit', async e => {
      e.preventDefault();
      if (!sb) return;
      const pw = $('upPass')?.value;
      const el = $('authErrorUp');
      if (!pw || pw.length < 8) {
        if (el) { el.textContent = LANG==='en'?'Password min. 8 chars.':'Passwort min. 8 Zeichen.'; el.classList.remove('hidden'); }
        return;
      }
      const { error } = await sb.auth.signUp({
        email: $('upEmail')?.value.trim(),
        password: pw,
        options: { emailRedirectTo: window.location.origin + '/' + DASH }
      });
      if (error) {
        if (el) { el.textContent = error.message; el.classList.remove('hidden'); }
      } else {
        if (el) { el.textContent = LANG==='en'?'Check your inbox!':'Postfach prüfen!'; el.classList.remove('hidden','text-red-400'); el.classList.add('text-lime'); }
      }
    });

    // Tab switcher
    $('tabSignIn')?.addEventListener('click', () => {
      $('formSignIn')?.classList.remove('hidden');
      $('formSignUp')?.classList.add('hidden');
      $('tabSignIn')?.classList.add('bg-zinc-800','text-white');
      $('tabSignUp')?.classList.remove('bg-zinc-800','text-white');
    });
    $('tabSignUp')?.addEventListener('click', () => {
      $('formSignUp')?.classList.remove('hidden');
      $('formSignIn')?.classList.add('hidden');
      $('tabSignUp')?.classList.add('bg-zinc-800','text-white');
      $('tabSignIn')?.classList.remove('bg-zinc-800','text-white');
    });
  }

  // ── DEMO BUTTON ──────────────────────────────────────
  function initDemoButton() {
    $('btnDemoStart')?.addEventListener('click', runLandingDemo);
    $('demoUrl')?.addEventListener('keydown', e => { if (e.key === 'Enter') runLandingDemo(); });
  }

  // ── INIT ─────────────────────────────────────────────
  function init() {
    icons();
    initSupabase();
    initPageLoader();
    initNav();
    initMagicLink();
    initPasswordAuth();
    initDemoButton();
    initHeroAnim();
    initFaq();
    initHeaderShrink();
    initBackToTop();
    initEmbedCopy();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();

})();
