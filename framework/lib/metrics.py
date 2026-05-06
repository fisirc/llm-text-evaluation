"""Metrics computation for accuracy, robustness, and comparative analysis."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

from .types import EvaluatedSample, TaskType


@dataclass
class DatasetMetrics:
    """Aggregated accuracy metrics for a single dataset evaluation.

    Attributes:
        total: Total number of samples evaluated.
        correct: Number of correctly predicted samples.
        failed: Number of samples where parsing failed (predicted is None).
        accuracy: Overall accuracy (correct / total).
        accuracy_by_task: Accuracy broken down by task type.
        avg_latency_ms: Average prediction latency in milliseconds.
        total_time_s: Total wall-clock evaluation time in seconds.
    """

    total: int
    correct: int
    failed: int
    accuracy: float
    accuracy_by_task: dict[str, float]
    avg_latency_ms: float
    total_time_s: float

    def to_dict(self) -> dict:
        return {
            "total": self.total,
            "correct": self.correct,
            "failed": self.failed,
            "accuracy": round(self.accuracy, 4),
            "accuracy_by_task": {
                k: round(v, 4) for k, v in self.accuracy_by_task.items()
            },
            "avg_latency_ms": round(self.avg_latency_ms, 2),
            "total_time_s": round(self.total_time_s, 2),
        }


@dataclass
class RobustnessMetrics:
    """Comparative robustness metrics between baseline and attacked results.

    Attributes:
        accuracy_drop: Accuracy_baseline - Accuracy_attacked (positive = worse).
        flip_rate: Fraction of baseline-correct samples that became incorrect.
        consistency: Fraction of samples where the prediction didn't change.
    """

    accuracy_drop: float
    flip_rate: float
    consistency: float

    def to_dict(self) -> dict:
        return {
            "accuracy_drop": round(self.accuracy_drop, 4),
            "flip_rate": round(self.flip_rate, 4),
            "consistency": round(self.consistency, 4),
        }


def compute_accuracy(results: list[EvaluatedSample]) -> DatasetMetrics:
    """Compute accuracy metrics from a list of evaluated samples.

    Args:
        results: List of EvaluatedSample objects from a single dataset run.

    Returns:
        DatasetMetrics with overall and per-task accuracy.
    """
    if not results:
        return DatasetMetrics(
            total=0,
            correct=0,
            failed=0,
            accuracy=0.0,
            accuracy_by_task={},
            avg_latency_ms=0.0,
            total_time_s=0.0,
        )

    total = len(results)
    correct = sum(1 for r in results if r.correct)
    failed = sum(1 for r in results if r.predicted is None)

    # Per-task accuracy
    task_correct: dict[str, int] = defaultdict(int)
    task_total: dict[str, int] = defaultdict(int)
    for r in results:
        task_total[r.task.value] += 1
        if r.correct:
            task_correct[r.task.value] += 1

    accuracy_by_task = {
        task: task_correct[task] / task_total[task] if task_total[task] > 0 else 0.0
        for task in task_total
    }

    # Timing
    latencies = [r.latency_ms for r in results if r.latency_ms > 0]
    avg_latency = sum(latencies) / len(latencies) if latencies else 0.0
    total_time = sum(latencies) / 1000.0 if latencies else 0.0

    return DatasetMetrics(
        total=total,
        correct=correct,
        failed=failed,
        accuracy=correct / total if total > 0 else 0.0,
        accuracy_by_task=accuracy_by_task,
        avg_latency_ms=avg_latency,
        total_time_s=total_time,
    )


def compute_robustness(
    baseline_results: list[EvaluatedSample],
    attacked_results: list[EvaluatedSample],
) -> RobustnessMetrics:
    """Compute robustness metrics comparing baseline vs. attacked results.

    Matches samples by their sample_id. Requires that both lists contain
    results for the same set of sample IDs.

    Args:
        baseline_results: Results from the baseline (unperturbed) dataset.
        attacked_results: Results from the attacked (perturbed) dataset.

    Returns:
        RobustnessMetrics with accuracy drop, flip rate, and consistency.
    """
    baseline_map = {r.sample_id: r for r in baseline_results}
    attacked_map = {r.sample_id: r for r in attacked_results}

    common_ids = set(baseline_map) & set(attacked_map)

    if not common_ids:
        return RobustnessMetrics(
            accuracy_drop=0.0,
            flip_rate=0.0,
            consistency=0.0,
        )

    # Accuracy drop
    baseline_correct = sum(
        1 for sid in common_ids if baseline_map[sid].correct
    )
    attacked_correct = sum(
        1 for sid in common_ids if attacked_map[sid].correct
    )
    n = len(common_ids)

    baseline_acc = baseline_correct / n
    attacked_acc = attacked_correct / n
    accuracy_drop = baseline_acc - attacked_acc

    # Flip rate: baseline correct → attacked incorrect
    flips = sum(
        1
        for sid in common_ids
        if baseline_map[sid].correct and not attacked_map[sid].correct
    )
    flip_rate = flips / baseline_correct if baseline_correct > 0 else 0.0

    # Consistency: same prediction regardless of correctness
    consistent = sum(
        1
        for sid in common_ids
        if baseline_map[sid].predicted == attacked_map[sid].predicted
    )
    consistency = consistent / n

    return RobustnessMetrics(
        accuracy_drop=accuracy_drop,
        flip_rate=flip_rate,
        consistency=consistency,
    )
