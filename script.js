// --- 0. REGISTER PWA & CUSTOM INSTALL BUTTON ---
let deferredPrompt;
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => console.log('PWA gagal terdaftar:', err));
    });
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); 
    deferredPrompt = e;
    const installBtn = document.getElementById('installAppBtn');
    if(installBtn) {
        installBtn.style.display = 'flex'; 
        installBtn.addEventListener('click', async () => {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if(outcome === 'accepted') {
                installBtn.style.display = 'none'; 
            }
            deferredPrompt = null;
        });
    }
});

// --- 1. INDEXEDDB SETUP (SannMusicDB) ---
let db;
const request = indexedDB.open("SannMusicDB", 1);
request.onupgradeneeded = function(e) {
    db = e.target.result;
    if(!db.objectStoreNames.contains('playlists')) db.createObjectStore('playlists', { keyPath: 'id' });
    if(!db.objectStoreNames.contains('liked_songs')) db.createObjectStore('liked_songs', { keyPath: 'videoId' });
};
request.onsuccess = function(e) { db = e.target.result; renderLibraryUI(); };

// --- 2. PLAYER LOGIC (MENGGUNAKAN AUDIO ELEMENT) ---
let isPlaying = false;
let currentTrack = null;
const audio = new Audio();

// Update Media Session (Control di Notifikasi HP)
function updateMediaSession() {
    if ('mediaSession' in navigator && currentTrack) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: currentTrack.title,
            artist: currentTrack.artist,
            artwork: [{ src: currentTrack.img, sizes: '512x512', type: 'image/png' }]
        });
        navigator.mediaSession.setActionHandler('play', () => togglePlay());
        navigator.mediaSession.setActionHandler('pause', () => togglePlay());
        navigator.mediaSession.setActionHandler('nexttrack', () => playNextSimilarSong());
    }
}

async function playNextSimilarSong() {
    if (!currentTrack) return;
    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(currentTrack.artist + " song")}`);
        const result = await response.json();
        if (result.length > 0) {
            const nextTrack = result[Math.floor(Math.random() * result.length)];
            playMusic(nextTrack.id, encodeURIComponent(JSON.stringify({videoId: nextTrack.id, title: nextTrack.title, artist: nextTrack.artist, img: nextTrack.thumbnail})));
        }
    } catch (error) {}
}

function playMusic(videoId, encodedTrackData) {
    const track = JSON.parse(decodeURIComponent(encodedTrackData));
    currentTrack = track;
    currentTrack.videoId = videoId; // Pastikan videoId tersimpan

    // UI Updates
    document.getElementById('miniPlayer').style.display = 'flex';
    document.getElementById('miniPlayerImg').src = track.img;
    document.getElementById('miniPlayerTitle').innerText = track.title;
    document.getElementById('miniPlayerArtist').innerText = track.artist;
    document.getElementById('playerArt').src = track.img;
    document.getElementById('playerTitle').innerText = track.title;
    document.getElementById('playerArtist').innerText = track.artist;
    
    // Play Logic (Menggunakan Proxy Audio)
    audio.src = `https://musicapi.x007.workers.dev/fetch?id=${videoId}`;
    audio.play();
    isPlaying = true;
    updateMediaSession();
    updatePlayIcons();
    checkIfLiked(videoId);
}

function togglePlay() {
    if (!audio.src) return;
    if (isPlaying) {
        audio.pause();
    } else {
        audio.play();
    }
    isPlaying = !isPlaying;
    updatePlayIcons();
}

function updatePlayIcons() {
    const playIconPath = "M8 5v14l11-7z";
    const pauseIconPath = "M6 19h4V5H6v14zm8-14v14h4V5h-4z";
    const path = isPlaying ? pauseIconPath : playIconPath;
    document.getElementById('mainPlayBtn').innerHTML = `<path d="${path}"></path>`;
    document.getElementById('miniPlayBtn').innerHTML = `<path d="${path}"></path>`;
}

// --- 3. SEARCH & RENDER ---
async function fetchAndRender(query, containerId, formatType, isArtist = false) {
    const container = document.getElementById(containerId);
    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const result = await response.json();
        
        let html = '';
        result.slice(0, 8).forEach(t => {
            const track = { videoId: t.id, title: t.title, artist: t.artist, img: t.thumbnail };
            html += formatType === 'list' ? createListHTML(track) : createCardHTML(track, isArtist);
        });
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = '<p>Gagal memuat data.</p>';
    }
}

function createListHTML(track) {
    const trackData = encodeURIComponent(JSON.stringify(track));
    return `
        <div class="v-item" onclick="playMusic('${track.videoId}', '${trackData}')">
            <img src="${track.img}" class="v-img">
            <div class="v-info">
                <div class="v-title">${track.title}</div>
                <div class="v-sub">${track.artist}</div>
            </div>
        </div>
    `;
}

function createCardHTML(track, isArtist = false) {
    const trackData = encodeURIComponent(JSON.stringify(track));
    const clickAction = isArtist ? `openArtistView('${track.title}')` : `playMusic('${track.videoId}', '${trackData}')`;
    return `
        <div class="h-card" onclick="${clickAction}">
            <img src="${track.img}" class="h-img ${isArtist ? 'artist-img' : ''}">
            <div class="h-title">${track.title}</div>
            <div class="h-sub">${isArtist ? 'Artis' : track.artist}</div>
        </div>
    `;
}

// Search Input Logic
let searchTimeout;
document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    if (!query) return;

    searchTimeout = setTimeout(() => {
        fetchAndRender(query, 'searchResults', 'list');
    }, 800);
});

// --- 4. LIBRARY & UTILS ---
function toggleLike() {
    if(!currentTrack) return;
    const tx = db.transaction("liked_songs", "readwrite");
    const store = tx.objectStore("liked_songs");
    const getReq = store.get(currentTrack.videoId);
    getReq.onsuccess = () => {
        if(getReq.result) {
            store.delete(currentTrack.videoId);
            showToast("Dihapus dari favorit");
        } else {
            store.put(currentTrack);
            showToast("Ditambahkan ke favorit");
        }
        checkIfLiked(currentTrack.videoId);
        renderLibraryUI();
    };
}

function checkIfLiked(videoId) {
    const tx = db.transaction("liked_songs", "readonly");
    const req = tx.objectStore("liked_songs").get(videoId);
    req.onsuccess = () => {
        const btn = document.getElementById('btnLikeSong');
        btn.style.fill = req.result ? '#1ed760' : 'white';
    };
}

function showToast(msg) {
    const t = document.getElementById('customToast');
    t.innerText = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

// Navigasi View
function switchView(view) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + view).classList.add('active');
}

function expandPlayer() { document.getElementById('playerModal').style.display = 'flex'; }
function minimizePlayer() { document.getElementById('playerModal').style.display = 'none'; }

window.onload = () => {
    fetchAndRender('lagu hits indonesia', 'recentList', 'list');
    fetchAndRender('pop indonesia terbaru', 'rowAnyar', 'card');
    fetchAndRender('artis pop populer', 'rowArtists', 'card', true);
};
