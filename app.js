/* =============================================
   TDeepMusic — app.js (v5)
   ============================================= */
   import { fetchTrack } from "./scrapers.js";

   // ── Dados locais ─────────────────────────────────
   const TRACKS = [
       { name:"Timothy's Lament",  artist:"O Profundo ft. Timothy", album:"Profundezas Vol. 1", dur:"3:47", sec:227, thumb:"🐙", bg:"linear-gradient(135deg,#0c4a6e,#06b6d4)" },
       { name:"Ocean Man Cover",   artist:"O Profundo",             album:"Single",             dur:"2:58", sec:178, thumb:"🌊", bg:"linear-gradient(135deg,#1e3a5f,#0ea5e9)" },
       { name:"Dolphin Song",      artist:"O Profundo e Amigos",    album:"Profundezas Vol. 2", dur:"4:12", sec:252, thumb:"🐬", bg:"linear-gradient(135deg,#312e81,#6366f1)" },
       { name:"Deep Dark Waters",  artist:"Seven Records",          album:"The Seven Soundtrack",dur:"5:03", sec:303, thumb:"🦑", bg:"linear-gradient(135deg,#064e3b,#10b981)" },
       { name:"Vought Anthems",    artist:"Vought Int. Music",      album:"Propaganda",         dur:"3:21", sec:201, thumb:"🪼", bg:"linear-gradient(135deg,#7c2d12,#f97316)" },
   ];
   const PALETTE = ["#06b6d4","#0ea5e9","#7c3aed","#0891b2","#10b981","#f97316","#ec4899","#eab308"];
   
   // ── State ────────────────────────────────────────
   let playlists = [
       { id:0, name:"Profundezas",         color:"#06b6d4", emoji:"🌊" },
       { id:1, name:"Oceano Escuro",        color:"#0ea5e9", emoji:"🌌" },
       { id:2, name:"Lamentos de Timothy", color:"#7c3aed", emoji:"🐙" },
       { id:3, name:"Golfinhos e Fins",    color:"#0891b2", emoji:"🐬" },
   ];
   let nextPlId = 4;
   let importedTracks = [];
   let likedTracks    = [];
   
   const player = {
       cur:            0,
       playing:        false,
       shuffle:        false,
       repeat:         false,
       liked:          false,
       progress:       0,
       interval:       null,
       importedActive: null,
       importedInterval: null,
   };
   
   // ── Refs ─────────────────────────────────────────
   const $ = id => document.getElementById(id);
   const pThumb    = $("p-thumb");
   const pName     = $("p-name");
   const pArtist   = $("p-artist");
   const pLike     = $("p-like");
   const btnPlay   = $("btn-play");
   const playIcon  = $("play-icon");
   const btnPrev   = $("btn-prev");
   const btnNext   = $("btn-next");
   const btnShuf   = $("btn-shuffle");
   const btnRep    = $("btn-repeat");
   const pbarFill  = $("pbar-fill");
   const pbarDot   = $("pbar-dot");
   const pbar      = $("pbar");
   const ptimeCur  = $("ptime-cur");
   const ptimeTot  = $("ptime-tot");
   const discImg   = $("disc-img");
   const heroPlay  = $("hero-play");
   const volSlider = $("vol-slider");
   const searchInput   = $("search-input");
   const searchResults = $("search-results");
   const searchClear   = $("search-clear");
   const addPlBtn  = $("add-playlist-btn");
   const plList    = $("playlist-list");
   const plNameIn  = $("pl-name-input");
   const plCreate  = $("pl-create-btn");
   
   // ── Iframes ───────────────────────────────────────
   const ytIframe = $("yt-player");
   const scIframe = $("sc-player");
   const ytWrap   = $("yt-iframe-wrap");
   
   // ── Áudio nativo (Spotify dlUrl) ─────────────────
   const audio = new Audio();
   audio.volume = 0.8;
   
   // ── Utils ────────────────────────────────────────
   const fmt = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;
   function extractYoutubeId(url) {
       const m = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
       return m ? m[1] : null;
   }
   function currentVol() { return parseInt(volSlider.value) / 100; }
   
   // ── Para tudo ─────────────────────────────────────
   function stopAll() {
       clearInterval(player.interval);
       clearInterval(player.importedInterval);
       if (ytIframe) { ytIframe.src = ""; ytIframe.style.display = "none"; }
       if (ytWrap)   ytWrap.style.width = "0";
       if (scIframe) scIframe.src = "";
       audio.pause();
       audio.src = "";
       player.importedActive = null;
   }
   
   // ══════════════════════════════════════════════════
   //   UI HELPERS
   // ══════════════════════════════════════════════════
   function setPlayingUI(on) {
       player.playing = on;
       playIcon.innerHTML = on
           ? `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>`
           : `<path d="M8 5v14l11-7z"/>`;
       if (discImg) discImg.classList.toggle("spinning", on);
   }
   
   function updatePbar(cur, total) {
       const tot = total || TRACKS[player.cur]?.sec || 1;
       const pct = Math.min((cur / tot) * 100, 100);
       pbarFill.style.width = pct + "%";
       pbarDot.style.left   = pct + "%";
       ptimeCur.textContent = fmt(cur);
   }
   
   function highlightTrack(i) {
       document.querySelectorAll(".track").forEach((el,idx) => el.classList.toggle("playing", idx === i));
   }
   
   function showToast(msg, ms=3000) {
       const t = $("toast");
       if (!t) return;
       t.textContent = msg;
       t.classList.add("show");
       setTimeout(() => t.classList.remove("show"), ms);
   }
   
   // ══════════════════════════════════════════════════
   //   PLAYER — local tracks (simulado)
   // ══════════════════════════════════════════════════
   function loadTrack(i) {
       stopAll();
       player.cur      = i;
       player.progress = 0;
       player.liked    = likedTracks.some(t => t.isLocal && t.name === TRACKS[i].name);
       pLike.classList.toggle("liked", player.liked);
       const t = TRACKS[i];
       pName.textContent        = t.name;
       pArtist.textContent      = t.artist;
       pThumb.textContent       = t.thumb;
       pThumb.style.background  = t.bg;
       pThumb.style.backgroundImage = "";
       ptimeTot.textContent     = t.dur;
       ptimeCur.textContent     = "0:00";
       updatePbar(0, t.sec);
       highlightTrack(i);
   }
   
   function play() {
       setPlayingUI(true);
       clearInterval(player.interval);
       if (player.importedActive) return; // gerenciado por startImportedTimer
       player.interval = setInterval(() => {
           player.progress++;
           const t = TRACKS[player.cur];
           if (!t) return;
           if (player.progress >= t.sec) {
               if (player.repeat) player.progress = 0;
               else { nextTrack(); return; }
           }
           updatePbar(player.progress, t.sec);
       }, 1000);
   }
   
   function pause() {
       setPlayingUI(false);
       clearInterval(player.interval);
       if (player.importedActive) {
           const p = player.importedActive.platform;
           if (p === "youtube" && ytIframe)
               ytIframe.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}','*');
           if (p === "soundcloud" && scIframe)
               scIframe.contentWindow?.postMessage(JSON.stringify({method:"pause"}),'*');
           if (p === "spotify") audio.pause();
       }
   }
   
   function togglePlay() {
       if (player.playing) { pause(); return; }
       if (player.importedActive) {
           const p = player.importedActive.platform;
           if (p === "youtube" && ytIframe)
               ytIframe.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}','*');
           if (p === "soundcloud" && scIframe)
               scIframe.contentWindow?.postMessage(JSON.stringify({method:"play"}),'*');
           if (p === "spotify") audio.play().catch(()=>{});
           setPlayingUI(true);
       } else {
           play();
       }
   }
   
   function nextTrack() {
       if (player.importedActive) {
           const idx = importedTracks.findIndex(t => t.originalUrl === player.importedActive.originalUrl);
           const nxt = importedTracks[idx + 1];
           if (nxt) { playImported(nxt); return; }
           stopAll(); setPlayingUI(false); return;
       }
       let n;
       if (player.shuffle)
           do { n = Math.floor(Math.random()*TRACKS.length); } while(n===player.cur && TRACKS.length>1);
       else
           n = (player.cur + 1) % TRACKS.length;
       loadTrack(n); if (player.playing) play();
   }
   
   function prevTrack() {
       if (player.importedActive) {
           const idx = importedTracks.findIndex(t => t.originalUrl === player.importedActive.originalUrl);
           const prv = importedTracks[idx - 1];
           if (prv) { playImported(prv); return; }
           stopAll(); setPlayingUI(false); return;
       }
       if (player.progress > 3) { player.progress = 0; updatePbar(0, TRACKS[player.cur]?.sec); return; }
       const p = (player.cur - 1 + TRACKS.length) % TRACKS.length;
       loadTrack(p); if (player.playing) play();
   }
   
   // ══════════════════════════════════════════════════
   //   CURTIR / FAVORITOS
   // ══════════════════════════════════════════════════
   function toggleLike() {
       player.liked = !player.liked;
       pLike.classList.toggle("liked", player.liked);
       if (player.importedActive) {
           const track = player.importedActive;
           if (player.liked) { if (!likedTracks.find(t=>t.originalUrl===track.originalUrl)) likedTracks.push(track); }
           else likedTracks = likedTracks.filter(t=>t.originalUrl!==track.originalUrl);
       } else {
           const track = TRACKS[player.cur];
           if (player.liked) { if (!likedTracks.find(t=>t.isLocal&&t.name===track.name)) likedTracks.push({...track,isLocal:true}); }
           else likedTracks = likedTracks.filter(t=>!(t.isLocal&&t.name===track.name));
       }
       renderFavorites();
   }
   
   function renderFavorites() {
       const list  = $("favorites-list");
       const empty = $("favorites-empty");
       if (!list) return;
       if (!likedTracks.length) {
           list.innerHTML = "";
           if (empty) empty.style.display="flex";
           return;
       }
       if (empty) empty.style.display="none";
       const bMap={youtube:"yt",soundcloud:"sc",spotify:"sp"};
       const bTxt={youtube:"YT",soundcloud:"SC",spotify:"SP"};
       list.innerHTML = likedTracks.map((t,i) => t.isLocal ? `
           <div class="track fav-track" data-fav="${i}">
               <span class="tn">${i+1}</span>
               <div class="tt" style="background:${t.bg}">${t.thumb}</div>
               <div class="ti"><p class="tn2">${t.name}</p><p class="ta">${t.artist}</p></div>
               <span class="tal">${t.album}</span>
               <span class="td">${t.dur}</span>
               <button class="t-more">···</button>
           </div>` : `
           <div class="imp-track fav-track" data-fav="${i}">
               <div class="imp-thumb-wrap">
                   ${t.thumb?`<img src="${t.thumb}" alt="capa" onerror="this.style.display='none'">`:``}
                   <div class="imp-thumb-emoji" style="${t.thumb?"display:none":""}">${t.emoji}</div>
               </div>
               <div class="imp-info"><div class="imp-title">${t.title}</div><div class="imp-artist">${t.artist}</div></div>
               <span class="imp-badge ${bMap[t.platform]||""}">${bTxt[t.platform]||"?"}</span>
           </div>`
       ).join("");
       list.querySelectorAll(".fav-track").forEach(el => {
           el.addEventListener("click", () => {
               const t = likedTracks[parseInt(el.dataset.fav)];
               if (t.isLocal) { const i=TRACKS.findIndex(x=>x.name===t.name); if(i>=0){loadTrack(i);play();} }
               else playImported(t);
           });
       });
   }
   
   // ══════════════════════════════════════════════════
   //   PLAYER — faixas importadas
   // ══════════════════════════════════════════════════
   function loadImportedTrack(track) {
       pName.textContent   = track.title;
       pArtist.textContent = track.artist;
       pThumb.textContent  = "";
       pThumb.style.background = "var(--bg-e)";
       if (track.thumb) {
           pThumb.style.backgroundImage    = `url(${track.thumb})`;
           pThumb.style.backgroundSize     = "cover";
           pThumb.style.backgroundPosition = "center";
       } else {
           pThumb.textContent = track.emoji;
       }
       player.liked = likedTracks.some(t=>t.originalUrl===track.originalUrl);
       pLike.classList.toggle("liked", player.liked);
       ptimeTot.textContent = "--:--";
       ptimeCur.textContent = "0:00";
       player.progress = 0;
       updatePbar(0, 1);
       highlightTrack(-1);
       player.importedActive = track;
   }
   
   // Timer para faixas Spotify com audio nativo
   function startAudioTimer() {
       clearInterval(player.importedInterval);
       player.importedInterval = setInterval(() => {
           if (!audio.src) return;
           if (audio.duration && !isNaN(audio.duration)) {
               ptimeTot.textContent = fmt(audio.duration);
               updatePbar(audio.currentTime, audio.duration);
           }
           if (audio.ended) {
               if (player.repeat) { audio.currentTime=0; audio.play(); }
               else nextTrack();
           }
       }, 500);
   }
   
   function playImported(track) {
       stopAll();
       loadImportedTrack(track);
   
       if (track.platform === "youtube") {
           const vid = extractYoutubeId(track.originalUrl);
           if (vid && ytIframe) {
               ytIframe.src = `https://www.youtube.com/embed/${vid}?autoplay=1&enablejsapi=1`;
               ytIframe.style.display = "block";
               if (ytWrap) ytWrap.style.width = "320px";
               setPlayingUI(true);
           } else { showToast("Não foi possível extrair o ID do vídeo."); }
   
       } else if (track.platform === "soundcloud") {
           if (scIframe) {
               scIframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(track.originalUrl)}&auto_play=true&hide_related=true&show_comments=false&show_user=false&show_reposts=false&visual=false`;
               setPlayingUI(true);
           }
   
       } else if (track.platform === "spotify") {
           if (track.dlUrl) {
               audio.src     = track.dlUrl;
               audio.volume  = currentVol();
               audio.loop    = player.repeat;
               audio.play()
                   .then(() => { setPlayingUI(true); startAudioTimer(); })
                   .catch(() => { showToast("Não foi possível tocar. Abrindo no Spotify..."); window.open(track.originalUrl,"_blank"); });
           } else {
               showToast("Spotify requer login. Abrindo no Spotify...");
               window.open(track.originalUrl,"_blank");
           }
       }
   }
   
   // ── Player events ─────────────────────────────────
   btnPlay.addEventListener("click", togglePlay);
   btnNext.addEventListener("click", nextTrack);
   btnPrev.addEventListener("click", prevTrack);
   pLike.addEventListener("click", toggleLike);
   heroPlay?.addEventListener("click", () => { loadTrack(0); play(); });
   
   btnShuf.addEventListener("click", () => {
       player.shuffle = !player.shuffle;
       btnShuf.classList.toggle("active", player.shuffle);
   });
   btnRep.addEventListener("click", () => {
       player.repeat = !player.repeat;
       btnRep.classList.toggle("active", player.repeat);
       // Aplica loop ao audio nativo imediatamente se estiver tocando
       if (player.importedActive?.platform === "spotify") audio.loop = player.repeat;
   });
   
   // Seek na barra
   pbar.addEventListener("click", e => {
       const pct = (e.clientX - pbar.getBoundingClientRect().left) / pbar.getBoundingClientRect().width;
       if (player.importedActive?.platform === "spotify" && audio.duration && !isNaN(audio.duration)) {
           audio.currentTime = pct * audio.duration;
           updatePbar(audio.currentTime, audio.duration);
       } else if (!player.importedActive) {
           player.progress = Math.floor(pct * (TRACKS[player.cur]?.sec || 100));
           updatePbar(player.progress, TRACKS[player.cur]?.sec);
       }
       // YT e SC: seek via postMessage é instável; não implementado
   });
   
   // Volume — aplica ao audio nativo; iframes controlam o volume deles
   volSlider.addEventListener("input", e => {
       const pct = parseInt(e.target.value);
       audio.volume = pct / 100;
       volSlider.style.background = `linear-gradient(to right,var(--acc) ${pct}%,var(--bg-h) ${pct}%)`;
   });
   volSlider.dispatchEvent(new Event("input"));
   
   // Cards e tracks locais
   document.querySelectorAll(".card").forEach(el => el.addEventListener("click", () => {
       const i=parseInt(el.dataset.track); if(!isNaN(i)){loadTrack(i);play();}
   }));
   document.querySelectorAll(".card-play").forEach(btn => btn.addEventListener("click", e => {
       e.stopPropagation();
       const i=parseInt(btn.closest(".card").dataset.track); if(!isNaN(i)){loadTrack(i);play();}
   }));
   document.querySelectorAll(".track").forEach(el => el.addEventListener("click", () => {
       const i=parseInt(el.dataset.track); if(!isNaN(i)){loadTrack(i);play();}
   }));
   
   // ══════════════════════════════════════════════════
   //   NAVEGAÇÃO
   // ══════════════════════════════════════════════════
   function showPage(pageId) {
       document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
       const t=$("page-"+pageId);
       if(t){ t.classList.add("active"); t.style.animation="none"; requestAnimationFrame(()=>{t.style.animation="";}); }
       document.querySelectorAll(".nav-item").forEach(li=>li.classList.toggle("active",li.dataset.page===pageId));
   }
   document.querySelectorAll(".nav-item").forEach(item=>item.addEventListener("click",()=>showPage(item.dataset.page)));
   
   // ══════════════════════════════════════════════════
   //   BUSCA
   // ══════════════════════════════════════════════════
   searchInput.addEventListener("input", () => {
       const q=searchInput.value.trim().toLowerCase();
       searchClear.classList.toggle("visible",q.length>0);
       if(!q){searchResults.classList.remove("open");return;}
       const hits=TRACKS.filter(t=>t.name.toLowerCase().includes(q)||t.artist.toLowerCase().includes(q));
       searchResults.innerHTML=hits.length
           ? hits.map(t=>`<div class="sr-item" data-track="${TRACKS.indexOf(t)}"><div class="sr-thumb" style="background:${t.bg}">${t.thumb}</div><div class="sr-info"><div class="sr-name">${t.name}</div><div class="sr-artist">${t.artist}</div></div></div>`).join("")
           : `<div class="sr-none">Nenhum resultado para "<strong>${q}</strong>"</div>`;
       searchResults.querySelectorAll(".sr-item").forEach(el=>el.addEventListener("click",()=>{loadTrack(parseInt(el.dataset.track));play();closeSearch();showPage("home");}));
       searchResults.classList.add("open");
   });
   searchClear.addEventListener("click",closeSearch);
   document.addEventListener("click",e=>{if(!e.target.closest(".search-wrap"))closeSearch();});
   function closeSearch(){searchInput.value="";searchResults.classList.remove("open");searchClear.classList.remove("visible");}
   
   // ══════════════════════════════════════════════════
   //   PLAYLISTS
   // ══════════════════════════════════════════════════
   let selectedEmoji="#", selectedColor=PALETTE[0];
   function renderPlaylists(){
       plList.innerHTML=playlists.map(pl=>`
           <li class="playlist-item" data-id="${pl.id}">
               <div class="playlist-dot" style="--c:${pl.color}"></div>
               <span class="pl-name">${pl.emoji} ${pl.name}</span>
               <button class="pl-opts" data-id="${pl.id}">···</button>
           </li>`).join("");
       plList.querySelectorAll(".pl-opts").forEach(btn=>btn.addEventListener("click",e=>{
           e.stopPropagation();
           if(confirm("Remover playlist?")){playlists=playlists.filter(p=>p.id!==parseInt(btn.dataset.id));renderPlaylists();}
       }));
   }
   addPlBtn.addEventListener("click",()=>{
       plNameIn.value=""; selectedEmoji="🎵"; selectedColor=PALETTE[Math.floor(Math.random()*PALETTE.length)];
       document.querySelectorAll(".emoji-opt").forEach(b=>b.classList.toggle("active",b.dataset.emoji===selectedEmoji));
       openModal("modal-playlist");
   });
   document.querySelectorAll(".emoji-opt").forEach(btn=>btn.addEventListener("click",()=>{
       document.querySelectorAll(".emoji-opt").forEach(b=>b.classList.remove("active"));
       btn.classList.add("active"); selectedEmoji=btn.dataset.emoji;
   }));
   plCreate.addEventListener("click",()=>{
       const name=plNameIn.value.trim();
       if(!name){plNameIn.focus();plNameIn.style.borderColor="#f87171";return;}
       plNameIn.style.borderColor="";
       playlists.push({id:nextPlId++,name,emoji:selectedEmoji,color:selectedColor});
       renderPlaylists(); closeModal("modal-playlist");
   });
   
   // ══════════════════════════════════════════════════
   //   MODAIS
   // ══════════════════════════════════════════════════
   function openModal(id){$(id).classList.add("open");}
   function closeModal(id){$(id).classList.remove("open");}
   document.querySelectorAll(".modal-close,[data-modal]").forEach(btn=>btn.addEventListener("click",()=>closeModal(btn.dataset.modal||btn.closest(".modal-overlay").id)));
   document.querySelectorAll(".modal-overlay").forEach(o=>o.addEventListener("click",e=>{if(e.target===o)closeModal(o.id);}));
   
   // ══════════════════════════════════════════════════
   //   IMPORT
   // ══════════════════════════════════════════════════
   const platformHints={
       youtube:   {icon:"▶",text:"Cole um link do YouTube (ex: youtube.com/watch?v=...)"},
       soundcloud:{icon:"☁",text:"Cole um link do SoundCloud (ex: soundcloud.com/artist/track)"},
       spotify:   {icon:"♫",text:"Cole um link do Spotify (ex: open.spotify.com/track/...)"},
   };
   let currentPreview=null;
   document.querySelectorAll(".ptab").forEach(btn=>btn.addEventListener("click",()=>{
       document.querySelectorAll(".ptab").forEach(b=>b.classList.remove("active")); btn.classList.add("active");
       const h=platformHints[btn.dataset.platform];
       $("hint-icon").textContent=h.icon; $("hint-text").textContent=h.text;
       $("import-url").value=""; hidePreview(); hideError();
   }));
   $("import-paste")?.addEventListener("click",async()=>{try{$("import-url").value=await navigator.clipboard.readText();}catch{}});
   $("import-btn").addEventListener("click",doImport);
   $("import-url").addEventListener("keydown",e=>{if(e.key==="Enter")doImport();});
   
   async function doImport(){
       const url=$("import-url").value.trim();
       if(!url){$("import-url").style.borderColor="#f87171";return;}
       $("import-url").style.borderColor=""; hidePreview(); hideError();
       showLoading("Conectando ao serviço..."); $("import-btn").disabled=true;
       try{
           const statuses=["Buscando informações da faixa...","Analisando metadados...","Carregando capa e título...","Quase lá..."];
           let si=0; const sid=setInterval(()=>{si=(si+1)%statuses.length;const e=$("loading-text");if(e)e.textContent=statuses[si];},2500);
           const result=await fetchTrack(url); clearInterval(sid);
           currentPreview=result; hideLoading(); showPreview(result);
       }catch(err){hideLoading();showError(err.message||"Erro ao buscar a faixa.");}
       finally{$("import-btn").disabled=false;}
   }
   function showLoading(t){const e=$("import-loading"),tx=$("loading-text");if(tx)tx.textContent=t;if(e)e.style.display="flex";}
   function hideLoading(){const e=$("import-loading");if(e)e.style.display="none";}
   function showError(m){const e=$("import-error"),tx=$("error-text");if(tx)tx.textContent=m;if(e)e.style.display="flex";}
   function hideError(){const e=$("import-error");if(e)e.style.display="none";}
   function hidePreview(){const e=$("import-preview");if(e)e.style.display="none";}
   
   function showPreview(track){
       const cover=$("ipb-cover"),fb=$("ipb-cover-fallback"),badge=$("ipb-badge"),
             title=$("ipb-title"),artist=$("ipb-artist"),quality=$("ipb-quality"),dlLink=$("ipb-dl-link");
       if(track.thumb){cover.src=track.thumb;cover.style.display="block";fb.style.display="none";}
       else{cover.style.display="none";fb.style.display="flex";fb.textContent=track.emoji;}
       const bMap={youtube:"yt",soundcloud:"sc",spotify:"sp"},bTxt={youtube:"YT",soundcloud:"SC",spotify:"SP"};
       badge.className=`ipb-badge ${bMap[track.platform]||""}`;badge.textContent=bTxt[track.platform]||track.platform.toUpperCase();
       title.textContent=track.title; artist.textContent=track.artist;
       if(track.platform==="youtube"){quality.textContent="reprodução via YouTube";dlLink.style.display="none";}
       else if(track.platform==="soundcloud"){quality.textContent="reprodução via SoundCloud";dlLink.style.display="none";}
       else if(track.dlUrl){dlLink.href=track.dlUrl;dlLink.style.display="inline-flex";quality.textContent="download disponível";}
       else{dlLink.style.display="none";quality.textContent="abre no Spotify";}
       $("import-preview").style.display="flex";
       $("ipb-play-preview").onclick=()=>playImported(track);
   }
   
   $("preview-add")?.addEventListener("click",()=>{
       if(!currentPreview)return;
       importedTracks.unshift({...currentPreview}); renderImported();
       hidePreview(); $("import-url").value=""; currentPreview=null;
   });
   
   function renderImported(){
       const c=$("imported-tracks"),empty=$("empty-imported"),count=$("imported-count");
       count.textContent=importedTracks.length===1?"1 faixa":`${importedTracks.length} faixas`;
       if(!importedTracks.length){c.innerHTML="";if(empty)empty.style.display="flex";return;}
       if(empty)empty.style.display="none";
       const bMap={youtube:"yt",soundcloud:"sc",spotify:"sp"},bTxt={youtube:"YT",soundcloud:"SC",spotify:"SP"};
       c.innerHTML=importedTracks.map((t,i)=>`
           <div class="imp-track" data-idx="${i}">
               <div class="imp-thumb-wrap">
                   ${t.thumb?`<img src="${t.thumb}" alt="capa" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`:``}
                   <div class="imp-thumb-emoji" style="${t.thumb?"display:none":""}">${t.emoji}</div>
               </div>
               <div class="imp-info"><div class="imp-title">${t.title}</div><div class="imp-artist">${t.artist}</div></div>
               <span class="imp-badge ${bMap[t.platform]||""}">${bTxt[t.platform]||"?"}</span>
               <button class="imp-del" data-idx="${i}" title="Remover">✕</button>
           </div>`).join("");
       c.querySelectorAll(".imp-track").forEach(el=>el.addEventListener("click",e=>{
           if(e.target.classList.contains("imp-del"))return;
           playImported(importedTracks[parseInt(el.dataset.idx)]);
       }));
       c.querySelectorAll(".imp-del").forEach(btn=>btn.addEventListener("click",e=>{
           e.stopPropagation(); importedTracks.splice(parseInt(btn.dataset.idx),1); renderImported();
       }));
   }
   
   // ══════════════════════════════════════════════════
   //   INIT
   // ══════════════════════════════════════════════════
   loadTrack(0);
   renderPlaylists();
   renderImported();
   renderFavorites();
