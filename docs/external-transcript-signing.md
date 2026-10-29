# External assistant transcript signing

Core accepts external assistant transcripts at `POST /api/mcp/external-conversations` only when both
its existing Mentingo OAuth token and its bot signature verify. The OAuth grant
must be exactly `student:read`. This endpoint is explicit transcript ingestion;
ordinary MCP calls do not publish conversations.

Configure `EXTERNAL_TRANSCRIPT_SIGNING_PUBLIC_KEY` on each connected Core instance
with the bot's Ed25519 public key, encoded as base64 DER SPKI. The matching private
key stays on the external assistant deployment. Distribute the public key to instances that
trust this assistant. Missing, malformed or non-Ed25519 keys disable transcript ingestion
without preventing Core startup. Restart Core after configuring or replacing the key.

The bot sends these headers alongside its `Authorization: Bearer ...` header:

- `X-Mentingo-Transcript-Timestamp`: integer Unix seconds.
- `X-Mentingo-Transcript-Signature`: base64 Ed25519 signature.

Sign the UTF-8 encoding of the following six strings joined by newline characters,
with no trailing newline:

1. `mentingo-external-transcript-v1`
2. `POST`
3. The authenticated token's canonical MCP resource URL plus `/external-conversations`,
   for example `https://tenant.example/api/mcp/external-conversations`.
4. The exact timestamp header value.
5. Lowercase hexadecimal SHA-256 digest of the exact HTTP body bytes.
6. Lowercase hexadecimal SHA-256 digest of the bearer token, without its `Bearer ` prefix.

Core verifies the captured raw body rather than serializing parsed JSON. The
signature binds the tenant destination and token, so requests cannot be forwarded
with another tenant URL or credential. Requests more than 300 seconds old or more
than 300 seconds in the future are rejected. Bot and Core clocks must agree.
Retries should sign the same body with a fresh timestamp; existing thread and
message uniqueness makes successful repeated deliveries idempotent. The signature
does not itself deduplicate requests within the accepted time window.

Treat external sender names and IDs as bot-supplied attribution, separate from the
connected Mentingo account and its permissions. Signatures attest to the configured
bot, while OAuth selects and authorizes the connected tenant/account.

The request selects `source` as `slack`, `discord` or `whatsapp`; `mentingo` is reserved for native conversations. Messages carry generic `participantId` and `participantName`. Only Slack currently has a shipping integration; the other source values prepare the contract for future adapters.
