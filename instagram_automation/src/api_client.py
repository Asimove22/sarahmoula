"""
Client HTTP centralisé pour l'Instagram Graph API avec gestion des rate limits
et retry automatique.
"""

import time
import logging
from typing import Any, Optional
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .auth import MetaAuth

logger = logging.getLogger(__name__)


class RateLimitError(Exception):
    """Levée quand la limite d'appels API est atteinte."""
    def __init__(self, retry_after: int = 3600):
        self.retry_after = retry_after
        super().__init__(f"Rate limit atteint. Réessaie dans {retry_after} secondes.")


class APIError(Exception):
    """Erreur générique de l'API Instagram Graph."""
    def __init__(self, message: str, code: int = 0, subcode: int = 0):
        self.code = code
        self.subcode = subcode
        super().__init__(f"[{code}/{subcode}] {message}")


class InstagramAPIClient:
    """Client HTTP avec retry, rate limit et gestion d'erreurs."""

    # Codes d'erreur Meta indiquant un rate limit
    RATE_LIMIT_CODES = {4, 17, 32, 613}

    def __init__(self, auth: Optional[MetaAuth] = None):
        self.auth = auth or MetaAuth()
        self.base_url = f"{self.auth.base_url}/{self.auth.api_version}"
        self.session = self._build_session()

    def _build_session(self) -> requests.Session:
        session = requests.Session()
        retry_strategy = Retry(
            total=3,
            backoff_factor=2,
            status_forcelist=[500, 502, 503, 504],
            allowed_methods=["GET", "POST", "DELETE"],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("https://", adapter)
        return session

    def _handle_error(self, response: requests.Response) -> None:
        try:
            body = response.json()
        except Exception:
            response.raise_for_status()
            return

        error = body.get("error", {})
        code = error.get("code", 0)
        subcode = error.get("error_subcode", 0)
        message = error.get("message", "Erreur inconnue")

        if code in self.RATE_LIMIT_CODES:
            retry_after = int(response.headers.get("Retry-After", 3600))
            raise RateLimitError(retry_after)

        if code == 190:
            raise APIError(
                "Token expiré ou invalide. Génère un nouveau token sur Meta for Developers.",
                code, subcode,
            )

        raise APIError(message, code, subcode)

    def get(self, endpoint: str, params: Optional[dict] = None, **kwargs) -> dict:
        params = params or {}
        params["access_token"] = self.auth.access_token
        url = f"{self.base_url}/{endpoint.lstrip('/')}"

        logger.debug("GET %s params=%s", url, {k: v for k, v in params.items() if k != "access_token"})

        resp = self.session.get(url, params=params, timeout=30, **kwargs)

        if not resp.ok:
            self._handle_error(resp)

        return resp.json()

    def post(self, endpoint: str, data: Optional[dict] = None, **kwargs) -> dict:
        data = data or {}
        data["access_token"] = self.auth.access_token
        url = f"{self.base_url}/{endpoint.lstrip('/')}"

        logger.debug("POST %s data=%s", url, {k: v for k, v in data.items() if k != "access_token"})

        resp = self.session.post(url, data=data, timeout=60, **kwargs)

        if not resp.ok:
            self._handle_error(resp)

        return resp.json()

    def wait_for_container(self, container_id: str, max_wait: int = 300) -> bool:
        """
        Attend que le conteneur média Instagram soit prêt (status = FINISHED).
        Polling toutes les 5 secondes jusqu'à max_wait secondes.
        """
        start = time.time()
        while time.time() - start < max_wait:
            data = self.get(container_id, params={"fields": "status_code,status"})
            status = data.get("status_code")

            if status == "FINISHED":
                return True
            if status == "ERROR":
                error_msg = data.get("status", "Erreur inconnue lors du traitement média")
                raise APIError(f"Traitement du conteneur échoué : {error_msg}")
            if status in ("IN_PROGRESS", "PUBLISHED"):
                logger.info("Conteneur %s en cours de traitement (%s)...", container_id, status)
                time.sleep(5)
                continue

            # Statut inconnu — attendre
            time.sleep(5)

        raise TimeoutError(f"Le conteneur {container_id} n'est pas prêt après {max_wait}s")
