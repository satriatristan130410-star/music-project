from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from ytmusicapi import YTMusic

app = FastAPI()

# Mengizinkan frontend (HTML) mengakses backend (Python) ini
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

yt = YTMusic()

@app.get("/api/search")
def search(q: str):
    # Mencari lagu berdasarkan kata kunci yang diketik user
    results = yt.search(q, filter="songs")
    
    songs = []
    for res in results:
        songs.append({
            "id": res.get("videoId"),
            "title": res.get("title"),
            "artist": res.get("artists")[0].get("name") if res.get("artists") else "Unknown",
            "album": res.get("album").get("name") if res.get("album") else "Single",
            "thumbnail": res.get("thumbnails")[-1].get("url") if res.get("thumbnails") else ""
        })
    return songs

@app.get("/api/health")
def health():
    return {"status": "ok"}
