import os
import shutil
import tempfile

import whisper
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Whisper Transcription Service")

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

MODEL_SIZE = os.getenv("WHISPER_MODEL", "base")
print(f"[whisper-service] Loading model '{MODEL_SIZE}'...")
model = whisper.load_model(MODEL_SIZE)
print(f"[whisper-service] Model ready.")

ALLOWED_EXTENSIONS = {".webm", ".mp4", ".mp3", ".ogg", ".wav", ".m4a"}


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_SIZE}


@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    filename = audio.filename or "recording"
    ext = os.path.splitext(filename)[1].lower() or ".webm"

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail=f"Unsupported format: {ext}")

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        shutil.copyfileobj(audio.file, tmp)
        tmp_path = tmp.name

    try:
        result = model.transcribe(tmp_path, fp16=False)
        text = result["text"].strip()
        return {"text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.unlink(tmp_path)
