# LLM Verbal Reasoning Evaluation: Results Report

**Benchmark started:** 2026-05-26T08:20:22.480011+00:00
**Benchmark finished:** 2026-06-02T05:42:56.608718+00:00
**Baseline dataset:** processed_dataset.json
**Status:** Partial

## Model: llama-3.2-3b-instruct
**Provider:** ollama

### Accuracy Summary

| Dataset | Attack | Total | Correct | Failed | Accuracy | Avg Latency (ms) |
|---------|--------|-------|---------|--------|----------|------------------|
| cross_lingual.arabic_base.json | cross_lingual (arabic_base) | 2215 | 522 | 10 | 23.57% | 2967.2 |
| cross_lingual.chinese_base.json | cross_lingual (chinese_base) | 2215 | 559 | 3 | 25.24% | 3369.1 |
| cross_lingual.french_base.json | cross_lingual (french_base) | 2215 | 555 | 1 | 25.06% | 2130.1 |
| cross_lingual.japanese_base.json | cross_lingual (japanese_base) | 2215 | 591 | 11 | 26.68% | 2074.8 |
| cross_lingual.russian_base.json | cross_lingual (russian_base) | 2215 | 556 | 16 | 25.10% | 1699.2 |
| processed_dataset.json | — | 2215 | 502 | 1 | 22.66% | 6189.3 |

### Per-Task Accuracy — cross_lingual (arabic_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 45 | 209 | 21.53% |
| incomplete_sentences | 0 | 13 | 0.00% |
| reading_comprehension | 145 | 500 | 29.00% |
| sentence_elimination | 89 | 500 | 17.80% |
| sentence_ordering | 60 | 319 | 18.81% |
| synonyms_and_antonyms | 37 | 174 | 21.26% |
| verbal_series | 146 | 500 | 29.20% |

### Per-Task Accuracy — cross_lingual (chinese_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 45 | 209 | 21.53% |
| incomplete_sentences | 1 | 13 | 7.69% |
| reading_comprehension | 153 | 500 | 30.60% |
| sentence_elimination | 93 | 500 | 18.60% |
| sentence_ordering | 67 | 319 | 21.00% |
| synonyms_and_antonyms | 41 | 174 | 23.56% |
| verbal_series | 159 | 500 | 31.80% |

### Per-Task Accuracy — cross_lingual (french_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 45 | 209 | 21.53% |
| incomplete_sentences | 4 | 13 | 30.77% |
| reading_comprehension | 148 | 500 | 29.60% |
| sentence_elimination | 88 | 500 | 17.60% |
| sentence_ordering | 63 | 319 | 19.75% |
| synonyms_and_antonyms | 46 | 174 | 26.44% |
| verbal_series | 161 | 500 | 32.20% |

### Per-Task Accuracy — cross_lingual (japanese_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 54 | 209 | 25.84% |
| incomplete_sentences | 3 | 13 | 23.08% |
| reading_comprehension | 153 | 500 | 30.60% |
| sentence_elimination | 90 | 500 | 18.00% |
| sentence_ordering | 53 | 319 | 16.61% |
| synonyms_and_antonyms | 57 | 174 | 32.76% |
| verbal_series | 181 | 500 | 36.20% |

### Per-Task Accuracy — cross_lingual (russian_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 50 | 209 | 23.92% |
| incomplete_sentences | 6 | 13 | 46.15% |
| reading_comprehension | 161 | 500 | 32.20% |
| sentence_elimination | 86 | 500 | 17.20% |
| sentence_ordering | 43 | 319 | 13.48% |
| synonyms_and_antonyms | 48 | 174 | 27.59% |
| verbal_series | 162 | 500 | 32.40% |

### Per-Task Accuracy — baseline

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 49 | 209 | 23.44% |
| incomplete_sentences | 1 | 13 | 7.69% |
| reading_comprehension | 129 | 500 | 25.80% |
| sentence_elimination | 92 | 500 | 18.40% |
| sentence_ordering | 63 | 319 | 19.75% |
| synonyms_and_antonyms | 35 | 174 | 20.11% |
| verbal_series | 133 | 500 | 26.60% |

