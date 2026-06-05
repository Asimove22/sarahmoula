#!/usr/bin/env python3
"""
CLI Instagram Automation — @impactamine
Usage: python cli.py [COMMANDE] [OPTIONS]
"""

import json
import sys
import time
from datetime import datetime
from pathlib import Path

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

# Ajouter le répertoire parent au path
sys.path.insert(0, str(Path(__file__).parent))

from src.logger import setup_logging
from src.auth import MetaAuth
from src.publisher import InstagramPublisher
from src.hashtags import HashtagManager
from src.stats import InstagramStats

console = Console()
logger = setup_logging()


def _print_success(message: str):
    console.print(f"[bold green]✓[/bold green] {message}")


def _print_error(message: str):
    console.print(f"[bold red]✗[/bold red] {message}", err=True)


def _print_info(message: str):
    console.print(f"[bold blue]→[/bold blue] {message}")


# ──────────────────────────────────────────────────────────────────────────────
# GROUPE PRINCIPAL
# ──────────────────────────────────────────────────────────────────────────────

@click.group()
@click.version_option("1.0.0", prog_name="instagram-automation")
def cli():
    """
    \b
    ██████████████████████████████████████
    █  Instagram Automation — @impactamine
    ██████████████████████████████████████
    Gestion des publications Instagram via l'API officielle Meta.
    """
    pass


# ──────────────────────────────────────────────────────────────────────────────
# AUTH
# ──────────────────────────────────────────────────────────────────────────────

@cli.group()
def auth():
    """Commandes d'authentification et de vérification des tokens."""
    pass


@auth.command("check")
def auth_check():
    """Vérifie la validité du token et les permissions."""
    _print_info("Vérification du token Meta...")
    try:
        meta_auth = MetaAuth()
        info = meta_auth.get_token_info()

        table = Table(title="Informations du Token")
        table.add_column("Propriété", style="cyan")
        table.add_column("Valeur", style="white")

        table.add_row("Valide", "[green]✓ Oui[/green]" if info["is_valid"] else "[red]✗ Non[/red]")
        if info.get("expires_at"):
            exp = datetime.fromtimestamp(info["expires_at"])
            days_left = (exp - datetime.now()).days
            color = "green" if days_left > 7 else "red"
            table.add_row("Expire le", f"[{color}]{exp.strftime('%d/%m/%Y %H:%M')} ({days_left}j)[/{color}]")
        table.add_row("Type", info.get("type", "N/A"))
        table.add_row("Permissions", "\n".join(info.get("scopes", [])) or "N/A")

        console.print(table)

        perms = meta_auth.check_permissions()
        if perms["missing"]:
            _print_error(f"Permissions manquantes : {', '.join(perms['missing'])}")
        else:
            _print_success("Toutes les permissions requises sont accordées.")

    except Exception as e:
        _print_error(str(e))
        sys.exit(1)


@auth.command("exchange-token")
@click.argument("short_token")
def exchange_token(short_token: str):
    """Échange un token court contre un token long-terme (60 jours)."""
    try:
        meta_auth = MetaAuth()
        result = meta_auth.exchange_for_long_lived_token(short_token)
        _print_success("Token long-terme généré !")
        console.print(Panel(
            f"[bold]ACCESS_TOKEN=[/bold]{result['access_token']}\n"
            f"[dim]Expire dans : {result.get('expires_in', 'N/A')} secondes[/dim]",
            title="Nouveau Token",
            border_style="green",
        ))
        console.print("[yellow]⚠ Copie ce token dans ton fichier .env[/yellow]")
    except Exception as e:
        _print_error(str(e))
        sys.exit(1)


@auth.command("get-ig-id")
@click.argument("page_token")
def get_ig_id(page_token: str):
    """Récupère l'IG_USER_ID depuis un token de Page Facebook."""
    try:
        meta_auth = MetaAuth()
        ig_id = meta_auth.get_instagram_user_id(page_token)
        if ig_id:
            _print_success(f"IG_USER_ID trouvé : {ig_id}")
            console.print(f"[yellow]⚠ Ajoute IG_USER_ID={ig_id} dans ton .env[/yellow]")
        else:
            _print_error("Aucun compte Instagram Business trouvé.")
    except Exception as e:
        _print_error(str(e))
        sys.exit(1)


