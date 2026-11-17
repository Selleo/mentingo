"""Overview/spec planning, targeted retrieval and evidence without implementation dumps."""

import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import pr_video_plan

SPEC = "docs/specs/enrollment-business-spec.md"
SECTION = SPEC + "#part-2"
CONTENT = "# Enrollment\n## Public access\nOpen a public course and choose Enroll.\n## Admin exports\nDownload reports.\n"


def inputs():
    return {
        "title": "Fix public course enrollment",
        "body": "Public courses now open correctly for learners.",
        "files": [{"path": "apps/api/enrollment.ts", "diff": "SECRET_CODE_SENTINEL"}],
        "business_specs": [{"path": SPEC, "content": CONTENT}],
    }


def recorded():
    return {
        "decision": "record",
        "reason": "Learners can open and enroll in a public course.",
        "flows": [
            {
                "id": "public-enrollment",
                "title": "Open a public course",
                "goal": "Access a public course",
                "changeEvidence": "Public courses now open correctly for learners.",
                "evidence": [
                    {
                        "sectionId": SECTION,
                        "quote": "Open a public course and choose Enroll.",
                    }
                ],
                "steps": ["Open the public course.", "Choose Enroll."],
                "expectedOutcome": "The learner can access the course.",
            }
        ],
    }


def replies(answer=None, paths=None, sections=None):
    return [
        {
            "decision": "review",
            "reason": "Public course access changed.",
            "paths": paths or [SPEC],
        },
        {"sectionIds": sections or [SECTION]},
        answer if answer is not None else recorded(),
    ]


