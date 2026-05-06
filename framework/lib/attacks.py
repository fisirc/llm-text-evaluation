"""Attack type definitions for adversarial robustness evaluation.

Attack types are metadata markers applied to datasets. They describe what kind
of perturbation was applied to the samples. The model being evaluated is NOT
aware of these attacks, they are purely for statistical analysis.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AttackType:
    """Base class for attack type markers.

    Attributes:
        label: User-defined label for this specific attack variant, e.g. synonym_low_intensity.
    """

    label: str

    @property
    def attack_name(self) -> str:
        """Machine-readable attack type name, derived from the class name."""
        # CamelCase to snake_case
        name = type(self).__name__
        result: list[str] = []
        for i, char in enumerate(name):
            if char.isupper() and i > 0:
                result.append("_")
            result.append(char.lower())
        return "".join(result)


@dataclass(frozen=True)
class CrossLingual(AttackType):
    """Cross-lingual perturbation: translating parts of the input to another language.

    Examples: translate prompt, context, question, or mix languages.
    """
    pass


@dataclass(frozen=True)
class Synonym(AttackType):
    """Synonym substitution: replacing key words with synonyms."""
    pass


@dataclass(frozen=True)
class Paraphrasing(AttackType):
    """Paraphrasing: rewriting sentences without changing meaning."""
    pass


@dataclass(frozen=True)
class MinimalPairs(AttackType):
    """Minimal pairs: changing a single critical word (negation, quantifier, connector)."""
    pass


@dataclass(frozen=True)
class ShortcutRemoval(AttackType):
    """Shortcut removal: eliminating explicit reasoning cues.

    Removes connectors like 'because', 'therefore', 'first/then'.
    """
    pass