# ──────────────────────────────────────────────────────────────────────────────
# PUBLISH
# ──────────────────────────────────────────────────────────────────────────────

@cli.group()
def publish():
    """Commandes de publication de médias."""
    pass


@publish.command("photo")
@click.option("--url", "-u", required=True, help="URL publique HTTPS de l'image")
@click.option("--caption", "-c", default="", help="Légende du post")
@click.option("--themes", "-t", multiple=True, help="Thèmes hashtags (ex: -t fitness -t morocco)")
@click.option("--hashtags", "-h", multiple=True, help="Hashtags personnalisés supplémentaires")
@click.option("--location", "-l", default=None, help="ID de lieu Facebook (optionnel)")
@click.option("--no-hashtags", is_flag=True, help="Désactiver l'ajout automatique de hashtags")
def publish_photo(url, caption, themes, hashtags, location, no_hashtags):
    """Publie une photo sur Instagram."""
    try:
        publisher = InstagramPublisher()
        final_caption = caption

        if not no_hashtags:
            hm = HashtagManager()
            final_caption = hm.build_caption(
                caption,
                themes=list(themes) or None,
                custom=list(hashtags) or None,
            )

        _print_info(f"Publication de la photo...")
        _print_info(f"Légende ({len(final_caption)} chars) : {final_caption[:80]}...")

        result = publisher.publish_photo(
            image_url=url,
            caption=final_caption,
            location_id=location,
        )
        _print_success(f"Photo publiée ! Post ID : {result['post_id']}")

    except Exception as e:
        _print_error(str(e))
        sys.exit(1)


@publish.command("reel")
@click.option("--url", "-u", required=True, help="URL publique HTTPS de la vidéo MP4")
@click.option("--caption", "-c", default="", help="Légende du Reel")
@click.option("--themes", "-t", multiple=True, help="Thèmes hashtags")
@click.option("--hashtags", "-h", multiple=True, help="Hashtags personnalisés")
@click.option("--cover", default=None, help="URL de la miniature personnalisée")
@click.option("--no-feed", is_flag=True, help="Ne pas partager sur le feed principal")
@click.option("--no-hashtags", is_flag=True)
def publish_reel(url, caption, themes, hashtags, cover, no_feed, no_hashtags):
    """Publie un Reel sur Instagram."""
    try:
        publisher = InstagramPublisher()
        final_caption = caption

        if not no_hashtags:
            hm = HashtagManager()
            final_caption = hm.build_caption(
                caption,
                themes=list(themes) or None,
                custom=list(hashtags) or None,
            )

        _print_info("Publication du Reel (peut prendre quelques minutes)...")
        result = publisher.publish_reel(
            video_url=url,
            caption=final_caption,
            cover_url=cover,
            share_to_feed=not no_feed,
        )
        _print_success(f"Reel publié ! Post ID : {result['post_id']}")

    except Exception as e:
        _print_error(str(e))
        sys.exit(1)


@publish.command("carousel")
@click.option("--urls", "-u", required=True, multiple=True, help="URLs des images (2-10)")
@click.option("--caption", "-c", default="", help="Légende du carrousel")
@click.option("--themes", "-t", multiple=True, help="Thèmes hashtags")
@click.option("--hashtags", "-h", multiple=True, help="Hashtags personnalisés")
@click.option("--location", "-l", default=None)
@click.option("--no-hashtags", is_flag=True)
def publish_carousel(urls, caption, themes, hashtags, location, no_hashtags):
    """Publie un carrousel (2-10 images) sur Instagram."""
    try:
        if not 2 <= len(urls) <= 10:
            _print_error(f"Le carrousel nécessite 2 à 10 images. Reçu : {len(urls)}")
            sys.exit(1)

        publisher = InstagramPublisher()
        final_caption = caption

        if not no_hashtags:
            hm = HashtagManager()
            final_caption = hm.build_caption(
                caption,
                themes=list(themes) or None,
                custom=list(hashtags) or None,
            )

        _print_info(f"Publication du carrousel ({len(urls)} images)...")
        result = publisher.publish_carousel(
            image_urls=list(urls),
            caption=final_caption,
            location_id=location,
        )
        _print_success(f"Carrousel publié ! Post ID : {result['post_id']}")

    except Exception as e:
        _print_error(str(e))
        sys.exit(1)


