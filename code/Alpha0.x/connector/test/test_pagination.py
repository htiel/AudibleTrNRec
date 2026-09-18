"""Bounded pagination accumulator tests (ATR-S022).

All pages are synthetic. Nothing here contacts a provider.
"""

import unittest

from atnr_connector.contract import (
    BYTE_ACCOUNTING_IS_WIRE_PROOF,
    MAX_PAGES,
    MAX_RESPONSE_BYTES,
    PAGE_SIZE,
)
from atnr_connector.service import ConnectorError, collect_library_pages


def page(count: int, *, start: int = 0) -> dict:
    return {"items": [{"asin": f"SYNTHETIC-{start + i}", "title": "Synthetic"} for i in range(count)]}


def pages(*responses):
    """Return a fetch function that serves the given pages in order."""

    log = []

    def fetch(number: int):
        log.append(number)
        if number - 1 >= len(responses):
            raise AssertionError(f"page {number} requested beyond the fixture")
        return responses[number - 1]

    fetch.log = log
    return fetch


class CompletenessTests(unittest.TestCase):
    def test_a_short_final_page_is_the_completeness_basis(self) -> None:
        fetch = pages(page(PAGE_SIZE), page(3, start=PAGE_SIZE))
        capture = collect_library_pages(fetch)
        self.assertEqual(capture["evidence"]["complete"], True)
        self.assertEqual(capture["evidence"]["basis"], "short-final-page")
        self.assertEqual(capture["evidence"]["pagesRead"], 2)
        self.assertEqual(len(capture["items"]), PAGE_SIZE + 3)
        self.assertEqual(fetch.log, [1, 2], "no page is requested after terminal evidence")

    def test_an_empty_first_page_is_a_declared_basis_not_a_failure(self) -> None:
        capture = collect_library_pages(pages(page(0)))
        self.assertEqual(capture["evidence"]["basis"], "empty-first-page")
        self.assertEqual(capture["items"], [])

    def test_a_single_short_page_completes_immediately(self) -> None:
        capture = collect_library_pages(pages(page(5)))
        self.assertEqual(capture["evidence"]["basis"], "short-final-page")
        self.assertEqual(capture["evidence"]["pagesRead"], 1)

    def test_the_evidence_states_that_byte_accounting_is_an_estimate(self) -> None:
        capture = collect_library_pages(pages(page(1)))
        evidence = capture["evidence"]
        self.assertEqual(evidence["byteAccountingIsWireProof"], BYTE_ACCOUNTING_IS_WIRE_PROOF)
        self.assertFalse(evidence["byteAccountingIsWireProof"])
        self.assertIn("estimatedResponseBytes", evidence)
        self.assertGreater(evidence["estimatedResponseBytes"], 0)


class BoundaryTests(unittest.TestCase):
    def test_exhausting_the_page_cap_stops_without_probing_further(self) -> None:
        full = [page(PAGE_SIZE, start=i * PAGE_SIZE) for i in range(MAX_PAGES)]
        fetch = pages(*full)
        with self.assertRaisesRegex(ConnectorError, "library-page-limit"):
            collect_library_pages(fetch)
        self.assertEqual(len(fetch.log), MAX_PAGES)
        self.assertEqual(max(fetch.log), MAX_PAGES, "no page beyond the cap is requested")

    def test_an_oversized_page_stops_the_capture(self) -> None:
        with self.assertRaisesRegex(ConnectorError, "library-page-oversized"):
            collect_library_pages(pages(page(PAGE_SIZE + 1)))

    def test_an_oversized_cumulative_response_stops_the_capture(self) -> None:
        heavy = {"items": [{"asin": "SYNTHETIC-HEAVY", "blob": "x" * (MAX_RESPONSE_BYTES + 1)}]}
        with self.assertRaisesRegex(ConnectorError, "library-response-too-large"):
            collect_library_pages(pages(heavy))

    def test_a_malformed_page_stops_the_capture(self) -> None:
        for response in (None, [], {"items": "not-a-list"}, {}, {"items": ["not-a-record"]}):
            with self.subTest(response=repr(response)):
                with self.assertRaisesRegex(ConnectorError, "library-response-invalid"):
                    collect_library_pages(pages(response))

    def test_a_record_without_a_usable_identifier_stops_the_capture(self) -> None:
        for asin in (None, "", "   ", 17):
            with self.subTest(asin=repr(asin)):
                with self.assertRaisesRegex(ConnectorError, "library-response-invalid"):
                    collect_library_pages(pages({"items": [{"asin": asin}]}))


class DuplicateTests(unittest.TestCase):
    def test_a_duplicate_across_pages_stops_instead_of_silently_deduplicating(self) -> None:
        first = page(PAGE_SIZE)
        overlapping = {"items": [first["items"][0], {"asin": "SYNTHETIC-NEW"}]}
        with self.assertRaisesRegex(ConnectorError, "library-pagination-duplicate"):
            collect_library_pages(pages(first, overlapping))

    def test_a_duplicate_within_a_page_stops(self) -> None:
        with self.assertRaisesRegex(ConnectorError, "library-pagination-duplicate"):
            collect_library_pages(
                pages({"items": [{"asin": "SYNTHETIC-1"}, {"asin": "SYNTHETIC-1"}]})
            )

    def test_reordered_pages_without_duplication_are_still_accepted(self) -> None:
        # A source that returns the same *set* in a different order across page
        # boundaries is only acceptable when no identifier repeats.
        capture = collect_library_pages(
            pages(
                {"items": [{"asin": f"SYNTHETIC-{i}"} for i in reversed(range(PAGE_SIZE))]},
                {"items": [{"asin": "SYNTHETIC-LAST"}]},
            )
        )
        self.assertEqual(len(capture["items"]), PAGE_SIZE + 1)


if __name__ == "__main__":
    unittest.main()
