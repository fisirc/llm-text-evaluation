"""Abstract base provider for LLM inference."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


class BaseProvider(ABC):
    """Abstract base class for LLM inference providers.

    All providers communicate via the OpenAI-compatible chat completions API,
    but differ in base URL, authentication, and capability details.

    Subclasses must implement:
        - complete(): Send a chat completion request
        - provider_name: Human-readable provider identifier

    Configurable per-provider options (set in constructor):
        - temperature: Sampling temperature (default 0.0 for deterministic output)
        - max_tokens: Maximum tokens in the response
        - response_format_mode: How to handle structured output
          ("json_schema", "json_object", or "none")
    """

    model: str
    batch_size: int
    temperature: float
    max_tokens: int | None
    response_format_mode: str

    @abstractmethod
    async def complete(
        self,
        messages: list[dict[str, str]],
        response_format: dict | None = None,
    ) -> tuple[str, int, int]:
        """Send a chat completion request.

        Args:
            messages: List of chat messages (role + content dicts).
            response_format: Optional structured output format spec.

        Returns:
            Tuple of (content_text, prompt_tokens, completion_tokens).

        Raises:
            openai.APIError: On API communication failure.
        """
        ...

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Human-readable provider identifier for reports."""
        ...

    @property
    def model_slug(self) -> str:
        """URL-safe model identifier for file naming."""
        return self.model.replace("/", "_").replace(":", "_").replace(".", "-")

    def __repr__(self) -> str:
        return (
            f"{type(self).__name__}(model={self.model!r}, batch={self.batch_size}, "
            f"temperature={self.temperature})"
        )
