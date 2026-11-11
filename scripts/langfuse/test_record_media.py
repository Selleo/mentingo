"""All media recorder tests are offline; no model or provider calls."""

import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from record_media import prepare_media, upload_media, _NoRedirect
from record import record_report
from test_manage import manifest


class MediaTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.data = b"\x89PNG\r\n\x1a\nsynthetic test image"
        self.path = self.root / "actual.png"
        self.path.write_bytes(self.data)
        self.descriptor = {
            "path": str(self.path),
            "sha256": hashlib.sha256(self.data).hexdigest(),
            "byteSize": len(self.data),
            "mediaType": "image/png",
        }
        self.rows = [
            {
                "output": {
                    "body": "Actual response preserved",
                    "artifacts": [dict(self.descriptor)],
                }
            }
        ]

    def client(self, dedup=False):
        owner = self

        class Client:
            origin = "https://langfuse.example"
            authorization = "Basic test-project-secret"
            calls = []

            def request(self, method, path, body=None):
                self.calls.append((method, path, body))
                if method == "POST":
                    return {
                        "mediaId": "media-id",
                        "uploadUrl": (
                            None
                            if dedup
                            else "https://store.example/upload?signed=synthetic"
                        ),
                    }
                return {"contentType": "image/png", "contentLength": len(owner.data)}

        return Client()

    def test_no_explicit_roots_never_reads_or_uploads(self):
        self.path.unlink()
        self.assertEqual(prepare_media(self.rows), [])
        self.assertEqual(
            upload_media(self.client(), self.rows, [], 0, "trace", "span"), []
        )
        self.assertNotIn("langfuseMedia", self.rows[0]["output"]["artifacts"][0])

    def test_all_artifacts_validated_before_any_network(self):
        self.rows[0]["output"]["artifacts"].append(
            {**self.descriptor, "sha256": "0" * 64}
        )
        client = self.client()
        with self.assertRaisesRegex(ValueError, "checksum"):
            prepared = prepare_media(self.rows, [self.root])
            upload_media(client, self.rows, prepared, 0, "trace", "span")
        self.assertEqual(client.calls, [])

    def test_recorder_rejects_corruption_before_project_verification(self):
        from unittest.mock import Mock

        client = Mock()
        artifact = {**self.descriptor, "sha256": "0" * 64}
        report = {
            "results": [
                {
                    "caseId": "source-grounding",
                    "status": "needs_review",
                    "output": artifact,
                    "checks": {},
                }
            ]
        }
        with self.assertRaisesRegex(ValueError, "checksum"):
            record_report(client, {}, manifest(), report, "test", [self.root])
        client.verify_project.assert_not_called()
        client.request.assert_not_called()

    def test_missing_root_rejected(self):
        with self.assertRaisesRegex(ValueError, "existing directory"):
            prepare_media(self.rows, [self.root / "missing"])

    def test_escaping_root_and_symlinks_rejected(self):
        (self.root / "different").mkdir()
        with self.assertRaisesRegex(ValueError, "outside"):
            prepare_media(self.rows, [self.root / "different"])
        link = self.root / "linked.png"
        link.symlink_to(self.path)
        self.rows[0]["output"]["artifacts"][0]["path"] = str(link)
        with self.assertRaisesRegex(ValueError, "symlinks"):
            prepare_media(self.rows, [self.root])
        self.rows[0]["output"]["artifacts"][0]["path"] = str(
            self.root / ".." / self.root.name / "actual.png"
        )
        with self.assertRaises(ValueError):
            prepare_media(self.rows, [self.root])

    def test_size_mime_and_hash_mismatch_rejected(self):
        for changes in (
            {"byteSize": 1},
            {"mediaType": "application/pdf"},
            {"sha256": "wrong"},
        ):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                prepare_media([{"output": {**self.descriptor, **changes}}], [self.root])

    def test_upload_never_forwards_auth_to_storage_and_preserves_output(self):
        prepared = prepare_media(self.rows, [self.root])
        requests = []

        def http(request):
            requests.append(request)
            return (201, b"")

        with patch("record_media._http", side_effect=http):
            receipts = upload_media(
                self.client(), self.rows, prepared, 0, "trace", "span"
            )
        put, patch_request = requests
        self.assertEqual(put.method, "PUT")
        self.assertIsNone(put.get_header("Authorization"))
        self.assertEqual(put.data, self.data)
        self.assertEqual(
            patch_request.get_header("Authorization"), "Basic test-project-secret"
        )
        self.assertEqual(receipts[0]["outputPath"], ["artifacts", 0])
        self.assertEqual(self.rows[0]["output"]["body"], "Actual response preserved")
        descriptor = self.rows[0]["output"]["artifacts"][0]
        self.assertEqual(descriptor["sha256"], self.descriptor["sha256"])
        self.assertEqual(
            descriptor["langfuseMedia"],
            "@@@langfuseMedia:type=image/png|id=media-id|source=bytes@@@",
        )
        self.assertEqual(prepared[0].data, self.data)

    def test_dedup_has_no_put_or_patch_and_readback_is_required(self):
        prepared = prepare_media(self.rows, [self.root])
        client = self.client(dedup=True)
        with patch("record_media._http") as http:
            upload_media(client, self.rows, prepared, 0, "trace", "span")
        http.assert_not_called()
        self.assertEqual([call[0] for call in client.calls], ["POST", "GET"])

    def test_bad_readback_cannot_create_an_attachment(self):
        prepared = prepare_media(self.rows, [self.root])
        client = self.client(dedup=True)
        original = client.request
        client.request = lambda method, path, body=None: (
            {"contentType": "application/pdf", "contentLength": len(self.data)}
            if method == "GET"
            else original(method, path, body)
        )
        with self.assertRaisesRegex(ValueError, "readback"):
            upload_media(client, self.rows, prepared, 0, "trace", "span")
        self.assertNotIn("langfuseMedia", self.rows[0]["output"]["artifacts"][0])

    def test_unsafe_upload_url_never_receives_bytes(self):
        prepared = prepare_media(self.rows, [self.root])
        client = self.client()
        original = client.request
        client.request = lambda method, path, body=None: (
            {"mediaId": "media-id", "uploadUrl": "http://unsafe.example/upload"}
            if method == "POST"
            else original(method, path, body)
        )
        with patch("record_media._http") as http, self.assertRaisesRegex(
            ValueError, "HTTPS"
        ):
            upload_media(client, self.rows, prepared, 0, "trace", "span")
        http.assert_not_called()

    def test_redirect_handler_refuses_redirects(self):
        self.assertIsNone(
            _NoRedirect().redirect_request(
                None, None, 302, "redirect", {}, "https://other.example"
            )
        )

    def test_raw_pcm_skipped_but_nested_wav_is_attached(self):
        wav = self.root / "actual.wav"
        data = b"RIFF0000WAVEsynthetic"
        wav.write_bytes(data)
        output = {
            **self.descriptor,
            "mediaType": "audio/pcm",
            "wav": {
                "path": str(wav),
                "mediaType": "audio/wav",
                "byteSize": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
            },
        }
        prepared = prepare_media([{"output": output}], [self.root])
        self.assertEqual(len(prepared), 1)
        self.assertEqual(prepared[0].output_path, ("wav",))


if __name__ == "__main__":
    unittest.main()
