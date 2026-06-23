# LiveKit Deployment Setup

This guide explains how to connect Mentingo live training sessions to a working LiveKit deployment.

Before configuring Mentingo, prepare a LiveKit instance. This can be either:

- LiveKit Cloud.
- A self-hosted LiveKit server with a public `wss://` endpoint.

For production self-hosting, LiveKit requires a public domain and a trusted SSL certificate for the LiveKit endpoint. The Mentingo API must also be publicly reachable so LiveKit can send webhooks to it.

## Mentingo Configuration

Mentingo needs these values:

```env
LIVEKIT_URL=wss://<livekit-domain>
LIVEKIT_API_KEY=<livekit-api-key>
LIVEKIT_API_SECRET=<livekit-api-secret>
```

Add them in one of these places:

1. Add them to the API `.env` file before starting the API.
2. Open `<mentingo-app-domain>/admin/envs` and paste the values into the corresponding fields:
   - `LIVEKIT_URL`
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`

The LiveKit webhook URL for Mentingo is:

```text
https://<mentingo-app-domain>/api/live-training/livekit/webhook
```

Use the same LiveKit API key for webhook signing that you configure in Mentingo.

## LiveKit Cloud

### Create API Credentials

1. Open LiveKit Cloud.
2. Select the project used by this Mentingo environment.
3. Go to **Settings -> API Keys**.
4. Select **Create key**.
5. Save the generated API key and API secret.
6. Copy the project WebSocket URL. It should look like:

   ```text
   wss://<project>.livekit.cloud
   ```

7. Add these values to Mentingo as:
   - `LIVEKIT_URL`
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`

### Create Webhook

1. In the same LiveKit Cloud project, go to **Settings -> Webhooks**.
2. Select **Create new webhook**.
3. Enter a descriptive name, for example `Mentingo production`.
4. Set the webhook URL to:

   ```text
   https://<mentingo-app-domain>/api/live-training/livekit/webhook
   ```

5. For **Signing API key**, select the API key you created for Mentingo.
6. Create the webhook.
7. Use the LiveKit Cloud test event action to verify that Mentingo receives the webhook.

## Self-Hosted LiveKit

Use this section when the LiveKit deployment does not have an admin dashboard.

### Create API Credentials

In a self-hosted LiveKit server, API keys are configured in the LiveKit server config file. Choose a unique key name and generate a strong secret. For example:

```bash
openssl rand -hex 32
```

Add the key pair to the LiveKit config:

```yaml
keys:
  <livekit-api-key>: <livekit-api-secret>
```

Example:

```yaml
keys:
  mentingo-production: 4f9c1d4e0d2f6f3b9e6c1a9d8b7a6c5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a
```

Use these same values in Mentingo:

```env
LIVEKIT_URL=wss://<livekit-domain>
LIVEKIT_API_KEY=mentingo-production
LIVEKIT_API_SECRET=<generated-secret>
```

Restart LiveKit after changing the config.

### Configure Webhook

Add a `webhook` section to the LiveKit server config:

```yaml
webhook:
  api_key: <livekit-api-key>
  urls:
    - https://<mentingo-app-domain>/api/live-training/livekit/webhook
```

The `webhook.api_key` value must match one of the keys from the `keys` section. LiveKit uses that key to sign webhook requests, and Mentingo verifies the signature with the matching `LIVEKIT_API_SECRET`.

Combined example:

```yaml
port: 7880

rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true

keys:
  mentingo-production: <generated-secret>

webhook:
  api_key: mentingo-production
  urls:
    - https://<mentingo-app-domain>/api/live-training/livekit/webhook
```

Restart LiveKit after changing the webhook config.

## Verification

1. Confirm the Mentingo API has `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET`.
2. Confirm the LiveKit webhook URL points to:

   ```text
   https://<mentingo-app-domain>/api/live-training/livekit/webhook
   ```

3. Confirm the webhook signing key is the same API key configured in Mentingo.
4. Create or start a live training session in Mentingo.
5. Join the session as a participant.
6. Confirm LiveKit room and participant events are received by Mentingo.

## References

- LiveKit Cloud and self-hosted webhook configuration: https://docs.livekit.io/intro/basics/rooms-participants-tracks/webhooks-events/
- LiveKit self-hosted deployment configuration: https://docs.livekit.io/transport/self-hosting/deployment/
- LiveKit local development credentials: https://docs.livekit.io/transport/self-hosting/local/
