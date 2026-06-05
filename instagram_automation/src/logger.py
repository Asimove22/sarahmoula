"""
Configuration du système de logging.
"""

import json
import logging
import logging.handlers
from pathlib import Path

CONFIG_PATH = Path(__file__).parent.parent / "config.json"


def setup_logging() -> logging.Logger:
    """Configure le logger principal depuis config.json."""
    with open(CONFIG_PATH, encoding="utf-8") as f:
        cfg = json.load(f)

    log_cfg = cfg.get("logging", {})
    level = getattr(logging, log_cfg.get("level", "INFO"))
    log_file = Path(__file__).parent.parent / log_cfg.get("log_file", "logs/instagram.log")
    log_file.parent.mkdir(parents=True, exist_ok=True)

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Handler fichier avec rotation
    file_handler = logging.handlers.RotatingFileHandler(
        log_file,
        maxBytes=log_cfg.get("max_bytes", 10 * 1024 * 1024),
        backupCount=log_cfg.get("backup_count", 5),
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)
    root_logger.addHandler(file_handler)

    # Handler console
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.WARNING)
    root_logger.addHandler(console_handler)

    return logging.getLogger("instagram_automation")