### Robustness Metrics

| Attack | Acc. Drop (Δ) | Flip Rate | Consistency | Pos. Transfer | Neg. Transfer | Rank Cons. |
|--------|---------------|-----------|-------------|--------------|--------------|------------|
| cross_lingual (arabic_base) | -0.90% | 69.72% | 26.28% | 30.28% | 25.10% | -0.058 |
| cross_lingual (chinese_base) | -2.57% | 68.13% | 25.19% | 31.87% | 23.23% | 0.109 |
| cross_lingual (french_base) | -2.39% | 64.94% | 28.44% | 35.06% | 26.50% | -0.007 |
| cross_lingual (japanese_base) | -4.02% | 65.94% | 26.68% | 34.06% | 24.52% | -0.060 |
| cross_lingual (russian_base) | -2.44% | 70.92% | 25.10% | 29.08% | 23.93% | -0.000 |

---

## Model: llama-3.1-8b-instruct
**Provider:** ollama

### Accuracy Summary

| Dataset | Attack | Total | Correct | Failed | Accuracy | Avg Latency (ms) |
|---------|--------|-------|---------|--------|----------|------------------|
| cross_lingual.arabic_base.json | cross_lingual (arabic_base) | 2215 | 594 | 4 | 26.82% | 2352.9 |
| cross_lingual.chinese_base.json | cross_lingual (chinese_base) | 2215 | 670 | 0 | 30.25% | 5407.7 |
| cross_lingual.french_base.json | cross_lingual (french_base) | 2215 | 665 | 0 | 30.02% | 6800.0 |
| cross_lingual.japanese_base.json | cross_lingual (japanese_base) | 2215 | 611 | 1 | 27.58% | 3107.8 |
| cross_lingual.russian_base.json | cross_lingual (russian_base) | 2215 | 622 | 3 | 28.08% | 2263.6 |
| processed_dataset.json | — | 2215 | 691 | 1 | 31.20% | 4519.6 |

### Per-Task Accuracy — cross_lingual (arabic_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 40 | 209 | 19.14% |
| incomplete_sentences | 2 | 13 | 15.38% |
| reading_comprehension | 193 | 500 | 38.60% |
| sentence_elimination | 113 | 500 | 22.60% |
| sentence_ordering | 60 | 319 | 18.81% |
| synonyms_and_antonyms | 46 | 174 | 26.44% |
| verbal_series | 140 | 500 | 28.00% |

### Per-Task Accuracy — cross_lingual (chinese_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 55 | 209 | 26.32% |
| incomplete_sentences | 4 | 13 | 30.77% |
| reading_comprehension | 217 | 500 | 43.40% |
| sentence_elimination | 88 | 500 | 17.60% |
| sentence_ordering | 62 | 319 | 19.44% |
| synonyms_and_antonyms | 63 | 174 | 36.21% |
| verbal_series | 181 | 500 | 36.20% |

### Per-Task Accuracy — cross_lingual (french_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 57 | 209 | 27.27% |
| incomplete_sentences | 3 | 13 | 23.08% |
| reading_comprehension | 250 | 500 | 50.00% |
| sentence_elimination | 84 | 500 | 16.80% |
| sentence_ordering | 65 | 319 | 20.38% |
| synonyms_and_antonyms | 44 | 174 | 25.29% |
| verbal_series | 162 | 500 | 32.40% |

### Per-Task Accuracy — cross_lingual (japanese_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 45 | 209 | 21.53% |
| incomplete_sentences | 3 | 13 | 23.08% |
| reading_comprehension | 214 | 500 | 42.80% |
| sentence_elimination | 91 | 500 | 18.20% |
| sentence_ordering | 48 | 319 | 15.05% |
| synonyms_and_antonyms | 49 | 174 | 28.16% |
| verbal_series | 161 | 500 | 32.20% |

