import unittest

from atnr_connector.normalize import normalize_library


class NormalizeTests(unittest.TestCase):
    def test_normalizes_required_library_metadata_without_source_identifiers(self) -> None:
        snapshot = normalize_library(
            [
                {
                    "asin": "SYNTHETIC-ASIN",
                    "title": "Synthetic Book",
                    "authors": [{"asin": "SYNTHETIC-AUTHOR", "name": "Ada Example"}],
                    "narrators": [{"name": "Nora Example"}],
                    "series": [{"asin": "SYNTHETIC-SERIES", "title": "Example Series", "sequence": "2"}],
                    "category_ladders": [
                        {"ladder": [{"id": "1", "name": "Fiction"}, {"id": "2", "name": "Fantasy"}]}
                    ],
                    "runtime_length_min": 600,
                    "percent_complete": 0.25,
                    "listening_status": "in_progress",
                    "purchase_date": "2026-01-02T03:04:05Z",
                    "is_playable": True,
                }
            ],
            marketplace="us",
            observed_at="2026-09-17T12:00:00.000Z",
        )

        self.assertEqual(snapshot["source"], "audible-community-private-api")
        self.assertEqual(len(snapshot["catalog"]["books"]), 1)
        self.assertEqual(len(snapshot["entries"]), 1)
        book = snapshot["catalog"]["books"][0]
        entry = snapshot["entries"][0]
        self.assertNotIn("SYNTHETIC-ASIN", book["bookId"])
        self.assertEqual(entry["percentComplete"], 25)
        self.assertEqual(entry["status"], "in-progress")
        self.assertEqual(book["durationMinutes"], 600)
        self.assertEqual(book["seriesPosition"], 2)

    def test_rejects_duplicate_editions(self) -> None:
        item = {"asin": "DUPLICATE", "title": "Synthetic"}
        with self.assertRaisesRegex(RuntimeError, "library-record-duplicate"):
            normalize_library(
                [item, dict(item)],
                marketplace="us",
                observed_at="2026-09-17T12:00:00.000Z",
            )

    def test_omits_over_limit_optional_prose_without_truncating(self) -> None:
        snapshot = normalize_library(
            [{"asin": "LONG", "title": "Synthetic", "publisher_summary": "x" * 2001}],
            marketplace="us",
            observed_at="2026-09-17T12:00:00.000Z",
        )
        self.assertIsNone(snapshot["catalog"]["books"][0]["synopsis"])


if __name__ == "__main__":
    unittest.main()