class Plan(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.run = Path(folder.name)

    def classify(self, source=None, answers=None):
        values = [
            (json.dumps(answer), {"provider": "cli"})
            for answer in (answers or replies())
        ]
        with mock.patch("pr_video_plan.llm.complete", side_effect=values) as call:
            result = pr_video_plan.plan(source or inputs(), self.run)
        return result, call

    def test_overview_routes_documents_then_sections_then_supported_flows(self):
        result, call = self.classify()
        self.assertEqual(call.call_count, 3)
        contexts = [json.loads(item.args[0]) for item in call.call_args_list]
        self.assertEqual(set(contexts[0]), {"overview", "documents"})
        self.assertNotIn("content", contexts[0]["documents"][0])
        self.assertEqual(set(contexts[1]), {"overview", "sections"})
        self.assertTrue(all("content" not in item for item in contexts[1]["sections"]))
        self.assertEqual(
            [item["id"] for item in contexts[2]["business_sections"]], [SECTION]
        )
        self.assertNotIn(
            "Download reports", contexts[2]["business_sections"][0]["content"]
        )
        self.assertEqual(result["flows"][0]["evidence"][0]["path"], SPEC)
        self.assertEqual(
            json.loads((self.run / "pr-video-plan.json").read_text()), result
        )
        for request in call.call_args_list:
            self.assertIn("untrusted evidence", request.args[1])
            self.assertNotIn("SECRET_CODE_SENTINEL", request.args[0])
            self.assertNotIn("apps/api/enrollment.ts", request.args[0])

    def test_large_code_diff_and_unrelated_spec_content_do_not_bloat_model_context(
        self,
    ):
        source = inputs()
        source["files"] = [
            {"path": "source.ts", "diff": "SECRET_CODE_SENTINEL" * 100000}
        ]
        source["business_specs"][0]["content"] += (
            "## Other reference material\n" + "Unrelated detail. " * 100000
        )
        _, call = self.classify(source)
        for request in call.call_args_list:
            self.assertLessEqual(
                len(request.args[0].encode("utf-8")), pr_video_plan.MAX_REQUEST_BYTES
            )
            self.assertNotIn("SECRET_CODE_SENTINEL", request.args[0])
        self.assertNotIn("Unrelated detail", call.call_args_list[2].args[0])

    def test_invisible_overview_skips_after_one_call_without_loading_sections(self):
        decision = {
            "decision": "skip",
            "reason": "Only internal logging changed.",
            "paths": [],
        }
        with mock.patch(
            "pr_video_plan._sections",
            side_effect=AssertionError("No section lookup needed"),
        ):
            result, call = self.classify(answers=[decision])
        self.assertEqual(call.call_count, 1)
        self.assertEqual(result["decision"], "skip")
        self.assertEqual(result["flows"], [])

    def test_changed_paths_are_not_behavioral_evidence_or_a_docs_only_veto(self):
        source = inputs()
        source["files"] = [{"path": "docs/notes.md"}]
        result, _ = self.classify(source)
        self.assertEqual(result["decision"], "record")

    def test_unknown_documents_and_sections_stop_before_flow_generation(self):
        for answers in (
            replies(paths=["docs/specs/invented-business-spec.md"]),
            replies(sections=[SPEC + "#invented"]),
            replies(paths=[SPEC, SPEC]),
        ):
            with (
                self.subTest(answers=answers),
                self.assertRaises(pr_video_plan.PlanningError),
            ):
                self.classify(answers=answers)
        self.assertFalse((self.run / "pr-video-plan.json").exists())

    def test_overview_and_selected_spec_quotes_must_both_support_a_flow(self):
        for field in ("overview", "quote", "section"):
            answer = recorded()
            if field == "overview":
                answer["flows"][0]["changeEvidence"] = "An invented behavior"
            elif field == "quote":
                answer["flows"][0]["evidence"][0]["quote"] = "An invented control"
            else:
                answer["flows"][0]["evidence"][0]["sectionId"] = SPEC + "#part-3"
            with (
                self.subTest(field=field),
                self.assertRaises(pr_video_plan.PlanningError),
            ):
                self.classify(answers=replies(answer))
        self.assertFalse((self.run / "pr-video-plan.json").exists())

    def test_uncertain_malformed_and_overflow_decisions_do_not_become_silent_skips(
        self,
    ):
        cases = [
            [{"decision": "uncertain", "reason": "Overview is unclear.", "paths": []}],
            [{"decision": "review", "reason": "Relevant.", "paths": []}],
            replies(
                {
                    "decision": "uncertain",
                    "reason": "Contradictory material.",
                    "flows": [],
                }
            ),
        ]
        too_many = recorded()
        too_many["flows"] = [
            copy.deepcopy(too_many["flows"][0])
            for _ in range(pr_video_plan.MAX_FLOWS + 1)
        ]
        cases.append(replies(too_many))
        for answers in cases:
            with (
                self.subTest(answers=answers),
                self.assertRaises(pr_video_plan.PlanningError),
            ):
                self.classify(answers=answers)
        self.assertFalse((self.run / "pr-video-plan.json").exists())

    def test_model_and_json_errors_preserve_failure_instead_of_a_skip(self):
        for text, usage in (
            ("", {"provider": "agent"}),
            ("garbled", {"provider": "cli"}),
        ):
            with (
                mock.patch("pr_video_plan.llm.complete", return_value=(text, usage)),
                self.assertRaises(ValueError),
            ):
                pr_video_plan.plan(inputs(), self.run)
        with (
            mock.patch(
                "pr_video_plan.llm.complete",
                side_effect=RuntimeError("provider failed"),
            ),
            self.assertRaises(RuntimeError),
        ):
            pr_video_plan.plan(inputs(), self.run)
        self.assertFalse((self.run / "pr-video-plan.json").exists())

    def test_unsafe_spec_paths_and_oversized_overview_fail_before_models(self):
        for path in (
            "../credentials-business-spec.md",
            "apps/api/secret-business-spec.md",
        ):
            source = inputs()
            source["business_specs"][0]["path"] = path
            with (
                mock.patch("pr_video_plan.llm.complete") as call,
                self.assertRaises(ValueError),
            ):
                pr_video_plan.plan(source, self.run)
            call.assert_not_called()
        source = inputs()
        source["body"] = "ą" * pr_video_plan.MAX_OVERVIEW_BYTES
        with (
            mock.patch("pr_video_plan.llm.complete") as call,
            self.assertRaises(ValueError),
        ):
            pr_video_plan.plan(source, self.run)
        call.assert_not_called()

    def test_sections_preserve_unicode_and_ignore_headings_inside_fenced_examples(self):
        source = (
            "# Topic\n```markdown\n## Fake heading\n```\n## Real section\n"
            + "Zażółć gęślą jaźń. " * 4000
        )
        sections = pr_video_plan._sections(SPEC, source)
        self.assertEqual("".join(section["content"] for section in sections), source)
        self.assertTrue(
            all(
                len(section["content"].encode("utf-8")) <= pr_video_plan.SECTION_BYTES
                for section in sections
            )
        )
        self.assertTrue(
            all("Fake heading" not in section["heading"] for section in sections)
        )
        self.assertEqual(len({section["id"] for section in sections}), len(sections))


if __name__ == "__main__":
    unittest.main()
