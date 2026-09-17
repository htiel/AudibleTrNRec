from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


class PolicyError(RuntimeError):
    pass


@dataclass(frozen=True)
class PrivateAlphaPolicy:
    app_name: str
    app_abbreviation: str
    distribution: str
    maximum_named_testers: int
    allowed_marketplaces: tuple[str, ...]
    provider_device_display_name: str
    automatic_sync_interval_minutes: int


def load_policy() -> PrivateAlphaPolicy:
    path = Path(__file__).resolve().parents[1] / "private-alpha-policy.json"
    try:
        raw: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise PolicyError("private-alpha-policy-unavailable") from error

    if raw.get("schemaVersion") != 1:
        raise PolicyError("private-alpha-policy-version")
    if raw.get("distribution") != "private-alpha":
        raise PolicyError("private-alpha-distribution-required")
    if raw.get("commercialShippingBlocked") is not True:
        raise PolicyError("commercial-shipping-must-be-blocked")
    if raw.get("appAbbreviation") != "ATnR":
        raise PolicyError("private-alpha-app-identity")

    testers = raw.get("maximumNamedTesters")
    interval = raw.get("automaticSyncIntervalMinutes")
    marketplaces = raw.get("allowedMarketplaces")
    if not isinstance(testers, int) or not 1 <= testers <= 10:
        raise PolicyError("private-alpha-tester-limit")
    if not isinstance(interval, int) or not 5 <= interval <= 1440:
        raise PolicyError("private-alpha-sync-interval")
    if not isinstance(marketplaces, list) or marketplaces != ["us"]:
        raise PolicyError("private-alpha-marketplace-allowlist")

    return PrivateAlphaPolicy(
        app_name=str(raw["appName"]),
        app_abbreviation=str(raw["appAbbreviation"]),
        distribution=str(raw["distribution"]),
        maximum_named_testers=testers,
        allowed_marketplaces=tuple(marketplaces),
        provider_device_display_name=str(raw["providerDeviceDisplayName"]),
        automatic_sync_interval_minutes=interval,
    )
