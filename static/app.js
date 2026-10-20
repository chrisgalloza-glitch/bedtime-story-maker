(() => {
  const $ = (id) => document.getElementById(id);
  const pinScreen = $("pin-screen");
  const appScreen = $("app-screen");
  const pinInput = $("pin");
  const pinGo = $("pin-go");
  const pinStatus = $("pin-status");
  const idea = $("idea");
  const makeBtn = $("make-btn");
  const micBtn = $("mic-btn");
  const status = $("status");
  const playerCard = $("player-card");
  const player = $("player");
  const downloadBtn = $("download-btn");
  const resultTitle = $("result-title");
  const storyList = $("story-list");
  const voiceGrid = $("voice-grid");
  const progressWrap = $("progress-wrap");
  const progressFill = $("progress-fill");
  const progressPct = $("progress-pct");
  const progressRider = $("progress-rider");
  const progressTrack = $("progress-track");
  const celebrate = $("celebrate");
  let language = "English";
  // ---- child profiles (settings + history kept per profile) ----
  const DEFAULT_PROFILES = [
    { id: "p1", name: "Kid 1", emoji: "🦄" },
    { id: "p2", name: "Kid 2", emoji: "🐱" },
  ];
  function loadProfiles() {
    let list = null;
    try { list = JSON.parse(localStorage.getItem("storyProfiles") || "null"); } catch (_) {}
    if (!Array.isArray(list) || list.length !== 2) list = DEFAULT_PROFILES.map((p) => ({ ...p }));
    // one-time migration: old single-user settings become profile 1's
    if (!localStorage.getItem("profilesMigrated")) {
      const oldVoice = localStorage.getItem("storyVoice");
      const oldLen = localStorage.getItem("storyLength");
      if (oldVoice && !localStorage.getItem("storyVoice:p1")) localStorage.setItem("storyVoice:p1", oldVoice);
      if (oldLen && !localStorage.getItem("storyLength:p1")) localStorage.setItem("storyLength:p1", oldLen);
      localStorage.setItem("profilesMigrated", "1");
    }
    localStorage.setItem("storyProfiles", JSON.stringify(list));
    return list;
  }
  let profiles = loadProfiles();
  let activeProfile = localStorage.getItem("activeProfile") === "p2" ? "p2" : "p1";
  const pKey = (k) => k + ":" + activeProfile;
  let storyLength = localStorage.getItem(pKey("storyLength")) || "medium";
  let selectedVoice = localStorage.getItem(pKey("storyVoice")) || "ava";
  let voices = [];
  let pollTimer = null;
  let jobProfile = "p1";
  let previewAudio = null;
  let displayPercent = 0;
  let targetPercent = 0;
  let tweenTimer = null;
  let lastSpeakPart = null;
  let partStartedAt = 0;
  let lastPartDurationMs = 45000;
  let writingStartedAt = 0;
  let serverWritingFloor = 0;

  const DB_NAME = "bedtime-stories";
  const STORE = "stories";

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbPut(record) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function idbAll() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  function setStatus(msg, kind) {
    status.textContent = msg;
    status.className = "status" + (kind ? " " + kind : "");
  }

  function voiceEmoji() {
    const v = voices.find((x) => x.id === selectedVoice);
    return (v && v.emoji) || "🦆";
  }

  function showProgressBar() {
    progressWrap.classList.remove("hidden", "error", "done");
    celebrate.classList.add("hidden");
    celebrate.innerHTML = "";
    progressRider.textContent = voiceEmoji();
  }

  function hideProgressBarSoon() {
    setTimeout(() => {
      if (!makeBtn.disabled) progressWrap.classList.add("hidden");
    }, 4000);
  }

  function applyBarVisual(pct) {
    const p = Math.max(0, Math.min(100, pct));
    progressFill.style.width = p + "%";
    progressRider.style.left = p + "%";
    progressPct.textContent = Math.round(p) + "%";
  }

  function burstCelebrate() {
    progressWrap.classList.add("done");
    celebrate.classList.remove("hidden");
    celebrate.innerHTML = "";
    const stars = ["⭐", "✨", "🌟", "💫", "🎉", "⭐", "✨", "🌙"];
    stars.forEach((s, i) => {
      const el = document.createElement("span");
      el.textContent = s;
      const angle = (i / stars.length) * Math.PI * 2;
      const dist = 48 + (i % 3) * 18;
      el.style.setProperty("--dx", Math.cos(angle) * dist + "px");
      el.style.setProperty("--dy", Math.sin(angle) * dist - 20 + "px");
      el.style.animationDelay = i * 0.04 + "s";
      celebrate.appendChild(el);
    });
  }

  function startTween() {
    if (tweenTimer) return;
    tweenTimer = setInterval(() => {
      // gentle creep so the bar never looks stuck (stays just ahead of the server value)
      const ceiling = Math.min(98, targetPercent + 2);
      if (targetPercent >= 1 && targetPercent < 98 && displayPercent >= targetPercent && displayPercent < ceiling) {
        displayPercent += 0.02;
        applyBarVisual(displayPercent);
        return;
      }
      if (displayPercent < targetPercent) {
        const step = Math.max(0.4, (targetPercent - displayPercent) * 0.18);
        displayPercent = Math.min(targetPercent, displayPercent + step);
        applyBarVisual(displayPercent);
      }
    }, 80);
  }

  function stopTween() {
    if (tweenTimer) {
      clearInterval(tweenTimer);
      tweenTimer = null;
    }
  }

  function setProgressFromJob(j) {
    const pct = typeof j.percent === "number" ? j.percent : 0;
    if (pct >= targetPercent) targetPercent = pct;
    if (j.status === "error") {
      progressWrap.classList.add("error");
      progressWrap.classList.remove("done");
      displayPercent = Math.max(displayPercent, targetPercent);
      applyBarVisual(displayPercent);
      stopTween();
    }
    startTween();
  }

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
      ...opts,
    });
    let data = null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) data = await res.json();
    if (!res.ok) {
      const detail = (data && (data.detail || data.error)) || res.statusText;
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }
    return data;
  }

  function langCode() {
    return language.startsWith("Es") ? "es" : "en";
  }

  function renderVoices() {
    voiceGrid.innerHTML = "";
    (voices.length ? voices : [
      { id: "ava", name: "Ava", description: "Warm free bedtime voice.", uses_credit: false, emoji: "🦆" },
    ]).forEach((v) => {
      const card = document.createElement("div");
      card.className = "voice-card" + (v.id === selectedVoice ? " selected" : "");
      card.dataset.voice = v.id;
      card.innerHTML =
        '<div class="v-name">' + (v.emoji || "") + " " + v.name + "</div>" +
        '<div class="v-desc">' + (v.description || "") + "</div>" +
        (v.uses_credit
          ? '<div class="v-credit">uses a little Grok credit</div>'
          : '<div class="v-credit" style="color:var(--ok)">free</div>') +
        '<div class="v-actions">' +
        '<button type="button" class="preview-btn" data-preview="' + v.id + '">▶️ Preview</button>' +
        '<button type="button" class="select-btn" data-select="' + v.id + '">' +
        (v.id === selectedVoice ? "✓ Selected" : "Choose") +
        "</button></div>";
      voiceGrid.appendChild(card);
    });

    voiceGrid.querySelectorAll("[data-select]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        selectVoice(btn.getAttribute("data-select"));
      });
    });
    voiceGrid.querySelectorAll("[data-preview]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        playPreview(btn.getAttribute("data-preview"));
      });
    });
    voiceGrid.querySelectorAll(".voice-card").forEach((card) => {
      card.addEventListener("click", () => selectVoice(card.dataset.voice));
    });
  }

  function selectVoice(id) {
    selectedVoice = id || "ava";
    localStorage.setItem(pKey("storyVoice"), selectedVoice);
    renderVoices();
    const name = (voices.find((v) => v.id === selectedVoice) || {}).name || selectedVoice;
    setStatus("Voice: " + name);
  }

  async function playPreview(id) {
    try {
      if (previewAudio) {
        previewAudio.pause();
        previewAudio = null;
      }
      setStatus("Playing preview…", "busy");
      const res = await fetch(
        "/api/voices/" + encodeURIComponent(id) + "/preview?lang=" + langCode(),
        { credentials: "same-origin" }
      );
      if (!res.ok) throw new Error("Preview failed (" + res.status + ")");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      previewAudio = new Audio(url);
      previewAudio.playsInline = true;
      previewAudio.onended = () => {
        URL.revokeObjectURL(url);
        setStatus("Ready — pick a voice and make a story!");
      };
      await previewAudio.play();
    } catch (e) {
      setStatus(e.message || "Could not play preview", "err");
    }
  }

  async function loadVoices() {
    try {
      const data = await api("/api/voices");
      voices = data.voices || [];
      if (!voices.some((v) => v.id === selectedVoice)) {
        selectedVoice = data.default || "ava";
        localStorage.setItem(pKey("storyVoice"), selectedVoice);
      }
    } catch (_) {
      voices = [];
    }
    renderVoices();
  }

  async function checkSession() {
    try {
      const s = await api("/api/session");
      if (s.ok) {
        pinScreen.classList.add("hidden");
        appScreen.classList.remove("hidden");
        await loadVoices();
        await refreshStories();
        return true;
      }
    } catch (_) {}
    pinScreen.classList.remove("hidden");
    appScreen.classList.add("hidden");
    return false;
  }

  pinGo.addEventListener("click", async () => {
    pinStatus.textContent = "Checking…";
    try {
      await api("/api/login", { method: "POST", body: JSON.stringify({ pin: pinInput.value }) });
      pinInput.value = "";
      await checkSession();
    } catch (e) {
      pinStatus.textContent = e.message || "Wrong PIN";
      pinStatus.className = "status err";
    }
  });
  pinInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") pinGo.click();
  });

  document.querySelectorAll(".lang button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".lang button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      language = btn.dataset.lang;
    });
  });

  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRec) {
    micBtn.classList.remove("hidden");
    let rec = null;
    micBtn.addEventListener("click", () => {
      if (rec) {
        try { rec.stop(); } catch (_) {}
        rec = null;
        micBtn.textContent = "🎤 Speak";
        return;
      }
      rec = new SpeechRec();
      rec.lang = language.startsWith("Es") ? "es-US" : "en-US";
      rec.interimResults = true;
      rec.continuous = false;
      micBtn.textContent = "⏹ Stop";
      setStatus("Listening… speak your idea", "busy");
      rec.onresult = (ev) => {
        let text = "";
        for (let i = 0; i < ev.results.length; i++) text += ev.results[i][0].transcript;
        idea.value = text.trim();
      };
      rec.onerror = () => {
        setStatus("Couldn’t hear that — try the keyboard 🎤 instead", "err");
        micBtn.textContent = "🎤 Speak";
        rec = null;
      };
      rec.onend = () => {
        micBtn.textContent = "🎤 Speak";
        rec = null;
        if (idea.value.trim()) setStatus("Got it! Press Make My Story when ready.");
      };
      try { rec.start(); } catch (_) {
        setStatus("Mic not available — use the keyboard 🎤", "err");
        micBtn.textContent = "🎤 Speak";
        rec = null;
      }
    });
  }

  function renderList(serverStories, localStories) {
    const byId = new Map();
    (localStories || []).forEach((s) => byId.set(s.id, s));
    (serverStories || []).forEach((s) => {
      if (!byId.has(s.id)) byId.set(s.id, { ...s, blobUrl: null });
    });
    const items = Array.from(byId.values()).sort((a, b) =>
      (b.created || "").localeCompare(a.created || "")
    );
    if (!items.length) {
      storyList.innerHTML = '<li class="meta">None yet — make your first story!</li>';
      return;
    }
    storyList.innerHTML = "";
    items.forEach((s) => {
      const li = document.createElement("li");
      const title = document.createElement("div");
      title.className = "title";
      title.textContent = s.title || "Story";
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = (s.created || "").replace("T", " ").slice(0, 19);
      const actions = document.createElement("div");
      actions.className = "actions";
      const play = document.createElement("button");
      play.textContent = "▶ Play";
      play.onclick = () => playStory(s);
      const dl = document.createElement("button");
      dl.textContent = "⬇ Save";
      dl.onclick = () => downloadStory(s);
      actions.append(play, dl);
      li.append(title, meta, actions);
      storyList.appendChild(li);
    });
  }

  async function refreshStories() {
    let server = [];
    try {
      const data = await api("/api/stories?profile=" + activeProfile);
      server = data.stories || [];
    } catch (_) {}
    let local = [];
    try { local = await idbAll(); } catch (_) {}
    // old cached stories (no profile) belong to profile 1
    local = local.filter((s) => (s.profile || "p1") === activeProfile);
    renderList(server, local);
  }

  async function fetchAudioBlob(storyId) {
    const res = await fetch("/api/stories/" + storyId + "/audio", { credentials: "same-origin" });
    if (!res.ok) throw new Error("Could not download audio");
    return await res.blob();
  }

  async function cacheStory(meta, blob) {
    await idbPut({
      id: meta.id || meta.story_id,
      title: meta.title,
      created: meta.created || new Date().toISOString(),
      words: meta.words,
      profile: meta.profile || activeProfile,
      blob,
    });
  }

  async function playStory(s) {
    try {
      let url = s.blobUrl;
      if (!url && s.blob) {
        url = URL.createObjectURL(s.blob);
        s.blobUrl = url;
      }
      if (!url) {
        const blob = await fetchAudioBlob(s.id);
        await cacheStory(s, blob);
        url = URL.createObjectURL(blob);
      }
      liveReset();
      playerCard.classList.remove("hidden");
      showFullPlayer();
      downloadBtn.classList.remove("hidden");
      resultTitle.textContent = s.title || "Your story";
      player.src = url;
      raLoadFull(s.id);
      downloadBtn.href = url;
      downloadBtn.download = ((s.title || "story").replace(/[^\w\- ]+/g, "").slice(0, 40) || "story") + ".mp3";
      player.play().catch(() => {});
      setStatus("Playing…", "ok");
    } catch (e) {
      setStatus(e.message || "Could not play", "err");
    }
  }

  async function downloadStory(s) {
    await playStory(s);
    downloadBtn.click();
  }

  // ---------- progressive (part by part) playback ----------
  const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
  const live = { active: false, jobId: null, storyId: null, total: 0, urls: {}, fetching: {}, cur: 0, waiting: false, started: false, el: [null, null], slot: 0, finished: false };
  const nowPlaying = $("now-playing");
  const liveToggle = $("live-toggle");
  const liveControls = $("live-controls");

  function liveReset() {
    Object.values(live.urls).forEach((u) => URL.revokeObjectURL(u));
    live.el.forEach((e) => { if (e) { e.pause(); e.removeAttribute("src"); } });
    Object.assign(live, { active: false, jobId: null, storyId: null, total: 0, urls: {}, fetching: {}, cur: 0, waiting: false, started: false, slot: 0, finished: false });
    if (typeof raReset === "function") raReset();
  }

  function livePrime() {
    // Called inside the Make tap so Android lets us play later without another tap.
    live.el = [new Audio(), new Audio()];
    live.el.forEach((e) => { e.playsInline = true; e.preload = "auto"; e.src = SILENT_WAV; e.play().catch(() => {}); });
  }

  function liveLabel() {
    if (live.finished) return "Playing: part " + live.cur + " of " + live.total;
    return "Playing part " + live.cur + " of " + (live.total || "?") + " — the rest is still being made";
  }

  function livePlay(n) {
    const el = live.el[live.slot];
    el.onended = null;
    if (el.src !== live.urls[n]) el.src = live.urls[n];
    try { el.currentTime = 0; } catch (_) {}
    live.cur = n;
    live.waiting = false;
    el.onended = () => liveNext();
    el.play().then(() => {
      if (!live.started) { live.started = true; nowPlaying.textContent = "Starting now! 🎶"; setTimeout(() => { if (live.active) nowPlaying.textContent = liveLabel(); }, 3000); }
      else nowPlaying.textContent = liveLabel();
      liveToggle.textContent = "⏸ Pause";
    }).catch(() => {
      nowPlaying.textContent = "Tap Play to start the story";
      liveToggle.textContent = "▶️ Play";
    });
    // preload the next part on the other element
    const other = live.el[1 - live.slot];
    if (live.urls[n + 1] && other.src !== live.urls[n + 1]) other.src = live.urls[n + 1];
    live.slot = 1 - live.slot;
  }

  function liveNext() {
    const n = live.cur + 1;
    if (live.total && n > live.total) { liveEnded(); return; }
    if (live.urls[n]) livePlay(n);
    else { live.waiting = true; nowPlaying.textContent = "Next part coming… 🌟"; }
  }

  function liveEnded() {
    nowPlaying.textContent = "The end 🌙 Sweet dreams!";
    liveToggle.textContent = "🔁 Hear it again";
    live.cur = 0; live.ended = true;
  }

  liveToggle.addEventListener("click", () => {
    if (live.ended || (live.cur === 0 && live.urls[1])) { live.ended = false; livePlay(1); return; }
    const el = live.el[1 - live.slot];  // the element currently playing
    if (!el || !el.src) return;
    if (el.paused) { el.play().catch(() => {}); liveToggle.textContent = "⏸ Pause"; }
    else { el.pause(); liveToggle.textContent = "▶️ Play"; }
  });

  const restartBtn = $("restart-btn");

  function showFullPlayer() {
    // Whole-story MP3 mode: native controls + Start over (live Pause/Play hidden)
    live.el.forEach((e) => { if (e) { e.onended = null; e.pause(); } });
    liveControls.classList.remove("hidden");
    liveToggle.classList.add("hidden");
    nowPlaying.classList.add("hidden");
    player.classList.remove("hidden");
  }

  function showLivePlayer() {
    liveControls.classList.remove("hidden");
    liveToggle.classList.remove("hidden");
    nowPlaying.classList.remove("hidden");
    player.pause();
    player.classList.add("hidden");
  }

  restartBtn.addEventListener("click", () => {
    if (!player.classList.contains("hidden")) {
      // full-story player
      try { player.currentTime = 0; } catch (_) {}
      player.play().catch(() => {});
      setStatus("Starting over from the beginning! ⏮️", "ok");
      return;
    }
    if (!live.urls[1]) return;  // nothing to play yet
    live.el.forEach((e) => { if (e) { e.onended = null; e.pause(); } });
    live.ended = false;
    live.waiting = false;
    nowPlaying.textContent = "Starting over! ⏮️";
    livePlay(1);
  });

  async function liveFetchPart(n) {
    if (live.urls[n] || live.fetching[n]) return;
    live.fetching[n] = true;
    try {
      const res = await fetch("/api/stories/" + live.storyId + "/parts/" + n + "/audio", { credentials: "same-origin" });
      if (!res.ok) throw new Error("part " + n);
      const blob = await res.blob();
      live.urls[n] = URL.createObjectURL(blob);
      raLoadPart(live.storyId, n);
      if (n === 1) {
        playerCard.classList.remove("hidden");
        showLivePlayer();
        downloadBtn.classList.add("hidden");
        livePlay(1);
      } else if (live.waiting && live.cur + 1 === n) {
        livePlay(n);
      } else if (live.cur + 1 === n) {
        const other = live.el[live.slot];  // idle element: preload for gapless handoff
        if (other) other.src = live.urls[n];
      }
    } catch (_) {
      // will retry on the next poll
    } finally {
      live.fetching[n] = false;
    }
  }

  // ---------- read-along (hidden until the 📖 button is pressed) ----------
  const raPanel = $("readalong");
  const raBtn = $("readalong-btn");
  const ra = { parts: {}, partEls: {}, full: null, fullEls: null, fullId: null, onEl: null, lastTop: -1, raf: 0 };

  function raReset() {
    Object.assign(ra, { parts: {}, partEls: {}, full: null, fullEls: null, fullId: null, onEl: null, lastTop: -1 });
    raPanel.innerHTML = "";
  }

  function raBuild(words, partN) {
    // words: [[start, end, text, newParagraph], ...] -> container + span list
    const wrap = document.createElement("div");
    wrap.className = "ra-part";
    if (partN) wrap.dataset.part = partN;
    let p = document.createElement("p");
    wrap.appendChild(p);
    const els = [];
    words.forEach((w, i) => {
      if (w[3] && p.childNodes.length) { p = document.createElement("p"); wrap.appendChild(p); }
      const sp = document.createElement("span");
      sp.className = "w";
      sp.textContent = w[2];
      sp.dataset.i = i;
      if (partN) sp.dataset.part = partN;
      p.appendChild(sp);
      p.appendChild(document.createTextNode(" "));
      els.push(sp);
    });
    return { wrap, els };
  }

  function raMsg(text) {
    raPanel.innerHTML = "";
    const m = document.createElement("p"); m.className = "ra-msg"; m.textContent = text;
    raPanel.appendChild(m);
  }

  function raFullMode() { return !player.classList.contains("hidden"); }

  function raRenderLive() {
    // show every part that has words, in order; keep built nodes
    if (raFullMode()) return;
    raPanel.querySelectorAll(".ra-msg").forEach((m) => m.remove());
    Object.keys(ra.parts).map(Number).sort((a, b) => a - b).forEach((n) => {
      if (!ra.partEls[n]) {
        const { wrap, els } = raBuild(ra.parts[n].words || [], n);
        ra.partEls[n] = { wrap, els };
        const after = Array.from(raPanel.querySelectorAll(".ra-part")).find((x) => Number(x.dataset.part) > n);
        raPanel.insertBefore(wrap, after || null);
      }
    });
    if (!raPanel.children.length) raMsg("The words are on their way… ✨");
  }

  function raRenderFull() {
    raPanel.innerHTML = "";
    ra.partEls = {};
    ra.onEl = null; ra.lastTop = -1;
    if (!ra.full) { raMsg("The words are on their way… ✨"); return; }
    if (!(ra.full.words || []).length) { raMsg("No words saved for this story."); return; }
    const { wrap, els } = raBuild(ra.full.words, 0);
    ra.fullEls = els;
    raPanel.appendChild(wrap);
  }

  async function raFetch(url) {
    for (let k = 0; k < 3; k++) {
      try {
        const res = await fetch(url, { credentials: "same-origin" });
        if (res.ok) return await res.json();
        if (res.status === 404 && k === 2) return null;
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 1200));
    }
    return null;
  }

  async function raLoadPart(storyId, n) {
    if (!storyId || ra.parts[n]) return;
    const t = await raFetch("/api/stories/" + storyId + "/parts/" + n + "/timings");
    if (t && live.storyId === storyId) { ra.parts[n] = t; raRenderLive(); }
  }

  async function raLoadFull(storyId) {
    ra.fullId = storyId; ra.full = null; ra.fullEls = null;
    raRenderFull();
    const t = await raFetch("/api/stories/" + storyId + "/timings");
    if (ra.fullId !== storyId) return;
    ra.full = t || { words: [] };
    if (raFullMode()) raRenderFull();
  }

  function raCurrent() {
    // -> {el: audio element, words, spans}
    if (raFullMode()) {
      return { el: player, words: ra.full && ra.full.words, spans: ra.fullEls };
    }
    const n = live.cur;
    const pe = ra.partEls[n];
    return { el: live.el[1 - live.slot], words: ra.parts[n] && ra.parts[n].words, spans: pe && pe.els };
  }

  function raIndexAt(words, t) {
    let lo = 0, hi = words.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (words[mid][0] <= t + 0.05) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return ans;
  }

  function raTick() {
    ra.raf = 0;
    if (raPanel.classList.contains("hidden")) return;
    if (raFullMode() && !ra.fullEls && ra.full) raRenderFull();
    if (!raFullMode() && ra.fullEls) { ra.fullEls = null; raPanel.innerHTML = ""; ra.partEls = {}; raRenderLive(); }
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

  function raApply(show) {
    raPanel.classList.toggle("hidden", !show);
    raBtn.setAttribute("aria-pressed", show ? "true" : "false");
    raBtn.textContent = show ? "📖 Hide words" : "📖 Read along";
    if (show) {
      ra.lastTop = -1;
      if (raFullMode()) { if (!ra.fullEls) raRenderFull(); } else raRenderLive();
      if (!ra.raf) ra.raf = requestAnimationFrame(raTick);
    } else if (ra.raf) { cancelAnimationFrame(ra.raf); ra.raf = 0; }
  }

  raBtn.addEventListener("click", () => {
    const show = raPanel.classList.contains("hidden");
    localStorage.setItem(pKey("readAlong"), show ? "1" : "0");
    raApply(show);
    if (show) playerCard.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // tap a word to jump there
  raPanel.addEventListener("click", (e) => {
    const sp = e.target.closest(".w");
    if (!sp) return;
    const i = Number(sp.dataset.i);
    if (raFullMode()) {
      if (!ra.full) return;
      try { player.currentTime = ra.full.words[i][0]; } catch (_) {}
      player.play().catch(() => {});
      return;
    }
    const n = Number(sp.dataset.part);
    const t = ra.parts[n] && ra.parts[n].words[i] ? ra.parts[n].words[i][0] : 0;
    if (!live.urls[n]) return;
    if (n !== live.cur || live.ended) {
      live.el.forEach((x) => { if (x) { x.onended = null; x.pause(); } });
      live.ended = false;
      livePlay(n);
    }
    const el = live.el[1 - live.slot];
    const go = () => { try { el.currentTime = t; } catch (_) {} };
    if (el.readyState >= 1) go(); else el.addEventListener("loadedmetadata", go, { once: true });
    if (el.paused) { el.play().catch(() => {}); liveToggle.textContent = "⏸ Pause"; }
  });

  async function pollJob(jobId) {
    clearInterval(pollTimer);
    live.active = true; live.jobId = jobId;
    const tick = async () => {
      try {
        const j = await api("/api/jobs/" + jobId);
        setProgressFromJob(j);
        live.storyId = j.story_id || live.storyId;
        live.total = j.parts_total || live.total;
        if (j.title) resultTitle.textContent = j.title;
        if (live.storyId) {
          // fetch ready parts in order (part 1 first)
          for (const n of (j.parts_ready || [])) { await liveFetchPart(n); }
        }
        if (!live.started && j.status !== "error") {
          setStatus(j.progress || j.status, "busy");
        } else if (j.status !== "done" && j.status !== "error") {
          setStatus("Your story is playing while the rest is being made 🎧", "ok");
        }
        if (j.status === "done" && j.story_id) {
          clearInterval(pollTimer);
          targetPercent = 100;
          displayPercent = 100;
          applyBarVisual(100);
          burstCelebrate();
          stopTween();
          makeBtn.disabled = false;
          live.finished = true;
          const meta = { id: j.story_id, title: j.title || "Story", created: new Date().toISOString(), profile: j.profile || jobProfile };
          const blob = await fetchAudioBlob(j.story_id);
          await cacheStory(meta, blob);
          const url = URL.createObjectURL(blob);
          playerCard.classList.remove("hidden");
          resultTitle.textContent = meta.title;
          downloadBtn.href = url;
          downloadBtn.classList.remove("hidden");
          downloadBtn.download = (meta.title.replace(/[^\w\- ]+/g, "").slice(0, 40) || "story") + ".mp3";
          if (live.started && !live.ended) {
            // keep the live parts playing; full MP3 is saved and ready to download
            player.src = url;
            setStatus("All done! The whole story is saved 💾", "ok");
          } else {
            showFullPlayer();
            player.src = url;
            raLoadFull(j.story_id);
            setStatus("All done! Press play 🎶", "ok");
          }
          hideProgressBarSoon();
          await refreshStories();
        } else if (j.status === "error") {
          clearInterval(pollTimer);
          makeBtn.disabled = false;
          progressWrap.classList.add("error");
          setStatus(j.error || "Something went wrong", "err");
          stopTween();
        }
      } catch (_) {
        setStatus("Still working… (waking up the story server)", "busy");
      }
    };
    await tick();
    pollTimer = setInterval(tick, 1500);
  }

  makeBtn.addEventListener("click", async () => {
    const text = idea.value.trim();
    if (!text || text.startsWith("Example:")) {
      setStatus("Type or speak your idea first!", "err");
      return;
    }
    makeBtn.disabled = true;
    jobProfile = activeProfile;
    liveReset();
    livePrime();
    playerCard.classList.add("hidden");
    player.pause();
    displayPercent = 0;
    targetPercent = 1;
    writingStartedAt = Date.now();
    serverWritingFloor = 1;
    lastSpeakPart = null;
    showProgressBar();
    applyBarVisual(0);
    startTween();
    setStatus("Starting… your story will begin in a minute!", "busy");
    try {
      const { job_id } = await api("/api/stories", {
        method: "POST",
        body: JSON.stringify({
          idea: text,
          language,
          voice: selectedVoice || "ava",
          length: storyLength,
          profile: activeProfile,
        }),
      });
      await pollJob(job_id);
    } catch (e) {
      makeBtn.disabled = false;
      progressWrap.classList.add("error");
      progressWrap.classList.remove("hidden");
      stopTween();
      setStatus(e.message || "Could not start", "err");
    }
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  function syncLengthButtons() {
    document.querySelectorAll("#length-group button").forEach((b) => {
      b.classList.toggle("active", b.dataset.length === storyLength);
    });
  }
  document.querySelectorAll("#length-group button").forEach((btn) => {
    btn.addEventListener("click", () => {
      storyLength = btn.dataset.length;
      localStorage.setItem(pKey("storyLength"), storyLength);
      syncLengthButtons();
    });
  });
  syncLengthButtons();

  // ---- profile picker ----
  const profileRow = $("profile-row");
  const profileEdit = $("profile-edit");
  const profileName = $("profile-name");
  const emojiGrid = $("emoji-grid");
  const EMOJIS = ["🦄", "🐱", "🐶", "🦊", "🐼", "🐰", "🦋", "🐢", "🦖", "🐬", "🌈", "⭐", "🌸", "🚀", "👑", "🐸"];
  let editingId = null;
  let editingEmoji = "";

  function saveProfiles() { localStorage.setItem("storyProfiles", JSON.stringify(profiles)); }

  function renderProfiles() {
    profileRow.innerHTML = "";
    profiles.forEach((p) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "profile-btn" + (p.id === activeProfile ? " active" : "");
      const em = document.createElement("span"); em.className = "p-emoji"; em.textContent = p.emoji;
      const nm = document.createElement("span"); nm.textContent = p.name;
      const ed = document.createElement("span"); ed.className = "p-edit"; ed.textContent = "✏️";
      ed.setAttribute("role", "button"); ed.title = "Change name";
      ed.addEventListener("click", (e) => { e.stopPropagation(); openEditor(p.id); });
      b.append(em, nm, ed);
      b.addEventListener("click", () => switchProfile(p.id));
      profileRow.appendChild(b);
    });
  }

  function openEditor(id) {
    const p = profiles.find((x) => x.id === id);
    editingId = id; editingEmoji = p.emoji;
    profileName.value = p.name;
    emojiGrid.innerHTML = "";
    EMOJIS.forEach((e) => {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = e;
      if (e === editingEmoji) b.className = "active";
      b.addEventListener("click", () => {
        editingEmoji = e;
        emojiGrid.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x.textContent === e));
      });
      emojiGrid.appendChild(b);
    });
    profileEdit.classList.remove("hidden");
  }
  $("profile-cancel").addEventListener("click", () => { profileEdit.classList.add("hidden"); editingId = null; });
  $("profile-save").addEventListener("click", () => {
    const p = profiles.find((x) => x.id === editingId);
    if (p) {
      p.name = profileName.value.trim().slice(0, 16) || p.name;
      p.emoji = editingEmoji || p.emoji;
      saveProfiles();
    }
    profileEdit.classList.add("hidden"); editingId = null;
    renderProfiles();
  });

  async function switchProfile(id) {
    if (id === activeProfile) return;
    if (makeBtn.disabled) { setStatus("Wait until this story is made, then switch 🙂", "busy"); return; }
    activeProfile = id;
    localStorage.setItem("activeProfile", id);
    selectedVoice = localStorage.getItem(pKey("storyVoice")) || "ava";
    if (voices.length && !voices.some((v) => v.id === selectedVoice)) selectedVoice = "ava";
    storyLength = localStorage.getItem(pKey("storyLength")) || "medium";
    renderProfiles();
    renderVoices();
    syncLengthButtons();
    raApply(localStorage.getItem(pKey("readAlong")) === "1");
    const p = profiles.find((x) => x.id === id);
    setStatus("Hi " + p.name + " " + p.emoji + "! Type your idea, then press Make My Story!");
    await refreshStories();
  }
  renderProfiles();
  raApply(localStorage.getItem(pKey("readAlong")) === "1");

  checkSession();
})();
