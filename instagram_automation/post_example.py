#!/usr/bin/env python3
"""
Exemples complets d'utilisation du système d'automatisation Instagram.
Adapte les URLs et paramètres selon ton contenu.
"""

import sys
import time
from pathlib import Path
from datetime import datetime, timedelta

sys.path.insert(0, str(Path(__file__).parent))

from src.auth import MetaAuth
from src.publisher import InstagramPublisher
from src.hashtags import HashtagManager
from src.stats import InstagramStats
from src.logger import setup_logging

logger = setup_logging()


def example_photo():
    """Exemple : publier une photo avec hashtags automatiques."""
    print("\n── EXEMPLE 1 : Publication Photo ──")

    publisher = InstagramPublisher()
    hm = HashtagManager()

    # Construire la légende avec hashtags fitness + general
    caption = hm.build_caption(
        text="La discipline bat la motivation sur le long terme. 💪\nChaque jour est une opportunité de progresser.",
        themes=["fitness", "lifestyle"],
        custom=["#impactamine", "#amine"],
    )

    print(f"Légende finale ({len(caption)} caractères) :\n{caption}\n")

    # Publier (remplace par une vraie URL hébergée publiquement)
    result = publisher.publish_photo(
        image_url="https://example.com/ton-image.jpg",
        caption=caption,
    )
    print(f"✓ Photo publiée ! Post ID : {result['post_id']}")
    return result


def example_reel():
    """Exemple : publier un Reel."""
    print("\n── EXEMPLE 2 : Publication Reel ──")

    publisher = InstagramPublisher()
    hm = HashtagManager()

    caption = hm.build_caption(
        text="New Reel ! Voici mes 3 règles pour rester focus chaque matin 🔥",
        themes=["fitness", "business"],
    )

    result = publisher.publish_reel(
        video_url="https://example.com/ton-reel.mp4",
        caption=caption,
        share_to_feed=True,
    )
    print(f"✓ Reel publié ! Post ID : {result['post_id']}")
    return result


def example_carousel():
    """Exemple : publier un carrousel de 3 images."""
    print("\n── EXEMPLE 3 : Publication Carrousel ──")

    publisher = InstagramPublisher()
    hm = HashtagManager()

    # 3 slides du carrousel
    image_urls = [
        "https://example.com/slide-1.jpg",
        "https://example.com/slide-2.jpg",
        "https://example.com/slide-3.jpg",
    ]

    caption = hm.build_caption(
        text="3 habitudes qui ont changé ma vie → Slide par slide ⬅️",
        themes=["lifestyle", "business"],
        custom=["#habitudes", "#croissance"],
    )

    result = publisher.publish_carousel(
        image_urls=image_urls,
        caption=caption,
    )
    print(f"✓ Carrousel publié ! Post ID : {result['post_id']}")
    return result


def example_scheduled_post():
    """Exemple : programmer un post dans 30 secondes."""
    print("\n── EXEMPLE 4 : Publication Programmée ──")

    publisher = InstagramPublisher()
    hm = HashtagManager()

    scheduled_time = time.time() + 30  # Dans 30 secondes
    scheduled_dt = datetime.fromtimestamp(scheduled_time)
    print(f"Publication programmée pour : {scheduled_dt.strftime('%H:%M:%S')}")

    caption = hm.build_caption(
        text="Post programmé automatiquement 🤖",
        themes=["general"],
    )

    result = publisher.schedule_post(
        publisher.publish_photo,
        scheduled_time=scheduled_time,
        image_url="https://example.com/image.jpg",
        caption=caption,
    )
    print(f"✓ Post programmé publié ! Post ID : {result['post_id']}")


def example_stats():
    """Exemple : récupérer les statistiques."""
    print("\n── EXEMPLE 5 : Statistiques ──")

    ig_stats = InstagramStats()

    # Résumé du compte
    summary = ig_stats.get_account_summary()
    print(f"Compte : @{summary.get('username')}")
    print(f"Abonnés : {summary.get('followers_count', 'N/A')}")
    print(f"Posts : {summary.get('media_count', 'N/A')}")

    # 3 derniers posts
    print("\nDerniers posts :")
    posts = ig_stats.get_recent_posts(limit=3)
    for post in posts:
        metrics = post.get("metrics", {})
        print(
            f"  • {post['post_id']} | {post.get('media_type')} | "
            f"Likes: {metrics.get('likes', 'N/A')} | "
            f"Reach: {metrics.get('reach', 'N/A')}"
        )

    # Insights 7 derniers jours
    print("\nInsights des 7 derniers jours :")
    insights = ig_stats.get_account_insights(days=7)
    for metric, data in insights.get("metrics", {}).items():
        print(f"  {metric}: {data.get('total', 'N/A')}")


def example_hashtags_only():
    """Exemple : tester la composition des hashtags."""
    print("\n── EXEMPLE 6 : Composition Hashtags ──")

    hm = HashtagManager()

    # Thèmes disponibles
    print(f"Thèmes disponibles : {hm.get_themes()}")

    # Combinaison fitness + morocco + custom
    tags = hm.get_hashtags(
        themes=["fitness", "morocco"],
        custom=["#impactamine", "#coaching"],
        shuffle=True,
        limit=20,
    )
    print(f"\n{len(tags)} hashtags générés :")
    print(" ".join(tags))

    # Légende complète
    caption = hm.build_caption(
        text="Session de sport au Maroc 🇲🇦💪",
        themes=["fitness", "morocco"],
    )
    print(f"\nLégende complète ({len(caption)} chars):\n{caption}")


def verify_setup():
    """Vérifie que le setup est correct avant de publier."""
    print("\n── VÉRIFICATION DU SETUP ──")
    try:
        auth = MetaAuth()
        print("✓ Variables d'environnement chargées")

        info = auth.get_token_info()
        if info["is_valid"]:
            print("✓ Token valide")
        else:
            print("✗ Token invalide — régénère un token sur Meta for Developers")
            return False

        perms = auth.check_permissions()
        if perms["all_granted"]:
            print("✓ Toutes les permissions accordées")
        else:
            print(f"✗ Permissions manquantes : {', '.join(perms['missing'])}")
            return False

        print("\n✓ Setup complet ! Prêt à publier.\n")
        return True

    except ValueError as e:
        print(f"✗ Erreur de configuration : {e}")
        return False


if __name__ == "__main__":
    print("═" * 50)
    print("  Instagram Automation — @impactamine")
    print("═" * 50)

    # Vérifie le setup avant tout
    if not verify_setup():
        print("\nCorrige la configuration et réessaie.")
        sys.exit(1)

    # Lance les exemples de ton choix (commente/décommente)
    # example_photo()
    # example_reel()
    # example_carousel()
    # example_scheduled_post()
    example_stats()
    example_hashtags_only()