### Per-Task Accuracy — cross_lingual (russian_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 58 | 209 | 27.75% |
| incomplete_sentences | 1 | 13 | 7.69% |
| reading_comprehension | 222 | 500 | 44.40% |
| sentence_elimination | 89 | 500 | 17.80% |
| sentence_ordering | 53 | 319 | 16.61% |
| synonyms_and_antonyms | 48 | 174 | 27.59% |
| verbal_series | 151 | 500 | 30.20% |

### Per-Task Accuracy — baseline

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 46 | 209 | 22.01% |
| incomplete_sentences | 2 | 13 | 15.38% |
| reading_comprehension | 244 | 500 | 48.80% |
| sentence_elimination | 105 | 500 | 21.00% |
| sentence_ordering | 76 | 319 | 23.82% |
| synonyms_and_antonyms | 60 | 174 | 34.48% |
| verbal_series | 158 | 500 | 31.60% |

### Robustness Metrics

| Attack | Acc. Drop (Δ) | Flip Rate | Consistency | Pos. Transfer | Neg. Transfer | Rank Cons. |
|--------|---------------|-----------|-------------|--------------|--------------|------------|
| cross_lingual (arabic_base) | +4.38% | 57.89% | 34.72% | 42.11% | 31.36% | 0.216 |
| cross_lingual (chinese_base) | +0.95% | 50.51% | 35.58% | 49.49% | 29.27% | — |
| cross_lingual (french_base) | +1.17% | 46.89% | 38.92% | 53.11% | 32.48% | — |
| cross_lingual (japanese_base) | +3.61% | 54.27% | 35.85% | 45.73% | 31.36% | 0.140 |
| cross_lingual (russian_base) | +3.12% | 52.82% | 36.21% | 47.18% | 31.23% | 0.039 |

---

## Model: gemma2-27b
**Provider:** ollama

### Accuracy Summary

| Dataset | Attack | Total | Correct | Failed | Accuracy | Avg Latency (ms) |
|---------|--------|-------|---------|--------|----------|------------------|
| cross_lingual.arabic_base.json | cross_lingual (arabic_base) | 2215 | 1056 | 0 | 47.67% | 3113.1 |
| cross_lingual.chinese_base.json | cross_lingual (chinese_base) | 2215 | 1112 | 0 | 50.20% | 3018.1 |
| cross_lingual.french_base.json | cross_lingual (french_base) | 2215 | 1145 | 0 | 51.69% | 3165.1 |
| cross_lingual.japanese_base.json | cross_lingual (japanese_base) | 2215 | 1085 | 0 | 48.98% | 11454.4 |
| cross_lingual.russian_base.json | cross_lingual (russian_base) | 2215 | 1081 | 0 | 48.80% | 17468.7 |
| processed_dataset.json | — | 2215 | 1177 | 0 | 53.14% | 4913.0 |

### Per-Task Accuracy — cross_lingual (arabic_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 71 | 209 | 33.97% |
| incomplete_sentences | 5 | 13 | 38.46% |
| reading_comprehension | 338 | 500 | 67.60% |
| sentence_elimination | 123 | 500 | 24.60% |
| sentence_ordering | 151 | 319 | 47.34% |
| synonyms_and_antonyms | 95 | 174 | 54.60% |
| verbal_series | 273 | 500 | 54.60% |

### Per-Task Accuracy — cross_lingual (chinese_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 72 | 209 | 34.45% |
| incomplete_sentences | 5 | 13 | 38.46% |
| reading_comprehension | 340 | 500 | 68.00% |
| sentence_elimination | 127 | 500 | 25.40% |
| sentence_ordering | 145 | 319 | 45.45% |
| synonyms_and_antonyms | 111 | 174 | 63.79% |
| verbal_series | 312 | 500 | 62.40% |

### Per-Task Accuracy — cross_lingual (french_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 87 | 209 | 41.63% |
| incomplete_sentences | 6 | 13 | 46.15% |
| reading_comprehension | 354 | 500 | 70.80% |
| sentence_elimination | 118 | 500 | 23.60% |
| sentence_ordering | 165 | 319 | 51.72% |
| synonyms_and_antonyms | 107 | 174 | 61.49% |
| verbal_series | 308 | 500 | 61.60% |

