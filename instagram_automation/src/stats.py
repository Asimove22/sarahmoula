"""
Récupération des statistiques Instagram : posts, insights, compte.
"""

import logging
from typing import List, Optional

from .api_client import InstagramAPIClient
from .auth import MetaAuth

logger = logging.getLogger(__name__)

# Métriques disponibles par type de média
PHOTO_METRICS = "likes,comments_count,reach,impressions,saved,shares"
VIDEO_METRICS = "likes,comments_count,reach,impressions,saved,shares,plays"
REEL_METRICS = "likes,comments_count,reach,plays,saved,shares,total_interactions"
ACCOUNT_METRICS = "impressions,reach,follower_count,profile_views,website_clicks"


class InstagramStats:
    """Récupère les statistiques et insights d'un compte Instagram Business."""

    def __init__(self, auth: Optional[MetaAuth] = None):
        self.auth = auth or MetaAuth()
        self.client = InstagramAPIClient(self.auth)
        self.ig_id = self.auth.ig_user_id

    def get_post_stats(self, post_id: str) -> dict:
        """
        Retourne les statistiques complètes d'un post spécifique.

        Args:
            post_id: ID du post Instagram

        Returns:
            dict avec métriques + métadonnées du post
        """
        # Récupérer le type de média pour choisir les bonnes métriques
        media_info = self.client.get(
            post_id,
            params={"fields": "media_type,media_url,thumbnail_url,permalink,timestamp,caption"},
        )
        media_type = media_info.get("media_type", "IMAGE")

        if media_type == "VIDEO":
            metrics = VIDEO_METRICS
        elif media_type == "REELS":
            metrics = REEL_METRICS
        else:
            metrics = PHOTO_METRICS

        # Récupérer les insights
        try:
            insights_data = self.client.get(
                f"{post_id}/insights",
                params={"metric": metrics},
            )
            insights = {
                item["name"]: item["values"][0]["value"]
                for item in insights_data.get("data", [])
                if item.get("values")
            }
        except Exception as e:
            logger.warning("Impossible de récupérer les insights pour %s : %s", post_id, e)
            insights = {}

        return {
            "post_id": post_id,
            "media_type": media_type,
            "permalink": media_info.get("permalink"),
            "timestamp": media_info.get("timestamp"),
            "caption_preview": (media_info.get("caption", "") or "")[:100],
            "metrics": insights,
        }

    def get_recent_posts(self, limit: int = 10) -> List[dict]:
        """
        Récupère les stats des N derniers posts du compte.

        Args:
            limit: Nombre de posts à récupérer (max 100)

        Returns:
            Liste de dicts avec les stats de chaque post
        """
        data = self.client.get(
            f"{self.ig_id}/media",
            params={
                "fields": "id,media_type,timestamp,permalink,like_count,comments_count",
                "limit": min(limit, 100),
            },
        )
        posts = data.get("data", [])
        logger.info("Récupération des stats pour %d posts...", len(posts))

        results = []
        for post in posts:
            try:
                stats = self.get_post_stats(post["id"])
                results.append(stats)
            except Exception as e:
                logger.warning("Erreur sur le post %s : %s", post["id"], e)
                results.append({"post_id": post["id"], "error": str(e)})

        return results

    def get_account_insights(self, period: str = "day", days: int = 7) -> dict:
        """
        Récupère les insights du compte sur une période.

        Args:
            period: 'day' ou 'week' ou 'month'
            days: Nombre de jours à couvrir (28 max)

        Returns:
            dict avec les métriques du compte
        """
        import time
        since = int(time.time()) - (days * 86400)
        until = int(time.time())

        try:
            data = self.client.get(
                f"{self.ig_id}/insights",
                params={
                    "metric": ACCOUNT_METRICS,
                    "period": period,
                    "since": since,
                    "until": until,
                },
            )
            metrics = {}
            for item in data.get("data", []):
                name = item["name"]
                values = item.get("values", [])
                metrics[name] = {
                    "total": sum(v.get("value", 0) for v in values),
                    "values": values,
                }
            return {"period": period, "days": days, "metrics": metrics}
        except Exception as e:
            logger.error("Erreur insights compte : %s", e)
            return {"error": str(e)}

    def get_account_summary(self) -> dict:
        """Récupère le résumé du profil Instagram."""
        data = self.client.get(
            self.ig_id,
            params={
                "fields": "username,name,biography,followers_count,follows_count,media_count,website,profile_picture_url"
            },
        )
        return data
