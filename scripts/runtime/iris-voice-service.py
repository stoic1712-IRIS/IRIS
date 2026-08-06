#!/usr/bin/env python3
"""Loopback-only neural voice service for the Founder Command Center.

Audio is processed in memory and is never retained. The Node gateway is the only
intended caller and remains responsible for the authenticated browser boundary.
"""

from __future__ import annotations

import argparse
import io
import os
import re
import threading
from contextlib import asynccontextmanager
from dataclasses import dataclass

import espeakng_loader
import numpy as np
import soundfile as sf
import torch
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from faster_whisper import WhisperModel
from kokoro import KPipeline
from phonemizer.backend.espeak.wrapper import EspeakWrapper
from pydantic import BaseModel, ConfigDict, Field
from silero_vad import get_speech_timestamps, load_silero_vad

HOST = "127.0.0.1"
DEFAULT_PORT = 8765
SAMPLE_RATE = 24_000
TRANSCRIPTION_SAMPLE_RATE = 16_000
MAX_AUDIO_BYTES = 8 * 1024 * 1024
MAX_TEXT_CHARACTERS = 6_000
KOKORO_REPOSITORY = "hexgrad/Kokoro-82M"
KOKORO_VOICE = "af_heart"
WHISPER_MODEL = "base.en"

EspeakWrapper.set_library(espeakng_loader.get_library_path())
os.environ["ESPEAK_DATA_PATH"] = espeakng_loader.get_data_path()


class TtsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1, max_length=MAX_TEXT_CHARACTERS)
    speed: float = Field(default=1.03, ge=0.85, le=1.15)


@dataclass
class Runtime:
    tts: KPipeline
    stt: WhisperModel
    vad: object
    tts_lock: threading.Lock
    stt_lock: threading.Lock


runtime: Runtime | None = None


def _clean_spoken_text(value: str) -> str:
    value = re.sub(r"https?://\S+", "the linked source", value)
    value = re.sub(r"[`*_#>|]", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def _mono_16khz(audio: np.ndarray, sample_rate: int) -> np.ndarray:
    if audio.ndim > 1:
        audio = np.mean(audio, axis=1)
    audio = audio.astype(np.float32, copy=False)
    if sample_rate == TRANSCRIPTION_SAMPLE_RATE:
        return audio
    if sample_rate <= 0 or audio.size == 0:
        raise ValueError("INVALID_AUDIO")
    length = max(1, round(audio.size * TRANSCRIPTION_SAMPLE_RATE / sample_rate))
    source = np.linspace(0.0, 1.0, num=audio.size, endpoint=False)
    target = np.linspace(0.0, 1.0, num=length, endpoint=False)
    return np.interp(target, source, audio).astype(np.float32)


def _require_runtime() -> Runtime:
    if runtime is None:
        raise HTTPException(status_code=503, detail="VOICE_RUNTIME_UNAVAILABLE")
    return runtime


@asynccontextmanager
async def lifespan(_: FastAPI):
    global runtime
    torch.set_num_threads(max(1, min(6, os.cpu_count() or 1)))
    runtime = Runtime(
        tts=KPipeline(lang_code="a", repo_id=KOKORO_REPOSITORY),
        stt=WhisperModel(
            WHISPER_MODEL,
            device="cpu",
            compute_type="int8",
            cpu_threads=max(1, min(6, os.cpu_count() or 1)),
        ),
        vad=load_silero_vad(onnx=True),
        tts_lock=threading.Lock(),
        stt_lock=threading.Lock(),
    )
    yield
    runtime = None


app = FastAPI(
    title="IRIS local neural voice",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)


@app.middleware("http")
async def local_only(request: Request, call_next):
    peer = request.client.host if request.client else ""
    if peer not in {"127.0.0.1", "::1"}:
        return JSONResponse(status_code=404, content={"error": "unavailable"})
    response = await call_next(request)
    response.headers["cache-control"] = "no-store"
    response.headers["x-content-type-options"] = "nosniff"
    return response


@app.get("/health")
def health() -> dict[str, object]:
    ready = runtime is not None
    return {
        "status": "ready" if ready else "starting",
        "tts": "Kokoro-82M",
        "voice": KOKORO_VOICE,
        "stt": WHISPER_MODEL,
        "vad": "silero-vad-onnx",
        "retention": "none",
    }


@app.post("/v1/tts")
def synthesize(candidate: TtsRequest) -> Response:
    active = _require_runtime()
    text = _clean_spoken_text(candidate.text)
    if not text:
        raise HTTPException(status_code=422, detail="EMPTY_SPOKEN_TEXT")
    with active.tts_lock:
        chunks = list(
            active.tts(text, voice=KOKORO_VOICE, speed=candidate.speed)
        )
    if not chunks:
        raise HTTPException(status_code=503, detail="TTS_EMPTY")
    audio = np.concatenate([np.asarray(chunk.audio, dtype=np.float32) for chunk in chunks])
    output = io.BytesIO()
    sf.write(output, audio, SAMPLE_RATE, format="WAV", subtype="PCM_16")
    payload = output.getvalue()
    return Response(
        payload,
        media_type="audio/wav",
        headers={
            "content-length": str(len(payload)),
            "x-iris-voice": KOKORO_VOICE,
            "x-iris-retention": "none",
        },
    )


@app.post("/v1/transcribe")
async def transcribe(request: Request) -> dict[str, object]:
    active = _require_runtime()
    if request.headers.get("content-type", "").split(";", 1)[0] != "audio/wav":
        raise HTTPException(status_code=415, detail="WAV_REQUIRED")
    payload = await request.body()
    if not payload or len(payload) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="AUDIO_SIZE_INVALID")
    try:
        audio, sample_rate = sf.read(io.BytesIO(payload), dtype="float32")
        mono = _mono_16khz(np.asarray(audio), int(sample_rate))
    except Exception as error:
        raise HTTPException(status_code=422, detail="AUDIO_INVALID") from error
    timestamps = get_speech_timestamps(
        torch.from_numpy(mono),
        active.vad,
        sampling_rate=TRANSCRIPTION_SAMPLE_RATE,
        threshold=0.5,
        min_speech_duration_ms=180,
        min_silence_duration_ms=300,
    )
    if not timestamps:
        raise HTTPException(status_code=422, detail="NO_SPEECH")
    with active.stt_lock:
        segments, info = active.stt.transcribe(
            io.BytesIO(payload),
            language="en",
            beam_size=1,
            best_of=1,
            condition_on_previous_text=False,
            vad_filter=False,
        )
        text = " ".join(segment.text.strip() for segment in segments).strip()
    if not text:
        raise HTTPException(status_code=422, detail="NO_TRANSCRIPT")
    return {
        "text": text[:MAX_TEXT_CHARACTERS],
        "language": info.language,
        "speechSegments": len(timestamps),
        "retention": "none",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default=HOST, choices=[HOST])
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    arguments = parser.parse_args()
    import uvicorn

    uvicorn.run(
        app,
        host=arguments.host,
        port=arguments.port,
        access_log=False,
        log_level="warning",
    )


if __name__ == "__main__":
    main()