@publish.command("schedule")
@click.option("--type", "media_type", type=click.Choice(["photo", "reel"]), required=True)
@click.option("--url", "-u", required=True, help="URL du média")
@click.option("--caption", "-c", default="")
@click.option("--at", required=True, help="Date/heure ISO 8601 (ex: 2025-12-25T18:00:00)")
@click.option("--themes", "-t", multiple=True)
@click.option("--hashtags", "-h", multiple=True)
def schedule_post(media_type, url, caption, at, themes, hashtags):
    """Programme une publication à une date/heure précise."""
    try:
        from dateutil import parser as dateparser
        scheduled_dt = dateparser.parse(at)
        if not scheduled_dt:
            _print_error(f"Format de date invalide : {at}")
            sys.exit(1)

        scheduled_ts = scheduled_dt.timestamp()
        delay = scheduled_ts - time.time()

        if delay < 0:
            _print_error("La date de publication est dans le passé.")
            sys.exit(1)

        publisher = InstagramPublisher()
        hm = HashtagManager()
        final_caption = hm.build_caption(
            caption,
            themes=list(themes) or None,
            custom=list(hashtags) or None,
        )

        _print_info(f"Publication programmée pour : {scheduled_dt.strftime('%d/%m/%Y à %H:%M:%S')}")
        _print_info(f"Temps d'attente : {delay/60:.1f} minutes")

        if media_type == "photo":
            result = publisher.schedule_post(
                publisher.publish_photo,
                scheduled_time=scheduled_ts,
                image_url=url,
                caption=final_caption,
            )
        else:
            result = publisher.schedule_post(
                publisher.publish_reel,
                scheduled_time=scheduled_ts,
                video_url=url,
                caption=final_caption,
            )

        _print_success(f"Publié ! Post ID : {result['post_id']}")

    except Exception as e:
        _print_error(str(e))
        sys.exit(1)


# ──────────────────────────────────────────────────────────────────────────────
# STATS
# ──────────────────────────────────────────────────────────────────────────────

@cli.group()
def stats():
    """Commandes de statistiques et analytics."""
    pass


@stats.command("post")
@click.argument("post_id")
def stats_post(post_id: str):
    """Affiche les statistiques d'un post spécifique."""
    try:
        ig_stats = InstagramStats()
        data = ig_stats.get_post_stats(post_id)

        table = Table(title=f"Statistiques — Post {post_id}")
        table.add_column("Métrique", style="cyan")
        table.add_column("Valeur", style="bold white")

        table.add_row("Type", data["media_type"])
        table.add_row("Publié le", data.get("timestamp", "N/A"))
        table.add_row("Lien", data.get("permalink", "N/A"))
        table.add_row("Légende", data.get("caption_preview", "")[:80] + "...")

        for metric, value in data.get("metrics", {}).items():
            table.add_row(metric, str(value))

        console.print(table)

    except Exception as e:
        _print_error(str(e))
        sys.exit(1)


