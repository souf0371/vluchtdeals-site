// Vluchtdeals prijsalarm – Cloudflare Pages Function (komt op vluchtdeals.com/api/prijsalarm/...)
//
//   POST /api/prijsalarm            aanmelden → bevestigingsmail (dubbele bevestiging)
//   POST /api/prijsalarm/bevestig   {t} vanaf de pagina /prijsalarm/bevestigen → alarm opslaan in Brevo
//   POST /api/prijsalarm/uit        {t} vanaf /prijsalarm/uitzetten, of één-klik-afmelden uit de mail (?t=…)
//
// Links in mails gaan naar een pagina met een knop (token in #fragment), niet direct naar deze functie:
// virusscanners van mailprogramma's openen links automatisch en zouden anders alarmen aan- of uitzetten.
//
// Nodig in Cloudflare Pages → Settings → Variables and Secrets: BREVO_API_KEY (zelfde sleutel als in GitHub).
// Alarmen staan alleen in Brevo: contactveld PRIJSALARMEN (compact, max 6 per adres), lijst 'Prijsalarm'.
// Links worden ondertekend met een sleutel die is afgeleid van BREVO_API_KEY (dezelfde afleiding als bot/prijsalarm.py).
// Bron van dit bestand: vluchtdeals-bot/site_functions/ (de stap 'website' zet het in vluchtdeals-site/functions/).

const API = "https://api.brevo.com/v3";
const SITE = "https://vluchtdeals.com";
const SENDER = { name: "Vluchtdeals", email: "info@vluchtdeals.com" };
const LIST_ALARM = "Prijsalarm";
const LIST_DEALMAIL = "Dealmail";
const ATTR = "PRIJSALARMEN";
const MAX_ALARMS = 6;
const ORIGINS = { ALL: "alle luchthavens", AMS: "Amsterdam", RTM: "Rotterdam", EIN: "Eindhoven", BRU: "Brussel en Charleroi", DUS: "Düsseldorf en Weeze" };
const CONFIRM_DAYS = 7;

// ---------- hulpjes ----------
const enc = new TextEncoder();
function b64url(bytes) {
  let s = "";
  const a = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64url(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function hmacKey(apiKey) {
  const raw = await crypto.subtle.digest("SHA-256", enc.encode("vd-prijsalarm-v1:" + apiKey));
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export async function sign(apiKey, obj) {
  const body = b64url(enc.encode(JSON.stringify(obj)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(apiKey), enc.encode(body));
  return body + "." + b64url(sig);
}
export async function verify(apiKey, token) {
  if (typeof token !== "string" || token.length > 2000 || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  let ok = false;
  try { ok = await crypto.subtle.verify("HMAC", await hmacKey(apiKey), unb64url(sig), enc.encode(body)); } catch (e) { return null; }
  if (!ok) return null;
  try { return JSON.parse(new TextDecoder().decode(unb64url(body))); } catch (e) { return null; }
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ymd = (d = new Date()) => d.toISOString().slice(0, 10).replace(/-/g, "");
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const go = (path) => new Response(null, { status: 303, headers: { location: SITE + path, "cache-control": "no-store" } });

// Alarmen compact opslaan: "LIS|ALL|80|20261128|-|0;MAD|AMS|60|20261128|20261201|58"
//   bestemming | vertrek | grens (€) | aangemaakt | laatst gemaild | prijs in laatste mail
export function parseAlarms(s) {
  if (!s || typeof s !== "string") return [];
  return s.split(";").map((x) => x.split("|")).filter((p) => p.length >= 3 && /^[A-Z]{3}$/.test(p[0])).map((p) => ({
    d: p[0], v: p[1] || "ALL", p: parseInt(p[2], 10) || 0, c: p[3] || ymd(), ls: p[4] && p[4] !== "-" ? p[4] : "", lp: parseInt(p[5], 10) || 0,
  }));
}
export function dumpAlarms(list) {
  return list.map((a) => [a.d, a.v, a.p, a.c, a.ls || "-", a.lp || 0].join("|")).join(";");
}

// ---------- Brevo ----------
async function brevo(env, method, path, body) {
  const r = await fetch(API + path, {
    method,
    headers: { "api-key": env.BREVO_API_KEY, accept: "application/json", "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
  return { ok: r.ok, status: r.status, data, text };
}
async function listIds(env) {
  const r = await brevo(env, "GET", "/contacts/lists?limit=50&offset=0");
  const out = {};
  for (const l of (r.data && r.data.lists) || []) out[String(l.name || "").trim().toLowerCase()] = l.id;
  if (!out[LIST_ALARM.toLowerCase()]) {          // eerste keer: lijst aanmaken (map 1 = standaardmap in Brevo)
    const f = await brevo(env, "GET", "/contacts/folders?limit=1&offset=0");
    const folderId = (f.data && f.data.folders && f.data.folders[0] && f.data.folders[0].id) || 1;
    const c = await brevo(env, "POST", "/contacts/lists", { name: LIST_ALARM, folderId });
    if (c.ok && c.data) out[LIST_ALARM.toLowerCase()] = c.data.id;
  }
  return out;
}
async function ensureAttr(env) {
  // bestaat hij al, dan geeft Brevo een foutmelding die we negeren
  await brevo(env, "POST", "/contacts/attributes/normal/" + ATTR, { type: "text" });
}
async function getContact(env, email) {
  const r = await brevo(env, "GET", "/contacts/" + encodeURIComponent(email));
  return r.ok ? r.data : null;
}
async function sendMail(env, to, subject, html, headers) {
  const body = { sender: SENDER, to: [{ email: to }], subject, htmlContent: html, tags: ["prijsalarm"] };
  if (headers) body.headers = headers;
  return brevo(env, "POST", "/smtp/email", body);
}

// ---------- mails ----------
function shell(inner) {
  return `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#EEF1F8;font-family:Inter,Arial,sans-serif;color:#0B1028">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF1F8;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden">
<tr><td style="background:#0B1028;padding:18px 24px"><img src="${SITE}/mail-logo.png" width="150" alt="Vluchtdeals" style="display:block;border:0"></td></tr>
<tr><td style="padding:28px 24px 8px 24px">${inner}</td></tr>
<tr><td style="padding:8px 24px 24px 24px;font-size:12px;line-height:1.6;color:#5B6385">Vluchtdeals · ProTrading · KvK 95302271 · <a href="${SITE}/privacy" style="color:#5B6385">Privacy</a></td></tr>
</table></td></tr></table></body></html>`;
}
function btn(href, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0"><tr><td style="background:#FFC53D;border-radius:999px">
<a href="${href}" style="display:inline-block;padding:14px 26px;font-weight:700;font-size:16px;color:#0B1028;text-decoration:none">${label}</a></td></tr></table>`;
}
function confirmMail(link, a, dealmail) {
  return shell(`<h1 style="margin:0 0 10px 0;font-size:24px;line-height:1.25">Bevestig je prijsalarm voor ${esc(a.n)}</h1>
<p style="margin:0 0 6px 0;font-size:15px;line-height:1.6;color:#3A4268">Je krijgt een mail zodra een retourvlucht naar <b>${esc(a.n)}</b> vanaf ${esc(ORIGINS[a.v] || a.v)} onder de <b>€${a.p}</b> zakt (per persoon).</p>
${dealmail ? `<p style="margin:0 0 6px 0;font-size:15px;line-height:1.6;color:#3A4268">Je krijgt ook elke donderdag de dealmail met de beste deals.</p>` : ""}
${btn(link, "Ja, zet mijn prijsalarm aan")}
<p style="margin:0 0 6px 0;font-size:13px;line-height:1.6;color:#5B6385">Heb je dit niet zelf aangevraagd? Dan hoef je niets te doen: zonder klik zetten we niets aan. De link werkt ${CONFIRM_DAYS} dagen.</p>`);
}

// ---------- handlers ----------
async function aanmelden(request, env) {
  let f = {};
  const ct = request.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) f = await request.json();
    else { const fd = await request.formData(); for (const [k, v] of fd.entries()) f[k] = String(v); }
  } catch (e) { return json({ ok: false, fout: "Dat lukte niet. Probeer het opnieuw." }, 400); }
  if (f.website) return json({ ok: true });                               // honeypot: robots krijgen 'ok' en verder niets
  const email = String(f.email || "").trim().toLowerCase();
  const d = String(f.dest || "").trim().toUpperCase();
  const n = String(f.naam || "").trim().slice(0, 60);
  const v = String(f.van || "ALL").trim().toUpperCase();
  const p = parseInt(String(f.prijs || "").replace(/[^\d]/g, ""), 10);
  const dealmail = f.dealmail === "1" || f.dealmail === true || f.dealmail === "on";
  if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i.test(email) || email.length > 254) return json({ ok: false, veld: "email", fout: "Vul een geldig e-mailadres in." }, 400);
  if (!/^[A-Z]{3}$/.test(d) || !n) return json({ ok: false, fout: "Kies een bestemming." }, 400);
  if (!ORIGINS[v]) return json({ ok: false, veld: "van", fout: "Kies een vertrekluchthaven." }, 400);
  if (!(p >= 10 && p <= 5000)) return json({ ok: false, veld: "prijs", fout: "Kies een prijs tussen €10 en €5.000." }, 400);
  const a = { e: email, d, n, v, p, m: dealmail ? 1 : 0, x: Date.now() + CONFIRM_DAYS * 864e5 };
  const link = `${SITE}/prijsalarm/bevestigen#t=${await sign(env.BREVO_API_KEY, a)}`;
  const r = await sendMail(env, email, `Bevestig je prijsalarm voor ${n}`, confirmMail(link, a, dealmail));
  if (!r.ok) {
    console.log("brevo smtp", r.status, r.text.slice(0, 300));
    return json({ ok: false, fout: "We konden de bevestigingsmail niet versturen. Probeer het later opnieuw." }, 502);
  }
  return json({ ok: true });
}

async function tokenFrom(request, url) {
  let t = url.searchParams.get("t");
  if (!t) {
    try {
      const ct = request.headers.get("content-type") || "";
      if (ct.includes("application/json")) t = (await request.json()).t;
      else { const fd = await request.formData(); t = fd.get("t"); }
    } catch (e) { t = null; }
  }
  return t ? String(t) : null;
}

async function bevestig(request, url, env) {
  const t = await verify(env.BREVO_API_KEY, await tokenFrom(request, url));
  if (!t || !t.e || !t.d) return json({ ok: false, fout: "Deze link klopt niet. Zet het prijsalarm opnieuw aan op de site." }, 400);
  if (!t.x || Date.now() > t.x) return json({ ok: false, verlopen: true, fout: "Deze link is verlopen. Zet het prijsalarm opnieuw aan op de site." }, 410);
  await ensureAttr(env);
  const lists = await listIds(env);
  const contact = await getContact(env, t.e);
  let alarms = parseAlarms(contact && contact.attributes ? contact.attributes[ATTR] : "");
  const same = alarms.find((x) => x.d === t.d && x.v === t.v);
  if (same) { same.p = t.p; same.c = ymd(); same.ls = ""; same.lp = 0; }
  else {
    alarms.push({ d: t.d, v: t.v, p: t.p, c: ymd(), ls: "", lp: 0 });
    if (alarms.length > MAX_ALARMS) alarms = alarms.slice(-MAX_ALARMS);   // oudste valt eraf
  }
  const add = [lists[LIST_ALARM.toLowerCase()]].filter(Boolean);
  if (t.m && lists[LIST_DEALMAIL.toLowerCase()]) add.push(lists[LIST_DEALMAIL.toLowerCase()]);
  const r = await brevo(env, "POST", "/contacts", { email: t.e, attributes: { [ATTR]: dumpAlarms(alarms) }, listIds: add, updateEnabled: true });
  if (!r.ok) { console.log("brevo contact", r.status, r.text.slice(0, 300)); return json({ ok: false, fout: "Opslaan lukte niet. Probeer het over een paar minuten opnieuw." }, 502); }
  return json({ ok: true, stad: t.n || t.d, prijs: t.p, van: ORIGINS[t.v] || t.v, dealmail: !!t.m });
}

async function uit(request, url, env) {
  const t = await verify(env.BREVO_API_KEY, await tokenFrom(request, url));
  if (!t || !t.e) return json({ ok: false, fout: "Deze link klopt niet." }, 400);
  const contact = await getContact(env, t.e);
  if (!contact) return json({ ok: true, alle: !!t.all });
  let alarms = parseAlarms(contact.attributes ? contact.attributes[ATTR] : "");
  alarms = t.all ? [] : alarms.filter((a) => !(a.d === t.d && a.v === t.v));
  const body = { attributes: { [ATTR]: dumpAlarms(alarms) } };
  const lists = await listIds(env);
  if (!alarms.length && lists[LIST_ALARM.toLowerCase()]) body.unlinkListIds = [lists[LIST_ALARM.toLowerCase()]];
  const r = await brevo(env, "PUT", "/contacts/" + encodeURIComponent(t.e), body);
  if (!r.ok) { console.log("brevo uit", r.status, r.text.slice(0, 300)); return json({ ok: false, fout: "Uitzetten lukte niet. Probeer het over een paar minuten opnieuw." }, 502); }
  return json({ ok: true, alle: !!t.all, stad: t.n || t.d || "" });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const sub = url.pathname.replace(/\/+$/, "").split("/").pop();
  if (!env.BREVO_API_KEY) return json({ ok: false, fout: "Het prijsalarm is even niet beschikbaar. Probeer het later opnieuw." }, 503);
  try {
    if (request.method === "POST" && sub === "prijsalarm") return await aanmelden(request, env);
    if (request.method === "POST" && sub === "bevestig") return await bevestig(request, url, env);
    if (request.method === "POST" && sub === "uit") return await uit(request, url, env);
    if (request.method === "GET" && (sub === "bevestig" || sub === "uit")) {      // oude/handmatige link: naar de pagina met knop
      const t = url.searchParams.get("t") || "";
      return go((sub === "bevestig" ? "/prijsalarm/bevestigen" : "/prijsalarm/uitzetten") + (t ? "#t=" + t : ""));
    }
    return json({ ok: false, fout: "Niet gevonden" }, 404);
  } catch (e) {
    console.log("prijsalarm fout", e && e.stack ? e.stack : e);
    return json({ ok: false, fout: "Er ging iets mis. Probeer het later opnieuw." }, 500);
  }
}
