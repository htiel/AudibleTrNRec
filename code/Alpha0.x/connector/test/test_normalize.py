"""Normalization contract tests (ATR-S021, ATR-S023, ATR-S026).

Every fixture here is synthetic. No personal library data, no live API access
and no provider identifier is reproduced in an assertion.
"""

import unittest

from atnr_connector.contract import CONTRACT_REVISION, CONTRIBUTOR_LIMIT
from atnr_connector.normalize import NormalizeError, normalize_library

OBSERVED_AT = "2026-09-17T12:00:00.000Z"


def normalize(items, observed_at: str = OBSERVED_AT):
    return normalize_library(items, marketplace="us", observed_at=observed_at)


def item(**overrides):
    base = {"asin": "SYNTHETIC-ASIN", "title": "Synthetic Book"}
    base.update(overrides)
    return base


class ProgressUnitTests(unittest.TestCase):
    """A declared percentage is preserved. Magnitude never implies a unit."""

    def test_declared_percentages_are_preserved_exactly(self) -> None:
        for value in (0, 0.5, 1, 25, 42.9, 99.9, 100):
            with self.subTest(value=value):
                snapshot = normalize([item(asin=f"A{value}", percent_complete=value)])
                self.assertEqual(snapshot["entries"][0]["percentComplete"], value)

    def test_a_small_value_is_never_rescaled_to_a_large_one(self) -> None:
        snapshot = normalize([item(percent_complete=0.5)])
        self.assertEqual(snapshot["entries"][0]["percentComplete"], 0.5)
        self.assertNotEqual(snapshot["entries"][0]["percentComplete"], 50)

    def test_absent_progress_is_unknown_not_zero(self) -> None:
        snapshot = normalize([item()])
        self.assertIsNone(snapshot["entries"][0]["percentComplete"])
        self.assertEqual(snapshot["entries"][0]["status"], "unknown")

    def test_present_but_invalid_progress_stops_the_capture(self) -> None:
        for value in ("50", True, float("nan"), float("inf"), [], {}):
            with self.subTest(value=repr(value)):
                with self.assertRaises(NormalizeError) as caught:
                    normalize([item(percent_complete=value)])
                self.assertEqual(caught.exception.category, "invalid-field-value")

    def test_out_of_range_progress_stops_the_capture(self) -> None:
        for value in (-1, 100.001, 1000):
            with self.subTest(value=value):
                with self.assertRaisesRegex(NormalizeError, "progress-value-out-of-range"):
                    normalize([item(percent_complete=value)])

    def test_status_is_never_derived_from_a_unit_conversion(self) -> None:
        finished = normalize([item(percent_complete=0.5, is_finished=True)])
        self.assertEqual(finished["entries"][0]["status"], "completed")
        self.assertEqual(finished["entries"][0]["percentComplete"], 0.5)

        declared = normalize([item(percent_complete=100, listening_status="not_started")])
        self.assertEqual(declared["entries"][0]["status"], "not-started")
        self.assertEqual(declared["entries"][0]["percentComplete"], 100)


class ContributorLimitTests(unittest.TestCase):
    def test_the_limit_comes_from_the_contract_and_is_not_a_local_constant(self) -> None:
        self.assertEqual(CONTRIBUTOR_LIMIT, 50)

    def test_a_record_at_the_limit_is_accepted_whole(self) -> None:
        authors = [
            {"asin": f"SYNTHETIC-AUTHOR-{i}", "name": f"Author {i}"}
            for i in range(CONTRIBUTOR_LIMIT)
        ]
        snapshot = normalize([item(authors=authors)])
        self.assertEqual(len(snapshot["catalog"]["books"][0]["authorIds"]), CONTRIBUTOR_LIMIT)

    def test_an_over_limit_record_is_refused_rather_than_truncated(self) -> None:
        for count in (CONTRIBUTOR_LIMIT + 1, 60, 100):
            with self.subTest(count=count):
                authors = [
                    {"asin": f"SYNTHETIC-AUTHOR-{i}", "name": f"Author {i}"}
                    for i in range(count)
                ]
                with self.assertRaises(NormalizeError) as caught:
                    normalize([item(authors=authors)])
                self.assertEqual(caught.exception.code, "contributor-limit-exceeded")
                self.assertEqual(caught.exception.category, "limit-exceeded")
                self.assertEqual(caught.exception.record_index, 0)

    def test_the_limit_applies_per_role_list(self) -> None:
        narrators = [
            {"asin": f"SYNTHETIC-NARRATOR-{i}", "name": f"Narrator {i}"}
            for i in range(CONTRIBUTOR_LIMIT + 1)
        ]
        with self.assertRaisesRegex(NormalizeError, "contributor-limit-exceeded"):
            normalize([item(narrators=narrators)])


