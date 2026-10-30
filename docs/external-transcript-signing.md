# External assistant transcript signing

Core accepts external assistant transcripts at `POST /api/mcp/external-conversations` only when the external assistant signature verifies. Transcript delivery does not require a Mentingo OAuth token. This endpoint is explicit transcript ingestion;
ordinary MCP calls do not publish conversations.

Configure `EXTERNAL_TRANSCRIPT_SIGNING_PUBLIC_KEY` on each connected Core instance
with the bot's Ed25519 public key, encoded as base64 DER SPKI. The matching private
key stays on the external assistant deployment. Distribute the public key to instances that
trust this assistant. Missing, malformed or non-Ed25519 keys disable transcript ingestion
without preventing Core startup. Restart Core after configuring or replacing the key.

For Learn, set the SSM parameter `/learn/production/api/editable/EXTERNAL_TRANSCRIPT_SIGNING_PUBLIC_KEY`. The Learn deployment workflow imports it into the API container.

The bot sends these headers without an Authorization header:

- `X-Mentingo-Transcript-Timestamp`: integer Unix seconds.
- `X-Mentingo-Transcript-Signature`: base64 Ed25519 signature.

Sign the UTF-8 encoding of the following five strings joined by newline characters,
with no trailing newline:

1. `mentingo-external-transcript-v1`
2. `POST`
3. The destination instance's canonical MCP resource URL plus `/external-conversations`,
   for example `https://tenant.example/api/mcp/external-conversations`.
4. The exact timestamp header value.
5. Lowercase hexadecimal SHA-256 digest of the exact HTTP body bytes.

Core verifies the captured raw body rather than serializing parsed JSON. The
signature binds the tenant destination, so requests cannot be forwarded
to another tenant URL. Requests more than 300 seconds old or more
than 300 seconds in the future are rejected. Bot and Core clocks must agree.
Retries should sign the same body with a fresh timestamp; existing thread and
message uniqueness makes successful repeated deliveries idempotent. The signature
does not itself deduplicate requests within the accepted time window.

External conversations belong to the integration installation in the receiving tenant. Supply its stable `integrationId` in each signed body. No paired Mentingo user owns these conversations. The destination host must resolve to an active tenant. Integration, platform and thread identity isolate transcripts; participant names and IDs remain attribution supplied by the trusted integration.

The request selects `source` as `slack`, `discord` or `whatsapp`; `mentingo` is reserved for native conversations. Messages carry generic `participantId` and `participantName`. Only Slack currently has a shipping integration; the other source values prepare the contract for future adapters.
