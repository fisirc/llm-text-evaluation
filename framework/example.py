from pathlib import Path

from lib import Benchmark, providers, attacks

benchmark = Benchmark(
    baseline=Path("dataset.json"),
    attacked=[
        (Path("dataset.french.json"), attacks.CrossLingual("fr_mixed")),
        (Path("dataset.synonyms.json"), attacks.Synonym("synonym_1")),
        (Path("dataset.paraphrasing.json"), attacks.Paraphrasing("paraphrasing_1")),
    ],
    models=[
        providers.Ollama(model="qwen2.5:7b-instruct", batch=2),
        providers.OpenRouter(
            model="nvidia/nemotron-3-super-120b-a12b:free",
            api_key="sk-or-v1-...",
            batch=2,
        ),
        providers.OpencodeGo(model="kimi-k2.6", api_key="oc-go-v1-...", batch=2),
        providers.OpencodeGo(model="minimax-m2.7", api_key="oc-go-v1-...", batch=1),
    ],
    concurrency=4,
    partial_results_dir=".partial",
)

result = benchmark.run()

if result.is_finished:
    for model in result:
        for ds in model.evaluated_datasets:
            print(ds.stats)
    result.save("stats.json")