class IdentityTests(unittest.TestCase):
    def test_one_provider_id_is_one_person_across_roles(self) -> None:
        snapshot = normalize([
            item(
                authors=[{"asin": "SYNTHETIC-PERSON", "name": "Ada Example"}],
                narrators=[{"asin": "SYNTHETIC-PERSON", "name": "Ada Example"}],
            )
        ])
        people = snapshot["catalog"]["people"]
        self.assertEqual(len(people), 1)
        self.assertEqual(people[0]["roles"], ["author", "narrator"])
        self.assertEqual(people[0]["identityBasis"], "provider-id")
        book = snapshot["catalog"]["books"][0]
        self.assertEqual(book["authorIds"], book["narratorIds"])

    def test_the_same_provider_id_is_shared_across_books(self) -> None:
        snapshot = normalize([
            item(asin="A1", authors=[{"asin": "SYNTHETIC-PERSON", "name": "Ada Example"}]),
            item(asin="A2", authors=[{"asin": "SYNTHETIC-PERSON", "name": "Ada Example (Jr.)"}]),
        ])
        self.assertEqual(len(snapshot["catalog"]["people"]), 1)

    def test_equal_names_without_identifiers_never_merge(self) -> None:
        snapshot = normalize([
            item(asin="A1", authors=[{"name": "Common Name"}]),
            item(asin="A2", authors=[{"name": "Common Name"}]),
        ])
        people = snapshot["catalog"]["people"]
        self.assertEqual(len(people), 2)
        self.assertTrue(all(p["identityBasis"] == "source-record-occurrence" for p in people))

    def test_a_name_only_contributor_does_not_merge_across_roles(self) -> None:
        snapshot = normalize([
            item(authors=[{"name": "Same Person"}], narrators=[{"name": "Same Person"}])
        ])
        self.assertEqual(len(snapshot["catalog"]["people"]), 2)

    def test_series_and_genre_identity_follow_the_same_rule(self) -> None:
        snapshot = normalize([
            item(
                asin="A1",
                series=[{"asin": "SYNTHETIC-SERIES", "title": "Example Series", "sequence": "2"}],
                category_ladders=[{"ladder": [{"id": "1", "name": "Fiction"}]}],
            ),
            item(
                asin="A2",
                series=[{"asin": "SYNTHETIC-SERIES", "title": "Example Series"}],
                category_ladders=[{"ladder": [{"name": "Fiction"}]}],
            ),
        ])
        facets = snapshot["catalog"]["facets"]
        series = [f for f in facets if f["type"] == "series"]
        genres = [f for f in facets if f["type"] == "genre"]
        self.assertEqual(len(series), 1, "a shared provider id is one series")
        self.assertEqual(len(genres), 2, "a name-only genre never merges with an identified one")
        self.assertEqual(snapshot["catalog"]["books"][0]["seriesPosition"], 2)


