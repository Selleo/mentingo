"""Opt-in verified artifact attachments for captured synthetic outputs (stdlib only)."""

from __future__ import annotations

import base64
import copy
import hashlib
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

MAX_BYTES = 20_000_000
SUPPORTED = {"image/png", "image/jpeg", "image/webp", "audio/wav", "application/pdf"}


@dataclass(frozen=True)
class Artifact:
    row: int
    output_path: tuple
    data: bytes
    media_type: str
    sha256: str


def _matches_type(data, media_type):
    return {
        "image/png": data.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/jpeg": data.startswith(b"\xff\xd8\xff"),
        "image/webp": data[:4] == b"RIFF" and data[8:12] == b"WEBP",
        "audio/wav": data[:4] == b"RIFF" and data[8:12] == b"WAVE",
        "application/pdf": data.startswith(b"%PDF-"),
    }[media_type]


def prepare_media(rows, media_roots=None):
    """Validate ALL allowed artifacts before any remote request; no opt-in means no reads."""
    if not media_roots:
        return []
    roots = []
    for value in media_roots:
        root = Path(value).expanduser().absolute()
        if root.is_symlink() or not root.is_dir():
            raise ValueError(
                "Media root must be an existing directory without symlinks"
            )
        roots.append(root.resolve())
    prepared = []

    def walk(value, row, location):
        if isinstance(value, dict):
            if "path" in value and any(
                key in value for key in ("sha256", "byteSize", "mediaType")
            ):
                media_type = value.get("mediaType")
                if media_type in SUPPORTED:
                    if not isinstance(value.get("path"), str):
                        raise ValueError("Invalid media artifact path")
                    candidate = Path(value["path"]).expanduser().absolute()
                    root = next(
                        (root for root in roots if candidate.is_relative_to(root)), None
                    )
                    if root is None:
                        raise ValueError(
                            "Media artifact is outside explicit media roots"
                        )
                    cursor = root
                    for part in candidate.relative_to(root).parts:
                        cursor = cursor / part
                        if part == ".." or cursor.is_symlink():
                            raise ValueError(
                                "Media artifact symlinks and traversal are forbidden"
                            )
                    if (
                        not candidate.resolve().is_relative_to(root)
                        or not candidate.is_file()
                    ):
                        raise ValueError(
                            "Media artifact must be a regular file within its root"
                        )
                    size = value.get("byteSize")
                    checksum = value.get("sha256")
                    if (
                        type(size) is not int
                        or not 0 < size <= MAX_BYTES
                        or candidate.stat().st_size != size
                    ):
                        raise ValueError(
                            "Media artifact size mismatch or limit exceeded"
                        )
                    if not isinstance(checksum, str) or not re.fullmatch(
                        r"[0-9a-f]{64}", checksum
                    ):
                        raise ValueError("Invalid media artifact SHA256")
                    with candidate.open("rb") as stream:
                        data = stream.read(MAX_BYTES + 1)
                    if (
                        len(data) != size
                        or hashlib.sha256(data).hexdigest() != checksum
                    ):
                        raise ValueError("Media artifact checksum or size mismatch")
                    if not _matches_type(data, media_type):
                        raise ValueError(
                            "Media artifact content does not match MIME type"
                        )
                    prepared.append(Artifact(row, location, data, media_type, checksum))
            for key, child in value.items():
                walk(child, row, location + (key,))
        elif isinstance(value, list):
            for index, child in enumerate(value):
                walk(child, row, location + (index,))

    for index, row in enumerate(rows):
        walk(row["output"], index, ())
    return prepared


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


def _http(request):
    """Never follow signed-URL redirects or expose credentials/URLs in errors."""
    try:
        with urllib.request.build_opener(_NoRedirect()).open(
            request, timeout=60
        ) as response:
            return response.status, response.read()
    except (urllib.error.URLError, OSError):
        raise RuntimeError(
            "Media HTTP request failed; no attachment recorded"
        ) from None


def upload_media(client, rows, prepared, row_index, trace_id, observation_id):
    receipts = []
    artifacts = [artifact for artifact in prepared if artifact.row == row_index]
    if not artifacts:
        return receipts
    rows[row_index]["output"] = copy.deepcopy(rows[row_index]["output"])
    for artifact in artifacts:
        sha256_base64 = base64.b64encode(bytes.fromhex(artifact.sha256)).decode("ascii")
        created = client.request(
            "POST",
            "/api/public/media",
            {
                "traceId": trace_id,
                "observationId": observation_id,
                "field": "output",
                "contentType": artifact.media_type,
                "contentLength": len(artifact.data),
                "sha256Hash": sha256_base64,
            },
        )
        media_id = created.get("mediaId")
        if not isinstance(media_id, str) or not re.fullmatch(
            r"[A-Za-z0-9_-]+", media_id
        ):
            raise ValueError("Media service returned an invalid identity")
        upload_url = created.get("uploadUrl")
        if upload_url is not None:
            parsed = urllib.parse.urlsplit(upload_url)
            if (
                parsed.scheme != "https"
                or not parsed.hostname
                or parsed.username
                or parsed.password
                or parsed.fragment
            ):
                raise ValueError("Media upload requires a signed HTTPS URL")
            headers = {"Content-Type": artifact.media_type}
            if parsed.hostname != "storage.googleapis.com":
                headers["x-ms-blob-type"] = "BlockBlob"
                headers["x-amz-checksum-sha256"] = sha256_base64
            started = time.monotonic()
            status, _ = _http(
                urllib.request.Request(
                    upload_url, data=artifact.data, method="PUT", headers=headers
                )
            )
            if not 200 <= status < 300:
                raise RuntimeError("Media upload was not acknowledged")
            patch = {
                "uploadedAt": datetime.now(timezone.utc).isoformat(),
                "uploadHttpStatus": status,
                "uploadTimeMs": int((time.monotonic() - started) * 1000),
            }
            # PATCH may legitimately return an empty body, unlike ProjectClient.request.
            _http(
                urllib.request.Request(
                    client.origin + "/api/public/media/" + media_id,
                    data=json.dumps(patch).encode(),
                    method="PATCH",
                    headers={
                        "Authorization": client.authorization,
                        "Content-Type": "application/json",
                    },
                )
            )
        readback = client.request("GET", "/api/public/media/" + media_id)
        if readback.get("contentType") != artifact.media_type or readback.get(
            "contentLength"
        ) != len(artifact.data):
            raise ValueError("Media readback content type or length mismatch")
        descriptor = rows[row_index]["output"]
        for key in artifact.output_path:
            descriptor = descriptor[key]
        descriptor["langfuseMedia"] = (
            "@@@langfuseMedia:type="
            + artifact.media_type
            + "|id="
            + media_id
            + "|source=bytes@@@"
        )
        receipts.append(
            {
                "mediaId": media_id,
                "sha256": artifact.sha256,
                "byteSize": len(artifact.data),
                "mediaType": artifact.media_type,
                "field": "output",
                "outputPath": list(artifact.output_path),
            }
        )
    return receipts
