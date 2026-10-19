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
  let storyLength = localStorage.getItem("storyLength") || "medium";
  let selectedVoice = localStorage.getItem("storyVoice") || "ava";
  let voices = [];
  let pollTimer = null;
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
    localStorage.setItem("storyVoice", selectedVoice);
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
        localStorage.setItem("storyVoice", selectedVoice);
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
      const data = await api("/api/stories");
      server = data.stories || [];
    } catch (_) {}
    let local = [];
    try { local = await idbAll(); } catch (_) {}
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
      playerCard.classList.remove("hidden");
      resultTitle.textContent = s.title || "Your story";
      player.src = url;
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

  async function liveFetchPart(n) {
    if (live.urls[n] || live.fetching[n]) return;
    live.fetching[n] = true;
    try {
      const res = await fetch("/api/stories/" + live.storyId + "/parts/" + n + "/audio", { credentials: "same-origin" });
      if (!res.ok) throw new Error("part " + n);
      const blob = await res.blob();
      live.urls[n] = URL.createObjectURL(blob);
      if (n === 1) {
        playerCard.classList.remove("hidden");
        liveControls.classList.remove("hidden");
        player.classList.add("hidden");
        downloadBtn.classList.add("hidden");
        nowPlaying.classList.remove("hidden");
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
          const meta = { id: j.story_id, title: j.title || "Story", created: new Date().toISOString() };
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
            liveControls.classList.add("hidden");
            nowPlaying.classList.add("hidden");
            player.classList.remove("hidden");
            player.src = url;
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

  document.querySelectorAll("#length-group button").forEach((btn) => {
    if (btn.dataset.length === storyLength) {
      document.querySelectorAll("#length-group button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    }
    btn.addEventListener("click", () => {
      document.querySelectorAll("#length-group button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      storyLength = btn.dataset.length;
      localStorage.setItem("storyLength", storyLength);
    });
  });

  checkSession();
})();
