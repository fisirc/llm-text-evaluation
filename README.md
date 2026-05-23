# Multilingual LLM Evaluation Framework for Verbal Reasoning

Framework for evaluating how LLMs perform on verbal reasoning tasks, with
built-in support for adversarial attacks, cross-lingual perturbations,
logprob-based rank consistency, and positive/negative transfer metrics, based in the study
[*Language-Specific Latent Process Hinders Cross-Lingual Performance*](https://arxiv.org/pdf/2505.13141).

## Scientific Context

The paper uses representation-level analysis (CKA, cosine similarity, logit
lens, and activation steering) to investigate why larger models underperform
in cross-lingual transfer despite higher accuracy. This framework implements
the evaluation layer, the metrics and perturbations needed to benchmark
those claims, enabling the study reported in
[*Language-Specific Latent Process Hinders Cross-Lingual Performance*](https://arxiv.org/pdf/2505.13141):

- **Cross-lingual consistency**: Spearman rank correlation between answer
  rank vectors across language pairs (Equation 1), computed from logprobs
  via `rank_consistency`.
- **Positive / negative transfer**: Directed rates of shared correct and
  incorrect responses between languages (Equations 2–3), computed over all
  pairwise combinations (Equations 4–6), exposed as `positive_transfer`
  and `negative_transfer`.
- **Cross-lingual perturbation**: The `CrossLingual` attack translates
  question stems via an LLM, producing the parallel-language datasets
  needed for consistency and transfer analysis.
- **Logprob extraction**: Per-choice logprobs (`ChoiceLogprobs`) enable
  rank-based consistency without re-running models, supporting the
  Spearman correlation methodology of the paper.

## Comparison with lm-evaluation-harness

[lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness)
is the standard tool for benchmarking LLMs on 200+ tasks. This framework
builds on that foundation with analysis capabilities the harness does not
provide:

| Capability                                    | lm-eval-harness                                | This framework                                                                                                |
| --------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Task suites**                               | 200+ (GLUE, MMLU, GSM8K, HellaSwag, ARC, etc.) | 7 verbal reasoning types in Spanish (10k+ samples) + works with any MCQ dataset                               |
| **Multilingual**                              | 122 languages via fixed benchmarks             | Cross-lingual attack as a perturbation over any dataset; translation via LLM                                  |
| **Adversarial perturbations**                 | ANLI only (fixed task)                         | 5 attack types applicable to any dataset (CrossLingual, Synonym, Paraphrasing, MinimalPairs, ShortcutRemoval) |
| **Model backends**                            | 15+ (HF, vLLM, SGLang, GGUF, NeMo, ONNX, etc.) | 3 (Ollama, OpenRouter, OpencodeGo) focused API providers                                                      |
| **Few-shot prompting**                        | Built-in via YAML configs                      | Not supported (zero-shot evaluation focus)                                                                    |
| **Logprobs**                                  | Not for chat APIs                              | Yes, per-choice logprobs for every model                                                                      |
| **Accuracy metrics**                          | acc, acc_norm, exact_match, f1, mcc, etc.      | accuracy, per-task accuracy                                                                                   |
| **Consistency metrics**                       | No                                             | Spearman rank correlation (`rank_consistency`) between answer-rank vectors from logprobs                      |
| **Positive / negative transfer**              | No                                             | Directed transfer rates per language pair (`positive_transfer`, `negative_transfer`)                          |
| **Robustness (flip rate, accuracy drop)**     | No                                             | `accuracy_drop`, `flip_rate`, `consistency`, per-task breakdown                                               |
| **Pairwise robustness**                       | No                                             | Attack A vs Attack B metrics in both directions                                                               |
| **Representation analysis (CKA, logit lens)** | No                                             | Not built-in (used externally in the accompanying paper)                                                      |
| **Activation steering**                       | Pre-defined vectors only                       | Not built-in (contrastive steering applied externally in the accompanying paper)                              |
| **Resumability**                              | SQLite caching                                 | JSON partial results after every batch; atomic writes                                                         |
| **Report export**                             | CLI table output                               | JSON (aggregates + per-sample) and scientific Markdown tables                                                 |
| **CLI**                                       | `lm-eval run` with YAML configs                | Python API only; example and validate scripts provided                                                        |

## Verbal Reasoning Tasks

- **Reading comprehension**: Answer verbal reasoning questions about long
  texts (~2500 characters).
- **Sentence ordering**: Find the logical sequence that creates a coherent,
  well-structured text.
- **Sentence elimination**: Identify the sentence that does NOT belong
  thematically or logically.
- **Verbal series**: Identify the pattern connecting words (synonyms,
  antonyms, categories, relationships).
- **Analogies**: Match the underlying relationship between the given pair
  of concepts.
- **Synonyms and antonyms**: Select the word with the closest or most
  opposite meaning in context.
- **Incomplete sentences**: Choose the option that best completes the
  sentence's meaning and grammar.

Enumerated as `TaskType` members: `reading_comprehension`, `sentence_ordering`,
`sentence_elimination`, `verbal_series`, `analogies`, `synonyms_and_antonyms`,
`incomplete_sentences`.

## Attacks

Attacks are perturbations of the baseline dataset. They can be generated
on-the-fly (`perturb()`) or loaded from a pre-computed file (`load_from`).
Every attack has a unique `label` used for disambiguation in reports.

### CrossLingual

Translates the question stem to another language via an LLM (default:
`qwen3.6-plus` via OpencodeGo). Options are preserved from the baseline.
Validates that translated text length is at least 23% of the original.

```py
from llm_verbal_framework import attacks, CrossLingualLanguage

attacks.CrossLingual(language=CrossLingualLanguage.FRENCH)
attacks.CrossLingual(language=CrossLingualLanguage.CHINESE)
attacks.CrossLingual(language=CrossLingualLanguage.FRENCH, label="fr_mixed")
```

`CrossLingualLanguage` enum: `FRENCH` (`"french"`), `CHINESE` (`"chinese"`).

### Synonym

Replaces key words with synonyms. Must be loaded from a pre-computed file.

```py
attacks.Synonym(label="synonym_1", load_from="synonym_dataset.json")
```

### Paraphrasing

Rewrites sentences without changing meaning. Load-from only.

```py
attacks.Paraphrasing(label="paraphrasing_1", load_from="paraphrased.json")
```

### MinimalPairs

Changes a single critical word (negation, quantifier, connector). Load-from only.

```py
attacks.MinimalPairs(label="negation_flip", load_from="minimal_pairs.json")
```

### ShortcutRemoval

Eliminates explicit reasoning cues (connectives like "because", "therefore",
"first/then"). Load-from only.

```py
attacks.ShortcutRemoval(label="no_shortcuts", load_from="shortcut_free.json")
```

## Metrics

### Per-dataset metrics (`DatasetMetrics`)

| Metric | Description |
|---|---|
| `accuracy` | `correct / total` |
| `total` | Total samples evaluated |
| `correct` | Correct predictions |
| `failed` | Parse failures (predicted is `None`) |
| `tasks` | Per-task dict: `{task_name: {correct, total, accuracy}}` |
| `avg_latency_ms` | Average prediction latency |
| `total_time_s` | Sum of all latencies |

### Robustness metrics (`RobustnessMetrics`)

Computed per attack-vs-baseline pair and per attack-vs-attack pair. All metrics
are directed (non-commutative).

| Metric | Description |
|---|---|
| `accuracy_drop` | `baseline_accuracy - attacked_accuracy`. Positive = performance degrades |
| `flip_rate` | Fraction of baseline-correct samples that become incorrect under attack |
| `consistency` | Fraction of samples where prediction did NOT change (same answer index) |
| `positive_transfer` | Fraction of baseline-correct samples that remain correct under attack (retained knowledge) |
| `negative_transfer` | Fraction of baseline-incorrect samples that produce the SAME wrong answer (persistent error) |
| `rank_consistency` | Spearman rank correlation between answer-rank vectors from logprobs. `None` when logprobs unavailable |
| `per_task_robustness` | Dict of the above metrics broken down by `TaskType` |

## Advanced Features

### Resumability

Partial results are saved after every batch with atomic writes
(temp file + rename). Interrupted runs resume without re-evaluating
completed work. Pass `partial_results_dir` and `base_dir` to configure.

### Logprobs and Rank Consistency

Set `logprobs=True` and `top_logprobs=5` on any provider to capture per-token
log probabilities. The framework extracts per-choice logprobs
(`ChoiceLogprobs`) by scanning digit tokens in the model output.
`RobustnessMetrics.rank_consistency` then computes Spearman's rho across
the answer-rank vectors, enabling the consistency analysis from the paper
(Equation 1) without running models twice.

### Pairwise Robustness

When multiple attacks are configured, `BenchmarkResult` computes
`compute_robustness(ds_a, ds_b)` for every ordered attack pair, enabling
cross-attack comparisons (e.g., "Does French → Chinese robustness differ
from Chinese → French?").

### Report Export

```py
result.save("stats.json")           # JSON aggregates
result.save("report.md")            # Markdown with scientific tables
result.save("report.json", per_sample=True)  # includes per-sample predictions
```

The Markdown report includes:
- Per-model, per-dataset accuracy table
- Per-task accuracy breakdown
- Robustness metrics table with all attack-vs-baseline comparisons

### Batch Evaluation

Multiple samples sent in a single LLM request (`batch_size` / `batch` on
providers). The framework constructs a structured JSON prompt and parses the
response to extract individual answer indices.

### Error Tolerance

- `retry_times`: max retries per individual sample
- `max_errors`: max total batch failures before aborting the model session
- Errors logged to JSON files per session for post-hoc inspection

### Dataset Validation

- Required fields: `id`, `task`, `question`, `options`, `answer`
- Unique IDs, valid `TaskType` values, minimum 2 options, valid 0-based answer index
- Perturbed datasets validated for structural alignment with baseline (same IDs, same answers, same option counts)
- CrossLingual translation validated against a 23% length threshold

## Dataset Format

```json
[
  {
    "id": 0,
    "task": "sentence_ordering",
    "question": "¿Cuál es el orden lógico de las siguientes oraciones? ...",
    "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
    "answer": 3,
    "rationale": "Explicación opcional del razonamiento correcto"
  }
]
```

- `id`: Unique integer identifier
- `task`: One of the seven `TaskType` enum values (string)
- `question`: Prompt text
- `options`: Array of 2+ answer choice strings
- `answer`: 0-based index of the correct option
- `rationale`: Optional explanation (not used during evaluation)

The project ships with 10k+ Spanish verbal reasoning questions in
[dataset/final/dataset.json](dataset/final/dataset.json).

## Providers

Multiple LLM backends, all sharing a common base interface
(`complete(messages, response_format) → content, prompt_tokens, completion_tokens, choice_logprobs`).

### All providers share these constructor parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `model` | `str` | required | Model identifier |
| `label` | `str \| None` | `None` | Variant tag (e.g. `"temp=0.7"`) for disambiguation in reports |
| `batch` | `int` | `1` | Questions per LLM request |
| `temperature` | `float` | `0.0` | Sampling temperature |
| `max_tokens` | `int \| None` | varies | Max response tokens |
| `enforce_json` | `bool` | `True` | Use `json_schema` response format when available |
| `retry_times` | `int` | `1` | Max retries per sample |
| `max_errors` | `int` | `3` | Max total batch failures before abort |
| `logprobs` | `bool` | `False` | Request token logprobs |
| `top_logprobs` | `int \| None` | `None` | Top-K logprobs per token |

### Ollama

```py
providers.Ollama(
    model="qwen2.5:7b-instruct",
    url="localhost:11434",       # host:port or http://host:port
    api_key="ollama",            # optional auth
    batch=2,
)
```

Uses the OpenAI-compatible `/v1/chat/completions` endpoint.

### OpenRouter

```py
providers.OpenRouter(
    model="claude-opus-4-7",
    api_key="sk-or-...",
    site_url="https://example.com",   # optional ranking headers
    site_name="My Project",
    batch=2,
    logprobs=True,
    top_logprobs=5,
)
```

Calls `https://openrouter.ai/api/v1`. 120s timeout.

### OpencodeGo

```py
providers.OpencodeGo(
    model="kimi-k2.6",
    label="temp=0.0",
    logprobs=True,
    top_logprobs=5,
)
```

Dual backend: OpenAI-compatible models (`kimi-k2.6`, `deepseek-v4-flash`,
`qwen3.6-plus`, etc.) use `AsyncOpenAI`; Anthropic models (`minimax-m2.5`,
`minimax-m2.7`) use `AsyncAnthropic`. Default `max_tokens` is 16384.
Logprobs unavailable for Anthropic models. `json_schema` unsupported for
non-Claude Anthropic models, falls back to prompt injection.

**Environment variable:** `OPENCODEGO_APIKEY` is required.

## Usage Example

```py
import os
from pathlib import Path
from llm_verbal_framework import Benchmark, providers, attacks, CrossLingualLanguage

OPENCODEGO_APIKEY = "sk-..."
OPENROUTER_APIKEY = "sk-or-..."

os.environ["OPENCODEGO_APIKEY"] = OPENCODEGO_APIKEY

benchmark = Benchmark(
    baseline=Path("dataset.json"),
    attacks=[
        attacks.CrossLingual(language=CrossLingualLanguage.FRENCH),
        attacks.CrossLingual(language=CrossLingualLanguage.CHINESE),
        attacks.CrossLingual(language=CrossLingualLanguage.FRENCH, label="fr_mixed"),
        attacks.Synonym("synonym_1"),
        attacks.Paraphrasing("paraphrasing_1"),
    ],
    models=[
        providers.Ollama(
            model="qwen2.5:7b-instruct",
            url="localhost:11434",
            batch=2,
        ),
        providers.OpenRouter(
            model="claude-opus-4-7",
            api_key=OPENROUTER_APIKEY,
            batch=2,
            logprobs=True,
            top_logprobs=5,
        ),
        providers.OpencodeGo(
            model="kimi-k2.6",
            api_key=OPENCODEGO_APIKEY,
            label="temp=0.0",
            logprobs=True,
            top_logprobs=5,
        ),
        providers.OpencodeGo(
            model="kimi-k2.6",
            api_key=OPENCODEGO_APIKEY,
            batch=1,
            temperature=0.7,
            label="temp=0.7",
        ),
    ],
    concurrency=4,
    base_dir="benchmark",
)

result = benchmark.run()

for model in result:
    print(f"\nModel: {model.model_name}")
    for ds in model.evaluated_datasets:
        print(f"  {ds.dataset_file} - accuracy: {ds.metrics.accuracy:.2%}")
        for task_name, task_metrics in ds.metrics.tasks.items():
            print(f"    {task_name}: {task_metrics['accuracy']:.2%}")
        if ds._robustness:
            r = ds._robustness
            print(f"    accuracy_drop={r.accuracy_drop:+.2%}  "
                  f"flip_rate={r.flip_rate:.2%}  "
                  f"consistency={r.consistency:.2%}")
            print(f"    pos_transfer={r.positive_transfer:.2%}  "
                  f"neg_transfer={r.negative_transfer:.2%}")
            if r.rank_consistency is not None:
                print(f"    rank_consistency={r.rank_consistency:.3f}")
        if ds._per_task_robustness:
            for task_name, tr in ds._per_task_robustness.items():
                print(f"    {task_name}: acc_drop={tr.accuracy_drop:+.2%}")

if result.is_finished:
    result.save("stats.json")
    result.save("report.md")
else:
    print("\nWarning: benchmark did not finish - partial results were saved.")
    result.save("stats.json")
```
