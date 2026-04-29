// --- 0. KONFIGURASI GLOBAL ---
let isPlaying = false;
let currentTrack = null;
const audio = new Audio();
let db;

// --- 1. INDEXEDDB SETUP ---
const request = indexedDB.open("SannMusicDB", 1);
request.onupgradeneeded = function(e) {
    db = e.target.result;
    if(!db.objectStoreNames.contains('playlists')) db.createObjectStore('playlists', { keyPath: 'id' });
    if(!db.objectStoreNames.contains('liked_songs')) db.createObjectStore('liked_songs', { keyPath: 'videoId' });
};
request.onsuccess = function(e) { 
    db = e.target.result; 
    console.log("Database Ready");
    if(typeof renderLibraryUI === "function") renderLibraryUI(); 
};

// --- 2. FUNGSI PLAY MUSIK ---
function playMusic(videoId, encodedTrackData) {
    try {
        const track = JSON.parse(decodeURIComponent(encodedTrackData));
        currentTrack = track;
        currentTrack.videoId = videoId;

        // Update UI (Gunakan pengecekan agar tidak error jika ID tidak ada)
        const elements = {
            'miniPlayer': 'flex',
            'miniPlayerTitle': track.title,
            'miniPlayerArtist': track.artist,
            'miniPlayerImg': track.img,
            'playerArt': track.img,
            'playerTitle': track.title,
            'playerArtist': track.artist
        };

        for (let id in elements) {
            let el = document.getElementById(id);
            if (el) {
                if (id === 'miniPlayer') el.style.display = elements[id];
                else if (el.tagName === 'IMG') el.src = elements[id];
                else el.innerText = elements[id];
            }
        }

        // Putar Musik lewat Proxy (Agar tidak kena blokir)
        audio.src = `https://musicapi.x007.workers.dev/fetch?id=${videoId}`;
        audio.play().then(() => {
            isPlaying = true;
            updatePlayIcons();
            updateMediaSession();
        }).catch(err => {
            console.error("Audio Play Error:", err);
            alert("Gagal memutar audio. Coba lagu lain.");
        });

        checkIfLiked(videoId);
    } catch (e) {
        console.error("Error in playMusic:", e);
    }
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
    
    ['mainPlayBtn', 'miniPlayBtn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:24px;fill:white"><path d="${path}"></path></svg>`;
    });
}

// --- 3. SEARCH & RENDER ---
async function fetchAndRender(query, containerId, formatType, isArtist = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const result = await response.json();
        
        if (!Array.isArray(result)) throw new Error("Data bukan array");

        let html = '';
        result.slice(0, 8).forEach(t => {
            const track = { videoId: t.id, title: t.title, artist: t.artist, img: t.thumbnail };
            html += formatType === 'list' ? createListHTML(track) : createCardHTML(track, isArtist);
        });
        container.innerHTML = html;
    } catch (error) {
        console.error("Fetch Error:", error);
        container.innerHTML = '<p style="color:gray;text-align:center">Gagal memuat data.</p>';
    }
}

function createListHTML(track) {
    const trackData = encodeURIComponent(JSON.stringify(track));
    return `
        <div class="v-item" onclick="playMusic('${track.videoId}', '${trackData}')" style="display:flex;align-items:center;margin-bottom:10px;cursor:pointer">
            <img src="${track.img}" style="width:50px;height:50px;border-radius:4px;margin-right:12px">
            <div class="v-info">
                <div style="font-weight:bold;color:white">${track.title}</div>
                <div style="color:gray;font-size:12px">${track.artist}</div>
            </div>
        </div>
    `;
}

function createCardHTML(track, isArtist = false) {
    const trackData = encodeURIComponent(JSON.stringify(track));
    const clickAction = isArtist ? `openArtistView('${track.title}')` : `playMusic('${track.videoId}', '${trackData}')`;
    return `
        <div class="h-card" onclick="${clickAction}" style="display:inline-block;width:140px;margin-right:15px;cursor:pointer">
            <img src="${track.img}" style="width:140px;height:140px;border-radius:${isArtist ? '50%' : '8px'}">
            <div style="color:white;margin-top:8px;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${track.title}</div>
            <div style="color:gray;font-size:12px">${isArtist ? 'Artis' : track.artist}</div>
        </div>
    `;
}

// --- 4. EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query.length > 2) {
                clearTimeout(window.searchTimer);
                window.searchTimer = setTimeout(() => {
                    fetchAndRender(query, 'searchResults', 'list');
                }, 500);
            }
        });
    }

    // Load Data Awal
    fetchAndRender('lagu hits indonesia', 'recentList', 'list');
    fetchAndRender('pop indonesia terbaru', 'rowAnyar', 'card');
    fetchAndRender('artis populer indonesia', 'rowArtists', 'card', true);
});

// Fungsi tambahan agar tidak error saat dipanggil di HTML
function expandPlayer() { 
    const el = document.getElementById('playerModal');
    if (el) el.style.display = 'flex'; 
}
function minimizePlayer() { 
    const el = document.getElementById('playerModal');
    if (el) el.style.display = 'none'; 
}
function showToast(msg) {
    console.log("Toast:", msg);
}
