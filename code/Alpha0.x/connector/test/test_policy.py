import unittest

from atnr_connector.policy import load_policy


class PolicyTests(unittest.TestCase):
    def test_private_alpha_policy_blocks_commercial_shipping(self) -> None:
        policy = load_policy()
        self.assertEqual(policy.app_abbreviation, "ATnR")
        self.assertEqual(policy.distribution, "private-alpha")
        self.assertLessEqual(policy.maximum_named_testers, 10)
        self.assertEqual(policy.allowed_marketplaces, ("us",))
        self.assertEqual(policy.provider_device_display_name, "Audible for iPhone")


if __name__ == "__main__":
    unittest.main()
