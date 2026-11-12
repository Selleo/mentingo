"""No-network regression tests for the remote configuration contract."""

import copy
import json
import subprocess
import unittest
import urllib.parse

from manage import ProjectClient, apply_configuration, definitions, validate_manifest


class MemoryClient(ProjectClient):
    def __init__(self):
        super().__init__(
            "https://langfuse.example",
            "synthetic-public",
            "synthetic-secret",
            "project-1",
        )
        self.evaluators = {}
        self.rules = {}
        self.datasets = {}
        self.items = {}
        self.calls = []

    def request(self, method, path, body=None):
        self.calls.append((method, path, copy.deepcopy(body)))
        if path == "/api/public/projects":
            return {"data": [{"id": "project-1", "name": "synthetic"}]}
        stem = path.split("?")[0]
        collections = {
            "/api/public/v2/evaluators": self.evaluators,
            "/api/public/v2/evaluation-rules": self.rules,
        }
        if stem in collections:
            store = collections[stem]
            if method == "GET":
                return {"data": list(store.values()), "meta": {"totalPages": 1}}
            key = "id-" + str(len(store))
            store[key] = {**copy.deepcopy(body), "id": key, "version": 1}
            return store[key]
        for prefix, store in collections.items():
            if stem.startswith(prefix + "/"):
                key = stem.split("/")[-1]
                if method == "PATCH":
                    store[key] = {
                        **store[key],
                        **copy.deepcopy(body),
                        "version": store[key]["version"] + 1,
                    }
                return store[key]
        if stem == "/api/public/v2/datasets":
            self.datasets[body["name"]] = {
                **copy.deepcopy(body),
                "id": "dataset-" + body["name"],
            }
            return self.datasets[body["name"]]
        if stem.startswith("/api/public/v2/datasets/"):
            name = urllib.parse.unquote(stem.removeprefix("/api/public/v2/datasets/"))
            if name not in self.datasets:
                raise RuntimeError("Langfuse GET dataset returned HTTP 404")
            return self.datasets[name]
        if stem == "/api/public/dataset-items":
            if method == "GET":
                name = urllib.parse.parse_qs(urllib.parse.urlsplit(path).query)[
                    "datasetName"
                ][0]
                return {
                    "data": [
                        row for row in self.items.values() if row["datasetName"] == name
                    ],
                    "meta": {"totalPages": 1},
                }
            self.items[body["id"]] = copy.deepcopy(body)
            return body
        raise AssertionError((method, path))


def manifest():
    return {
        "features": [
            {
                "featureId": "mentor",
                "datasetName": "regression/synthetic/mentor/v1",
                "traceNames": ["mentor-turn"],
                "executionLevel": "application_response",
                "items": [
                    {
                        "id": "source-grounding",
                        "input": {
                            "message": "Where is reception?",
                            "source": "Reception is on floor one.",
                        },
                        "expectedOutput": {"requiredFacts": ["floor one"]},
                        "metadata": {"synthetic": True},
                    }
                ],
            }
        ]
    }