@stats.command("recent")
@click.option("--limit", "-n", default=5, help="Nombre de posts (défaut: 5)")
@click.option("--json-output", is_flag=True, help="Sortie JSON brute")
def stats_recent(limit: int, json_output: bool):
    """Affiche les stats des N derniers posts."""
    try:
        ig_stats = InstagramStats()
        _print_info(f"Récupération des stats des {limit} derniers posts...")
        posts = ig_stats.get_recent_posts(limit=limit)

        if json_output:
            click.echo(json.dumps(posts, indent=2, ensure_ascii=False))
            return

        table = Table(title=f"Derniers {len(posts)} posts — @impactamine")
        table.add_column("Post ID", style="dim")
        table.add_column("Type")
        table.add_column("Date")
        table.add_column("Likes", justify="right")
        table.add_column("Comments", justify="right")
        table.add_column("Reach", justify="right")
        table.add_column("Impressions", justify="right")

        for p in posts:
            if "error" in p:
                table.add_row(p["post_id"], "[red]Erreur[/red]", "-", "-", "-", "-", "-")
                continue
            m = p.get("metrics", {})
            table.add_row(
                p["post_id"],
                p.get("media_type", "N/A"),
                (p.get("timestamp") or "")[:10],
                str(m.get("likes", m.get("like_count", "-"))),
                str(m.get("comments_count", "-")),
                str(m.get("reach", "-")),
                str(m.get("impressions", "-")),
            )

        console.print(table)

    except Exception as e:
        _print_error(str(e))
        sys.exit(1)


@stats.command("account")
@click.option("--days", "-d", default=7, help="Période en jours (max 28)")
@click.option("--json-output", is_flag=True)
def stats_account(days: int, json_output: bool):
    """Affiche les insights du compte sur une période."""
    try:
        ig_stats = InstagramStats()
        summary = ig_stats.get_account_summary()
        insights = ig_stats.get_account_insights(days=days)

        if json_output:
            click.echo(json.dumps({"summary": summary, "insights": insights}, indent=2, ensure_ascii=False))
            return

        # Résumé du profil
        console.print(Panel(
            f"[bold]@{summary.get('username', 'N/A')}[/bold] — {summary.get('name', '')}\n"
            f"Abonnés : [bold]{summary.get('followers_count', 'N/A')}[/bold] | "
            f"Abonnements : {summary.get('follows_count', 'N/A')} | "
            f"Posts : {summary.get('media_count', 'N/A')}",
            title="Profil Instagram",
            border_style="blue",
        ))

        # Insights
        table = Table(title=f"Insights des {days} derniers jours")
        table.add_column("Métrique", style="cyan")
        table.add_column("Total", justify="right", style="bold")

        for metric, data in insights.get("metrics", {}).items():
            table.add_row(metric, str(data.get("total", "N/A")))

        console.print(table)

    except Exception as e:
        _print_error(str(e))
        sys.exit(1)


# ──────────────────────────────────────────────────────────────────────────────
# HASHTAGS
# ──────────────────────────────────────────────────────────────────────────────

@cli.group()
def hashtags():
    """Gestion et prévisualisation des hashtags."""
    pass


@hashtags.command("list")
def hashtags_list():
    """Liste tous les thèmes de hashtags disponibles."""
    hm = HashtagManager()
    table = Table(title="Thèmes de hashtags disponibles")
    table.add_column("Thème", style="cyan")
    table.add_column("Nombre", justify="right")
    table.add_column("Exemples")

    for theme, tags in hm.hashtag_sets.items():
        table.add_row(theme, str(len(tags)), "  ".join(tags[:4]) + "...")

    console.print(table)


@hashtags.command("preview")
@click.option("--themes", "-t", multiple=True, help="Thèmes à combiner")
@click.option("--custom", "-c", multiple=True, help="Hashtags supplémentaires")
def hashtags_preview(themes, custom):
    """Prévisualise la combinaison de hashtags."""
    hm = HashtagManager()
    tags = hm.get_hashtags(
        themes=list(themes) or None,
        custom=list(custom) or None,
        shuffle=False,
    )
    console.print(Panel(
        " ".join(tags),
        title=f"Hashtags ({len(tags)}) — Thèmes: {', '.join(themes) or 'general'}",
        border_style="green",
    ))


if __name__ == "__main__":
    cli()
