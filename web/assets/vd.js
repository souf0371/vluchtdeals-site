/* Vluchtdeals – menu, voettekst en cookiekeuze.
   Meet- en advertentiediensten laden ALLEEN na toestemming. Staat er hieronder geen dienst ingesteld,
   dan verschijnt er geen cookiemelding (er is dan niets om toestemming voor te vragen). */
(function () {
  var CFG = {
    ga: ''            // Google Analytics 4 meet-ID, bv. 'G-XXXXXXX'. Leeg = uit.
  };
  var KEY = 'vd_consent', MAXDAYS = 365;
  var d = document;

  // ---------- menu (telefoon) ----------
  var mb = d.querySelector('.vd-menu'), mp = d.querySelector('.vd-panel');
  function menu(open) { if (!mb || !mp) return; mp.classList.toggle('open', open); mb.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  if (mb && mp) {
    mb.addEventListener('click', function () { menu(!mp.classList.contains('open')); });
    mp.addEventListener('click', function (e) { if (e.target.closest('a')) menu(false); });   // link gekozen → menu dicht
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape') menu(false); });
    d.addEventListener('click', function (e) { if (mp.classList.contains('open') && !e.target.closest('.vd-head')) menu(false); });
    window.addEventListener('hashchange', function () { menu(false); });
  }

  // ---------- datumvelden: 'Kies datum' tonen zolang er niets gekozen is ----------
  if (!/Firefox\//.test(navigator.userAgent)) d.documentElement.classList.add('dph');
  d.querySelectorAll('.dwrap input[type=date]').forEach(function (i) {
    function upd() { i.parentNode.classList.toggle('has', !!i.value); }
    i.addEventListener('input', upd); i.addEventListener('change', upd); upd();
  });

  // ---------- voettekst: op computer altijd open, op telefoon uitklapbaar ----------
  var mq = window.matchMedia('(min-width: 721px)');
  function feet() { d.querySelectorAll('.vd-foot details').forEach(function (x) { if (mq.matches) x.open = true; }); }
  feet(); if (mq.addEventListener) mq.addEventListener('change', function () { feet(); if (mq.matches) menu(false); });
  d.querySelectorAll('.vd-foot details summary').forEach(function (s) {
    s.addEventListener('click', function (e) { if (mq.matches) e.preventDefault(); });
  });

  // ---------- toestemming ----------
  function read() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (v && v.t && (Date.now() - v.t) < MAXDAYS * 864e5) return v; } catch (e) {}
    return null;
  }
  function save(stats, ads) {
    var v = { v: 1, stats: !!stats, ads: !!ads, t: Date.now() };
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {}
    apply(v); hideBanner();
    if (!v.stats) clearCookies(/^_ga/);
  }
  function clearCookies(re) {
    d.cookie.split(';').forEach(function (c) {
      var n = c.split('=')[0].trim();
      if (re.test(n)) ['', '.vluchtdeals.com', 'vluchtdeals.com'].forEach(function (dom) {
        d.cookie = n + '=; Max-Age=0; path=/' + (dom ? '; domain=' + dom : '');
      });
    });
  }
  var gaLoaded = false;
  function apply(v) {
    if (v && v.stats && CFG.ga && !gaLoaded) {
      gaLoaded = true;
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { dataLayer.push(arguments); };
      gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: v.ads ? 'granted' : 'denied',
        ad_user_data: v.ads ? 'granted' : 'denied', ad_personalization: v.ads ? 'granted' : 'denied' });
      gtag('js', new Date()); gtag('config', CFG.ga, { anonymize_ip: true });
      var s = d.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(CFG.ga);
      d.head.appendChild(s);
    }
  }
  var needed = !!CFG.ga;

  // ---------- cookiemelding ----------
  var banner = null;
  function hideBanner() { if (banner) { banner.remove(); banner = null; } }
  function showBanner() {
    banner = d.createElement('div'); banner.className = 'vd-cookie'; banner.setAttribute('role', 'dialog'); banner.setAttribute('aria-label', 'Cookiemelding');
    banner.innerHTML = '<div class="in"><div class="txt"><b class="t">Mogen we cookies gebruiken?</b>' +
      '<p>Met jouw toestemming meten we hoe de site wordt gebruikt, zodat we hem kunnen verbeteren. Zonder toestemming plaatsen we die cookies niet; de site werkt dan gewoon. Lees de <a href="/cookies.html">cookieverklaring</a>.</p></div>' +
      '<div class="btns"><button type="button" class="vd-btn" data-c="no">Weigeren</button>' +
      '<button type="button" class="vd-btn set" data-c="set">Instellingen</button>' +
      '<button type="button" class="vd-btn dark" data-c="yes">Accepteren</button></div></div>';
    banner.addEventListener('click', function (e) {
      var c = e.target.getAttribute && e.target.getAttribute('data-c');
      if (c === 'no') save(false, false); else if (c === 'yes') save(true, true); else if (c === 'set') openSettings();
    });
    d.body.appendChild(banner);
  }

  // ---------- instellingen ----------
  function openSettings() {
    var cur = read() || { stats: false, ads: false };
    var m = d.createElement('div'); m.className = 'vd-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'vd-ps-t');
    var off = needed ? '' : '<p style="margin:10px 0 0;padding:12px 14px;border-radius:12px;background:#EEF1F8">Op dit moment gebruiken we geen meet- of advertentiecookies. Je keuze wordt wel bewaard voor als dat verandert.</p>';
    m.innerHTML = '<div class="box"><h2 id="vd-ps-t">Privacy-instellingen</h2><p style="margin:0">Kies welke cookies je toestaat. Je kunt dit altijd aanpassen via ‘Privacy-instellingen’ onderaan elke pagina.</p>' + off +
      '<div class="row"><div><b>Noodzakelijk</b><p>Nodig om de site te laten werken en je keuze te onthouden. Altijd aan.</p></div><label class="vd-sw"><input type="checkbox" checked disabled aria-label="Noodzakelijk, altijd aan"><span></span></label></div>' +
      '<div class="row"><div><b>Statistieken</b><p>Meten hoe bezoekers de site gebruiken (Google Analytics), zodat we hem kunnen verbeteren.</p></div><label class="vd-sw"><input type="checkbox" id="vd-c-stats" aria-label="Statistieken"' + (cur.stats ? ' checked' : '') + '><span></span></label></div>' +
      '<div class="row"><div><b>Marketing</b><p>Meten of onze advertenties werken. Nu niet in gebruik.</p></div><label class="vd-sw"><input type="checkbox" id="vd-c-ads" aria-label="Marketing"' + (cur.ads ? ' checked' : '') + '><span></span></label></div>' +
      '<p style="margin:14px 0 0;font-size:14px;color:#4A5275">Bezoekers tellen we ook zonder cookies (Cloudflare Web Analytics). Meer in de <a href="/cookies.html" style="color:#0B4FA8">cookieverklaring</a>.</p>' +
      '<div class="btns"><button type="button" class="vd-btn" data-m="no">Alles weigeren</button><button type="button" class="vd-btn" data-m="save">Keuze opslaan</button><button type="button" class="vd-btn dark" data-m="yes">Alles accepteren</button></div></div>';
    function close() { m.remove(); d.removeEventListener('keydown', esc); }
    function esc(e) { if (e.key === 'Escape') close(); }
    m.addEventListener('click', function (e) {
      if (e.target === m) return close();
      var a = e.target.getAttribute && e.target.getAttribute('data-m');
      if (a === 'no') { save(false, false); close(); }
      else if (a === 'yes') { save(true, true); close(); }
      else if (a === 'save') { save(d.getElementById('vd-c-stats').checked, d.getElementById('vd-c-ads').checked); close(); }
    });
    d.addEventListener('keydown', esc);
    d.body.appendChild(m);
    var f = m.querySelector('#vd-c-stats'); if (f) f.focus();
  }
  d.querySelectorAll('[data-privacy-settings]').forEach(function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); openSettings(); });
  });

  var v = read();
  if (v) apply(v); else if (needed) showBanner();
})();
