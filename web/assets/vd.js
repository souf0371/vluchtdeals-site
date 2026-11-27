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

  // ---------- ankerlinks (#deals, #dealmail, ...): netjes scrollen, ook na het dichtklappen van het menu ----------
  function go(hash, smooth) { var el = hash && d.getElementById(decodeURIComponent(hash.slice(1))); if (el) el.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant', block: 'start' }); return !!el; }
  d.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="#"]'); if (!a || a.target === '_blank') return;
    var u; try { u = new URL(a.href, location.href); } catch (x) { return; }
    if (u.origin !== location.origin || u.pathname !== location.pathname || !u.hash || !d.getElementById(decodeURIComponent(u.hash.slice(1)))) return;
    e.preventDefault(); menu(false);
    requestAnimationFrame(function () { go(u.hash, true); if (history.pushState) history.pushState(null, '', u.hash); });
  });
  if (location.hash) {
    var y0 = null;
    window.addEventListener('load', function () { setTimeout(function () { if (go(location.hash)) y0 = window.scrollY; }, 150); });
    setTimeout(function () { if (y0 !== null && Math.abs(window.scrollY - y0) < 5) go(location.hash); }, 1600);  // na het laden van de deals
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
  // zoek: toestemming voor de zoekmachine van onze partner (zoeken.vluchtdeals.com). undefined = huidige keuze houden.
  function save(stats, ads, zoek) {
    var old = read() || {};
    if (zoek === undefined) zoek = !!old.zoek;
    var v = { v: 2, stats: !!stats, ads: !!ads, zoek: !!zoek, t: Date.now() };
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {}
    apply(v); hideBanner();
    if (!v.stats) clearCookies(/^_ga/);
    if (!v.zoek) clearCookies(/^_sp_/);   // meetcookies (Snowplow) die de zoekmachine op .vluchtdeals.com kan zetten
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
      '<p>Met jouw toestemming meten we hoe de site wordt gebruikt, zodat we hem kunnen verbeteren. Zonder toestemming plaatsen we die cookies niet; de site werkt dan gewoon. Lees de <a href="/cookies">cookieverklaring</a>.</p></div>' +
      '<div class="btns"><button type="button" class="vd-btn" data-c="no">Weigeren</button>' +
      '<button type="button" class="vd-btn set" data-c="set">Instellingen</button>' +
      '<button type="button" class="vd-btn dark" data-c="yes">Accepteren</button></div></div>';
    banner.addEventListener('click', function (e) {
      var c = e.target.getAttribute && e.target.getAttribute('data-c');
      if (c === 'no') save(false, false, false); else if (c === 'yes') save(true, true); else if (c === 'set') openSettings();
    });
    d.body.appendChild(banner);
  }

  // ---------- instellingen ----------
  function openSettings() {
    var cur = read() || { stats: false, ads: false, zoek: false };
    var m = d.createElement('div'); m.className = 'vd-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'vd-ps-t');
    var off = needed ? '' : '<p style="margin:10px 0 0;padding:12px 14px;border-radius:12px;background:#EEF1F8">Op vluchtdeals.com zelf gebruiken we op dit moment geen meet- of advertentiecookies. Je keuze wordt wel bewaard voor als dat verandert.</p>';
    m.innerHTML = '<div class="box"><h2 id="vd-ps-t">Privacy-instellingen</h2><p style="margin:0">Kies welke cookies je toestaat. Je kunt dit altijd aanpassen via ‘Privacy-instellingen’ onderaan elke pagina.</p>' + off +
      '<div class="row"><div><b>Noodzakelijk</b><p>Nodig om de site te laten werken en je keuze te onthouden. Altijd aan.</p></div><label class="vd-sw"><input type="checkbox" checked disabled aria-label="Noodzakelijk, altijd aan"><span></span></label></div>' +
      '<div class="row"><div><b>Statistieken</b><p>Meten hoe bezoekers de site gebruiken (Google Analytics), zodat we hem kunnen verbeteren.</p></div><label class="vd-sw"><input type="checkbox" id="vd-c-stats" aria-label="Statistieken"' + (cur.stats ? ' checked' : '') + '><span></span></label></div>' +
      '<div class="row"><div><b>Marketing</b><p>Meten of onze advertenties werken. Nu niet in gebruik.</p></div><label class="vd-sw"><input type="checkbox" id="vd-c-ads" aria-label="Marketing"' + (cur.ads ? ' checked' : '') + '><span></span></label></div>' +
      '<div class="row"><div><b>Zoekmachine van onze partner</b><p>De zoekmachine op zoeken.vluchtdeals.com komt van onze partner Travelpayouts en plaatst meetcookies. Uit: we vragen het opnieuw als je wilt zoeken.</p></div><label class="vd-sw"><input type="checkbox" id="vd-c-zoek" aria-label="Zoekmachine van onze partner"' + (cur.zoek ? ' checked' : '') + '><span></span></label></div>' +
      '<p style="margin:14px 0 0;font-size:14px;color:#4A5275">Bezoekers tellen we ook zonder cookies (Cloudflare Web Analytics). Meer in de <a href="/cookies" style="color:#0B4FA8">cookieverklaring</a>.</p>' +
      '<div class="btns"><button type="button" class="vd-btn" data-m="no">Alles weigeren</button><button type="button" class="vd-btn" data-m="save">Keuze opslaan</button><button type="button" class="vd-btn dark" data-m="yes">Alles accepteren</button></div></div>';
    function close() { m.remove(); d.removeEventListener('keydown', esc); }
    function esc(e) { if (e.key === 'Escape') close(); }
    m.addEventListener('click', function (e) {
      if (e.target === m) return close();
      var a = e.target.getAttribute && e.target.getAttribute('data-m');
      if (a === 'no') { save(false, false, false); close(); }
      else if (a === 'yes') { save(true, true, true); close(); }
      else if (a === 'save') { save(d.getElementById('vd-c-stats').checked, d.getElementById('vd-c-ads').checked, d.getElementById('vd-c-zoek').checked); close(); }
    });
    d.addEventListener('keydown', esc);
    d.body.appendChild(m);
    var f = m.querySelector('#vd-c-stats'); if (f) f.focus();
  }
  // ---------- toestemming vóór de zoekmachine (zoeken.vluchtdeals.com) ----------
  // De zoekmachine van onze partner start meteen meetcookies en heeft zelf geen 'weigeren'. Daarom vragen we het hier,
  // vóórdat iemand erheen gaat. 'Akkoord' wordt bewaard (vd_consent.zoek); 'Liever niet' niet, dan vragen we het de volgende keer weer.
  var ZOEKHOST = 'zoeken.vluchtdeals.com';
  function isZoek(url) { try { return new URL(url, location.href).hostname === ZOEKHOST; } catch (e) { return false; } }
  function naarZoek(url, nieuw) {
    if (nieuw) { var w = window.open(url, '_blank'); if (w) { try { w.opener = null; } catch (e) {} } else location.href = url; }   // 'noopener' geeft altijd null terug, dus zelf loskoppelen
    else location.href = url;
  }
  var gate = null;
  function zoekVraag(url, nieuw) {
    var v = read();
    if (v && v.zoek) return naarZoek(url, nieuw);
    if (gate) gate.remove();
    var back = d.activeElement;
    var m = d.createElement('div'); m.className = 'vd-modal vd-gate'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.setAttribute('aria-labelledby', 'vd-zg-t'); m.setAttribute('aria-describedby', 'vd-zg-p');
    m.innerHTML = '<div class="box"><h2 id="vd-zg-t">Even checken voor je zoekt</h2>' +
      '<p id="vd-zg-p">Je gaat naar de zoekmachine van onze reispartner. Die plaatst meetcookies om te zien hoe er gezocht wordt. Daar hebben wij geen invloed op.</p>' +
      '<p class="sm">We bewaren je keuze op dit apparaat. Wijzigen kan altijd via ‘Privacy-instellingen’ onderaan de pagina. Meer in de <a href="/cookies">cookieverklaring</a>.</p>' +
      '<div class="btns"><button type="button" class="vd-btn" data-z="no">Liever niet</button><button type="button" class="vd-btn dark" data-z="yes">Akkoord, zoeken</button></div></div>';
    function close() { m.remove(); gate = null; d.removeEventListener('keydown', esc); if (back && back.focus) try { back.focus(); } catch (e) {} }
    function esc(e) { if (e.key === 'Escape') close(); }
    m.addEventListener('click', function (e) {
      if (e.target === m) return close();
      var z = e.target.getAttribute && e.target.getAttribute('data-z');
      if (z === 'yes') { var c = read() || {}; save(!!c.stats, !!c.ads, true); close(); naarZoek(url, nieuw); }
      else if (z === 'no') {
        m.querySelector('.box').innerHTML = '<h2 id="vd-zg-t">Geen probleem</h2>' +
          '<p id="vd-zg-p">Zonder de zoekmachine kun je nog steeds de deals van vandaag bekijken en je aanmelden voor de gratis dealmail.</p>' +
          '<div class="btns"><button type="button" class="vd-btn" data-z="close">Sluiten</button><a class="vd-btn" href="/#dealmail" data-z="mail">Naar de dealmail</a></div>';
        var b = m.querySelector('[data-z=close]'); if (b) b.focus();
      }
      else if (z === 'close' || z === 'mail') close();
    });
    d.addEventListener('keydown', esc);
    d.body.appendChild(m); gate = m;
    var f = m.querySelector('[data-z=yes]'); if (f) f.focus();
  }
  window.vdZoek = function (url, nieuw) { zoekVraag(url, !!nieuw); };
  // alle links naar de zoekmachine (deals, bestemmingen, tegels), ook links die later worden toegevoegd
  d.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0) return;
    var a = e.target.closest && e.target.closest('a[href]'); if (!a || !isZoek(a.href)) return;
    var v = read(); if (v && v.zoek) return;          // al akkoord: link werkt gewoon
    e.preventDefault();
    zoekVraag(a.href, a.target === '_blank' || e.metaKey || e.ctrlKey);
  }, true);
  d.addEventListener('auxclick', function (e) {      // middelste muisknop (nieuw tabblad)
    if (e.button !== 1) return;
    var a = e.target.closest && e.target.closest('a[href]'); if (!a || !isZoek(a.href)) return;
    var v = read(); if (v && v.zoek) return;
    e.preventDefault(); zoekVraag(a.href, true);
  }, true);
  // formulieren die naar de zoekmachine gaan (bestemmingspagina's)
  d.addEventListener('submit', function (e) {
    var f = e.target; if (!f || !f.action || !isZoek(f.action) || (f.method || 'get').toLowerCase() !== 'get') return;
    var v = read(); if (v && v.zoek) return;
    e.preventDefault();
    var u = new URL(f.action); u.search = new URLSearchParams(new FormData(f)).toString();   // zelfde adres als het formulier zelf zou maken
    zoekVraag(u.toString(), f.target === '_blank');
  }, true);

  // ---------- dealmail-formulier boven de voettekst (Brevo, dubbele bevestiging) ----------
  d.querySelectorAll('.vd-mailform').forEach(function (f) {
    var m = f.querySelector('input[type=email]'), btn = f.querySelector('button'), msg = f.querySelector('.note');
    function say(t, c) { msg.textContent = t; msg.className = 'note ' + (c || ''); }
    m.addEventListener('input', function () { if (msg.className.indexOf('err') > -1) say('Je krijgt eerst een mail om te bevestigen.'); });
    f.addEventListener('submit', function (e) {
      var v = (m.value || '').trim();
      if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { e.preventDefault(); say('Vul een geldig e-mailadres in.', 'err'); m.focus(); return; }
      if (!window.fetch || !window.FormData) return;
      e.preventDefault(); btn.disabled = true; btn.textContent = 'Bezig…';
      fetch(f.action + '?isAjax=1', { method: 'POST', body: new FormData(f) }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.success) { say('Bijna klaar! Check je mail en klik op de link om je inschrijving te bevestigen.', 'ok'); m.value = ''; btn.textContent = 'Aangemeld'; }
        else { say('Dat lukte niet. Controleer je e-mailadres en probeer het opnieuw.', 'err'); btn.disabled = false; btn.textContent = 'Aanmelden'; }
      }).catch(function () { f.submit(); });
    });
  });

  d.querySelectorAll('[data-privacy-settings]').forEach(function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); openSettings(); });
  });

  var v = read();
  if (v) apply(v); else if (needed) showBanner();
})();
