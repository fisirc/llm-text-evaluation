"""Self-contained HTML report generation for BenchmarkResult.

Reads static assets from ``framework/assets/``, builds a full data JSON
(including per-sample with logprobs), and produces a single self-contained
HTML file with everything inlined.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .report import BenchmarkResult
    from .types import EvaluatedSample

ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"

TASK_LABELS: dict[str, str] = {
    "reading_comprehension": "Comprensión",
    "sentence_ordering": "Ord. oraciones",
    "sentence_elimination": "Eliminación",
    "verbal_series": "Series verbales",
    "analogies": "Analogías",
    "synonyms_and_antonyms": "Sin./Antón.",
    "incomplete_sentences": "Inc. oraciones",
}

ATTACK_LABELS: dict[str, str] = {
    "arabic_base": "Arabic",
    "chinese_base": "Chinese",
    "french_base": "French",
    "japanese_base": "Japanese",
    "swahili_base": "Swahili",
    "russian_base": "Russian",
    "english_base": "English",
}

METRIC_LABELS: dict[str, str] = {
    "accuracy": "Accuracy",
    "accuracy_drop": "Acc. Drop",
    "flip_rate": "Flip Rate",
    "consistency": "Consistency",
    "positive_transfer": "Pos. Transfer",
    "negative_transfer": "Neg. Transfer",
    "rank_consistency": "Rank Cons.",
}


def build_html(result: "BenchmarkResult") -> str:
    """Generate a self-contained interactive HTML report from a BenchmarkResult.

    Reads CSS and JS from ``framework/assets/``, builds a rich data JSON
    (aggregates + per-sample with logprobs), and inlines everything into
    a single HTML file.  Chart.js is loaded from CDN.
    """
    result._compute_all_robustness()

    # -- Build data structure ----------------------------------------------
    data = _build_data(result)

    # -- Read static assets ------------------------------------------------
    css_path = ASSETS_DIR / "report.css"
    js_path = ASSETS_DIR / "report.js"
    html_path = ASSETS_DIR / "report.html"

    css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""
    js = js_path.read_text(encoding="utf-8") if js_path.exists() else ""
    html_template = html_path.read_text(encoding="utf-8") if html_path.exists() else ""

    # -- Assemble final HTML ------------------------------------------------
    data_json = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    data_script = "window.BENCHMARK_DATA=" + data_json + ";"

    html = html_template
    html = html.replace("/*__CSS__*/", css)
    html = html.replace("/*__JS__*/", js)
    html = html.replace("/*__DATA__*/", data_script)

    return html


# ---------------------------------------------------------------------------
# Data builder
# ---------------------------------------------------------------------------

def _load_per_sample_from_partials(result: "BenchmarkResult") -> dict[str, dict]:
    """Scan partial analysis files and build per_sample data.

    When the BenchmarkResult was reconstructed from partial files (e.g. after
    an interrupted run), ``ds.results`` may be empty.  This function reads
    the saved analysis JSONs directly to recover per-sample predictions and
    logprobs so that the interactive report can still show Confidence,
    Patterns, and Comparison tabs.
    """
    per_sample: dict[str, dict] = {}

    if not result.base_dir:
        return per_sample

    analysis_dir = Path(result.base_dir) / "partial" / "analysis"
    if not analysis_dir.exists():
        return per_sample

    for fpath in sorted(analysis_dir.glob("*.json")):
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError):
            continue

        model_name = data.get("model") or ""
        dataset_file = data.get("dataset_file") or ""

        # Determine attack label from dataset_file
        attack_label = "baseline"
        for mr in result.models:
            for ds in mr.evaluated_datasets:
                if ds.dataset_file == dataset_file:
                    attack_label = ds.attack_label
                    break
            if attack_label != "baseline":
                break

        for item in data.get("results", []):
            try:
                sid = str(item["sample_id"])
                if sid not in per_sample:
                    per_sample[sid] = {
                        "sample_id": item["sample_id"],
                        "task": item["task"],
                        "expected": item["expected"],
                        "models": {},
                    }
                sample = per_sample[sid]
                lp = None
                lp_data = item.get("logprobs")
                if isinstance(lp_data, dict) and "choice_logprobs" in lp_data:
                    lp = {str(k): float(v) for k, v in lp_data["choice_logprobs"].items()}

                sample["models"].setdefault(model_name, {})[attack_label] = {
                    "predicted": item.get("predicted"),
                    "correct": item.get("correct"),
                    "latency_ms": round(item.get("latency_ms", 0), 2),
                    "logprobs": lp,
                }
            except (KeyError, ValueError, TypeError):
                continue

    return per_sample


def _build_data(result: "BenchmarkResult") -> dict:
    """Build the full data structure for JS consumption."""
    models: list[str] = []
    attacks: list[str] = []
    tasks: set[str] = set()

    # -- Collect model/attack/task lists -----------------------------------
    for mr in result.models:
        if mr.model_name not in models:
            models.append(mr.model_name)
        for ds in mr.evaluated_datasets:
            lbl = ds.attack_label
            if lbl != "baseline" and lbl not in attacks:
                attacks.append(lbl)
            for t in ds.metrics.tasks:
                tasks.add(t)

    attacks.sort()

    # -- Build aggregates --------------------------------------------------
    aggregates: dict[str, dict] = {}
    file_map: dict[str, str] = {}  # filename -> attack_label

    for mr in result.models:
        aggregates[mr.model_name] = {}
        for ds in mr.evaluated_datasets:
            lbl = ds.attack_label
            file_map[ds.dataset_file] = lbl
            entry: dict = {
                "file": ds.dataset_file,
                "metrics": ds.metrics.to_dict(),
                "robustness": ds._robustness.to_dict() if ds._robustness else None,
                "robustness_per_task": (
                    {t: rm.to_dict() for t, rm in ds._per_task_robustness.items()}
                    if ds._per_task_robustness else None
                ),
                "pairwise_robustness": (
                    {f: rm.to_dict() for f, rm in ds._pairwise_robustness.items()}
                    if ds._pairwise_robustness else None
                ),
            }
            aggregates[mr.model_name][lbl] = entry

    # -- Build per_sample --------------------------------------------------
    per_sample: dict[str, dict] = {}

    # First try from BenchmarkResult.results (in-memory)
    for mr in result.models:
        for ds in mr.evaluated_datasets:
            lbl = ds.attack_label
            for r in ds.results:
                sid = str(r.sample_id)
                if sid not in per_sample:
                    per_sample[sid] = {
                        "sample_id": r.sample_id,
                        "task": r.task.value,
                        "expected": r.expected,
                        "models": {},
                    }
                sample = per_sample[sid]
                sample["models"].setdefault(mr.model_name, {})[lbl] = {
                    "predicted": r.predicted,
                    "correct": r.correct,
                    "latency_ms": round(r.latency_ms, 2),
                    "logprobs": (
                        {str(k): v for k, v in r.logprobs.choice_logprobs.items()}
                        if r.logprobs and r.logprobs.choice_logprobs
                        else None
                    ),
                }

    # If per_sample is empty, load from partial files on disk
    if not per_sample:
        per_sample = _load_per_sample_from_partials(result)

    # -- Build attack labels (merge defaults with runtime labels) ----------
    attack_labels = dict(ATTACK_LABELS)
    for mr in result.models:
        for ds in mr.evaluated_datasets:
            if ds.attack is not None:
                lbl = ds.attack.label or ds.attack.attack_name
                if lbl not in attack_labels:
                    attack_labels[lbl] = lbl.replace("_", " ").title()

    return {
        "info": {
            "started_at": result.started_at,
            "finished_at": result.finished_at,
            "is_finished": result.is_finished,
            "baseline": result.baseline_file,
            "total_samples": max(
                (ds.metrics.total for mr in result.models for ds in mr.evaluated_datasets),
                default=0
            ),
        },
        "models": models,
        "attacks": attacks,
        "tasks": sorted(tasks),
        "task_labels": TASK_LABELS,
        "attack_labels": attack_labels,
        "metric_labels": METRIC_LABELS,
        "file_map": file_map,
        "aggregates": aggregates,
        "per_sample": per_sample,
    }