(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  // ---------------------------------------------------------------- i18n
  const STR = {
    en: {
      appName: "Story Time", grownups: "Grown-ups", ideaQ: "What's the story about?", whoReads: "Who reads?",
      howLong: "How long?", myStories: "My stories", talk: "Talk", listening: "Listening…", ideaPh: "a little duck who finds a sparkly pond…",
      make: "Make My Story", makeSub: "Starts in about a minute", making: "Making your story…", nowPlaying: "Now playing — tap to open",
      installHint: "Tip for grown-ups: Chrome menu → Add to Home screen.", back: "Back", dim: "Dim", startOver: "Start over",
      readAlong: "Read along", hideWords: "Hide words", tryAgain: "Try again", details: "Grown-ups: details", close: "Close",
      wakeTitle: "Waking up the story machine…", wakeText: "It was sleeping! This takes about a minute.",
      wakeOffline: "No internet right now. Check the Wi-Fi — I'll keep trying.", wakeSaved: "While you wait, your saved stories still play:",
      pinLabel: "Family PIN", unlock: "Unlock", askGrownup: "Ask a grown-up for the PIN.", wrongPin: "Wrong PIN. Ask a grown-up.",
      tapToSee: "Tap to see the screen", free: "free", typeIdea: "Tell me your idea first — tap 🎤 Talk!",
      startingNow: "Starting now! 🎶", nextComing: "Next part coming… 🌟", theEnd: "The end 🌙 Sweet dreams!", paused: "Paused",
      partOf: "Part {n} of {t}", moreStars: "more stars are coming ✨", allStars: "the whole story is ready ⭐",
      readBy: "read by {v}", oopsH: "Oops! The story got lost.", oopsP: "Let's try again.", busyH: "One story at a time!",
      busyP: "Another story is still being made. Try again in a little bit.", sleepyH: "The story machine is still waking up.",
      sleepyP: "Give it a minute, then try again.", gentleH: "Let's pick a gentle idea 🌸",
      gentleP: "Bedtime stories are cozy and calm. Try something soft, like a sleepy bunny or a starry boat.", ok: "OK",
      noStories: "No stories yet — make your first one!", heardIt: "Got it! Now press Make My Story.",
      micNo: "I couldn't hear that. You can also tap the keyboard 🎤.", holdEdit: "Hold to change", renameH: "Change name & picture",
      save: "Save", cancel: "Cancel", pinPromptH: "Grown-ups only", pinPromptP: "Enter the family PIN.",
      askGrokH: "Ask a grown-up 🙋", askGrokP: "This voice costs a little money. A grown-up can type the PIN to say yes.",
      deleteH: "Delete this story?", deleteP: "“{t}” will be removed from this tablet and the server. This can't be undone.", del: "Delete",
      gVoices: "Voices", gAllowGrok: "Allow Grok voices (Luna, Carina, Orion)", gAskGrok: "Ask a grown-up before using them",
      gCostNote: "Ava is free. Grok voices cost roughly 16–34¢ per story (Short to Long).", gLanguage: "Language",
      gScreenLang: "Screen language", gAutoNote: "Auto follows each kid's story language.", gStoryLang: "Story language",
      gBedtime: "Bedtime", gDim: "Extra-dim night colors", gDark: "Turn screen dark after story starts",
      gFilter: "Gentle-words filter on story ideas", gStories: "Stories", gSavedNote: "Stories are saved on this tablet.",
      gStorage: "Stories are saved on this tablet. Space used: {mb} MB.", gPin: "Family PIN",
      gPinHow: "To change the PIN: open Render → bedtime-story-maker → Environment → edit FAMILY_PIN → Save. The site restarts; then unlock with the new PIN.",
      logout: "Log out", play: "Play", download: "Save MP3", onTablet: "on this tablet", serverOnly: "server copy",
    },
    es: {
      appName: "Hora del Cuento", grownups: "Adultos", ideaQ: "¿De qué trata el cuento?", whoReads: "¿Quién lee?",
      howLong: "¿Qué tan largo?", myStories: "Mis cuentos", talk: "Hablar", listening: "Escuchando…", ideaPh: "un patito que encuentra un estanque brillante…",
      make: "Hacer Mi Cuento", makeSub: "Empieza en un minuto", making: "Haciendo tu cuento…", nowPlaying: "Sonando ahora — toca para abrir",
      installHint: "Consejo para adultos: menú de Chrome → Agregar a pantalla principal.", back: "Atrás", dim: "Oscurecer", startOver: "Empezar de nuevo",
      readAlong: "Leer juntos", hideWords: "Ocultar palabras", tryAgain: "Intentar otra vez", details: "Adultos: detalles", close: "Cerrar",
      wakeTitle: "Despertando la máquina de cuentos…", wakeText: "¡Estaba dormida! Tarda como un minuto.",
      wakeOffline: "No hay internet ahora. Revisa el Wi-Fi — sigo intentando.", wakeSaved: "Mientras esperas, tus cuentos guardados sí suenan:",
      pinLabel: "PIN de la familia", unlock: "Abrir", askGrownup: "Pídele el PIN a un adulto.", wrongPin: "PIN incorrecto. Pregúntale a un adulto.",
      tapToSee: "Toca para ver la pantalla", free: "gratis", typeIdea: "Primero cuéntame tu idea — ¡toca 🎤 Hablar!",
      startingNow: "¡Empezamos! 🎶", nextComing: "Ya viene la siguiente parte… 🌟", theEnd: "Fin 🌙 ¡Dulces sueños!", paused: "En pausa",
      partOf: "Parte {n} de {t}", moreStars: "vienen más estrellas ✨", allStars: "el cuento completo está listo ⭐",
      readBy: "lo lee {v}", oopsH: "¡Uy! Se perdió el cuento.", oopsP: "Intentemos otra vez.", busyH: "¡Un cuento a la vez!",
      busyP: "Todavía se está haciendo otro cuento. Intenta en un ratito.", sleepyH: "La máquina de cuentos sigue despertando.",
      sleepyP: "Espera un minuto y vuelve a intentar.", gentleH: "Escojamos una idea suave 🌸",
      gentleP: "Los cuentos para dormir son tranquilos. Prueba algo suave, como un conejito dormilón o un barco de estrellas.", ok: "OK",
      noStories: "Aún no hay cuentos — ¡haz el primero!", heardIt: "¡Listo! Ahora toca Hacer Mi Cuento.",
      micNo: "No te escuché. También puedes tocar el 🎤 del teclado.", holdEdit: "Mantén presionado", renameH: "Cambiar nombre y dibujo",
      save: "Guardar", cancel: "Cancelar", pinPromptH: "Solo adultos", pinPromptP: "Escribe el PIN de la familia.",
      askGrokH: "Pregúntale a un adulto 🙋", askGrokP: "Esta voz cuesta un poquito de dinero. Un adulto puede escribir el PIN para decir que sí.",
      deleteH: "¿Borrar este cuento?", deleteP: "“{t}” se borrará de esta tableta y del servidor. No se puede deshacer.", del: "Borrar",
      gVoices: "Voces", gAllowGrok: "Permitir voces Grok (Luna, Carina, Orion)", gAskGrok: "Pedir permiso a un adulto antes de usarlas",
      gCostNote: "Ava es gratis. Las voces Grok cuestan aprox. 16–34¢ por cuento (corto a largo).", gLanguage: "Idioma",
      gScreenLang: "Idioma de la pantalla", gAutoNote: "Auto sigue el idioma del cuento de cada niño.", gStoryLang: "Idioma del cuento",
      gBedtime: "Hora de dormir", gDim: "Colores extra oscuros de noche", gDark: "Apagar la pantalla cuando empieza el cuento",
      gFilter: "Filtro de palabras suaves en las ideas", gStories: "Cuentos", gSavedNote: "Los cuentos se guardan en esta tableta.",
      gStorage: "Los cuentos se guardan en esta tableta. Espacio usado: {mb} MB.", gPin: "PIN de la familia",
      gPinHow: "Para cambiar el PIN: abre Render → bedtime-story-maker → Environment → edita FAMILY_PIN → Save. El sitio se reinicia; luego abre con el PIN nuevo.",
      logout: "Cerrar sesión", play: "Escuchar", download: "Guardar MP3", onTablet: "en esta tableta", serverOnly: "copia del servidor",
    },
  };

  // ---------------------------------------------------------------- state
  const DEFAULT_PROFILES = [
    { id: "p1", name: "Kid 1", emoji: "🦄" },
    { id: "p2", name: "Kid 2", emoji: "🐱" },
  ];
  const DEFAULT_SETTINGS = { allowGrok: true, askGrok: false, uiLang: "auto", dim: false, darkAfter: false, filter: true };
  const VOICE_FALLBACK = [{ id: "ava", name: "Ava", emoji: "🦆", uses_credit: false, description: "Warm free bedtime voice." }];
  const COIN = "🪙 16–34¢";

  function loadJSON(key, dflt) {
    try { const v = JSON.parse(localStorage.getItem(key) || "null"); return v == null ? dflt : v; } catch (_) { return dflt; }
  }
  let settings = Object.assign({}, DEFAULT_SETTINGS, loadJSON("grownSettings", {}));
  let profiles = loadJSON("storyProfiles", null);
  if (!Array.isArray(profiles) || profiles.length !== 2) profiles = DEFAULT_PROFILES.map((p) => ({ ...p }));
  if (!localStorage.getItem("profilesMigrated")) {
    const oldVoice = localStorage.getItem("storyVoice"), oldLen = localStorage.getItem("storyLength");
    if (oldVoice && !localStorage.getItem("storyVoice:p1")) localStorage.setItem("storyVoice:p1", oldVoice);
    if (oldLen && !localStorage.getItem("storyLength:p1")) localStorage.setItem("storyLength:p1", oldLen);
    localStorage.setItem("profilesMigrated", "1");
  }
  localStorage.setItem("storyProfiles", JSON.stringify(profiles));
  let activeProfile = localStorage.getItem("activeProfile") === "p2" ? "p2" : "p1";
  const pKey = (k, pid) => k + ":" + (pid || activeProfile);
  const getP = (k, d, pid) => localStorage.getItem(pKey(k, pid)) || d;
  const setP = (k, v, pid) => localStorage.setItem(pKey(k, pid), v);
  const storyLang = (pid) => (getP("storyLang", "English", pid).startsWith("Es") ? "Español" : "English");
  let voices = [];
  let pollTimer = null;
  let jobProfile = "p1";
  let lastRequest = null;
  let previewAudio = null, previewId = null;
  let pmode = null;           // "live" | "full" | null
  let fullStoryId = null;
  let making = false;

  const uiLang = () => (settings.uiLang === "auto" ? (storyLang() === "Español" ? "es" : "en") : settings.uiLang);
  const t = (k, vars) => {
    let s = (STR[uiLang()] && STR[uiLang()][k]) || STR.en[k] || k;
    if (vars) Object.keys(vars).forEach((x) => { s = s.replace("{" + x + "}", vars[x]); });
    return s;
  };
  const altLang = () => (uiLang() === "es" ? "en" : "es");
  const saveSettings = () => localStorage.setItem("grownSettings", JSON.stringify(settings));
  const saveProfiles = () => localStorage.setItem("storyProfiles", JSON.stringify(profiles));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function applyI18n() {
    document.documentElement.lang = uiLang();
    qsa("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    qsa("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    qsa("[data-alt]").forEach((el) => { el.textContent = STR[altLang()][el.dataset.alt] || ""; });
    $("p-words-l").textContent = raPanel.classList.contains("hidden") ? t("readAlong") : t("hideWords");
  }

  // ---------------------------------------------------------------- tiny helpers
  const show = (id) => $(id).classList.remove("hidden");
  const hide = (id) => $(id).classList.add("hidden");
  const isShown = (id) => !$(id).classList.contains("hidden");
  const fmtTime = (s) => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const day = (iso) => { const d = new Date(iso || ""); return isNaN(d) ? "" : d.toLocaleDateString(uiLang() === "es" ? "es-MX" : "en-US", { month: "short", day: "numeric", year: "numeric" }); };
  const profile = (pid) => profiles.find((p) => p.id === (pid || activeProfile)) || profiles[0];

  async function api(path, opts = {}) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), opts.timeout || 20000);
    let res;
    try {
      res = await fetch(path, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, signal: ctl.signal, ...opts });
    } finally { clearTimeout(timer); }
    let data = null;
    if ((res.headers.get("content-type") || "").includes("application/json")) data = await res.json();
    if (!res.ok) {
      const err = new Error((data && (data.detail || data.error)) || res.statusText);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // ---------------------------------------------------------------- IndexedDB (stories saved on the tablet)
  const DB_NAME = "bedtime-stories", STORE = "stories";
  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" }); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function idbTx(mode, fn) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const out = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
      tx.onerror = () => reject(tx.error);
    });
  }
  const idbPut = (rec) => idbTx("readwrite", (s) => { s.put(rec); });
  const idbDel = (id) => idbTx("readwrite", (s) => { s.delete(id); });
  const idbAll = () => idbTx("readonly", (s) => s.getAll()).then((r) => r || []);

  async function cacheStory(meta, blob) {
    await idbPut({ id: meta.id, title: meta.title, created: meta.created || new Date().toISOString(), words: meta.words,
      profile: meta.profile || activeProfile, voice: meta.voice, blob });
  }
  async function fetchAudioBlob(storyId) {
    const res = await fetch("/api/stories/" + storyId + "/audio", { credentials: "same-origin" });
    if (!res.ok) throw new Error("Could not download audio");
    return await res.blob();
  }

  // ---------------------------------------------------------------- screens / session (wake → PIN only if server says so)
  let wakeTimer = null;
  function showOnly(id) {
    ["wake-screen", "pin-screen", "app-screen"].forEach((x) => (x === id ? show(x) : hide(x)));
  }
  async function checkSession() {
    const slow = setTimeout(() => { if (!isShown("app-screen") && !isShown("pin-screen")) showWake(); }, 900);
    try {
      const s = await api("/api/session", { timeout: 9000 });
      clearTimeout(slow); clearTimeout(wakeTimer);
      if (s && s.ok) { showOnly("app-screen"); await enterApp(); }
      else { showOnly("pin-screen"); $("pin").focus(); }
    } catch (_) {
      clearTimeout(slow);
      showWake();
      clearTimeout(wakeTimer);
      wakeTimer = setTimeout(checkSession, 3000);
    }
  }
  async function showWake() {
    showOnly("wake-screen");
    $("wake-p").textContent = navigator.onLine === false ? t("wakeOffline") : t("wakeText");
    let local = [];
    try { local = (await idbAll()).filter((s) => (s.profile || "p1") === activeProfile && s.blob); } catch (_) {}
    if (local.length) { renderStoryCards($("wake-list"), local.slice(0, 6), true); show("wake-saved"); } else hide("wake-saved");
  }
  window.addEventListener("online", () => { if (isShown("wake-screen")) checkSession(); });

  $("pin-go").addEventListener("click", async () => {
    $("pin-status").textContent = "…";
    try {
      await api("/api/login", { method: "POST", body: JSON.stringify({ pin: $("pin").value }) });
      $("pin").value = "";
      $("pin-status").textContent = t("askGrownup");
      $("pin-status").className = "status";
      await checkSession();
    } catch (e) {
      if (e.status === 403) { $("pin-status").textContent = t("wrongPin"); $("pin-status").className = "status err"; }
      else { showWake(); wakeTimer = setTimeout(checkSession, 3000); }
    }
  });
  $("pin").addEventListener("keydown", (e) => { if (e.key === "Enter") $("pin-go").click(); });

  let entered = false;
  async function enterApp() {
    applyAll();
    if (!entered) { entered = true; await loadVoices(); }
    renderVoices();
    await refreshStories();
  }

  function applyAll() {
    applyI18n();
    renderKids();
    syncLength();
    renderVoices();
    applyBedtime();
  }

  // ---------------------------------------------------------------- kids (big cards; hold ✏️ to rename)
  const EMOJIS = ["🦄", "🐱", "🐶", "🦊", "🐼", "🐰", "🦋", "🐢", "🦖", "🐬", "🌈", "⭐", "🌸", "🚀", "👑", "🐸"];
  function renderKids() {
    const box = $("kids");
    box.innerHTML = "";
    profiles.forEach((p) => {
      const b = document.createElement("div");
      b.className = "kid" + (p.id === activeProfile ? " on" : "");
      b.setAttribute("role", "button");
      b.tabIndex = 0;
      b.innerHTML = '<span class="e">' + esc(p.emoji) + "</span>" + esc(p.name);
      b.addEventListener("click", () => switchProfile(p.id));
      if (p.id === activeProfile) {
        const ed = document.createElement("button");
        ed.type = "button"; ed.className = "edit"; ed.setAttribute("aria-label", t("holdEdit"));
        ed.innerHTML = "<span>✏️</span>";
        attachHold(ed, b, () => openRename(p.id));
        b.appendChild(ed);
      }
      box.appendChild(b);
    });
  }
  function attachHold(btn, host, done) {
    // press-and-hold ~0.8s so a stray tap never opens the editor
    let start = 0, raf = 0, fired = false;
    const tip = () => {
      if (host.querySelector(".hold-tip")) return;
      const tp = document.createElement("div"); tp.className = "hold-tip"; tp.textContent = t("holdEdit");
      host.appendChild(tp); setTimeout(() => tp.remove(), 1600);
    };
    const step = () => {
      const f = Math.min(1, (performance.now() - start) / 800);
      btn.style.setProperty("--hold", Math.round(f * 100) + "%");
      if (f >= 1) { fired = true; cancel(); done(); return; }
      raf = requestAnimationFrame(step);
    };
    const begin = (e) => { e.preventDefault(); e.stopPropagation(); fired = false; start = performance.now(); raf = requestAnimationFrame(step); };
    const cancel = () => { cancelAnimationFrame(raf); btn.style.setProperty("--hold", "0%"); };
    const end = (e) => { e.stopPropagation(); if (!fired) tip(); cancel(); };
    btn.addEventListener("pointerdown", begin);
    btn.addEventListener("pointerup", end);
    btn.addEventListener("pointerleave", cancel);
    btn.addEventListener("pointercancel", cancel);
    btn.addEventListener("click", (e) => e.stopPropagation());
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  function openRename(pid) {
    const p = profile(pid);
    let pick = p.emoji;
    modal('<h2>' + esc(t("renameH")) + '</h2><input type="text" id="m-name" maxlength="16" value="' + esc(p.name) + '"/>' +
      '<div class="emoji-grid" id="m-emoji">' + EMOJIS.map((e) => '<button type="button" class="' + (e === pick ? "on" : "") + '">' + e + "</button>").join("") + "</div>" +
      '<div class="mrow"><button class="btn ghost" id="m-cancel" type="button">' + esc(t("cancel")) + '</button><button class="btn make-like" id="m-ok" type="button">✓ ' + esc(t("save")) + "</button></div>");
    qsa("#m-emoji button").forEach((b) => b.addEventListener("click", () => { pick = b.textContent; qsa("#m-emoji button").forEach((x) => x.classList.toggle("on", x === b)); }));
    $("m-cancel").onclick = closeModal;
    $("m-ok").onclick = () => { p.name = $("m-name").value.trim().slice(0, 16) || p.name; p.emoji = pick; saveProfiles(); closeModal(); renderKids(); };
  }
  async function switchProfile(id) {
    if (id === activeProfile) return;
    if (making) { hint(t("busyP"), true); return; }
    activeProfile = id;
    localStorage.setItem("activeProfile", id);
    applyAll();
    await refreshStories();
  }

  // ---------------------------------------------------------------- modal
  function modal(html) { $("modal-card").innerHTML = html; show("modal"); }
  function closeModal() { hide("modal"); $("modal-card").innerHTML = ""; }
  $("modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
  function message(h, p) {
    modal("<h2>" + esc(h) + "</h2><p>" + esc(p) + '</p><div class="mrow"><button class="btn make-like" id="m-ok" type="button">' + esc(t("ok")) + "</button></div>");
    $("m-ok").onclick = closeModal;
  }
  function confirmBox(h, p, okLabel) {
    return new Promise((resolve) => {
      modal("<h2>" + esc(h) + "</h2><p>" + esc(p) + '</p><div class="mrow"><button class="btn ghost" id="m-cancel" type="button">' + esc(t("cancel")) +
        '</button><button class="btn" id="m-ok" type="button" style="background:#e94560">' + esc(okLabel) + "</button></div>");
      $("m-cancel").onclick = () => { closeModal(); resolve(false); };
      $("m-ok").onclick = () => { closeModal(); resolve(true); };
    });
  }
  function pinPrompt(h, p) {
    // verifies the family PIN with the server (same check as unlocking)
    return new Promise((resolve) => {
      modal("<h2>" + esc(h) + "</h2><p>" + esc(p) + '</p><input type="password" inputmode="numeric" id="m-pin" placeholder="••••"/><p class="status" id="m-pinmsg"></p>' +
        '<div class="mrow"><button class="btn ghost" id="m-cancel" type="button">' + esc(t("cancel")) + '</button><button class="btn" id="m-ok" type="button">' + esc(t("unlock")) + "</button></div>");
      const input = $("m-pin");
      setTimeout(() => input.focus(), 50);
      const go = async () => {
        try {
          await api("/api/login", { method: "POST", body: JSON.stringify({ pin: input.value }) });
          closeModal(); resolve(true);
        } catch (e) {
          $("m-pinmsg").textContent = e.status === 403 ? t("wrongPin") : t("sleepyP");
          $("m-pinmsg").className = "status err"; input.value = "";
        }
      };
      $("m-ok").onclick = go;
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
      $("m-cancel").onclick = () => { closeModal(); resolve(false); };
    });
  }

  // ---------------------------------------------------------------- voices (face cards)
  async function loadVoices() {
    try { const d = await api("/api/voices"); voices = d.voices || []; } catch (_) { voices = []; }
  }
  const allowedVoices = () => (voices.length ? voices : VOICE_FALLBACK).filter((v) => settings.allowGrok || !v.uses_credit);
  function currentVoice() {
    let id = getP("storyVoice", "ava");
    if (!allowedVoices().some((v) => v.id === id)) id = "ava";
    return id;
  }
  function renderVoices() {
    const box = $("voices");
    const sel = currentVoice();
    box.innerHTML = "";
    allowedVoices().forEach((v) => {
      const c = document.createElement("div");
      c.className = "v" + (v.id === sel ? " on" : "");
      c.setAttribute("role", "button");
      c.innerHTML = '<button type="button" class="play' + (previewId === v.id ? " playing" : "") + '" aria-label="Sample">' + (previewId === v.id ? "■" : "▶") + "</button>" +
        '<span class="f">' + esc(v.emoji || "🌙") + "</span><b>" + esc(v.name) + "</b>" +
        (v.uses_credit ? '<span class="tag coin">' + COIN + "</span>" : '<span class="tag free">🌙 ' + esc(t("free")) + "</span>");
      c.querySelector(".play").addEventListener("click", (e) => { e.stopPropagation(); playPreview(v.id); });
      c.addEventListener("click", () => chooseVoice(v));
      box.appendChild(c);
    });
  }
  async function chooseVoice(v) {
    if (v.uses_credit && settings.askGrok && currentVoice() !== v.id) {
      const ok = await pinPrompt(t("askGrokH"), t("askGrokP"));
      if (!ok) return;
    }
    setP("storyVoice", v.id);
    renderVoices();
  }
  async function playPreview(id) {
    if (previewAudio) { previewAudio.pause(); previewAudio = null; }
    if (previewId === id) { previewId = null; renderVoices(); renderGrownVoices(); return; }
    previewId = id; renderVoices(); renderGrownVoices();
    try {
      const res = await fetch("/api/voices/" + encodeURIComponent(id) + "/preview?lang=" + (storyLang() === "Español" ? "es" : "en"), { credentials: "same-origin" });
      if (!res.ok) throw new Error("preview");
      const url = URL.createObjectURL(await res.blob());
      previewAudio = new Audio(url);
      previewAudio.onended = () => { URL.revokeObjectURL(url); previewId = null; renderVoices(); renderGrownVoices(); };
      await previewAudio.play();
    } catch (_) { previewId = null; renderVoices(); renderGrownVoices(); }
  }

  // ---------------------------------------------------------------- length
  function syncLength() {
    const len = getP("storyLength", "medium");
    qsa("#len button").forEach((b) => b.classList.toggle("on", b.dataset.length === len));
  }
  qsa("#len button").forEach((b) => b.addEventListener("click", () => { setP("storyLength", b.dataset.length); syncLength(); }));

  // ---------------------------------------------------------------- talk (speech to text)
  const idea = $("idea");
  function hint(msg, err) { $("idea-hint").textContent = msg || ""; $("idea-hint").className = "hint" + (err ? " err" : ""); }
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  $("talk-btn").addEventListener("click", () => {
    const btn = $("talk-btn");
    const reset = () => { btn.classList.remove("listening"); btn.querySelector("small").textContent = t("talk"); rec = null; };
    if (!SpeechRec) { idea.focus(); hint(t("micNo")); return; }
    if (rec) { try { rec.stop(); } catch (_) {} reset(); return; }
    rec = new SpeechRec();
    rec.lang = storyLang() === "Español" ? "es-US" : "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    btn.classList.add("listening");
    btn.querySelector("small").textContent = t("listening");
    rec.onresult = (ev) => { let s = ""; for (let i = 0; i < ev.results.length; i++) s += ev.results[i][0].transcript; idea.value = s.trim(); };
    rec.onerror = () => { hint(t("micNo"), true); reset(); };
    rec.onend = () => { reset(); if (idea.value.trim()) hint(t("heardIt")); };
    try { rec.start(); } catch (_) { hint(t("micNo"), true); reset(); }
  });

  // ---------------------------------------------------------------- gentle-words filter
  const ROUGH = ["kill", "killed", "killing", "blood", "bloody", "gun", "guns", "knife", "knives", "murder", "dead", "death", "die", "dies", "zombie", "zombies",
    "demon", "devil", "horror", "weapon", "bomb", "war", "shoot", "shooting", "stab", "gore", "matar", "mata", "sangre", "pistola", "cuchillo", "asesino",
    "asesinato", "muerte", "muerto", "morir", "zombi", "demonio", "diablo", "terror", "bomba", "guerra", "disparar", "arma"];
  function isRough(text) {
    const words = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-zñ]+/);
    return words.some((w) => ROUGH.includes(w));
  }

  // ---------------------------------------------------------------- making a story
  let displayPercent = 0, targetPercent = 0, tweenTimer = null;
  function applyBar(p) {
    p = Math.max(0, Math.min(100, p));
    $("progress-fill").style.width = p + "%";
    $("progress-rider").style.left = p + "%";
    $("making-pct").textContent = Math.round(p) + "%";
  }
  function startTween() {
    if (tweenTimer) return;
    tweenTimer = setInterval(() => {
      const ceiling = Math.min(98, targetPercent + 2);
      if (targetPercent >= 1 && targetPercent < 98 && displayPercent >= targetPercent && displayPercent < ceiling) { displayPercent += 0.02; applyBar(displayPercent); return; }
      if (displayPercent < targetPercent) { displayPercent = Math.min(targetPercent, displayPercent + Math.max(0.4, (targetPercent - displayPercent) * 0.18)); applyBar(displayPercent); }
    }, 80);
  }
  function stopTween() { clearInterval(tweenTimer); tweenTimer = null; }
  function setMaking(on) {
    making = on;
    $("make-btn").classList.toggle("hidden", on);
    $("making").classList.toggle("hidden", !on && !$("making").classList.contains("done"));
  }
  function burstCelebrate() {
    const c = $("celebrate");
    $("making").classList.add("done");
    c.classList.remove("hidden"); c.innerHTML = "";
    ["⭐", "✨", "🌟", "💫", "🎉", "⭐", "✨", "🌙"].forEach((s, i) => {
      const el = document.createElement("span"); el.textContent = s;
      const a = (i / 8) * Math.PI * 2, d = 48 + (i % 3) * 18;
      el.style.setProperty("--dx", Math.cos(a) * d + "px"); el.style.setProperty("--dy", Math.sin(a) * d - 20 + "px");
      el.style.animationDelay = i * 0.04 + "s"; c.appendChild(el);
    });
    setTimeout(() => { $("making").classList.remove("done"); if (!making) hide("making"); }, 3500);
  }

  $("make-btn").addEventListener("click", () => {
    const text = idea.value.trim();
    if (text.length < 2) { hint(t("typeIdea"), true); idea.focus(); return; }
    if (settings.filter && isRough(text)) { message(t("gentleH"), t("gentleP")); return; }
    startStory({ idea: text, language: storyLang(), voice: currentVoice(), length: getP("storyLength", "medium"), profile: activeProfile });
  });

  async function startStory(req) {
    lastRequest = req;
    jobProfile = req.profile;
    hint("");
    liveReset();
    livePrime();
    hide("oops");
    hide("np-bar");
    displayPercent = 0; targetPercent = 1;
    $("making").classList.remove("done");
    $("progress-rider").textContent = (voices.find((v) => v.id === req.voice) || {}).emoji || "🦆";
    $("making-text").textContent = t("making");
    applyBar(0);
    setMaking(true);
    startTween();
    try {
      const { job_id } = await api("/api/stories", { method: "POST", body: JSON.stringify(req), timeout: 70000 });
      await pollJob(job_id);
    } catch (e) {
      failStory(e.status === 429 ? "busy" : e.name === "AbortError" || !e.status ? "sleepy" : "oops", e.message);
    }
  }

  function failStory(kind, detail) {
    clearInterval(pollTimer);
    stopTween();
    setMaking(false);
    hide("making");
    const art = { busy: "🐢", sleepy: "😴", oops: "🙈" }[kind] || "🙈";
    $("oops-art").textContent = art;
    $("oops-h").textContent = t(kind === "busy" ? "busyH" : kind === "sleepy" ? "sleepyH" : "oopsH");
    $("oops-p").textContent = t(kind === "busy" ? "busyP" : kind === "sleepy" ? "sleepyP" : "oopsP");
    $("oops-detail").textContent = detail || "";
    if (pmode === "live" && !live.started) closePlayer();
    show("oops");
  }
  $("oops-retry").addEventListener("click", () => { hide("oops"); if (lastRequest) startStory(lastRequest); });
  $("oops-back").addEventListener("click", () => hide("oops"));

  async function pollJob(jobId) {
    clearInterval(pollTimer);
    live.active = true; live.jobId = jobId;
    let fails = 0;
    const tick = async () => {
      try {
        const j = await api("/api/jobs/" + jobId, { timeout: 15000 });
        fails = 0;
        if (typeof j.percent === "number" && j.percent > targetPercent) targetPercent = j.percent;
        startTween();
        $("making-text").textContent = t("making");
        live.storyId = j.story_id || live.storyId;
        live.total = j.parts_total || live.total;
        live.title = j.title || live.title;
        live.ready = j.parts_ready || [];
        if (live.storyId) for (const n of live.ready) await liveFetchPart(n);
        if (pmode === "live") pUpdate();
        if (j.status === "done" && j.story_id) {
          clearInterval(pollTimer);
          targetPercent = 100; displayPercent = 100; applyBar(100); stopTween();
          burstCelebrate();
          setMaking(false);
          live.finished = true;
          const meta = { id: j.story_id, title: j.title || "Story", created: new Date().toISOString(), profile: j.profile || jobProfile, voice: j.voice };
          try { await cacheStory(meta, await fetchAudioBlob(j.story_id)); } catch (_) {}
          if (!live.started) openFull(meta);
          await refreshStories();
          if (pmode === "live") pUpdate();
        } else if (j.status === "error") {
          failStory("oops", j.error);
        }
      } catch (e) {
        if (e.status === 401) { clearInterval(pollTimer); setMaking(false); showOnly("pin-screen"); return; }
        if (e.status === 404) { failStory("oops", "The story job was lost (server restarted)."); return; }
        fails++;
        $("making-text").textContent = t("wakeTitle");
      }
    };
    await tick();
    pollTimer = setInterval(tick, 1500);
  }

  // ---------------------------------------------------------------- story lists
  async function storiesFor(pid) {
    let server = [], local = [];
    try { server = (await api("/api/stories" + (pid ? "?profile=" + pid : ""))).stories || []; } catch (_) {}
    try { local = await idbAll(); } catch (_) {}
    if (pid) local = local.filter((s) => (s.profile || "p1") === pid);
    const byId = new Map();
    local.forEach((s) => byId.set(s.id, { ...s, onTablet: true }));
    server.forEach((s) => { const cur = byId.get(s.id); byId.set(s.id, cur ? { ...s, ...cur, onServer: true } : { ...s, onServer: true }); });
    return Array.from(byId.values()).sort((a, b) => (b.created || "").localeCompare(a.created || ""));
  }
  function renderStoryCards(ul, items, localOnly) {
    ul.innerHTML = "";
    if (!items.length) { ul.innerHTML = '<li class="empty">' + esc(t("noStories")) + "</li>"; return; }
    items.forEach((s) => {
      const li = document.createElement("li");
      li.innerHTML = '<button class="sc-play" type="button" aria-label="' + esc(t("play")) + '">▶</button><div><div class="sc-t">' + esc(s.title || "Story") +
        '</div><div class="sc-m">' + esc(day(s.created)) + "</div></div>";
      li.querySelector(".sc-play").addEventListener("click", () => openFull(s, localOnly));
      ul.appendChild(li);
    });
  }
  async function refreshStories() {
    renderStoryCards($("story-list"), await storiesFor(activeProfile));
  }

  // ---------------------------------------------------------------- full-screen bedtime player
  const player = $("player");
  const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
  const live = { active: false, jobId: null, storyId: null, title: "", total: 0, ready: [], urls: {}, fetching: {}, cur: 0, waiting: false,
    started: false, ended: false, el: [null, null], slot: 0, finished: false };

  function liveReset() {
    Object.values(live.urls).forEach((u) => URL.revokeObjectURL(u));
    live.el.forEach((e) => { if (e) { e.onended = null; e.pause(); e.removeAttribute("src"); } });
    Object.assign(live, { active: false, jobId: null, storyId: null, title: "", total: 0, ready: [], urls: {}, fetching: {}, cur: 0, waiting: false,
      started: false, ended: false, slot: 0, finished: false });
    raReset();
  }
  function livePrime() {
    // inside the Make tap, so Android lets us start audio later without another tap
    live.el = [new Audio(), new Audio()];
    live.el.forEach((e) => {
      e.playsInline = true; e.preload = "auto"; e.src = SILENT_WAV; e.play().catch(() => {});
      ["play", "pause", "playing"].forEach((ev) => e.addEventListener(ev, () => pmode === "live" && pUpdate()));
    });
  }
  const liveEl = () => live.el[1 - live.slot];
  function livePlay(n) {
    const el = live.el[live.slot];
    el.onended = null;
    if (el.src !== live.urls[n]) el.src = live.urls[n];
    try { el.currentTime = 0; } catch (_) {}
    live.cur = n; live.waiting = false; live.ended = false;
    el.onended = () => liveNext();
    const other = live.el[1 - live.slot];
    if (other) { other.onended = null; other.pause(); }
    el.play().then(() => {
      if (!live.started) { live.started = true; flashState(t("startingNow")); armDarkener(); }
      pUpdate();
    }).catch(() => pUpdate());
    if (live.urls[n + 1] && other && other.src !== live.urls[n + 1]) other.src = live.urls[n + 1];
    live.slot = 1 - live.slot;
    pUpdate();
  }
  function liveNext() {
    const n = live.cur + 1;
    if (live.total && n > live.total) { live.ended = true; pUpdate(); return; }
    if (live.urls[n]) livePlay(n); else { live.waiting = true; pUpdate(); }
  }
  async function liveFetchPart(n) {
    if (live.urls[n] || live.fetching[n]) return;
    live.fetching[n] = true;
    try {
      const res = await fetch("/api/stories/" + live.storyId + "/parts/" + n + "/audio", { credentials: "same-origin" });
      if (!res.ok) throw new Error("part");
      live.urls[n] = URL.createObjectURL(await res.blob());
      raLoadPart(live.storyId, n);
      if (n === 1 && !live.started) { openLive(); livePlay(1); }
      else if (live.waiting && live.cur + 1 === n) livePlay(n);
      else if (live.cur + 1 === n) { const idle = live.el[live.slot]; if (idle) idle.src = live.urls[n]; }
    } catch (_) { /* retried next poll */ } finally { live.fetching[n] = false; }
  }

  let flashMsg = "", flashUntil = 0;
  function flashState(msg) { flashMsg = msg; flashUntil = Date.now() + 3000; }

  function openPlayerScreen() {
    show("player-screen");
    document.body.style.overflow = "hidden";
    hide("np-bar");
    applyWordsState();
  }
  function openLive() {
    pmode = "live";
    player.pause();
    hide("p-seekrow");
    openPlayerScreen();
    pUpdate();
  }
  async function openFull(s, localOnly) {
    let url = s.blobUrl;
    try {
      if (!url && s.blob) { url = URL.createObjectURL(s.blob); s.blobUrl = url; }
      if (!url) {
        const blob = await fetchAudioBlob(s.id);
        await cacheStory({ ...s, profile: s.profile || activeProfile }, blob);
        url = URL.createObjectURL(blob);
      }
    } catch (_) { failStory("sleepy", "Could not load the story audio."); return; }
    if (pmode === "live") liveReset();
    pmode = "full";
    fullStoryId = s.id;
    live.title = s.title;
    player.src = url;
    show("p-seekrow");
    openPlayerScreen();
    if (!localOnly) raLoadFull(s.id); else { ra.full = null; raRenderFull(); raLoadFull(s.id); }
    player.play().then(armDarkener).catch(() => {});
    pUpdate();
  }
  function closePlayer() {
    hide("player-screen");
    document.body.style.overflow = "";
    const playing = pmode === "full" ? !player.paused : (pmode === "live" && liveEl() && !liveEl().paused) || (pmode === "live" && making);
    $("np-bar").classList.toggle("hidden", !playing);
  }
  $("p-back").addEventListener("click", closePlayer);
  $("np-bar").addEventListener("click", () => { if (pmode) { openPlayerScreen(); pUpdate(); } });
  ["play", "pause", "ended", "timeupdate", "loadedmetadata"].forEach((ev) => player.addEventListener(ev, () => pmode === "full" && pUpdate()));

  function pUpdate() {
    if (!pmode) return;
    const btn = $("p-toggle"), glyph = $("p-glyph");
    let state = "", g = "❚❚", waiting = false, label = "Pause";
    const v = voices.find((x) => x.id === (lastRequest && pmode === "live" ? lastRequest.voice : "")) || null;
    $("p-title").textContent = live.title || (pmode === "live" ? t("making") : "");
    const kid = profile(pmode === "live" ? jobProfile : activeProfile);
    $("p-sub").textContent = kid.emoji + " " + kid.name + (v ? " · " + t("readBy", { v: v.name }) : "");
    if (pmode === "live") {
      const el = liveEl();
      if (live.ended) { g = "🔁"; state = t("theEnd"); label = "Replay"; }
      else if (live.waiting) { g = "⏳"; waiting = true; state = t("nextComing"); label = "Waiting"; }   // never says Pause while waiting
      else if (!el || el.paused) { g = "▶"; state = live.started ? t("paused") : ""; label = "Play"; }
      const stars = $("p-stars");
      const total = live.total || 0;
      stars.innerHTML = "";
      for (let i = 1; i <= total; i++) {
        const sp = document.createElement("span"); sp.textContent = "⭐";
        if (live.ready.includes(i)) sp.className = i === live.cur && !live.ended ? "now" : "done";
        stars.appendChild(sp);
      }
      $("p-cap").textContent = total ? t("partOf", { n: Math.max(1, live.cur), t: total }) + " · " + (live.finished ? t("allStars") : t("moreStars")) : "";
    } else {
      if (player.ended) { g = "🔁"; state = t("theEnd"); label = "Replay"; }
      else if (player.paused) { g = "▶"; state = t("paused"); label = "Play"; }
      $("p-stars").innerHTML = "";
      $("p-cap").textContent = "";
      const d = player.duration || 0;
      $("p-cur").textContent = fmtTime(player.currentTime);
      $("p-dur").textContent = fmtTime(d);
      if (d && !seeking) $("p-seek").value = Math.round((player.currentTime / d) * 1000);
    }
    if (Date.now() < flashUntil && !waiting) state = flashMsg;
    glyph.textContent = g;
    btn.classList.toggle("waiting", waiting);
    btn.setAttribute("aria-label", label);
    $("p-state").textContent = state;
  }
  setInterval(() => { if (pmode && isShown("player-screen")) pUpdate(); }, 500);

  $("p-toggle").addEventListener("click", () => {
    if (pmode === "full") {
      if (player.ended || player.paused) player.play().catch(() => {}); else player.pause();
      return;
    }
    if (pmode !== "live") return;
    if (live.waiting) return;                       // nothing to pause yet; the next part starts by itself
    if (live.ended) { if (live.urls[1]) livePlay(1); return; }
    const el = liveEl();
    if (!el || !el.src) return;
    if (el.paused) el.play().catch(() => {}); else el.pause();
    pUpdate();
  });
  $("p-restart").addEventListener("click", () => {
    if (pmode === "full") { try { player.currentTime = 0; } catch (_) {} player.play().catch(() => {}); return; }
    if (pmode === "live" && live.urls[1]) { live.el.forEach((e) => { if (e) { e.onended = null; e.pause(); } }); livePlay(1); flashState("⏮️ " + t("startOver")); }
  });
  let seeking = false;
  $("p-seek").addEventListener("input", () => { seeking = true; const d = player.duration || 0; $("p-cur").textContent = fmtTime((d * $("p-seek").value) / 1000); });
  $("p-seek").addEventListener("change", () => { const d = player.duration || 0; if (d) player.currentTime = (d * $("p-seek").value) / 1000; seeking = false; });

  // ---------------------------------------------------------------- read-along (hidden until 📖 is pressed; remembered per kid)
  const raPanel = $("readalong");
  const ra = { parts: {}, partEls: {}, full: null, fullEls: null, fullId: null, onEl: null, lastTop: -1, raf: 0 };
  function raReset() { Object.assign(ra, { parts: {}, partEls: {}, full: null, fullEls: null, fullId: null, onEl: null, lastTop: -1 }); raPanel.innerHTML = ""; }
  function raBuild(words, partN) {
    const wrap = document.createElement("div"); wrap.className = "ra-part"; if (partN) wrap.dataset.part = partN;
    let p = document.createElement("p"); wrap.appendChild(p);
    const els = [];
    words.forEach((w, i) => {
      if (w[3] && p.childNodes.length) { p = document.createElement("p"); wrap.appendChild(p); }
      const sp = document.createElement("span"); sp.className = "w"; sp.textContent = w[2]; sp.dataset.i = i;
      if (partN) sp.dataset.part = partN;
      p.appendChild(sp); p.appendChild(document.createTextNode(" ")); els.push(sp);
    });
    return { wrap, els };
  }
  function raMsg(text) { raPanel.innerHTML = '<p class="ra-msg">' + esc(text) + "</p>"; }
  function raRenderLive() {
    if (pmode !== "live") return;
    qsa(".ra-msg", raPanel).forEach((m) => m.remove());
    Object.keys(ra.parts).map(Number).sort((a, b) => a - b).forEach((n) => {
      if (ra.partEls[n]) return;
      const built = raBuild(ra.parts[n].words || [], n);
      ra.partEls[n] = built;
      const after = qsa(".ra-part", raPanel).find((x) => Number(x.dataset.part) > n);
      raPanel.insertBefore(built.wrap, after || null);
    });
    if (!raPanel.children.length) raMsg("✨ …");
  }
  function raRenderFull() {
    raPanel.innerHTML = ""; ra.partEls = {}; ra.onEl = null; ra.lastTop = -1;
    if (!ra.full) { raMsg("✨ …"); return; }
    if (!(ra.full.words || []).length) { raMsg("—"); return; }
    const built = raBuild(ra.full.words, 0); ra.fullEls = built.els; raPanel.appendChild(built.wrap);
  }
  async function raFetch(url) {
    for (let k = 0; k < 3; k++) {
      try { const r = await fetch(url, { credentials: "same-origin" }); if (r.ok) return await r.json(); } catch (_) {}
      await new Promise((r) => setTimeout(r, 1200));
    }
    return null;
  }
  async function raLoadPart(storyId, n) {
    if (!storyId || ra.parts[n]) return;
    const tm = await raFetch("/api/stories/" + storyId + "/parts/" + n + "/timings");
    if (tm && live.storyId === storyId) { ra.parts[n] = tm; raRenderLive(); }
  }
  async function raLoadFull(storyId) {
    ra.fullId = storyId; ra.full = null; ra.fullEls = null; raRenderFull();
    const tm = await raFetch("/api/stories/" + storyId + "/timings");
    if (ra.fullId !== storyId) return;
    ra.full = tm || { words: [] };
    if (pmode === "full") raRenderFull();
  }
  function raCurrent() {
    if (pmode === "full") return { el: player, words: ra.full && ra.full.words, spans: ra.fullEls };
    const pe = ra.partEls[live.cur];
    return { el: liveEl(), words: ra.parts[live.cur] && ra.parts[live.cur].words, spans: pe && pe.els };
  }
  function raIndexAt(words, tm) {
    let lo = 0, hi = words.length - 1, ans = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (words[mid][0] <= tm + 0.05) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
    return ans;
  }
  function raTick() {
    ra.raf = 0;
    if (raPanel.classList.contains("hidden") || !isShown("player-screen")) return;
    if (pmode === "full" && !ra.fullEls && ra.full) raRenderFull();
    if (pmode === "live" && ra.fullEls) { ra.fullEls = null; raPanel.innerHTML = ""; ra.partEls = {}; raRenderLive(); }
    const c = raCurrent();
    if (c.el && c.words && c.spans && c.spans.length) {
      const i = raIndexAt(c.words, c.el.currentTime || 0);
      const sp = i >= 0 ? c.spans[i] : null;
      if (sp !== ra.onEl) {
        if (ra.onEl) ra.onEl.classList.remove("on");
        if (sp) sp.classList.add("on");
        ra.onEl = sp;
        if (sp && sp.offsetTop !== ra.lastTop) {
          ra.lastTop = sp.offsetTop;
          raPanel.scrollTo({ top: Math.max(0, sp.offsetTop - raPanel.clientHeight / 2 + sp.offsetHeight / 2), behavior: "smooth" });
        }
      }
    }
    ra.raf = requestAnimationFrame(raTick);
  }
  function applyWordsState() {
    const showW = getP("readAlong", "0") === "1";
    raPanel.classList.toggle("hidden", !showW);
    $("player-screen").classList.toggle("words-open", showW);
    $("p-words").setAttribute("aria-pressed", showW ? "true" : "false");
    $("p-words-l").textContent = showW ? t("hideWords") : t("readAlong");
    if (showW) {
      ra.lastTop = -1;
      if (pmode === "full") { if (!ra.fullEls) raRenderFull(); } else raRenderLive();
      if (!ra.raf) ra.raf = requestAnimationFrame(raTick);
    } else if (ra.raf) { cancelAnimationFrame(ra.raf); ra.raf = 0; }
  }
  $("p-words").addEventListener("click", () => { setP("readAlong", getP("readAlong", "0") === "1" ? "0" : "1"); applyWordsState(); });
  raPanel.addEventListener("click", (e) => {
    const sp = e.target.closest(".w"); if (!sp) return;
    const i = Number(sp.dataset.i);
    if (pmode === "full") { if (ra.full) { try { player.currentTime = ra.full.words[i][0]; } catch (_) {} player.play().catch(() => {}); } return; }
    const n = Number(sp.dataset.part);
    const tm = ra.parts[n] && ra.parts[n].words[i] ? ra.parts[n].words[i][0] : 0;
    if (!live.urls[n]) return;
    if (n !== live.cur || live.ended) livePlay(n);
    const el = liveEl();
    const go = () => { try { el.currentTime = tm; } catch (_) {} };
    if (el.readyState >= 1) go(); else el.addEventListener("loadedmetadata", go, { once: true });
    if (el.paused) el.play().catch(() => {});
  });

  // ---------------------------------------------------------------- bedtime helpers
  let darkTimer = null;
  function applyBedtime() { $("dim-veil").classList.toggle("hidden", !settings.dim); $("p-dim").classList.toggle("on", settings.dim); }
  $("p-dim").addEventListener("click", () => { settings.dim = !settings.dim; saveSettings(); applyBedtime(); });
  function armDarkener() {
    clearTimeout(darkTimer);
    if (!settings.darkAfter) return;
    darkTimer = setTimeout(() => { if (isShown("player-screen")) show("darkener"); }, 30000);
  }
  $("darkener").addEventListener("click", () => { hide("darkener"); armDarkener(); });

  // ---------------------------------------------------------------- grown-ups panel
  $("grown-btn").addEventListener("click", async () => {
    const ok = await pinPrompt(t("pinPromptH"), t("pinPromptP"));
    if (ok) openGrown();
  });
  $("g-close").addEventListener("click", () => { hide("grown-screen"); document.body.style.overflow = ""; applyAll(); refreshStories(); });
  function setToggle(id, on) { $(id).classList.toggle("on", !!on); $(id).setAttribute("aria-checked", on ? "true" : "false"); }
  [["g-allow", "allowGrok"], ["g-ask", "askGrok"], ["g-dim", "dim"], ["g-dark", "darkAfter"], ["g-filter", "filter"]].forEach(([id, key]) => {
    $(id).addEventListener("click", () => { settings[key] = !settings[key]; saveSettings(); setToggle(id, settings[key]); applyBedtime(); renderGrownVoices(); });
  });
  qsa("#g-uilang button").forEach((b) => b.addEventListener("click", () => { settings.uiLang = b.dataset.v; saveSettings(); renderGrown(); }));

  function openGrown() {
    show("grown-screen");
    document.body.style.overflow = "hidden";
    renderGrown();
  }
  function renderGrown() {
    applyI18n();
    setToggle("g-allow", settings.allowGrok); setToggle("g-ask", settings.askGrok); setToggle("g-dim", settings.dim);
    setToggle("g-dark", settings.darkAfter); setToggle("g-filter", settings.filter);
    qsa("#g-uilang button").forEach((b) => b.classList.toggle("on", b.dataset.v === settings.uiLang));
    const sl = $("g-storylang");
    sl.innerHTML = "";
    profiles.forEach((p) => {
      const row = document.createElement("div"); row.className = "grow";
      const cur = storyLang(p.id);
      row.innerHTML = "<span>" + esc(p.emoji + " " + p.name) + " · " + esc(t("gStoryLang")) + '</span><div class="seg"><button type="button" data-v="English" class="' +
        (cur === "English" ? "on" : "") + '">English</button><button type="button" data-v="Español" class="' + (cur === "Español" ? "on" : "") + '">Español</button></div>';
      qsa("button", row).forEach((b) => b.addEventListener("click", () => { setP("storyLang", b.dataset.v, p.id); renderGrown(); }));
      sl.appendChild(row);
    });
    renderGrownVoices();
    renderGrownStories();
  }
  function renderGrownVoices() {
    const ul = $("g-voices"); if (!ul) return;
    ul.innerHTML = "";
    (voices.length ? voices : VOICE_FALLBACK).forEach((v) => {
      const li = document.createElement("li");
      const off = v.uses_credit && !settings.allowGrok;
      li.innerHTML = '<button class="ibtn" type="button">' + (previewId === v.id ? "■" : "▶") + '</button><span class="gv-t"><b>' + esc((v.emoji || "") + " " + v.name) + "</b> " +
        (v.uses_credit ? '<span style="color:var(--warn)">' + COIN + "</span>" : '<span style="color:var(--ok)">' + esc(t("free")) + "</span>") +
        (off ? " · 🔒" : "") + '<span class="gsmall">' + esc(v.description || "") + "</span></span>";
      li.querySelector("button").addEventListener("click", () => playPreview(v.id));
      ul.appendChild(li);
    });
  }
  async function renderGrownStories() {
    const ul = $("g-stories");
    const items = await storiesFor(null);
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        $("g-storage").textContent = t("gStorage", { mb: ((est.usage || 0) / 1048576).toFixed(1) });
      }
    } catch (_) {}
    ul.innerHTML = "";
    if (!items.length) { ul.innerHTML = '<li class="gnote">' + esc(t("noStories")) + "</li>"; return; }
    items.forEach((s) => {
      const kid = profile(s.profile || "p1");
      const where = s.onTablet ? t("onTablet") : t("serverOnly");
      const li = document.createElement("li");
      li.innerHTML = '<span class="gs-k">' + esc(kid.emoji) + '</span><span class="gs-t"><b>' + esc(s.title || "Story") + '</b><span class="gsmall">' +
        esc(kid.name + " · " + day(s.created) + (s.voice || s.voice_id ? " · " + (s.voice || s.voice_id) : "") + " · " + where) + "</span></span>" +
        '<button class="ibtn" type="button" data-a="play">▶</button><button class="ibtn" type="button" data-a="dl">⬇</button><button class="ibtn danger" type="button" data-a="del">🗑</button>';
      li.querySelector('[data-a="play"]').addEventListener("click", () => { hide("grown-screen"); document.body.style.overflow = ""; openFull(s); });
      li.querySelector('[data-a="dl"]').addEventListener("click", () => downloadStory(s));
      li.querySelector('[data-a="del"]').addEventListener("click", async () => {
        if (!(await confirmBox(t("deleteH"), t("deleteP", { t: s.title || "Story" }), "🗑 " + t("del")))) return;
        try { await idbDel(s.id); } catch (_) {}
        try { await api("/api/stories/" + encodeURIComponent(s.id), { method: "DELETE" }); } catch (_) {}
        renderGrownStories();
      });
      ul.appendChild(li);
    });
  }
  async function downloadStory(s) {
    try {
      const blob = s.blob || (await fetchAudioBlob(s.id));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = ((s.title || "story").replace(/[^\w\- ]+/g, "").slice(0, 40) || "story") + ".mp3";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (_) { message(t("sleepyH"), t("sleepyP")); }
  }
  $("g-logout").addEventListener("click", async () => {
    try { await api("/api/logout", { method: "POST" }); } catch (_) {}
    hide("grown-screen"); document.body.style.overflow = "";
    showOnly("pin-screen");
  });

  // ---------------------------------------------------------------- boot
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  applyI18n();
  applyBedtime();
  checkSession();
})();