### Per-Task Accuracy — cross_lingual (japanese_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 63 | 209 | 30.14% |
| incomplete_sentences | 8 | 13 | 61.54% |
| reading_comprehension | 344 | 500 | 68.80% |
| sentence_elimination | 122 | 500 | 24.40% |
| sentence_ordering | 148 | 319 | 46.39% |
| synonyms_and_antonyms | 103 | 174 | 59.20% |
| verbal_series | 297 | 500 | 59.40% |

### Per-Task Accuracy — cross_lingual (russian_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 73 | 209 | 34.93% |
| incomplete_sentences | 8 | 13 | 61.54% |
| reading_comprehension | 339 | 500 | 67.80% |
| sentence_elimination | 125 | 500 | 25.00% |
| sentence_ordering | 142 | 319 | 44.51% |
| synonyms_and_antonyms | 97 | 174 | 55.75% |
| verbal_series | 297 | 500 | 59.40% |

### Per-Task Accuracy — baseline

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 89 | 209 | 42.58% |
| incomplete_sentences | 8 | 13 | 61.54% |
| reading_comprehension | 373 | 500 | 74.60% |
| sentence_elimination | 152 | 500 | 30.40% |
| sentence_ordering | 140 | 319 | 43.89% |
| synonyms_and_antonyms | 101 | 174 | 58.05% |
| verbal_series | 314 | 500 | 62.80% |

### Robustness Metrics

| Attack | Acc. Drop (Δ) | Flip Rate | Consistency | Pos. Transfer | Neg. Transfer | Rank Cons. |
|--------|---------------|-----------|-------------|--------------|--------------|------------|
| cross_lingual (arabic_base) | +5.46% | 32.63% | 53.77% | 67.37% | 38.34% | — |
| cross_lingual (chinese_base) | +2.93% | 27.61% | 56.57% | 72.39% | 38.63% | — |
| cross_lingual (french_base) | +1.44% | 23.70% | 60.99% | 76.30% | 43.64% | — |
| cross_lingual (japanese_base) | +4.15% | 30.25% | 54.18% | 69.75% | 36.51% | — |
| cross_lingual (russian_base) | +4.33% | 27.87% | 58.10% | 72.13% | 42.20% | — |

---

## Model: gemma-3-27b
**Provider:** ollama

### Accuracy Summary

| Dataset | Attack | Total | Correct | Failed | Accuracy | Avg Latency (ms) |
|---------|--------|-------|---------|--------|----------|------------------|
| cross_lingual.arabic_base.json | cross_lingual (arabic_base) | 2215 | 844 | 0 | 38.10% | 6354.1 |
| cross_lingual.chinese_base.json | cross_lingual (chinese_base) | 2215 | 937 | 0 | 42.30% | 3808.0 |
| cross_lingual.french_base.json | cross_lingual (french_base) | 2215 | 935 | 1 | 42.21% | 3425.8 |
| cross_lingual.japanese_base.json | cross_lingual (japanese_base) | 2215 | 890 | 2 | 40.18% | 11535.4 |
| cross_lingual.russian_base.json | cross_lingual (russian_base) | 2215 | 911 | 3 | 41.13% | 11570.9 |
| processed_dataset.json | — | 2215 | 944 | 0 | 42.62% | 6548.1 |

### Per-Task Accuracy — cross_lingual (arabic_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 63 | 209 | 30.14% |
| incomplete_sentences | 5 | 13 | 38.46% |
| reading_comprehension | 287 | 500 | 57.40% |
| sentence_elimination | 102 | 500 | 20.40% |
| sentence_ordering | 88 | 319 | 27.59% |
| synonyms_and_antonyms | 82 | 174 | 47.13% |
| verbal_series | 217 | 500 | 43.40% |

