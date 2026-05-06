"""Prompt engineering for LLM verbal reasoning evaluation.

Handles:
- Building system and user messages per task type
- Constructing JSON schema for structured output (single and batch)
- Parsing model responses with fallback strategies
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass

from .types import Sample, TaskType


# ── System prompt ──────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are an expert evaluator for verbal reasoning tasks in Spanish.
You will receive questions with numbered answer options (0-based index).
Analyze each question carefully and select the BEST answer.

TASK-SPECIFIC GUIDELINES:
- Reading comprehension: Focus on what the text explicitly states or strongly implies.
- Sentence ordering (plan de redacción): Find the logical sequence that creates a coherent, well-structured text.
- Sentence elimination: Identify the sentence that does NOT belong thematically or logically.
- Verbal series: Identify the pattern connecting the words (synonyms, antonyms, categories, relationships).
- Analogies: Match the underlying relationship between the given pair of concepts.
- Synonyms and antonyms: Select the word with the closest or most opposite meaning in context.
- Incomplete sentences: Choose the option that best completes the sentence's meaning and grammar.

RULES:
- Consider the context, question, and ALL options before deciding.
- Your response must be valid JSON matching the required schema.
- Provide ONLY the answer index, no explanations."""


# ── JSON schemas ───────────────────────────────────────────────────────────────

SINGLE_ANSWER_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "single_answer",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "answer": {
                    "type": "integer",
                    "description": "0-based index of the correct option",
                },
            },
            "required": ["answer"],
            "additionalProperties": False,
        },
    },
}

BATCH_ANSWER_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "batch_answers",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "answers": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "integer",
                                "description": "Sample ID from the question",
                            },
                            "answer": {
                                "type": "integer",
                                "description": "0-based index of the correct option",
                            },
                        },
                        "required": ["id", "answer"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["answers"],
            "additionalProperties": False,
        },
    },
}


# ── Prompt building ────────────────────────────────────────────────────────────


def _format_options(options: tuple[str, ...]) -> str:
    """Format options as numbered list."""
    return "\n".join(f"{i}) {opt}" for i, opt in enumerate(options))


def build_single_prompt(sample: Sample) -> str:
    """Build user message for a single sample.

    Args:
        sample: The sample to format as a prompt.

    Returns:
        Formatted user message string.
    """
    return (
        f"Question (id: {sample.id}, type: {sample.task.value}):\n"
        f"{sample.question}\n\n"
        f"Options:\n{_format_options(sample.options)}"
    )


def build_batch_prompt(samples: list[Sample]) -> str:
    """Build user message for a batch of samples.

    Args:
        samples: List of samples to format as a single prompt.

    Returns:
        Formatted user message string with all questions.
    """
    parts: list[str] = ["Answer each of the following questions:\n"]

    for i, sample in enumerate(samples, 1):
        parts.append(
            f"---\nQuestion {i} (id: {sample.id}, type: {sample.task.value}):\n"
            f"{sample.question}\n\n"
            f"Options:\n{_format_options(sample.options)}\n"
        )

    return "\n".join(parts)


def build_messages(
    samples: list[Sample],
) -> tuple[list[dict[str, str]], dict]:
    """Build the full message list and response format for a batch of samples.

    Args:
        samples: One or more samples to include in this request.

    Returns:
        Tuple of (messages, response_format) ready for the provider.
    """
    if len(samples) == 1:
        user_msg = build_single_prompt(samples[0])
        response_format = SINGLE_ANSWER_SCHEMA
    else:
        user_msg = build_batch_prompt(samples)
        response_format = BATCH_ANSWER_SCHEMA

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_msg},
    ]

    return messages, response_format


# ── Response parsing ───────────────────────────────────────────────────────────


def parse_single_response(raw: str) -> int | None:
    """Parse a single-answer JSON response.

    Tries JSON parsing first, then falls back to regex extraction.

    Args:
        raw: Raw model response text.

    Returns:
        The predicted answer index, or None if parsing fails.
    """
    # Try JSON parse
    try:
        data = json.loads(raw.strip())
        if isinstance(data, dict) and "answer" in data:
            answer = data["answer"]
            if isinstance(answer, int):
                return answer
    except (json.JSONDecodeError, TypeError):
        pass

    # Fallback: extract first integer from response
    match = re.search(r"\b(\d+)\b", raw)
    if match:
        return int(match.group(1))

    return None


def parse_batch_response(
    raw: str,
    expected_ids: list[int],
) -> dict[int, int | None]:
    """Parse a batch-answer JSON response.

    Returns a mapping from sample ID to predicted answer index.

    Args:
        raw: Raw model response text.
        expected_ids: List of sample IDs we expect in the response.

    Returns:
        Dict mapping sample_id → predicted_answer (None if missing/failed).
    """
    results: dict[int, int | None] = {sid: None for sid in expected_ids}

    # Try JSON parse
    try:
        data = json.loads(raw.strip())
        if isinstance(data, dict) and "answers" in data:
            for item in data["answers"]:
                if isinstance(item, dict) and "id" in item and "answer" in item:
                    sid = item["id"]
                    answer = item["answer"]
                    if sid in results and isinstance(answer, int):
                        results[sid] = answer
    except (json.JSONDecodeError, TypeError):
        pass

    return results
