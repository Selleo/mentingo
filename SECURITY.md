# Security Policy

Mentingo is used to run mandatory and compliance training inside organisations, so security reports are treated as a priority, not as ordinary issues.

## Supported versions

| Version | Supported |
|---|---|
| 4.x (latest minor) | ✅ Security fixes |
| 4.x (older minors) | ⚠️ Upgrade to the latest 4.x |
| < 4.0 | ❌ Not supported |

We ship fixes on the latest released minor. If you are self-hosting, subscribe to [Releases](https://github.com/Selleo/mentingo/releases) to be notified.

## Reporting a vulnerability

**Please do not open a public issue, discussion or pull request for a security problem.**

Report it privately in one of two ways:

1. [GitHub Private Vulnerability Reporting](https://github.com/Selleo/mentingo/security/advisories/new) - preferred.
2. Email **security@mentingo.com**. <!-- ETAP 2: potwierdzić, że skrzynka istnieje i kto ją czyta; jeśli nie - podmienić na istniejący adres -->

Please include, as far as you can:

- affected version or commit, and whether it is a self-hosted or managed deployment;
- a description of the issue and its impact;
- reproduction steps or a proof of concept;
- any suggested mitigation.

## What happens next

| Stage | Target |
|---|---|
| Acknowledgement of your report | 3 business days |
| Initial assessment and severity rating | 10 business days |
| Fix or documented mitigation for critical issues | 30 days |
| Coordinated public disclosure | after a fix is released, or 90 days from the report, whichever comes first |

We will keep you updated during the process and, unless you prefer otherwise, credit you in the advisory and the release notes.

## Scope

**In scope:** the code in this repository - API, web app, packages, database schema and the deployment configuration published in `docs/`.

**Out of scope:** third-party services you configure yourself (your AI provider, object storage, video CDN, payment processor, identity provider), vulnerabilities that require access to a server you already control, findings against `mentingo.com` marketing pages, and reports produced solely by an automated scanner without a demonstrated impact.

## For self-hosting operators

A default installation is a development installation. Before going to production:

- replace every default secret: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `MASTER_KEY` (32 bytes, base64), database passwords, object storage keys;
- remove the seeded demo accounts (`admin+tenant1@example.com` and the rest);
- run the application with the least-privilege runtime database role (`LMS_DATABASE_URL`) and keep the migrator role (`MIGRATOR_DATABASE_URL`) out of the running application;
- restrict `CORS_ORIGIN` and `INTEGRATION_CORS_ORIGINS` to the domains you actually serve;
- terminate TLS in front of the application and keep object storage private, served through pre-signed URLs only;
- take backups of PostgreSQL and object storage, and test a restore;
- decide where your AI provider processes data before enabling AI features, and use your own API key.

## Safe harbour

We will not pursue or support legal action against anyone who reports a vulnerability in good faith, follows this policy, avoids privacy violations and service degradation, and gives us reasonable time to respond before any public disclosure.
