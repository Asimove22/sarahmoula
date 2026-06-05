"""
Gestion et composition automatique des hashtags par thème.
"""

import json
import logging
import random
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).parent.parent / "config.json"


class HashtagManager:
    """Compose des ensembles de hashtags à partir de thèmes définis dans config.json."""

    MAX_HASHTAGS = 30

    def __init__(self, config_path: Path = CONFIG_PATH):
        with open(config_path, encoding="utf-8") as f:
            cfg = json.load(f)
        self.hashtag_sets: dict = cfg.get("hashtags", {})
        self.auto_add = cfg.get("publishing", {}).get("auto_add_hashtags", True)
        self.max_tags = cfg.get("publishing", {}).get("max_hashtags", self.MAX_HASHTAGS)

    def get_themes(self) -> List[str]:
        return list(self.hashtag_sets.keys())

    def get_hashtags(
        self,
        themes: Optional[List[str]] = None,
        custom: Optional[List[str]] = None,
        shuffle: bool = True,
        limit: Optional[int] = None,
    ) -> List[str]:
        """
        Construit une liste de hashtags unique en combinant thèmes + custom.

        Args:
            themes: Liste de thèmes depuis config.json (ex: ["fitness", "morocco"])
            custom: Hashtags supplémentaires à ajouter
            shuffle: Mélanger aléatoirement pour éviter les patterns répétitifs
            limit: Nombre max de hashtags (défaut : config max_hashtags)
        """
        tags = []

        if themes:
            for theme in themes:
                if theme not in self.hashtag_sets:
                    logger.warning("Thème inconnu '%s'. Thèmes disponibles : %s", theme, self.get_themes())
                    continue
                tags.extend(self.hashtag_sets[theme])

        # Toujours inclure les hashtags généraux
        if "general" in self.hashtag_sets and "general" not in (themes or []):
            tags.extend(self.hashtag_sets["general"])

        if custom:
            # Normalise : ajoute # si absent
            tags.extend(t if t.startswith("#") else f"#{t}" for t in custom)

        # Déduplique en préservant l'ordre
        seen = set()
        unique = []
        for tag in tags:
            clean = tag.lower().strip()
            if clean not in seen:
                seen.add(clean)
                unique.append(tag)

        if shuffle:
            random.shuffle(unique)

        cap = limit or self.max_tags
        if len(unique) > cap:
            logger.info("Troncature : %d hashtags → %d (limite)", len(unique), cap)
            unique = unique[:cap]

        return unique

    def format_for_caption(
        self,
        themes: Optional[List[str]] = None,
        custom: Optional[List[str]] = None,
    ) -> str:
        """Retourne les hashtags formatés pour inclusion dans une légende Instagram."""
        tags = self.get_hashtags(themes=themes, custom=custom)
        return " ".join(tags)

    def build_caption(
        self,
        text: str,
        themes: Optional[List[str]] = None,
        custom: Optional[List[str]] = None,
        separator: str = "\n\n",
    ) -> str:
        """Assemble la légende finale : texte + hashtags."""
        if not self.auto_add:
            return text

        hashtag_block = self.format_for_caption(themes=themes, custom=custom)
        if not hashtag_block:
            return text

        return f"{text}{separator}{hashtag_block}"
