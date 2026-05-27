"""Benchmark orchestration: the main entry point for running evaluations.

Coordinates dataset loading, model evaluation, partial results,
and metric computation across all (model, dataset) combinations.
"""

from __future__ import annotations

import asyncio
import json
import logging
import random
import time
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from .attacks import AttackType
from .dataset import Dataset, load_dataset
from .errors import log_error
from .partial import load_partial_results, save_partial_results
from .perturb import generate_perturbed_dataset
from .prompt import build_messages, parse_batch_response, parse_single_response
from .providers.base import BaseProvider
from .report import BenchmarkResult, DatasetResult, ModelResult
from .types import EvaluatedSample, ChoiceLogprobs, TaskType

logger = logging.getLogger("llm_verbal_framework")

# Reduce verbosity of HTTP-level libraries
logging.getLogger("httpcore").setLevel(logging.INFO)
logging.getLogger("anthropic").setLevel(logging.INFO)


@dataclass
class _RetryState:
    """In-memory retry and error tracking for a single model session.

    Tracked per (dataset_filename, sample_id).  Errors are counted per
    failed *batch attempt* (not per sample), so a batch of 3 failing once
    adds 1 to ``total_errors``.

    After ``retry_times + 1`` total failures for a given sample (i.e. the
    batch was attempted that many times and failed every time), that sample
    is skipped for the remainder of the session.

    When ``total_errors >= max_errors`` the session is aborted entirely.

    Attributes:
        retry_times: Max retries per sample (from provider).
        max_errors: Max total batch failures before abort (from provider).
        sample_attempts: (dataset_filename, sample_id) → failed attempt count.
        total_errors: Cumulative count of failed batch attempts.
        aborted: True once total_errors >= max_errors.
    """

    retry_times: int
    max_errors: int
    sample_attempts: dict[tuple[str, int], int] = field(default_factory=dict)
    total_errors: int = 0
    aborted: bool = False

    def record_failure(
        self, dataset_filename: str, sample_ids: list[int]
    ) -> None:
        """Record one failed batch attempt for every sample in *sample_ids*."""
        for sid in sample_ids:
            key = (dataset_filename, sid)
            self.sample_attempts[key] = self.sample_attempts.get(key, 0) + 1
        self.total_errors += 1
        if self.total_errors >= self.max_errors:
            self.aborted = True

    def should_skip(
        self, dataset_filename: str, sample_id: int
    ) -> bool:
        """Return True if *sample_id* has been retried too many times."""
        key = (dataset_filename, sample_id)
        return self.sample_attempts.get(key, 0) > self.retry_times


