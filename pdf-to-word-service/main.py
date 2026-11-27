import asyncio
import gc
import logging
import os
import tempfile
import uuid
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pdf2docx import Converter
from starlette.concurrency import run_in_threadpool

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pdf-to-word-service")

MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB
CHUNK_SIZE = 64 * 1024  # 64 KB
TMP_DIR = Path(os.getenv("TMP_DIR", tempfile.gettempdir()))
DOCX_MIME = (
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)

# Limit concurrent conversions to 1 for Koyeb Free Tier (512 MB RAM, 0.1 vCPU)
convert_semaphore = asyncio.Semaphore(1)

app = FastAPI(
    title="PDFAlat - PDF to Word Microservice",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
)


def _parse_allowed_origins() -> list[str]:
    raw = os.getenv("ALLOWED_ORIGINS", "*").strip()
    if not raw or raw == "*":
        return ["*"]
    return [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]


allowed_origins = _parse_allowed_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


def _cleanup_temp_files(*paths: Path) -> None:
    for path in paths:
        try:
            if path.exists():
                path.unlink()
        except OSError as exc:
            logger.warning("Gagal menghapus file sementara %s: %s", path, exc)
    gc.collect()


def _convert_pdf_to_docx_sync(pdf_path: Path, docx_path: Path) -> None:
    converter: Converter | None = None
    try:
        converter = Converter(str(pdf_path))
        converter.convert(str(docx_path), start=0, end=None)
    finally:
        if converter is not None:
            try:
                converter.close()
            except Exception as exc:
                logger.warning("Gagal menutup Converter: %s", exc)
        gc.collect()


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/convert")
async def convert_pdf_to_word(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
) -> FileResponse:
    original_name = (file.filename or "dokumen.pdf").strip()
    if not original_name.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Format file tidak didukung. Unggah file dengan ekstensi .pdf.",
        )

    allowed_mimes = {
        "application/pdf",
        "application/x-pdf",
        "application/octet-stream",
        "",
    }
    content_type = (file.content_type or "").lower().split(";")[0].strip()
    if content_type not in allowed_mimes:
        raise HTTPException(
            status_code=400,
            detail="Tipe MIME file tidak valid. Hanya file PDF yang diterima.",
        )

    TMP_DIR.mkdir(parents=True, exist_ok=True)
    job_id = uuid.uuid4().hex
    pdf_path = TMP_DIR / f"{job_id}.pdf"
    docx_path = TMP_DIR / f"{job_id}.docx"

    total_bytes = 0
    first_chunk = b""

    try:
        with pdf_path.open("wb") as out_file:
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                if total_bytes == 0:
                    first_chunk = chunk[:5]
                total_bytes += len(chunk)
                if total_bytes > MAX_FILE_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail="Ukuran file melebihi batas maksimal 10 MB.",
                    )
                out_file.write(chunk)

        if total_bytes == 0 or not first_chunk.startswith(b"%PDF-"):
            raise HTTPException(
                status_code=400,
                detail="File PDF kosong atau rusak.",
            )

        async with convert_semaphore:
            await run_in_threadpool(_convert_pdf_to_docx_sync, pdf_path, docx_path)

        if not docx_path.exists() or docx_path.stat().st_size == 0:
            raise HTTPException(
                status_code=500,
                detail="Gagal menghasilkan file Word dari PDF ini.",
            )

        base_stem = Path(original_name).stem or "dokumen"
        safe_stem = "".join(
            ch if ch.isalnum() or ch in ("-", "_", " ") else "_" for ch in base_stem
        ).strip() or "dokumen"
        download_filename = f"{safe_stem}.docx"

        background_tasks.add_task(_cleanup_temp_files, pdf_path, docx_path)

        return FileResponse(
            path=str(docx_path),
            media_type=DOCX_MIME,
            filename=download_filename,
            background=background_tasks,
        )
    except HTTPException:
        _cleanup_temp_files(pdf_path, docx_path)
        raise
    except Exception as exc:
        _cleanup_temp_files(pdf_path, docx_path)
        msg = str(exc).lower()
        if "password" in msg or "encrypted" in msg:
            raise HTTPException(
                status_code=400,
                detail="File PDF ini dilindungi kata sandi dan tidak dapat diproses.",
            ) from exc
        logger.exception("Kesalahan saat mengonversi PDF ke Word")
        raise HTTPException(
            status_code=500,
            detail="Terjadi kesalahan saat mengonversi dokumen PDF ke Word.",
        ) from exc
    finally:
        await file.close()