class RecordPolicyTests(unittest.TestCase):
    def test_no_source_identifier_is_reproduced_in_the_snapshot(self) -> None:
        snapshot = normalize([item(authors=[{"asin": "SYNTHETIC-AUTHOR", "name": "Ada"}])])
        text = repr(snapshot)
        self.assertNotIn("SYNTHETIC-ASIN", text)
        self.assertNotIn("SYNTHETIC-AUTHOR", text)

    def test_a_malformed_record_stops_the_whole_capture_with_its_position(self) -> None:
        with self.assertRaises(NormalizeError) as caught:
            normalize([item(asin="GOOD"), item(asin="ALSO-GOOD", title=None)])
        diagnostic = caught.exception.diagnostic()
        self.assertEqual(diagnostic["recordIndex"], 1)
        self.assertEqual(diagnostic["category"], "missing-required-field")
        self.assertNotIn("title", diagnostic.values())

    def test_a_non_record_entry_is_refused(self) -> None:
        with self.assertRaises(NormalizeError) as caught:
            normalize([item(), "not-a-record"])
        self.assertEqual(caught.exception.record_index, 1)
        self.assertEqual(caught.exception.category, "unsupported-record-shape")

    def test_duplicate_records_are_refused(self) -> None:
        with self.assertRaises(NormalizeError) as caught:
            normalize([item(), item()])
        self.assertEqual(caught.exception.code, "library-record-duplicate")
        self.assertEqual(caught.exception.category, "duplicate-record")
        self.assertEqual(caught.exception.record_index, 1)

    def test_over_limit_optional_prose_is_omitted_not_truncated(self) -> None:
        snapshot = normalize([item(publisher_summary="x" * 2001)])
        self.assertIsNone(snapshot["catalog"]["books"][0]["synopsis"])

    def test_a_diagnostic_never_carries_source_content(self) -> None:
        with self.assertRaises(NormalizeError) as caught:
            normalize([item(percent_complete="unmistakable-source-value")])
        self.assertNotIn("unmistakable-source-value", repr(caught.exception.diagnostic()))


class ObservationTests(unittest.TestCase):
    def test_a_naive_or_malformed_observation_is_refused(self) -> None:
        for value in ("2026-09-17T12:00:00", "2026-09-17", "now", "", None, 17):
            with self.subTest(value=repr(value)):
                with self.assertRaisesRegex(NormalizeError, "observed-at-invalid"):
                    normalize([item()], observed_at=value)

    def test_an_offset_qualified_instant_is_accepted(self) -> None:
        snapshot = normalize([item()], observed_at="2026-09-17T14:00:00.000+02:00")
        self.assertEqual(snapshot["observedAt"], "2026-09-17T14:00:00.000+02:00")


class EnvelopeTests(unittest.TestCase):
    def test_the_snapshot_declares_the_contract_it_was_captured_under(self) -> None:
        snapshot = normalize([item()])
        self.assertEqual(snapshot["sourceContractRevision"], CONTRACT_REVISION)
        self.assertEqual(snapshot["source"], "audible-community-private-api")
        self.assertEqual(snapshot["marketplace"], "us")

    def test_referential_integrity_holds_for_every_emitted_record(self) -> None:
        snapshot = normalize([
            item(
                asin="A1",
                authors=[{"asin": "P1", "name": "Ada"}],
                narrators=[{"name": "Nora"}],
                series=[{"asin": "S1", "title": "Series"}],
                category_ladders=[{"ladder": [{"id": "G1", "name": "Fiction"}]}],
            )
        ])
        people = {p["personId"] for p in snapshot["catalog"]["people"]}
        facets = {f["facetId"] for f in snapshot["catalog"]["facets"]}
        books = {b["bookId"] for b in snapshot["catalog"]["books"]}
        for entry in snapshot["entries"]:
            self.assertIn(entry["bookId"], books)
        for book in snapshot["catalog"]["books"]:
            for person_id in book["authorIds"] + book["narratorIds"]:
                self.assertIn(person_id, people)
            for facet_id in book["genreIds"] + [book["seriesId"]]:
                if facet_id:
                    self.assertIn(facet_id, facets)

    def test_an_empty_library_is_a_valid_empty_snapshot(self) -> None:
        snapshot = normalize([])
        self.assertEqual(snapshot["entries"], [])
        self.assertEqual(snapshot["catalog"]["books"], [])


if __name__ == "__main__":
    unittest.main()
