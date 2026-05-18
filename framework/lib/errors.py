"""Structured error logging for debugging purposes.

Writes one JSON file per benchmark session under ``{partial_dir}/errors/``
containing an array of error records accumulated over the session.  This does
NOT change error-handling behaviour — it is purely observational.
"""

from __future__ import annotations

import json
import os
import tempfile
import traceback
from datetime import datetime, timezone
from pathlib import Path


def log_error(
    partial_dir: str | Path,
    session_id: str,
    /,
    *,
    phase: str,
    error_type: str,
    provider: str = "",
    model: str = "",
    dataset: str = "",
    batch_id: int | None = None,
    sample_ids: list[int] | None = None,
    attempt: int | None = None,
    max_attempts: int | None = None,
    exception: BaseException | None = None,
    **extra: object,
) -> None:
    """Append an error record to the session error file.

    The file is ``{partial_dir}/errors/{session_id}.json`` and contains a JSON
    array of error records.  Each call reads the existing file, appends the new
    record, and writes atomically.

    Args:
        partial_dir: Root directory for partial files.
        session_id: Unique benchmark session identifier (e.g. the ISO timestamp
            from ``started_at``).
        phase: Pipeline phase (``"perturbation"``, ``"evaluation"``).
        error_type: ``"api_error"``, ``"batch_exhausted"``,
            ``"model_aborted"``, ``"translation_failed"``.
        provider: Provider name.
        model: Model identifier string.
        dataset: Dataset filename.
        batch_id: Batch index.
        sample_ids: Sample IDs in the failing batch.
        attempt: 1-based attempt number.
        max_attempts: Total number of attempts allowed.
        exception: The caught exception (optional).
        **extra: Additional key-value pairs to include in the record.
    """
    errors_dir = Path(partial_dir) / "errors"
    os.makedirs(errors_dir, exist_ok=True)

    fpath = errors_dir / f"{session_id}.json"

    record: dict[str, object] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "phase": phase,
        "error_type": error_type,
    }
    if provider:
        record["provider"] = provider
    if model:
        record["model"] = model
    if dataset:
        record["dataset"] = dataset
    if batch_id is not None:
        record["batch_id"] = batch_id
    if sample_ids is not None:
        record["sample_ids"] = sample_ids
    if attempt is not None:
        record["attempt"] = attempt
    if max_attempts is not None:
        record["max_attempts"] = max_attempts
    if exception is not None:
        record["exception_type"] = type(exception).__name__
        record["exception_message"] = str(exception)
        record["traceback"] = traceback.format_exc()
    if extra:
        record.update(extra)

    # Read existing records or start fresh
    existing: list[object] = []
    if fpath.exists():
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                existing = data
        except (json.JSONDecodeError, OSError):
            pass

    existing.append(record)

    # Atomic write
    fd, tmp_path = tempfile.mkstemp(
        dir=errors_dir, prefix=".errors_", suffix=".tmp"
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(existing, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, fpath)
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise
