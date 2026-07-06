/* =============================================
   TDeepMusic — scrapers.js
   Adaptação browser dos scrapers Node.js
   Usa allorigins.win como proxy CORS gratuito
   =============================================
   
   ESTRUTURA ORIGINAL:
   - soundcloud.js → DownCloudMe (downcloudme.com)
   - spotify.js    → SpotifyDL   (dlapi.app)
   - youtube.js    → YTDown      (app.ytdown.to)
   ============================================= */

   const CORS_PROXY = "https://api.allorigins.win/raw?url=";
   const CORS_JSON  = "https://api.allorigins.win/get?url=";
   
   /* ──────────────────────────────────────────────
      UTILS
   ────────────────────────────────────────────── */
   async function proxyFetch(url, options = {}) {
       const encoded = encodeURIComponent(url);
       const res = await fetch(CORS_PROXY + encoded, options);
       if (!res.ok) throw new Error(`HTTP ${res.status}`);
       return res.text();
   }
   
   async function proxyJSON(url) {
       const encoded = encodeURIComponent(url);
       const res = await fetch(CORS_JSON + encoded);
       const wrapper = await res.json();
       return JSON.parse(wrapper.contents);
   }
   
   function parseHTML(html) {
       const parser = new DOMParser();
       return parser.parseFromString(html, "text/html");
   }
   
   /* ──────────────────────────────────────────────
      YOUTUBE — adaptado de youtube.js (YTDown)
      Endpoint: app.ytdown.to/proxy.php
   ────────────────────────────────────────────── */
   export async function fetchYoutube(url) {
       if (!url.match(/youtube\.com|youtu\.be/i)) {
           throw new Error("URL inválida. Use um link do YouTube.");
       }
   
       // Tenta extrair ID do vídeo para thumbnail via oEmbed (sem CORS)
       const videoId = extractYoutubeId(url);
   
       // 1) Tenta API pública do oEmbed para título e thumb
       let title = "Vídeo do YouTube";
       let thumb = null;
       let artist = "YouTube";
   
       try {
           const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
           const data = await proxyJSON(oembedUrl);
           title  = data.title  || title;
           author = data.author_name || artist;
           artist = data.author_name || artist;
           thumb  = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : (data.thumbnail_url || null);
       } catch (e) {
           // fallback: só thumbnail via ID
           if (videoId) thumb = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
       }
   
       // 2) Tenta obter link de download via ytdown
       let dlUrl = null;
       try {
           const body = new URLSearchParams({ url }).toString();
           const raw = await proxyFetch("https://app.ytdown.to/proxy.php", {
               method: "POST",
               headers: { "Content-Type": "application/x-www-form-urlencoded" },
               body
           });
           const data = JSON.parse(raw);
           // Pega o primeiro item de áudio disponível
           const audioItem = data?.api?.mediaItems?.find(i => i.type?.toLowerCase() === "audio");
           const anyItem   = data?.api?.mediaItems?.[0];
           const best = audioItem || anyItem;
           if (best?.mediaUrl) dlUrl = best.mediaUrl;
           if (data?.api?.title) title = data.api.title;
       } catch (e) {
           console.warn("[YT] Erro ao buscar download:", e.message);
       }
   
       return {
           platform: "youtube",
           title,
           artist,
           thumb,
           dlUrl,
           originalUrl: url,
           emoji: "▶",
           badge: "YT",
           badgeClass: "yt"
       };
   }
   
   function extractYoutubeId(url) {
       const m = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
       return m ? m[1] : null;
   }
   
   /* ──────────────────────────────────────────────
      SOUNDCLOUD — adaptado de soundcloud.js (DownCloudMe)
      Endpoint: downcloudme.com/download
   ────────────────────────────────────────────── */
   export async function fetchSoundcloud(url) {
       if (!url.match(/soundcloud\.com/i)) {
           throw new Error("URL inválida. Use um link do SoundCloud.");
       }
   
       let title = "Faixa do SoundCloud";
       let thumb = null;
       let artist = "SoundCloud";
       let dlUrl = null;
   
       // 1) Tenta oEmbed do SoundCloud (sem autenticação, público)
       try {
           const oembedUrl = `https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`;
           const data = await proxyJSON(oembedUrl);
           title  = data.title || title;
           artist = data.author_name || artist;
           thumb  = data.thumbnail_url || null;
       } catch (e) {
           console.warn("[SC] oEmbed falhou:", e.message);
       }
   
       // 2) Tenta downcloudme (fluxo do soundcloud.js original)
       try {
           // Passo 1: pega tokens da home
           const homeHtml = await proxyFetch("https://downcloudme.com/");
           const homeDoc  = parseHTML(homeHtml);
           const verify   = homeDoc.querySelector('input[name="downloader_verify"]')?.value || "";
           const referer  = homeDoc.querySelector("form")?.getAttribute("action") || "/";
   
           // Passo 2: POST para download
           const body = new URLSearchParams({
               downloader_verify: verify,
               _wp_http_referer: referer,
               url
           }).toString();
   
           const resultHtml = await proxyFetch("https://downcloudme.com/download", {
               method: "POST",
               headers: { "Content-Type": "application/x-www-form-urlencoded" },
               body
           });
   
           const doc = parseHTML(resultHtml);
   
           // Extrai direto ou backup (igual parseSingle do original)
           const directEl = doc.querySelector("#fastDownloadBtn");
           if (directEl) {
               dlUrl = directEl.getAttribute("data-direct") || null;
               const parsedTitle = doc.querySelector("h3")?.textContent?.trim();
               if (parsedTitle) title = parsedTitle;
               const parsedThumb = [...doc.querySelectorAll("img")]
                   .map(i => i.src)
                   .find(s => s?.includes("sndcdn"));
               if (parsedThumb) thumb = parsedThumb;
           }
       } catch (e) {
           console.warn("[SC] downcloudme falhou:", e.message);
       }
   
       return {
           platform: "soundcloud",
           title,
           artist,
           thumb,
           dlUrl,
           originalUrl: url,
           emoji: "☁",
           badge: "SC",
           badgeClass: "sc"
       };
   }
   
   /* ──────────────────────────────────────────────
      SPOTIFY — adaptado de spotify.js (SpotifyDL)
      Endpoint: spotify.dlapi.app + master.dlapi.app
   ────────────────────────────────────────────── */
   export async function fetchSpotify(url) {
       if (!url.match(/spotify\.com/i)) {
           throw new Error("URL inválida. Use um link do Spotify.");
       }
   
       let title = "Faixa do Spotify";
       let artist = "Spotify";
       let thumb = null;
       let dlUrl = null;
   
       const BEARER = "Bearer pGLXoCsVu0hcstAecIDwlrlbcrUzv0e1cWBJ0yuB";
   
       // 1) Meta — igual ao spotify.js original
       try {
           const metaUrl = `https://spotify.dlapi.app/api/Gettrack?spotify_url=${encodeURIComponent(url)}`;
           const meta = await proxyJSON(metaUrl);
   
           title  = meta?.name || title;
           artist = meta?.artists?.map(a => a.name).join(", ") || artist;
           // Pega a maior imagem do album
           const images = meta?.album?.images || [];
           thumb = images.sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url || null;
   
           const targetUrl = meta?.external_urls?.spotify || url;
   
           // 2) Convert — igual ao spotify.js original
           const convertRaw = await proxyFetch("https://master.dlapi.app/api/v1/convert", {
               method: "POST",
               headers: {
                   "Authorization": BEARER,
                   "Content-Type": "application/json"
               },
               body: JSON.stringify({ url: targetUrl, format: "mp3" })
           });
   
           const init = JSON.parse(convertRaw);
   
           if (init?.download_url) {
               dlUrl = init.download_url;
           } else {
               const taskId = init?.task_id || init?.id;
               if (taskId) {
                   // Polling (máx 10 tentativas no browser pra não travar)
                   for (let i = 0; i < 10; i++) {
                       await sleep(3000);
                       try {
                           const statusRaw = await proxyFetch(`https://master.dlapi.app/api/v1/tasks/${taskId}`, {
                               headers: { "Authorization": BEARER }
                           });
                           const status = JSON.parse(statusRaw);
                           if (status?.status === "finished" || status?.status === "completed") {
                               dlUrl = status?.result?.download_url || status?.download_url;
                               break;
                           }
                           if (status?.status === "failed") break;
                       } catch {}
                   }
               }
           }
       } catch (e) {
           console.warn("[SP] Erro:", e.message);
       }
   
       return {
           platform: "spotify",
           title,
           artist,
           thumb,
           dlUrl,
           originalUrl: url,
           emoji: "♪",
           badge: "SP",
           badgeClass: "sp"
       };
   }
   
   /* ──────────────────────────────────────────────
      DISPATCHER — chama o scraper certo pelo URL
   ────────────────────────────────────────────── */
   export async function fetchTrack(url) {
       const clean = url.trim();
       if (!clean) throw new Error("URL vazia.");
   
       if (clean.match(/youtube\.com|youtu\.be/i))  return fetchYoutube(clean);
       if (clean.match(/soundcloud\.com/i))          return fetchSoundcloud(clean);
       if (clean.match(/spotify\.com/i))             return fetchSpotify(clean);
   
       throw new Error("Plataforma não reconhecida. Use YouTube, SoundCloud ou Spotify.");
   }
   
   function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