class Benchmark:
    """Main benchmark orchestrator.

    Manages dataset loading, validation, model evaluation with concurrency
    control, partial results persistence, and result aggregation.

    Args:
        baseline: Path to the baseline (unperturbed) dataset.
        attacks: List of AttackType instances specifying perturbations to apply
            or pre-computed files to load (via ``load_from``).  Attack labels
            must be unique across all attack types.
        models: List of provider instances to evaluate.  If the same model
            appears multiple times (same slug), each instance must provide a
            distinct ``label``.  Concurrency is controlled per-provider via
            the ``concurrency`` attribute on each provider instance.
        partial_results_dir: Directory to store/load partial results.
            Relative to ``base_dir`` when set.
        base_dir: Optional base directory. When set, all output paths
            (partial results and result.save) are resolved relative to it.
            The directory is created if it does not exist.
        logprobs_sample_limit: When set, only re-evaluate this many samples
            that lack logprobs per (model, dataset) combination.  Samples
            that already have logprobs are always kept.  Useful when you
            have existing results without logprobs and want to compute
            rank_consistency from a subset instead of re-running everything.
    """

    def __init__(
        self,
        baseline: str | Path,
        attacks: list[AttackType] | None = None,
        models: list[BaseProvider] | None = None,
        concurrency: int = 0,
        partial_results_dir: str | Path = "partial",
        base_dir: str | Path | None = None,
        logprobs_sample_limit: int | None = None,
    ) -> None:
        self._concurrency = concurrency
        self._logprobs_sample_limit = logprobs_sample_limit
        self._attacks = attacks or []
        self._models = models or []

        # -- Validate attack labels are unique --
        seen_labels: dict[str, str] = {}
        for a in self._attacks:
            if a.label is None:
                raise ValueError(
                    f"Attack of type '{a.attack_name}' has no label. "
                    f"Provide an explicit label or ensure __post_init__ sets one."
                )
            if a.label in seen_labels:
                raise ValueError(
                    f"Duplicate perturbation label '{a.label}': "
                    f"used by both '{seen_labels[a.label]}' and '{a.attack_name}'. "
                    f"Labels must be unique across all attack types."
                )
            seen_labels[a.label] = a.attack_name

        # -- Validate model labels --
        self._model_labels: list[str] = []
        slug_counts = Counter(m.model_slug for m in self._models)
        seen_slug_labels: dict[str, set[str]] = {}
        for m in self._models:
            slug = m.model_slug
            if slug_counts[slug] > 1:
                if not m.label:
                    raise ValueError(
                        f"Model '{m.model}' appears multiple times. "
                        f"Provide a distinct 'label' for each instance "
                        f"(e.g. label='temp=0.7')."
                    )
                slug_labels = seen_slug_labels.setdefault(slug, set())
                if m.label in slug_labels:
                    raise ValueError(
                        f"Duplicate label '{m.label}' for model slug "
                        f"'{slug}'. Labels must be unique per model slug."
                    )
                slug_labels.add(m.label)
                self._model_labels.append(m.label)
            else:
                self._model_labels.append(m.label or "base")

        # -- Directory setup --
        if base_dir is not None:
            base_dir = Path(base_dir)
            base_dir.mkdir(parents=True, exist_ok=True)
            self._partial_dir = base_dir / partial_results_dir
            self._base_dir = str(base_dir)
        else:
            self._partial_dir = Path(partial_results_dir)
            self._base_dir = None

        # -- Load baseline --
        logger.info("Loading baseline dataset: %s", baseline)
        self._baseline = load_dataset(baseline, attack=None)
        logger.info(
            "Baseline loaded: %d samples, %d tasks",
            len(self._baseline),
            len({s.task for s in self._baseline.samples}),
        )

    def run(
        self,
        attacks_only: bool = False,
        analyze_while_attacking: bool = True,
    ) -> BenchmarkResult:
        """Run the full evaluation pipeline.

        Executes all (model, dataset) combinations with concurrency control
        and partial result persistence.

        When ``attacks_only=True`` the baseline dataset is skipped; only
        perturbed (attacked) datasets are evaluated.  This is useful when
        the baseline was already evaluated in a prior run and only the
        attack results need refreshing.

        When ``analyze_while_attacking=True`` (the default), model evaluation
        starts as soon as datasets become available: the baseline is evaluated
        immediately, and each perturbed dataset is queued for evaluation the
        moment its perturbation thread finishes.  This overlaps LLM calls for
        perturbation and evaluation, improving throughput.  When ``False``,
        all perturbations complete before evaluation begins (legacy behavior).

        On KeyboardInterrupt the method reconstructs a partial
        ``BenchmarkResult`` from any analysis and perturbation files already
        on disk so the caller can still produce a report.

        Args:
            attacks_only: If True, skip baseline evaluation.
            analyze_while_attacking: If True, start evaluation as soon as
                each perturbed dataset is ready instead of waiting for all
                perturbations to complete first.

        Returns:
            BenchmarkResult with all evaluation data.
        """
        try:
            return asyncio.run(
                self._run_async(
                    attacks_only=attacks_only,
                    analyze_while_attacking=analyze_while_attacking,
                )
            )
        except KeyboardInterrupt:
            logger.warning(
                "Benchmark interrupted by user — building partial result "
                "from saved files"
            )
            return self._build_interrupted_result()

    async def _run_async(
        self,
        attacks_only: bool = False,
        analyze_while_attacking: bool = True,
    ) -> BenchmarkResult:
        """Async implementation of the benchmark pipeline."""
        started_at = datetime.now(timezone.utc).isoformat()

        # -- Generate perturbed datasets asynchronously --
        self._attacked: list[Dataset] = []

        use_interleaved = (
            analyze_while_attacking
            and not attacks_only
            and bool(self._attacks)
            and bool(self._models)
        )

        if use_interleaved:
            return await self._run_interleaved(started_at)

        # -- Sequential mode: perturb all, then evaluate all --
        async def _perturb_one(attack: AttackType) -> Dataset:
            logger.info(
                "Processing attack: %s (%s)", attack.attack_name, attack.label
            )
            ds = await generate_perturbed_dataset(
                self._baseline, attack, self._partial_dir, started_at,
            )
            logger.info("  Prepared: %d samples", len(ds))
            return ds

        if len(self._attacks) <= 1:
            for attack in self._attacks:
                ds = await _perturb_one(attack)
                self._attacked.append(ds)
        else:
            results = await asyncio.gather(*[
                _perturb_one(a) for a in self._attacks
            ])
            self._attacked.extend(results)

        if attacks_only:
            logger.info(
                "attacks_only — %d perturbed dataset(s) generated, skipping evaluation",
                len(self._attacked),
            )
            finished_at = datetime.now(timezone.utc).isoformat()
            result = BenchmarkResult(
                models=[],
                is_finished=False,
                baseline_file=self._baseline.filename,
                started_at=started_at,
                finished_at=finished_at,
                base_dir=self._base_dir,
            )
            return result

        all_datasets = [self._baseline] + self._attacked

        async def _evaluate_one_model(
            provider: BaseProvider, label: str,
        ) -> tuple[ModelResult, bool]:
            logger.info(
                "Evaluating model: %s (%s) [label=%s]",
                provider.display_name, provider.provider_name, label,
            )

            ordered = sorted(
                all_datasets,
                key=lambda ds: self._dataset_priority(ds, provider, label),
            )
            logger.info(
                "  Dataset order: %s",
                [f"{ds.filename} (tier={self._dataset_priority(ds, provider, label)[0]})" for ds in ordered],
            )

            model_result = ModelResult(
                model_name=provider.display_name,
                provider=provider.provider_name,
            )
            retry_state = _RetryState(
                retry_times=provider.retry_times,
                max_errors=provider.max_errors,
            )
            finished = True

            semaphore = provider.get_semaphore()

            for dataset in ordered:
                if retry_state.aborted:
                    finished = False
                    break

                attack_info = f"attack={dataset.attack.attack_name}/{dataset.attack.label}" if dataset.attack else "baseline"
                logger.info(
                    "  [%s] Evaluating %s (%s): %d samples",
                    provider.display_name, dataset.filename, attack_info, len(dataset),
                )
                ds_result = await self._evaluate_dataset(
                    provider, dataset, label, started_at, retry_state, semaphore,
                )
                model_result.evaluated_datasets.append(ds_result)

                expected = len(dataset)
                completed = len(ds_result.results)
                if retry_state.aborted or completed < expected:
                    finished = False
                    logger.warning(
                        "  %s: %d/%d completed (incomplete)",
                        dataset.filename,
                        completed,
                        expected,
                    )

                    if retry_state.aborted:
                        logger.warning(
                            "  %s: ABORTING model — %d errors",
                            dataset.filename,
                            retry_state.total_errors,
                        )
                        log_error(
                            self._partial_dir,
                            started_at,
                            phase="evaluation",
                            error_type="model_aborted",
                            provider=provider.provider_name,
                            model=provider.display_name,
                            dataset=dataset.filename,
                            total_errors=retry_state.total_errors,
                            max_errors=retry_state.max_errors,
                        )
                        break
                else:
                    m = ds_result.metrics
                    logger.info(
                        "  %s: %d/%d completed (%.1f%% accuracy)",
                        dataset.filename,
                        completed,
                        expected,
                        m.accuracy * 100,
                    )
                    if m.tasks:
                        per_task = " ".join(
                            f"{task}={info['accuracy']:.0%}" for task, info in sorted(m.tasks.items())
                        )
                        logger.info("    per-task: %s", per_task)

            return model_result, finished

        tasks = [
            _evaluate_one_model(provider, self._model_labels[idx])
            for idx, provider in enumerate(self._models)
        ]
        pairs = await asyncio.gather(*tasks)

        model_results = [p[0] for p in pairs]
        all_finished = all(p[1] for p in pairs)

        finished_at = datetime.now(timezone.utc).isoformat()

        result = BenchmarkResult(
            models=model_results,
            is_finished=all_finished,
            baseline_file=self._baseline.filename,
            started_at=started_at,
            finished_at=finished_at,
            base_dir=self._base_dir,
        )
        result._compute_all_robustness()
        return result

    async def _run_interleaved(
        self,
        started_at: str,
    ) -> BenchmarkResult:
        """Run perturbation and evaluation concurrently.

        Starts evaluating the baseline immediately, then streams each
        perturbed dataset to model evaluation as soon as it is ready,
        rather than waiting for all perturbations to complete first.
        """
        # -- Events signalling when each attack's perturbation is done --
        attack_events: dict[str, asyncio.Event] = {}
        attack_results: dict[str, Dataset] = {}
        attack_errors: dict[str, BaseException] = {}

        for attack in self._attacks:
            attack_events[attack.label] = asyncio.Event()

        async def _perturb_and_signal(attack: AttackType) -> None:
            logger.info(
                "Processing attack: %s (%s)", attack.attack_name, attack.label
            )
            try:
                ds = await generate_perturbed_dataset(
                    self._baseline, attack, self._partial_dir, started_at,
                )
                logger.info("  Prepared: %d samples", len(ds))
                attack_results[attack.label] = ds
            except Exception as exc:
                attack_errors[attack.label] = exc
                logger.error(
                    "  Attack %s failed: %s: %s",
                    attack.label, type(exc).__name__, exc,
                )
            finally:
                attack_events[attack.label].set()

        perturb_tasks = [
            asyncio.create_task(_perturb_and_signal(a)) for a in self._attacks
        ]

        # -- Evaluate models concurrently, streaming datasets as they arrive --

        async def _evaluate_model_streaming(
            provider: BaseProvider, label: str,
        ) -> tuple[ModelResult, bool]:
            logger.info(
                "Evaluating model: %s (%s) [label=%s]",
                provider.display_name, provider.provider_name, label,
            )
            semaphore = provider.get_semaphore()
            model_result = ModelResult(
                model_name=provider.display_name,
                provider=provider.provider_name,
            )
            retry_state = _RetryState(
                retry_times=provider.retry_times,
                max_errors=provider.max_errors,
            )
            finished = True

            # Build a unified queue: baseline is always ready, attacks become ready
            # when their perturbation finishes.  We pick the highest-priority ready
            # dataset each iteration.
            baseline_done = False
            attack_done: set[str] = set()
            all_attack_labels = [a.label for a in self._attacks]

            while not baseline_done or len(attack_done) < len(all_attack_labels):
                if retry_state.aborted:
                    finished = False
                    break

                # Collect all datasets that are ready to evaluate
                candidates: list[Dataset] = []
                if not baseline_done:
                    candidates.append(self._baseline)
                for attack in self._attacks:
                    if attack.label not in attack_done and attack_events[attack.label].is_set():
                        candidates.append(attack_results[attack.label])

                if not candidates:
                    # No datasets ready yet — wait for the next attack perturbation
                    pending_labels = [
                        lbl for lbl in all_attack_labels if lbl not in attack_done
                    ]
                    if pending_labels:
                        await asyncio.wait(
                            [asyncio.ensure_future(attack_events[lbl].wait()) for lbl in pending_labels],
                            return_when=asyncio.FIRST_COMPLETED,
                        )
                    continue

                # Pick the highest-priority ready dataset
                candidates.sort(key=lambda ds: self._dataset_priority(ds, provider, label))
                dataset = candidates[0]
                is_baseline = dataset.attack is None

                attack_info = f"attack={dataset.attack.attack_name}/{dataset.attack.label}" if dataset.attack else "baseline"
                logger.info(
                    "  [%s] Evaluating %s (%s): %d samples",
                    provider.display_name, dataset.filename, attack_info, len(dataset),
                )

                if is_baseline:
                    pass
                elif dataset.attack is not None and dataset.attack.label in attack_errors:
                    raise attack_errors[dataset.attack.label]

                ds_result = await self._evaluate_dataset(
                    provider, dataset, label, started_at, retry_state, semaphore,
                )
                model_result.evaluated_datasets.append(ds_result)

                if is_baseline:
                    baseline_done = True
                elif dataset.attack is not None:
                    attack_done.add(dataset.attack.label)

                expected = len(dataset)
                completed = len(ds_result.results)
                if retry_state.aborted or completed < expected:
                    finished = False
                    logger.warning(
                        "  %s: %d/%d completed (incomplete)",
                        dataset.filename, completed, expected,
                    )
                    if retry_state.aborted:
                        logger.warning(
                            "  %s: ABORTING model — %d errors",
                            dataset.filename, retry_state.total_errors,
                        )
                        log_error(
                            self._partial_dir, started_at,
                            phase="evaluation", error_type="model_aborted",
                            provider=provider.provider_name,
                            model=provider.display_name,
                            dataset=dataset.filename,
                            total_errors=retry_state.total_errors,
                            max_errors=retry_state.max_errors,
                        )
                        break
                else:
                    m = ds_result.metrics
                    logger.info(
                        "  %s: %d/%d completed (%.1f%% accuracy)",
                        dataset.filename, completed, expected, m.accuracy * 100,
                    )
                    if m.tasks:
                        per_task = " ".join(
                            f"{task}={info['accuracy']:.0%}"
                            for task, info in sorted(m.tasks.items())
                        )
                        logger.info("    per-task: %s", per_task)

            return model_result, finished

        eval_tasks = [
            asyncio.create_task(
                _evaluate_model_streaming(provider, self._model_labels[idx])
            )
            for idx, provider in enumerate(self._models)
        ]

        try:
            pairs = await asyncio.gather(*eval_tasks)
        except Exception:
            for task in perturb_tasks:
                if not task.done():
                    task.cancel()
            await asyncio.gather(*perturb_tasks, return_exceptions=True)
            raise
        finally:
            for task in perturb_tasks:
                if not task.done():
                    task.cancel()
            await asyncio.gather(*perturb_tasks, return_exceptions=True)

        self._attacked = [
            attack_results[a.label] for a in self._attacks
            if a.label in attack_results
        ]

        model_results = [p[0] for p in pairs]
        all_finished = all(p[1] for p in pairs)

        finished_at = datetime.now(timezone.utc).isoformat()
        result = BenchmarkResult(
            models=model_results,
            is_finished=all_finished,
            baseline_file=self._baseline.filename,
            started_at=started_at,
            finished_at=finished_at,
            base_dir=self._base_dir,
        )
        result._compute_all_robustness()
        return result

    def _build_interrupted_result(self) -> BenchmarkResult:
        """Reconstruct a partial ``BenchmarkResult`` from saved analysis files.

        Scans ``{partial_dir}/analysis/`` for JSON partials, groups them by
        model, and wraps them in ``DatasetResult`` / ``ModelResult`` objects.
        The returned result has ``is_finished=False``.
        """
        started_at = datetime.now(timezone.utc).isoformat()
        finished_at = datetime.now(timezone.utc).isoformat()

        analysis_dir = self._partial_dir / "analysis"

        # -- Build dataset_filename → attack mapping ------------------------
        dataset_attack_map: dict[str, AttackType | None] = {}
        dataset_attack_map[self._baseline.filename] = None
        for attack in self._attacks:
            if attack.load_from:
                filename = Path(attack.load_from).name
            else:
                filename = f"{attack.attack_name}.{attack.label or 'default'}.json"
            dataset_attack_map[filename] = attack

        # -- Load partials grouped by (model_name, provider) -------------
        model_map: dict[tuple[str, str], dict[str, list[EvaluatedSample]]] = {}
        earliest_started = started_at

        if analysis_dir.exists():
            for fpath in sorted(analysis_dir.glob("*.json")):
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                except (json.JSONDecodeError, OSError):
                    continue

                model_name = data.get("model") or ""
                provider = data.get("provider") or ""
                dataset_file = data.get("dataset_file") or ""
                file_started = data.get("started_at") or ""

                if file_started and file_started < earliest_started:
                    earliest_started = file_started

                key = (model_name, provider)
                if key not in model_map:
                    model_map[key] = {}
                if dataset_file not in model_map[key]:
                    model_map[key][dataset_file] = []

                for item in data.get("results", []):
                    try:
                        lp = None
                        lp_data = item.get("logprobs")
                        if isinstance(lp_data, dict) and "choice_logprobs" in lp_data:
                            lp = ChoiceLogprobs(
                                choice_logprobs={
                                    int(k): float(v)
                                    for k, v in lp_data["choice_logprobs"].items()
                                }
                            )
                        model_map[key][dataset_file].append(
                            EvaluatedSample(
                                sample_id=item["sample_id"],
                                task=TaskType(item["task"]),
                                expected=item["expected"],
                                predicted=item["predicted"],
                                correct=item["correct"],
                                raw_response=item.get("raw_response", ""),
                                latency_ms=item.get("latency_ms", 0),
                                batch_id=item.get("batch_id", 0),
                                timestamp=item.get("timestamp", ""),
                                logprobs=lp,
                            )
                        )
                    except (KeyError, ValueError):
                        continue

        # -- Build ModelResult objects -----------------------------------
        model_results: list[ModelResult] = []
        for (model_name, provider), datasets in model_map.items():
            model_result = ModelResult(model_name=model_name, provider=provider)
            for dataset_file, sample_results in datasets.items():
                attack = dataset_attack_map.get(dataset_file)
                if attack is not None and attack not in self._attacks:
                    continue
                model_result.evaluated_datasets.append(
                    DatasetResult(
                        dataset_file=dataset_file,
                        attack=attack,
                        results=sample_results,
                    )
                )
            if model_result.evaluated_datasets:
                model_results.append(model_result)

        result = BenchmarkResult(
            models=model_results,
            is_finished=False,
            baseline_file=self._baseline.filename,
            started_at=earliest_started,
            finished_at=finished_at,
            base_dir=self._base_dir,
        )
        result._compute_all_robustness()
        return result

    def _logprobs_needed(self, provider: BaseProvider) -> int | None:
        """Return the minimum logprobs count required per (model, dataset).

        Returns ``None`` when logprobs are not requested.
        """
        if not getattr(provider, "logprobs", False):
            return None
        return self._logprobs_sample_limit or 20

    def _count_logprobs(self, results: list) -> int:
        """Count results that already have valid logprobs."""
        return sum(
            1 for r in results
            if r.logprobs is not None and r.logprobs.choice_logprobs
        )

    def _dataset_priority(
        self, dataset: Dataset, provider: BaseProvider, model_label: str,
    ) -> tuple[int, float]:
        """Sort key for dataset evaluation order.

        Returns ``(tier, completion_ratio)`` where:
        - tier 0 = attacked dataset with 0 predictions (highest priority)
        - tier 1 = attacked dataset with predictions but needs more work
        - tier 2 = attacked dataset fully completed (including logprobs)
        - tier 3 = baseline (lowest priority)

        "Needs more work" means either incomplete predictions, or
        logprobs are required but the collected count is below the minimum.
        Within the same tier, lower completion ratio sorts first.
        """
        is_baseline = dataset.attack is None
        existing = load_partial_results(
            self._partial_dir, dataset.filename,
            provider.model_slug, model_label,
        )
        sessionless = [r for r in existing if not r.raw_response.startswith("ERROR:")]
        completed = len(sessionless)
        total = len(dataset)
        ratio = completed / total if total > 0 else 1.0

        if is_baseline:
            tier = 3
        elif completed == 0:
            tier = 0
        elif ratio < 1.0:
            tier = 1
        else:
            lp_needed = self._logprobs_needed(provider)
            if lp_needed is not None:
                lp_count = self._count_logprobs(sessionless)
                if lp_count < lp_needed:
                    tier = 1
                else:
                    tier = 2
            else:
                tier = 2

        return (tier, ratio)

    async def _evaluate_dataset(
        self,
        provider: BaseProvider,
        dataset: Dataset,
        model_label: str,
        started_at: str,
        retry_state: _RetryState,
        semaphore: asyncio.Semaphore,
    ) -> DatasetResult:
        """Evaluate a single (model, dataset) combination.

        Loads partial results, filters out already-evaluated and
        retry-exhausted samples, evaluates remaining in batches with
        concurrency control, and persists progress.
        """
        # Load partial results (filter out any stale error markers)
        existing = load_partial_results(
            self._partial_dir,
            dataset.filename,
            provider.model_slug,
            model_label,
        )
        sessionless = [r for r in existing if not r.raw_response.startswith("ERROR:")]
        needs_logprobs = getattr(provider, "logprobs", False)
        if needs_logprobs:
            lp_needed = self._logprobs_needed(provider)
            lp_count = self._count_logprobs(sessionless)
            completed_ids = {
                r.sample_id for r in sessionless
                if r.logprobs is not None and r.logprobs.choice_logprobs
            }
            if lp_count >= lp_needed:
                logger.info(
                    "  %s: logprobs minimum met (%d >= %d), treating all as completed",
                    dataset.filename, lp_count, lp_needed,
                )
                completed_ids = {r.sample_id for r in sessionless}
            elif self._logprobs_sample_limit is not None:
                lacking = [
                    r.sample_id for r in sessionless
                    if r.logprobs is None or not r.logprobs.choice_logprobs
                ]
                remaining_budget = max(0, lp_needed - lp_count)
                n_to_pick = min(remaining_budget, len(lacking))
                random.seed(42)
                allowed = set(random.sample(lacking, n_to_pick))
                completed_ids.update(
                    r.sample_id for r in sessionless
                    if r.sample_id not in allowed
                )
        else:
            completed_ids = {r.sample_id for r in sessionless}
        all_results = list(sessionless)

        # Determine remaining samples — skip those already completed and
        # those whose retry budget was exhausted in THIS session.
        remaining = [
            s for s in dataset.samples
            if s.id not in completed_ids
            and not retry_state.should_skip(dataset.filename, s.id)
        ]

        if not remaining:
            logger.info("  %s: all samples already completed", dataset.filename)
            return DatasetResult(
                dataset_file=dataset.filename,
                attack=dataset.attack,
                results=all_results,
            )

        logger.info(
            "  %s: %d remaining (of %d total, %d cached)",
            dataset.filename,
            len(remaining),
            len(dataset),
            len(completed_ids),
        )

        # Group into batches
        batches: list[list] = []
        for i in range(0, len(remaining), provider.batch_size):
            batches.append(remaining[i : i + provider.batch_size])

        batch_counter = len(completed_ids) // max(provider.batch_size, 1)

        lock = asyncio.Lock()

        async def _eval_batch(batch_idx: int, batch_samples: list) -> list[EvaluatedSample] | None:
            batch_id = batch_counter + batch_idx
            sample_ids = [s.id for s in batch_samples]
            logger.info("    Batch %d: Evaluating samples %s", batch_id, sample_ids)

            batch_results = await self._evaluate_batch(
                provider, batch_samples, batch_id, semaphore, retry_state,
                dataset.filename, started_at,
            )
            if batch_results is not None:
                async with lock:
                    new_ids = {r.sample_id for r in batch_results}
                    all_results[:] = [
                        r for r in all_results if r.sample_id not in new_ids
                    ]
                    all_results.extend(batch_results)
                    correct = sum(1 for r in batch_results if r.correct)
                    logger.info(
                        "    Batch %d: Completed (%d/%d correct)",
                        batch_id, correct, len(batch_samples),
                    )
                    save_partial_results(
                        partial_dir=self._partial_dir,
                        dataset_filename=dataset.filename,
                        model_name=provider.display_name,
                        model_slug=provider.model_slug,
                        provider_name=provider.provider_name,
                        label=model_label,
                        results=all_results,
                        total_samples=len(dataset),
                        started_at=started_at,
                    )
            return batch_results

        eval_tasks = [
            _eval_batch(idx, batch)
            for idx, batch in enumerate(batches)
        ]
        await asyncio.gather(*eval_tasks)

        return DatasetResult(
            dataset_file=dataset.filename,
            attack=dataset.attack,
            results=all_results,
        )

    async def _evaluate_batch(
        self,
        provider: BaseProvider,
        samples: list,
        batch_id: int,
        semaphore: asyncio.Semaphore,
        retry_state: _RetryState,
        dataset_filename: str,
        started_at: str,
    ) -> list[EvaluatedSample] | None:
        """Evaluate a batch of samples with retry logic.

        Returns a list of EvaluatedSample on success, or None if all
        retries were exhausted.
        """
        async with semaphore:
            if retry_state.aborted:
                return None
            messages, response_format = build_messages(samples)

            sample_ids = [s.id for s in samples]

            for attempt in range(retry_state.retry_times + 1):
                start_time = time.perf_counter()
                try:
                    raw_response, prompt_tokens, completion_tokens, choice_logprobs = await provider.complete(
                        messages, response_format
                    )
                    logger.debug(
                        "    Batch %d: Raw response:\n%s", batch_id, raw_response,
                    )
                    # Filter logprobs to only valid answer indices
                    if choice_logprobs and samples:
                        num_choices = len(samples[0].options)
                        filtered = {k: v for k, v in choice_logprobs.choice_logprobs.items() if 0 <= k < num_choices}
                        if filtered:
                            choice_logprobs = ChoiceLogprobs(choice_logprobs=filtered)
                        else:
                            choice_logprobs = None
                    logger.debug(
                        "    Batch %d: Final messages (after provider processing):\n%s",
                        batch_id, json.dumps(messages, ensure_ascii=False, indent=4),
                    )
                except Exception as e:
                    logger.error(
                        "    Batch %d attempt %d/%d failed: %s: %s",
                        batch_id, attempt + 1, retry_state.retry_times + 1,
                        type(e).__name__, e,
                    )
                    log_error(
                        self._partial_dir,
                        started_at,
                        phase="evaluation",
                        error_type="api_error",
                        provider=provider.provider_name,
                        model=provider.display_name,
                        dataset=dataset_filename,
                        batch_id=batch_id,
                        sample_ids=sample_ids,
                        attempt=attempt + 1,
                        max_attempts=retry_state.retry_times + 1,
                        exception=e,
                    )
                    if attempt == retry_state.retry_times:
                        # All retries exhausted
                        retry_state.record_failure(dataset_filename, sample_ids)
                        log_error(
                            self._partial_dir,
                            started_at,
                            phase="evaluation",
                            error_type="batch_exhausted",
                            provider=provider.provider_name,
                            model=provider.display_name,
                            dataset=dataset_filename,
                            batch_id=batch_id,
                            sample_ids=sample_ids,
                            max_attempts=retry_state.retry_times + 1,
                        )
                        logger.warning(
                            "    Batch %d: all %d attempts failed — skipping %d samples",
                            batch_id, retry_state.retry_times + 1, len(samples),
                        )
                        return None
                    continue

                # --- success path ---
                elapsed_ms = (time.perf_counter() - start_time) * 1000
                timestamp = datetime.now(timezone.utc).isoformat()
                per_sample_ms = elapsed_ms / len(samples)

                results: list[EvaluatedSample] = []

                if len(samples) == 1:
                    predicted = parse_single_response(raw_response)
                    s = samples[0]
                    results.append(
                        EvaluatedSample(
                            sample_id=s.id,
                            task=s.task,
                            expected=s.answer,
                            predicted=predicted,
                            correct=predicted == s.answer,
                            raw_response=raw_response,
                            latency_ms=elapsed_ms,
                            batch_id=batch_id,
                            timestamp=timestamp,
                            logprobs=choice_logprobs,
                        )
                    )
                else:
                    expected_ids = [s.id for s in samples]
                    parsed = parse_batch_response(raw_response, expected_ids)
                    for s in samples:
                        predicted = parsed.get(s.id)
                        results.append(
                            EvaluatedSample(
                                sample_id=s.id,
                                task=s.task,
                                expected=s.answer,
                                predicted=predicted,
                                correct=predicted == s.answer,
                                raw_response=raw_response,
                                latency_ms=per_sample_ms,
                                batch_id=batch_id,
                                timestamp=timestamp,
                                logprobs=choice_logprobs,
                            )
                        )

                null_count = sum(1 for r in results if r.predicted is None)
                if null_count > 0 and attempt < retry_state.retry_times:
                    logger.warning(
                        "    Batch %d attempt %d/%d: %d/%d predictions null — retrying",
                        batch_id, attempt + 1, retry_state.retry_times + 1,
                        null_count, len(samples),
                    )
                    log_error(
                        self._partial_dir,
                        started_at,
                        phase="evaluation",
                        error_type="parse_failure",
                        provider=provider.provider_name,
                        model=provider.display_name,
                        dataset=dataset_filename,
                        batch_id=batch_id,
                        sample_ids=[r.sample_id for r in results if r.predicted is None],
                        attempt=attempt + 1,
                        max_attempts=retry_state.retry_times + 1,
                    )
                    continue

                if null_count == len(samples) and attempt == retry_state.retry_times:
                    logger.warning(
                        "    Batch %d: all %d predictions null after %d attempts — skipping",
                        batch_id, len(samples), retry_state.retry_times + 1,
                    )
                    retry_state.record_failure(dataset_filename, sample_ids)
                    return None

                return results
