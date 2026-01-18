"""
Configuration for Story Engine microservice.
Loads settings from environment variables.
"""

import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment."""

    # Server
    host: str = "0.0.0.0"
    port: int = 5001
    debug: bool = False

    # Database
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql://rolia:rolia@localhost:5432/rolia"
    )

    # Redis
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    redis_ttl_story_state: int = 86400  # 24 hours
    redis_ttl_ai_context: int = 300  # 5 minutes
    redis_ttl_npc_memory: int = 86400  # 24 hours

    # Story Engine
    default_karma: int = 50
    karma_min: int = 0
    karma_max: int = 100
    default_relationship: int = 50
    betrayal_threshold_default: int = 30
    redemption_threshold_default: int = 80

    # NLP
    spacy_model: str = "es_core_news_sm"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Karma action mappings
KARMA_ACTIONS = {
    # Positive actions
    "helped_innocent": 10,
    "showed_mercy": 15,
    "kept_promise": 10,
    "donated_to_poor": 12,
    "exposed_corruption": 20,
    "saved_life": 25,
    "protected_weak": 15,
    "told_truth": 5,
    "forgave_enemy": 20,
    "self_sacrifice": 30,

    # Negative actions
    "lied_for_gain": -5,
    "stole": -8,
    "killed_unarmed": -20,
    "betrayed_ally": -30,
    "broke_promise": -15,
    "tortured": -25,
    "killed_innocent": -40,
    "abandoned_ally": -20,
    "blackmailed": -15,
    "poisoned": -20,
}

# Faction configurations
FACTION_THRESHOLDS = {
    "corona": {
        "trust_threshold": 60,
        "betray_threshold": 30,
        "hero_threshold": 80,
    },
    "pueblo": {
        "hero_threshold": 80,
        "villain_threshold": 20,
    },
    "orden_llama": {
        "recruit_threshold": -40,
    },
    "gremio_mercaderes": {
        "discount_threshold": 70,
        "ban_threshold": 20,
    },
}

# NPC personality traits ranges
NPC_TRAIT_RANGES = {
    "cunning": (0, 100),
    "loyalty": (0, 100),
    "patience": (0, 100),
    "pride": (0, 100),
    "cruelty": (0, 100),
    "compassion": (0, 100),
    "courage": (0, 100),
    "greed": (0, 100),
    "honor": (0, 100),
    "wisdom": (0, 100),
}

# Emotional states for NPCs
NPC_EMOTIONAL_STATES = [
    "neutral",
    "friendly",
    "hostile",
    "suspicious",
    "nervous",
    "fearful",
    "angry",
    "grateful",
    "sad",
    "excited",
    "calculating",
    "desperate",
]

# Scene tension levels
TENSION_LEVELS = {
    "low": {"music": "ambient", "pace": "slow", "danger": 0.1},
    "normal": {"music": "exploration", "pace": "normal", "danger": 0.3},
    "high": {"music": "tension", "pace": "fast", "danger": 0.6},
    "critical": {"music": "combat", "pace": "urgent", "danger": 0.9},
}
