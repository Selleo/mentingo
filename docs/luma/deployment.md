# Luma Integration Setup

This guide explains how to connect Mentingo to Luma-backed features:

- AI course generation.
- Voice mentor mode.

Mentingo calls Luma with a Luma organization API key. The key authenticates Mentingo to Luma and also carries feature-specific provider secrets configured in Luma.

## Mentingo Configuration

Mentingo needs two Luma values:

```env
LUMA_BASE_URL=https://<luma-api-domain>/api
LUMA_API_KEY=<luma-organization-api-key>
```

`LUMA_BASE_URL` must point to the Luma public API base URL. The Luma public routes are versioned under `/v1`, and the SDK appends that version internally, so use the API base URL, not a specific endpoint.

Configure these values as follows:

1. Add `LUMA_BASE_URL` to the Mentingo API `.env` file. This value is only read from process env.
2. Add `LUMA_API_KEY` either:
   - in the Mentingo API `.env`, or
   - in `<mentingo-app>/admin/envs` under the `LUMA_API_KEY` field.

Do not configure `LUMA_BASE_URL` in `<mentingo-app>/admin/envs`; that screen only stores `LUMA_API_KEY` for Luma.

Mentingo checks Luma availability through the Luma configuration endpoint. The features become available only when Luma says the required provider secrets are configured for the API key.

## Create The Luma Organization API Key

In the Luma app:

1. Sign in as an organization owner or admin.
2. Open the organization settings.
3. Go to **API keys**.
4. Create a new API key, for example `Mentingo production`.
5. Copy the generated key immediately. It is shown only once.
6. Paste that key into Mentingo as `LUMA_API_KEY`.

The generated key usually starts with:

```text
luma_live_
```

This single Luma API key is used by both:

- Mentingo course generation HTTP requests through `X-API-Key`.
- Mentingo voice mentor Socket.IO connections through Socket.IO auth.

## Feature-Specific Provider Keys

After creating the Luma organization API key, use **Set** on that key in the Luma app to configure provider secrets.

### AI Course Generation

AI course generation is enabled when the Luma API key has both:

- `agent_api_key`
- `embedding_api_key`

`agent_api_key` is the chat/agent model provider key. `embedding_api_key` is the embedding model provider key.

Use provider keys with enough quota for course generation. Course generation can run multiple chapter/lesson workers in parallel, and the selected API key concurrency tier controls how much parallel work Luma attempts.

Optional for course generation:

- `napkin_api_key`

Napkin is used for generated visual assets where that path is enabled. If it is missing, Luma skips those generated assets. The basic course-generation availability check only requires the agent and embedding keys.

### Voice Mentor

Voice mentor mode is enabled when the Luma API key has both:

- `speech_to_text_api_key`
- `text_to_speech_api_key`

`speech_to_text_api_key` is the Gladia key. `text_to_speech_api_key` is the Cartesia key.

Voice mentor also requires Mentingo Core to have `OPENAI_API_KEY` configured, because the AI mentor conversation and judge still use Core's OpenAI setup.

The current voice integration expects:

```env
AUDIO_TRANSCRIPTION_PROVIDER=gladia
AUDIO_TTS_PROVIDER=cartesia
TTS_MODEL=sonic-3
```

Keep the provider-specific API keys aligned with those provider settings.

## Required Keys

All Luma features need `LUMA_BASE_URL` and `LUMA_API_KEY` in Mentingo.

AI course generation needs `agent_api_key` and `embedding_api_key` on the Luma API key.

Voice mentor needs `speech_to_text_api_key` and `text_to_speech_api_key` on the Luma API key, plus `OPENAI_API_KEY` in Mentingo Core.

Generated visual assets need `napkin_api_key`. Without it, Luma skips those assets.

## Verification

1. Confirm the Luma API base URL is reachable from the Mentingo API host.
2. Confirm Mentingo has:

   ```env
   LUMA_BASE_URL=https://<luma-api-domain>/api
   LUMA_API_KEY=<luma-organization-api-key>
   ```

3. Open the Mentingo admin env setup page and confirm Luma no longer appears as missing.
4. Call or load the Mentingo Luma configuration check. It should report:
   - `courseGenerationEnabled: true` when `agent_api_key` and `embedding_api_key` are configured.
   - `voiceMentorEnabled: true` when `speech_to_text_api_key` and `text_to_speech_api_key` are configured.
5. For course generation, open an empty course as an admin and confirm the AI course generation action is available.
6. For voice mentor, open an AI mentor lesson as a student and confirm the voice mentor action is available.

## Troubleshooting

- If both features are disabled, check `LUMA_BASE_URL` and `LUMA_API_KEY` first.
- If only course generation is disabled, check the Luma API key's `agent_api_key` and `embedding_api_key`.
- If only voice mentor is disabled, check the Luma API key's `speech_to_text_api_key` and `text_to_speech_api_key`.
- If generated visual assets are missing, check whether `napkin_api_key` is configured. When it is not configured, Luma skips those assets.
- If voice mentor connects but transcription or speech output fails, verify the speech-to-text and text-to-speech provider keys and quotas.
- If the Luma API key was created but not copied, revoke it and create a new one. Luma only shows the raw key once.
