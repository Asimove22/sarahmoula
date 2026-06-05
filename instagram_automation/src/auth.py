"""
Gestion de l'authentification et des tokens Meta / Instagram Graph API.
"""

import os
import json
import time
import logging
from typing import Optional
from dotenv import load_dotenv
import requests

load_dotenv()
logger = logging.getLogger(__name__)


class MetaAuth:
    """Gère les tokens OAuth Meta et leur cycle de vie."""

    def __init__(self):
        self.app_id = os.getenv("APP_ID")
        self.app_secret = os.getenv("APP_SECRET")
        self.access_token = os.getenv("ACCESS_TOKEN")
        self.ig_user_id = os.getenv("IG_USER_ID")
        self.api_version = os.getenv("API_VERSION", "v21.0")
        self.base_url = os.getenv("BASE_URL", "https://graph.facebook.com")

        self._validate_credentials()

    def _validate_credentials(self):
        required = {
            "APP_ID": self.app_id,
            "APP_SECRET": self.app_secret,
            "ACCESS_TOKEN": self.access_token,
            "IG_USER_ID": self.ig_user_id,
        }
        missing = [k for k, v in required.items() if not v]
        if missing:
            raise ValueError(
                f"Variables d'environnement manquantes : {', '.join(missing)}\n"
                "Copie .env.example en .env et remplis tes credentials."
            )

    def get_token_info(self) -> dict:
        """Vérifie la validité et l'expiration du token actuel."""
        url = f"{self.base_url}/debug_token"
        params = {
            "input_token": self.access_token,
            "access_token": f"{self.app_id}|{self.app_secret}",
        }
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json().get("data", {})
        return {
            "is_valid": data.get("is_valid", False),
            "expires_at": data.get("expires_at"),
            "scopes": data.get("scopes", []),
            "app_id": data.get("app_id"),
            "type": data.get("type"),
        }

    def exchange_for_long_lived_token(self, short_token: str) -> dict:
        """
        Échange un token court (2h) contre un token long (60 jours).
        Nécessite APP_ID et APP_SECRET.
        """
        url = f"{self.base_url}/oauth/access_token"
        params = {
            "grant_type": "fb_exchange_token",
            "client_id": self.app_id,
            "client_secret": self.app_secret,
            "fb_exchange_token": short_token,
        }
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        result = resp.json()
        logger.info("Token long-terme obtenu, expire dans %s secondes", result.get("expires_in"))
        return result

    def get_instagram_user_id(self, page_access_token: str) -> Optional[str]:
        """
        Récupère l'IG_USER_ID depuis le token de Page.
        Utile lors du premier setup.
        """
        url = f"{self.base_url}/{self.api_version}/me/accounts"
        params = {"access_token": page_access_token}
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        pages = resp.json().get("data", [])

        for page in pages:
            page_id = page["id"]
            page_token = page["access_token"]
            ig_url = f"{self.base_url}/{self.api_version}/{page_id}"
            ig_resp = requests.get(
                ig_url,
                params={"fields": "instagram_business_account", "access_token": page_token},
                timeout=15,
            )
            ig_data = ig_resp.json()
            if "instagram_business_account" in ig_data:
                ig_id = ig_data["instagram_business_account"]["id"]
                logger.info("IG_USER_ID trouvé : %s (Page: %s)", ig_id, page.get("name"))
                return ig_id

        logger.warning("Aucun compte Instagram Business trouvé. Vérifie le lien Page/Instagram.")
        return None

    def check_permissions(self) -> dict:
        """Vérifie les permissions disponibles pour le token."""
        url = f"{self.base_url}/{self.api_version}/me/permissions"
        params = {"access_token": self.access_token}
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        perms = resp.json().get("data", [])
        granted = {p["permission"] for p in perms if p.get("status") == "granted"}
        required = {
            "instagram_basic",
            "instagram_content_publish",
            "instagram_manage_insights",
            "pages_read_engagement",
        }
        missing = required - granted
        return {
            "granted": list(granted),
            "required": list(required),
            "missing": list(missing),
            "all_granted": len(missing) == 0,
        }

    @property
    def headers(self) -> dict:
        return {"Content-Type": "application/json"}