### Per-Task Accuracy — cross_lingual (chinese_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 67 | 209 | 32.06% |
| incomplete_sentences | 3 | 13 | 23.08% |
| reading_comprehension | 301 | 500 | 60.20% |
| sentence_elimination | 109 | 500 | 21.80% |
| sentence_ordering | 97 | 319 | 30.41% |
| synonyms_and_antonyms | 93 | 174 | 53.45% |
| verbal_series | 267 | 500 | 53.40% |

### Per-Task Accuracy — cross_lingual (french_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 60 | 209 | 28.71% |
| incomplete_sentences | 9 | 13 | 69.23% |
| reading_comprehension | 296 | 500 | 59.20% |
| sentence_elimination | 122 | 500 | 24.40% |
| sentence_ordering | 105 | 319 | 32.92% |
| synonyms_and_antonyms | 95 | 174 | 54.60% |
| verbal_series | 248 | 500 | 49.60% |

### Per-Task Accuracy — cross_lingual (japanese_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 67 | 209 | 32.06% |
| incomplete_sentences | 5 | 13 | 38.46% |
| reading_comprehension | 262 | 500 | 52.40% |
| sentence_elimination | 105 | 500 | 21.00% |
| sentence_ordering | 101 | 319 | 31.66% |
| synonyms_and_antonyms | 91 | 174 | 52.30% |
| verbal_series | 259 | 500 | 51.80% |

### Per-Task Accuracy — cross_lingual (russian_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 66 | 209 | 31.58% |
| incomplete_sentences | 4 | 13 | 30.77% |
| reading_comprehension | 276 | 500 | 55.20% |
| sentence_elimination | 119 | 500 | 23.80% |
| sentence_ordering | 104 | 319 | 32.60% |
| synonyms_and_antonyms | 91 | 174 | 52.30% |
| verbal_series | 251 | 500 | 50.20% |

### Per-Task Accuracy — baseline

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 61 | 209 | 29.19% |
| incomplete_sentences | 5 | 13 | 38.46% |
| reading_comprehension | 297 | 500 | 59.40% |
| sentence_elimination | 129 | 500 | 25.80% |
| sentence_ordering | 105 | 319 | 32.92% |
| synonyms_and_antonyms | 88 | 174 | 50.57% |
| verbal_series | 259 | 500 | 51.80% |

### Robustness Metrics

| Attack | Acc. Drop (Δ) | Flip Rate | Consistency | Pos. Transfer | Neg. Transfer | Rank Cons. |
|--------|---------------|-----------|-------------|--------------|--------------|------------|
| cross_lingual (arabic_base) | +4.51% | 43.54% | 42.26% | 56.46% | 31.71% | — |
| cross_lingual (chinese_base) | +0.32% | 38.77% | 43.52% | 61.23% | 30.37% | — |
| cross_lingual (french_base) | +0.41% | 37.08% | 45.91% | 62.92% | 33.28% | — |
| cross_lingual (japanese_base) | +2.44% | 42.27% | 40.72% | 57.73% | 28.09% | 0.128 |
| cross_lingual (russian_base) | +1.49% | 39.51% | 43.88% | 60.49% | 31.55% | 0.225 |

---

## Model: qwen3.5-27b
**Provider:** ollama+opencode-go

### Accuracy Summary

| Dataset | Attack | Total | Correct | Failed | Accuracy | Avg Latency (ms) |
|---------|--------|-------|---------|--------|----------|------------------|
| cross_lingual.arabic_base.json | cross_lingual (arabic_base) | 152 | 95 | 0 | 62.50% | 27964.7 |
| cross_lingual.chinese_base.json | cross_lingual (chinese_base) | 200 | 158 | 0 | 79.00% | 43962.4 |
| cross_lingual.french_base.json | cross_lingual (french_base) | 136 | 108 | 0 | 79.41% | 48105.1 |
| cross_lingual.japanese_base.json | cross_lingual (japanese_base) | 146 | 111 | 0 | 76.03% | 14156.8 |
| cross_lingual.russian_base.json | cross_lingual (russian_base) | 162 | 130 | 0 | 80.25% | 12902.7 |
| processed_dataset.json | — | 886 | 658 | 1 | 74.27% | 75258.8 |