class ConfigurationTests(unittest.TestCase):
    def test_cursor_pagination_retains_all_evaluators(self):
        client = MemoryClient()
        calls = []

        def pages(method, path, body=None):
            calls.append(path)
            if "cursor=" not in path:
                return {"data": [{"id": "first"}], "meta": {"cursor": "next-page"}}
            return {"data": [{"id": "second"}], "meta": {}}

        client.request = pages
        self.assertEqual(
            client.list_all("/api/public/v2/evaluators"),
            [{"id": "first"}, {"id": "second"}],
        )
        self.assertIn("cursor=next-page", calls[1])
        self.assertNotIn("page=", calls[0])

    def test_project_mismatch_prevents_all_writes(self):
        client = MemoryClient()
        client.expected_id = "another-project"
        with self.assertRaisesRegex(ValueError, "Project identity"):
            apply_configuration(
                client, "synthetic", manifest(), "stored-provider", "test-model"
            )
        self.assertTrue(all(method == "GET" for method, _, _ in client.calls))

    def test_rules_cover_roots_without_automatically_starting_experiments(self):
        client = MemoryClient()
        snapshot = apply_configuration(
            client, "synthetic", manifest(), "stored-provider", "test-model"
        )
        root = next(
            rule
            for rule in snapshot["rules"]
            if "every-new-trace-quality" in rule["name"]
        )
        self.assertEqual(root["sampling"], 1)
        self.assertTrue(root["enabled"])
        self.assertIn(
            {
                "type": "boolean",
                "column": "isRootObservation",
                "operator": "=",
                "value": True,
            },
            root["filter"],
        )
        self.assertIn(
            {
                "type": "boolean",
                "column": "isExperimentItemRootSpan",
                "operator": "=",
                "value": False,
            },
            root["filter"],
        )
        experiment = next(
            rule for rule in snapshot["rules"] if "/experiment-" in rule["name"]
        )
        self.assertIn(
            {
                "type": "boolean",
                "column": "isExperimentItemRootSpan",
                "operator": "=",
                "value": True,
            },
            experiment["filter"],
        )
        self.assertFalse(any("/experiments" in path for _, path, _ in client.calls))
        self.assertEqual(
            next(iter(client.datasets.values()))["metadata"]["trigger"],
            "explicit_manual_cli",
        )

    def test_missing_model_connection_keeps_llm_rules_disabled(self):
        snapshot = apply_configuration(
            MemoryClient(), "synthetic", manifest(), None, None, False
        )
        for rule in snapshot["rules"]:
            self.assertEqual(
                rule["enabled"], "every-new-trace-evidence" in rule["name"]
            )

    def test_same_configuration_does_not_duplicate_evaluators_rules_or_items(self):
        client = MemoryClient()
        first = apply_configuration(
            client, "synthetic", manifest(), "stored-provider", "test-model"
        )
        first_ids = [(item["name"], item["id"]) for item in first["evaluators"]]
        client.calls.clear()
        second = apply_configuration(
            client, "synthetic", manifest(), "stored-provider", "test-model"
        )
        self.assertEqual(
            first_ids, [(item["name"], item["id"]) for item in second["evaluators"]]
        )
        self.assertEqual(len(client.items), 1)
        self.assertFalse(any(method == "PATCH" for method, _, _ in client.calls))
        self.assertFalse(any(method == "POST" for method, _, _ in client.calls))

    def test_live_mappings_do_not_require_experiment_only_fields(self):
        evaluators, _ = definitions(
            "synthetic", manifest()["features"], "stored-provider", "test-model"
        )
        live = next(item for item in evaluators if "live-grounding" in item["name"])
        self.assertEqual(
            {row["source"] for row in live["variableMapping"]},
            {"input", "output", "metadata"},
        )
        experiment = next(
            item for item in evaluators if "experiment-mentor" in item["name"]
        )
        self.assertIn(
            "expected_output", {row["source"] for row in experiment["variableMapping"]}
        )

    def test_empty_oracle_and_duplicate_identity_are_rejected(self):
        value = manifest()
        value["features"][0]["items"][0]["expectedOutput"] = {}
        with self.assertRaises(ValueError):
            validate_manifest(value)
        value = manifest()
        value["features"].append(copy.deepcopy(value["features"][0]))
        with self.assertRaises(ValueError):
            validate_manifest(value)

    def test_code_evaluator_missing_output_is_not_a_correctness_pass(self):
        code = definitions("synthetic", manifest()["features"])[0][0]["sourceCode"]
        program = (
            code
            + '\nprocess.stdout.write(JSON.stringify([evaluate({observation:{output:null}}), evaluate({observation:{output:"Generated text"}})]));'
        )
        completed = subprocess.run(
            ["node", "-e", program], text=True, capture_output=True, check=True
        )
        missing, present = json.loads(completed.stdout)
        self.assertEqual(missing["scores"][0]["value"], "insufficient_evidence")
        self.assertEqual(present["scores"][0]["value"], "present")
        self.assertNotIn(
            "pass", [missing["scores"][0]["value"], present["scores"][0]["value"]]
        )


if __name__ == "__main__":
    unittest.main()


class AudioOutputMappingTests(unittest.TestCase):
    def test_only_known_audio_output_variables_use_faithful_metadata(self):
        from manage import definitions

        audio = manifest()["features"][0].copy()
        audio["id"] = "mentor-transcription"
        audio.pop("featureId", None)
        definitions_list, _ = definitions("mentingo", [audio])
        definition = definitions_list[-1]
        self.assertIn(
            {
                "variable": "output",
                "source": "metadata",
                "jsonPath": "$.judgeCompatibleOutput",
            },
            definition["variableMapping"],
        )
        self.assertEqual(
            definition["modelConfig"],
            {"provider": "regression-judge", "model": "gpt-6-luna"},
        )
        ordinary, _ = definitions("mentingo", manifest()["features"])
        self.assertIn(
            {"variable": "output", "source": "output"}, ordinary[-1]["variableMapping"]
        )

    def test_patch_preserves_entire_definition_except_output_mapping(self):
        import copy
        from manage import llm_definition, preserved_audio_definition

        current = llm_definition(
            "regression/mentingo/experiment-mentor-transcription/v1",
            "Original strict rubric",
            "existing-provider",
            "existing-model",
            experiment=True,
        )
        current.update(id="owned", version=31, status="active")
        before = copy.deepcopy(current)
        patch = preserved_audio_definition(current, "mentingo", "mentor-transcription")
        self.assertEqual(current, before)
        for field in ("type", "prompt", "modelConfig", "outputDefinition"):
            self.assertEqual(patch[field], current[field])
        self.assertEqual(
            set(patch),
            {"type", "prompt", "modelConfig", "variableMapping", "outputDefinition"},
        )
        for mapping in current["variableMapping"]:
            if mapping["variable"] != "output":
                self.assertIn(mapping, patch["variableMapping"])
        with self.assertRaises(ValueError):
            preserved_audio_definition(current, "mentingo", "unowned-feature")
