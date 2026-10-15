"""
AI Engine Factory and Registry.
Allows drop-in instantiation of any of the 5 AI architectures matching the
plug-and-play design philosophy of mechanisms/base.py.
"""
from typing import Dict, Type
from simulation.ai.base import BaseAI
from simulation.ai.simple_fsm import SimpleDecisionEngine
from simulation.ai.behavior_tree import BehaviorTreeEngine
from simulation.ai.fuzzy import FuzzySteeringEngine
from simulation.ai.goap import GOAPSteeringEngine
from simulation.ai.utility import UtilityAIEngine


AI_REGISTRY: Dict[str, Type[BaseAI]] = {
    "simple": SimpleDecisionEngine,
    "fsm": SimpleDecisionEngine,
    "behavior_tree": BehaviorTreeEngine,
    "fuzzy": FuzzySteeringEngine,
    "goap": GOAPSteeringEngine,
    "utility": UtilityAIEngine,
}


def make_ai_engine(ai_type: str) -> BaseAI:
    """
    Factory returning an initialized AI controller instance.
    Supports: 'simple' / 'fsm', 'behavior_tree', 'fuzzy', 'goap', 'utility'.
    """
    key = ai_type.lower()
    if key not in AI_REGISTRY:
        raise ValueError(
            f"Unknown AI architecture: {ai_type!r}. Available: {list(AI_REGISTRY.keys())}"
        )
    return AI_REGISTRY[key]()