### Per-Task Accuracy — cross_lingual (arabic_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 6 | 15 | 40.00% |
| incomplete_sentences | 7 | 13 | 53.85% |
| reading_comprehension | 10 | 15 | 66.67% |
| sentence_elimination | 4 | 15 | 26.67% |
| sentence_ordering | 47 | 63 | 74.60% |
| synonyms_and_antonyms | 9 | 15 | 60.00% |
| verbal_series | 12 | 16 | 75.00% |

### Per-Task Accuracy — cross_lingual (chinese_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| sentence_ordering | 158 | 200 | 79.00% |

### Per-Task Accuracy — cross_lingual (french_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 4 | 5 | 80.00% |
| incomplete_sentences | 5 | 5 | 100.00% |
| reading_comprehension | 5 | 5 | 100.00% |
| sentence_elimination | 4 | 5 | 80.00% |
| sentence_ordering | 86 | 109 | 78.90% |
| synonyms_and_antonyms | 2 | 3 | 66.67% |
| verbal_series | 2 | 4 | 50.00% |

### Per-Task Accuracy — cross_lingual (japanese_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 8 | 13 | 61.54% |
| incomplete_sentences | 8 | 12 | 66.67% |
| reading_comprehension | 12 | 12 | 100.00% |
| sentence_elimination | 5 | 14 | 35.71% |
| sentence_ordering | 59 | 69 | 85.51% |
| synonyms_and_antonyms | 8 | 13 | 61.54% |
| verbal_series | 11 | 13 | 84.62% |

### Per-Task Accuracy — cross_lingual (russian_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 6 | 7 | 85.71% |
| incomplete_sentences | 5 | 5 | 100.00% |
| reading_comprehension | 5 | 6 | 83.33% |
| sentence_elimination | 4 | 5 | 80.00% |
| sentence_ordering | 100 | 126 | 79.37% |
| synonyms_and_antonyms | 4 | 7 | 57.14% |
| verbal_series | 6 | 6 | 100.00% |

### Per-Task Accuracy — baseline

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| reading_comprehension | 64 | 77 | 83.12% |
| sentence_elimination | 320 | 490 | 65.31% |
| sentence_ordering | 274 | 319 | 85.89% |

### Robustness Metrics

| Attack | Acc. Drop (Δ) | Flip Rate | Consistency | Pos. Transfer | Neg. Transfer | Rank Cons. |
|--------|---------------|-----------|-------------|--------------|--------------|------------|
| cross_lingual (arabic_base) | +13.92% | 19.05% | 77.22% | 80.95% | 62.50% | -0.090 |
| cross_lingual (chinese_base) | +8.50% | 14.86% | 81.50% | 85.14% | 56.00% | 0.027 |
| cross_lingual (french_base) | +8.77% | 15.00% | 78.95% | 85.00% | 35.71% | 0.160 |
| cross_lingual (japanese_base) | +9.30% | 13.33% | 81.40% | 86.67% | 45.45% | 0.413 |
| cross_lingual (russian_base) | +9.09% | 14.53% | 80.30% | 85.47% | 40.00% | 0.260 |

---

## Model: qwen2.5-coder-7b
**Provider:** ollama

### Accuracy Summary

| Dataset | Attack | Total | Correct | Failed | Accuracy | Avg Latency (ms) |
|---------|--------|-------|---------|--------|----------|------------------|
| cross_lingual.arabic_base.json | cross_lingual (arabic_base) | 2215 | 701 | 0 | 31.65% | 2771.6 |
| cross_lingual.chinese_base.json | cross_lingual (chinese_base) | 2215 | 916 | 0 | 41.35% | 4195.7 |
| cross_lingual.french_base.json | cross_lingual (french_base) | 2215 | 877 | 0 | 39.59% | 4703.6 |
| cross_lingual.japanese_base.json | cross_lingual (japanese_base) | 2215 | 813 | 0 | 36.70% | 1662.2 |
| cross_lingual.russian_base.json | cross_lingual (russian_base) | 2215 | 834 | 0 | 37.65% | 3306.1 |
| processed_dataset.json | — | 2215 | 878 | 2 | 39.64% | 5547.1 |

