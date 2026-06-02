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

    for mr in result.models:
        aggregates[mr.model_name] = {}
        for ds in mr.evaluated_datasets:
            lbl = ds.attack_label
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
        "aggregates": aggregates,
        "per_sample": per_sample,
    }
