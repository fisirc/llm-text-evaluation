from llm_verbal_framework import load_dataset, benchmark, providers, AttackType

dataset_normal = load_dataset("dataset.json", attacks=[None])
dataset_french = load_dataset("dataset.french.json", attacks=[AttackType.CrossLingual("fr_mixed")])
dataset_synonyms = load_dataset("dataset.synonyms.json", attacks=[AttackType.Synonym("synonym_1")])
dataset_paraphrasing = load_dataset("dataset.paraphrasing.json", attacks=[AttackType.Paraphrasing("paraphrasing_1")])

result = benchmark(
    datasets=[
        dataset_normal,
        dataset_french,
        dataset_synonyms,
        dataset_paraphrasing,
    ],
    partial_resulst_dir=".partial",
    concurrency=4, # max number of parallel llm requests
    models=[
        # batch means how much samples are sent together to the model in a single request
        providers.OpenRouter(model="nvidia/nemotron_3_super", batch=2, api_key="..."),
        providers.OpenRouter(model="inclusion/ling_2.6_1t", batch=2, api_key="..."),
        providers.Ollama(model="qwen:7b", url="localhost:6969", batch=2),
        providers.Ollama(model="llama3.1:latest", url="remote.server", auth="...", batch=2),
        providers.HuggingFace(model="meta-llama/Llama-2-7b-chat-hf", batch=2),
    ],
)

if result.is_finished:
    for model in result:
        for dataset in model.evaluated_datasets:
            print(dataset.stats)
    result.save("stats.json")
