# Bedtime Story Maker (Web / Android tablet)

One-screen PWA for kids: type or speak a story idea → gentle bedtime story → Ava reads it aloud (Microsoft neural TTS, free via edge-tts).

Built for an older Samsung Galaxy Tab A. Works in Chrome; can be **Added to Home screen**.

## Recommended host: **Render (free Web Service)**

| Option | Free? | Card? | Can run edge-tts? | Notes |
|--------|-------|-------|-------------------|-------|
| **Render free** | Yes | **No** | **Yes** (Docker/Python) | Sleeps after 15 min idle; ~30–60s cold start. **Best fit.** |
| Hugging Face Spaces | Docker needs PRO now | Often | Yes if paid | Free tier no longer enough for Docker/Gradio CPU. |
| Cloudflare Workers | Yes | No | Awkward | Outbound WS possible, but long TTS jobs fight CPU limits; would need a full JS rewrite of edge-tts. |
| Google Cloud Run | Free tier | **Yes** (billing account) | Yes | More account setup than Render. |
| Fly.io | No real free tier | Yes after short trial | Yes | Not free for ongoing use. |
| **Higgsfield websites** | Via your HF account | — | **Poor fit** | Scaffold is React 19 on **one Cloudflare Worker** (D1/R2/KV/Containers optional). Not a Python edge-tts host; Containers exist but are off by default and heavier than this app needs. Secrets tool only *lists* names. **Do not use for this.** |

**Why Render:** no credit card, Dockerfile works as-is, env vars for `FAMILY_PIN` + `GEMINI_API_KEY`, HTTPS included. Sleep is fine for bedtime — the app polls a job, so the first tap after idle may wait ~1 minute while the server wakes, then writing + Ava’s voice take several more minutes.

> Free Render has **no persistent disk**. Stories live on the server only while it is awake. The tablet **saves MP3s in IndexedDB** after each story and offers **Download MP3**, so the girls keep their library on the device.

## What Chris does to deploy (about 15 minutes)

1. Create a free Gemini key: https://aistudio.google.com/apikey  
2. Put this folder in a GitHub repo (or push `story-maker-web`).  
3. Sign up at https://render.com with GitHub (no card).  
4. Dashboard → **New** → **Web Service** → connect the repo.  
5. Settings:
   - **Runtime:** Docker (or it detects the Dockerfile)
   - **Instance type:** Free
   - **Health check path:** `/api/health`
6. **Environment** variables:
   - `FAMILY_PIN` = a short PIN only your family knows (e.g. `4821`)
   - `GEMINI_API_KEY` = the key from step 1
   - `MOCK_LLM` = `0`
7. Click **Create Web Service** / Deploy. Wait for the green URL, e.g. `https://bedtime-story-maker.onrender.com`
8. On the tablet Chrome: open that URL → enter the PIN → Chrome menu → **Add to Home screen**.

Optional: set `XAI_API_KEY` instead of Gemini (paid). Gemini is preferred and free-tier.

## Local run (development)

```bash
cd story-maker-web
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export FAMILY_PIN=1234
export MOCK_LLM=1          # canned short story; no Gemini key needed
export DATA_DIR=./data
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Open http://127.0.0.1:8000 — PIN `1234`.

## How the girls use it (tablet)

1. Tap the **Stories** home-screen icon (or open the link).  
2. Enter the family PIN (grown-up helps the first time).  
3. Pick **English** or **Español**.  
4. Type an idea — or tap the keyboard **🎤** to speak (or the on-screen Speak button if it appears).  
5. Tap **Make My Story**.  
6. Wait (status text: Writing… / Recording Ava’s voice…). First open after a while may say “waking up”.  
7. The story plays. Use **Download MP3** to keep it. Past stories stay in the list on the tablet.

## API (for debugging)

- `POST /api/login` `{ "pin": "..." }`
- `POST /api/stories` `{ "idea": "...", "language": "English" }` → `{ "job_id" }`
- `GET /api/jobs/{id}` → status / progress / story_id
- `GET /api/stories/{id}/audio` → MP3

## Models & voice

- Story (free): Google **gemini-3.8-flash**
- Story (paid alt): xAI **grok-4.3**
- Voice: **en-US-AvaMultilingualNeural** at **-10%** (works for English and Spanish)


## Voices

Kids pick a reader on the home screen:

| Card | Engine | Notes |
|------|--------|-------|
| **Ava** (default) | Microsoft edge-tts `en-US-AvaMultilingualNeural` @ −10% | Free |
| **Luna** | xAI TTS `luna` @ speed 0.9 | Gentle / nurturing — uses Grok credit |
| **Carina** | xAI TTS `carina` @ speed 0.9 | Soft / soothing — uses Grok credit |
| **Orion** | xAI TTS `orion` @ speed 0.9 | Rich calm storyteller — uses Grok credit |

Choice is stored in `localStorage` and sent as `voice` on `POST /api/stories`.
Previews: `GET /api/voices/{id}/preview?lang=en|es` (PIN required).
If a Grok voice fails mid-story, the rest falls back to Ava.
