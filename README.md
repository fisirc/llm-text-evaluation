# Evaluating LLMs performance for verbal reasoning tasks

This project aims to provide a framework to evaluate how different models perform
when solving verbal reasoning tasks, such as:

- **Reading comprehension**: Answer verbal reasoning questions about long texts (~2500 characters).
- **Sentence ordering**: Find the logical sequence that creates a coherent, well-structured text.
- **Sentence elimination**: Identify the sentence that does NOT belong thematically or logically.
- **Verbal series**: Identify the pattern connecting the words (synonyms, antonyms, categories, relationships).
- **Analogies**: Match the underlying relationship between the given pair of concepts.
- **Synonyms and antonyms**: Select the word with the closest or most opposite meaning in context.
- **Incomplete sentences**: Choose the option that best completes the sentence's meaning and grammar.

The framework supports multiple providers, including [Opencode](https://opencode.ai/), [OpenRouter](https://openrouter.ai/), and [Ollama](https://ollama.ai/) for self-hosted models.

## Attacks

Attacks are variants of the original dataset, with tweaks that may result interesting for the benchmark.

For example, the `CrossLingual` attack evaluates how well the
model performs in a translated version of the original question.

The current implementation supports Chinese and French lingual perturbations.

## Dataset

The datasets consist of +10 thousand of spanish verbal reasoning questions. See [dataset.json](dataset/final/dataset.json).

## Using the framework

```py
import os
from pathlib import Path
from llm_verbal_framework import Benchmark, providers, attacks

os.environ['OPENCODEGO_APIKEY'] = 'sk-...'
os.environ['OPENROUTER_APIKEY'] = '??-...'

benchmark = Benchmark(
    baseline=Path("dataset.json"),
    attacks=[
        attacks.CrossLingual(language=CrossLingualLanguage.FRENCH),
        attacks.CrossLingual(language=CrossLingualLanguage.CHINESE),
        attacks.CrossLingual("fr_mixed"),
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
            batch=2,
            logprobs=True,
            top_logprobs=5,
        ),
        providers.OpencodeGo(
            model="kimi-k2.6",
            label="temp=0.0",
            logprobs=True,
            top_logprobs=5,
        ),
        providers.OpencodeGo(
            model="kimi-k2.6",
            batch=1,
            temperature=0.7,
            label="kimi_temp_0.7",
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
        if ds._robustness:
            r = ds._robustness
            print(f"    accuracy_drop={r.accuracy_drop:+.2%}  flip_rate={r.flip_rate:.2%}  pos_transfer={r.positive_transfer:.2%}")

if result.is_finished:
    result.save("stats.json")
    result.save("report.md")
else:
    print("\nWarning: benchmark did not finish - partial results were saved.")
    result.save("stats.json")
```
