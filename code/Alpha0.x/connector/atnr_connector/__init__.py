"""Private-alpha Audible connector for Audible Track and Recommend."""

APP_ABBREVIATION = "ATnR"
CONNECTOR_VERSION = "0.0.2"
#: Release whose custody directory and DPAPI entropy already exist on disk.
#: Immutable: never derive custody paths or entropy from CONNECTOR_VERSION.
LEGACY_CUSTODY_RELEASE = "0.0.1"
SOURCE_NAME = "audible-community-private-api"
