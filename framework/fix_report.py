import asyncio
from lib import Benchmark, providers, attacks, CrossLingualLanguage
from pathlib import Path

BENCHMARK_DIR = Path(__file__).resolve().parent.parent / "dataset/final/evaluation"

translation_model = providers.OpencodeGo(
    model='glm-5',
    api_key="123",
    batch=6,
    enforce_json=True,
    temperature=0.0,
    concurrency=3,
)

baseline = str(Path(__file__).resolve().parent.parent / 'dataset/final/verbal_reasoning_tests.json')
attack_base = Path(__file__).resolve().parent.parent / 'dataset/final/attacks/cross_lingual/'

attack_list = [
    attacks.CrossLingual(
        label='arabic_base',
        load_from=str(attack_base / 'verbal_reasoning_tests.cross_lingual.arabic.json'),
        language=CrossLingualLanguage.ARABIC,
        model=translation_model,
    ),
    attacks.CrossLingual(
        label='chinese_base',
        load_from=str(attack_base / 'verbal_reasoning_tests.cross_lingual.chinese.json'),
        language=CrossLingualLanguage.CHINESE,
        model=translation_model,
    ),
    attacks.CrossLingual(
        label='french_base',
        load_from=str(attack_base / 'verbal_reasoning_tests.cross_lingual.french.json'),
        language=CrossLingualLanguage.FRENCH,
        model=translation_model,
    ),
    attacks.CrossLingual(
        label='japanese_base',
        load_from=str(attack_base / 'verbal_reasoning_tests.cross_lingual.japanese.json'),
        language=CrossLingualLanguage.JAPANESE,
        model=translation_model,
    ),
    attacks.CrossLingual(
        label='swahili_base',
        load_from=str(attack_base / 'verbal_reasoning_tests.cross_lingual.swahili.json'),
        language=CrossLingualLanguage.SWAHILI,
        model=translation_model,
    ),
    attacks.CrossLingual(
        label='russian_base',
        load_from=str(attack_base / 'verbal_reasoning_tests.cross_lingual.russian.json'),
        language=CrossLingualLanguage.RUSSIAN,
        model=translation_model,
    ),
]

model_list=[
    providers.Ollama(
        model='gemma2:27b',
        alias='gemma2-27b',
        url='http://localhost:11434',
        batch=3,
        enforce_json=True,
        temperature=0.0,
        concurrency=5,
    ),
    providers.Ollama(
        model='nidumai/nidum-gemma-3-27b-instruct-uncensored:q3_k_m',
        alias='gemma-3-27b',
        url='http://localhost:11434',
        batch=3,
        enforce_json=True,
        temperature=0.0,
        concurrency=5,
        logprobs=True,
        top_logprobs=5,
    ),
    providers.Ollama(
        model='sammcj/qwen2.5-coder-7b-instruct:q8_0',
        alias='qwen2.5-coder-7b',
        url='http://localhost:11434',
        batch=3,
        enforce_json=False,
        temperature=0.0,
        concurrency=5,
        logprobs=True,
        top_logprobs=5,
    ),
    providers.ProviderPool(
        name="qwen3.5-plus",
        alias="qwen3.5-27b",
        providers=[
            providers.Ollama(
                model='kwangsuklee/Qwen3.5-27B-Claude-4.6-Opus-Reasoning-Distilled-GGUF:latest',
                url='http://localhost:11434',
                batch=6,
                enforce_json=True,
                temperature=0.0,
                concurrency=2,
                logprobs=True,
                top_logprobs=5,
            )
        ]
    ),
    providers.Ollama(
        model='artifish/llama3.2-uncensored:latest',
        alias='llama-3.2-3b-instruct',
        url='http://localhost:11434',
        batch=3,
        enforce_json=False,
        temperature=0.0,
        concurrency=5,
        logprobs=True,
        top_logprobs=5,
    ),
    providers.Ollama(
        model='dolphin3:latest',
        alias='llama-3.1-8b-instruct',
        url='http://localhost:11434',
        batch=3,
        enforce_json=True,
        temperature=0.0,
        concurrency=5,
        logprobs=True,
        top_logprobs=5,
    ),
]

b = Benchmark(
    models=model_list,
    baseline=baseline,
    attacks=attack_list,
    partial_results_dir=BENCHMARK_DIR / 'partial',
)
res = b._build_interrupted_result()
res._save_html(str(BENCHMARK_DIR / 'validation_report.html'))
res._save_json(str(BENCHMARK_DIR / 'validation_report.json'))
print('Report successfully regenerated!')

