"""
Fonctions de publication : photo, Reel, carrousel.
Utilise le flux en 2 étapes de l'Instagram Graph API :
  1. Créer un conteneur média (container)
  2. Publier le conteneur
"""

import logging
import time
from typing import List, Optional

from .api_client import InstagramAPIClient, RateLimitError
from .auth import MetaAuth

logger = logging.getLogger(__name__)


class InstagramPublisher:
    """Publie des médias sur Instagram via l'API Graph officielle."""

    def __init__(self, auth: Optional[MetaAuth] = None):
        self.auth = auth or MetaAuth()
        self.client = InstagramAPIClient(self.auth)
        self.ig_id = self.auth.ig_user_id

    # ──────────────────────────────────────────
    # PHOTO
    # ──────────────────────────────────────────

    def publish_photo(
        self,
        image_url: str,
        caption: str = "",
        location_id: Optional[str] = None,
    ) -> dict:
        """
        Publie une photo sur le feed Instagram.

        Args:
            image_url: URL publique de l'image (HTTPS, accessible par Meta)
            caption: Légende du post (max 2200 caractères)
            location_id: ID de lieu Facebook (optionnel)

        Returns:
            dict avec 'container_id' et 'post_id'
        """
        logger.info("Publication photo en cours...")

        # Étape 1 : créer le conteneur
        container_data = {
            "image_url": image_url,
            "caption": caption[:2200],
        }
        if location_id:
            container_data["location_id"] = location_id

        container = self.client.post(f"{self.ig_id}/media", data=container_data)
        container_id = container["id"]
        logger.info("Conteneur créé : %s", container_id)

        # Attendre que le média soit traité
        self.client.wait_for_container(container_id)

        # Étape 2 : publier
        post = self.client.post(
            f"{self.ig_id}/media_publish",
            data={"creation_id": container_id},
        )
        post_id = post["id"]
        logger.info("Photo publiée avec succès ! Post ID : %s", post_id)

        return {"container_id": container_id, "post_id": post_id}

    # ──────────────────────────────────────────
    # REEL
    # ──────────────────────────────────────────

    def publish_reel(
        self,
        video_url: str,
        caption: str = "",
        cover_url: Optional[str] = None,
        share_to_feed: bool = True,
    ) -> dict:
        """
        Publie un Reel sur Instagram.

        Args:
            video_url: URL publique de la vidéo MP4 (HTTPS)
            caption: Légende du Reel
            cover_url: URL de la miniature personnalisée (optionnel)
            share_to_feed: Partager aussi sur le feed principal

        Returns:
            dict avec 'container_id' et 'post_id'
        """
        logger.info("Publication Reel en cours...")

        container_data = {
            "media_type": "REELS",
            "video_url": video_url,
            "caption": caption[:2200],
            "share_to_feed": str(share_to_feed).lower(),
        }
        if cover_url:
            container_data["cover_url"] = cover_url

        container = self.client.post(f"{self.ig_id}/media", data=container_data)
        container_id = container["id"]
        logger.info("Conteneur Reel créé : %s", container_id)

        # Les Reels prennent plus de temps à traiter
        self.client.wait_for_container(container_id, max_wait=600)

        post = self.client.post(
            f"{self.ig_id}/media_publish",
            data={"creation_id": container_id},
        )
        post_id = post["id"]
        logger.info("Reel publié avec succès ! Post ID : %s", post_id)

        return {"container_id": container_id, "post_id": post_id}

    # ──────────────────────────────────────────
    # CARROUSEL
    # ──────────────────────────────────────────

    def publish_carousel(
        self,
        image_urls: List[str],
        caption: str = "",
        location_id: Optional[str] = None,
    ) -> dict:
        """
        Publie un carrousel (2 à 10 images) sur Instagram.

        Args:
            image_urls: Liste d'URLs d'images (2-10 images)
            caption: Légende du carrousel
            location_id: ID de lieu Facebook (optionnel)

        Returns:
            dict avec 'item_ids', 'container_id' et 'post_id'
        """
        if not 2 <= len(image_urls) <= 10:
            raise ValueError(f"Un carrousel nécessite entre 2 et 10 images. Reçu : {len(image_urls)}")

        logger.info("Publication carrousel (%d images) en cours...", len(image_urls))

        # Étape 1 : créer un conteneur pour chaque image
        item_ids = []
        for idx, url in enumerate(image_urls):
            logger.info("Création item %d/%d...", idx + 1, len(image_urls))
            item = self.client.post(
                f"{self.ig_id}/media",
                data={"image_url": url, "is_carousel_item": "true"},
            )
            item_ids.append(item["id"])
            # Petite pause entre les créations d'items
            time.sleep(1)

        logger.info("Items créés : %s", item_ids)

        # Étape 2 : créer le conteneur carrousel
        carousel_data = {
            "media_type": "CAROUSEL",
            "children": ",".join(item_ids),
            "caption": caption[:2200],
        }
        if location_id:
            carousel_data["location_id"] = location_id

        container = self.client.post(f"{self.ig_id}/media", data=carousel_data)
        container_id = container["id"]
        logger.info("Conteneur carrousel créé : %s", container_id)

        self.client.wait_for_container(container_id)

        # Étape 3 : publier
        post = self.client.post(
            f"{self.ig_id}/media_publish",
            data={"creation_id": container_id},
        )
        post_id = post["id"]
        logger.info("Carrousel publié avec succès ! Post ID : %s", post_id)

        return {"item_ids": item_ids, "container_id": container_id, "post_id": post_id}

    # ──────────────────────────────────────────
    # PUBLICATION PROGRAMMÉE
    # ──────────────────────────────────────────

    def schedule_post(
        self,
        publish_func,
        scheduled_time: float,
        **kwargs,
    ) -> dict:
        """
        Attend jusqu'à scheduled_time (timestamp UNIX) puis publie.

        Args:
            publish_func: La fonction de publication (publish_photo, publish_reel, etc.)
            scheduled_time: Timestamp UNIX de la publication
            **kwargs: Arguments pour publish_func

        Returns:
            Résultat de publish_func
        """
        delay = scheduled_time - time.time()
        if delay < 0:
            raise ValueError("La date de publication est dans le passé.")

        logger.info(
            "Publication programmée dans %.0f secondes (%.0f minutes)",
            delay, delay / 60,
        )
        time.sleep(delay)
        return publish_func(**kwargs)