### Per-Task Accuracy — cross_lingual (arabic_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 57 | 209 | 27.27% |
| incomplete_sentences | 4 | 13 | 30.77% |
| reading_comprehension | 231 | 500 | 46.20% |
| sentence_elimination | 103 | 500 | 20.60% |
| sentence_ordering | 88 | 319 | 27.59% |
| synonyms_and_antonyms | 57 | 174 | 32.76% |
| verbal_series | 161 | 500 | 32.20% |

### Per-Task Accuracy — cross_lingual (chinese_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 68 | 209 | 32.54% |
| incomplete_sentences | 6 | 13 | 46.15% |
| reading_comprehension | 289 | 500 | 57.80% |
| sentence_elimination | 120 | 500 | 24.00% |
| sentence_ordering | 95 | 319 | 29.78% |
| synonyms_and_antonyms | 86 | 174 | 49.43% |
| verbal_series | 252 | 500 | 50.40% |

### Per-Task Accuracy — cross_lingual (french_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 66 | 209 | 31.58% |
| incomplete_sentences | 7 | 13 | 53.85% |
| reading_comprehension | 286 | 500 | 57.20% |
| sentence_elimination | 131 | 500 | 26.20% |
| sentence_ordering | 102 | 319 | 31.97% |
| synonyms_and_antonyms | 79 | 174 | 45.40% |
| verbal_series | 206 | 500 | 41.20% |

### Per-Task Accuracy — cross_lingual (japanese_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 65 | 209 | 31.10% |
| incomplete_sentences | 5 | 13 | 38.46% |
| reading_comprehension | 277 | 500 | 55.40% |
| sentence_elimination | 114 | 500 | 22.80% |
| sentence_ordering | 96 | 319 | 30.09% |
| synonyms_and_antonyms | 68 | 174 | 39.08% |
| verbal_series | 188 | 500 | 37.60% |

### Per-Task Accuracy — cross_lingual (russian_base)

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 69 | 209 | 33.01% |
| incomplete_sentences | 6 | 13 | 46.15% |
| reading_comprehension | 288 | 500 | 57.60% |
| sentence_elimination | 124 | 500 | 24.80% |
| sentence_ordering | 85 | 319 | 26.65% |
| synonyms_and_antonyms | 75 | 174 | 43.10% |
| verbal_series | 187 | 500 | 37.40% |

### Per-Task Accuracy — baseline

| Task | Correct | Total | Accuracy |
|------|---------|-------|----------|
| analogies | 65 | 209 | 31.10% |
| incomplete_sentences | 5 | 13 | 38.46% |
| reading_comprehension | 302 | 500 | 60.40% |
| sentence_elimination | 127 | 500 | 25.40% |
| sentence_ordering | 89 | 319 | 27.90% |
| synonyms_and_antonyms | 74 | 174 | 42.53% |
| verbal_series | 216 | 500 | 43.20% |

### Robustness Metrics

| Attack | Acc. Drop (Δ) | Flip Rate | Consistency | Pos. Transfer | Neg. Transfer | Rank Cons. |
|--------|---------------|-----------|-------------|--------------|--------------|------------|
| cross_lingual (arabic_base) | +7.99% | 49.43% | 44.06% | 50.57% | 39.79% | — |
| cross_lingual (chinese_base) | -1.72% | 33.03% | 51.83% | 66.97% | 41.88% | — |
| cross_lingual (french_base) | +0.05% | 32.00% | 53.00% | 68.00% | 43.16% | — |
| cross_lingual (japanese_base) | +2.93% | 37.36% | 52.10% | 62.64% | 45.18% | — |
| cross_lingual (russian_base) | +1.99% | 34.40% | 56.48% | 65.60% | 50.49% | 0.116 |

---
