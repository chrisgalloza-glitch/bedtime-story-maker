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
  let language = "English";
  let selectedVoice = localStorage.getItem("storyVoice") || "ava";
  let voices = [];
  let pollTimer = null;
  let previewAudio = null;

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

  async function pollJob(jobId) {
    clearInterval(pollTimer);
    const tick = async () => {
      try {
        const j = await api("/api/jobs/" + jobId);
        setStatus(j.progress || j.status, j.status === "error" ? "err" : "busy");
        if (j.status === "done" && j.story_id) {
          clearInterval(pollTimer);
          makeBtn.disabled = false;
          const blob = await fetchAudioBlob(j.story_id);
          const meta = {
            id: j.story_id,
            title: j.title || "Story",
            created: new Date().toISOString(),
          };
          await cacheStory(meta, blob);
          const url = URL.createObjectURL(blob);
          playerCard.classList.remove("hidden");
          resultTitle.textContent = meta.title;
          player.src = url;
          downloadBtn.href = url;
          downloadBtn.download = (meta.title.replace(/[^\w\- ]+/g, "").slice(0, 40) || "story") + ".mp3";
          setStatus("All done! Playing now…", "ok");
          player.play().catch(() => {});
          await refreshStories();
        } else if (j.status === "error") {
          clearInterval(pollTimer);
          makeBtn.disabled = false;
          setStatus(j.error || "Something went wrong", "err");
        }
      } catch (_) {
        setStatus("Still working… (waking up the story server)", "busy");
      }
    };
    await tick();
    pollTimer = setInterval(tick, 2500);
  }

  makeBtn.addEventListener("click", async () => {
    const text = idea.value.trim();
    if (!text || text.startsWith("Example:")) {
      setStatus("Type or speak your idea first!", "err");
      return;
    }
    makeBtn.disabled = true;
    playerCard.classList.add("hidden");
    setStatus("Starting… this can take a few minutes", "busy");
    try {
      const { job_id } = await api("/api/stories", {
        method: "POST",
        body: JSON.stringify({
          idea: text,
          language,
          voice: selectedVoice || "ava",
        }),
      });
      await pollJob(job_id);
    } catch (e) {
      makeBtn.disabled = false;
      setStatus(e.message || "Could not start", "err");
    }
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  checkSession();
})();
