# Langfuse regression setup

Experiments run only through an explicit local CLI invocation. Updating a prompt does not launch an experiment. Dataset-specific evaluator rules score submitted experiment items; they do not call the application. Online rules use sampling `1` for new root traces and known nested feature observations, excluding evaluator-internal spans. They cannot evaluate requests that the application does not trace.

Three independent live LLM judges assess task completion, grounding, and safety/scope. Feature experiment judges compare actual output with each case's expected outcome and invariants. Categories are `pass`, `fail`, and `insufficient_evidence`. A separate code evaluator checks whether an output was captured; `present` is not a correctness score. Judgments are not calibrated release gates. Missing source, receipt, media, or state evidence must not be treated as proof of success.

The versioned feature manifests describe every dataset and expected result. These are synthetic regression cases informed by historical failures, not a statistically validated benchmark. Inspect coverage limitations before interpreting a green result. Text checks do not establish audible TTS quality, tenant isolation, durable application updates, or actual Slack delivery.

## Reproduce configuration

Core PR #2105 owns `scripts/langfuse/manage.py` and `record.py`. Set `LANGFUSE_BASE_URL`, `LANGFUSE_PUBLIC_KEY`, and `LANGFUSE_SECRET_KEY` for the intended project in your shell using your normal secret tooling. The scripts never load dotenv automatically, create provider connections, or store model credentials. Never commit secrets.

```sh
python3 scripts/langfuse/manage.py --manifest MANIFEST --profile PROFILE --project-id PROJECT_ID --output setup.json
# First command is offline. Add --apply to publish definitions/dataset items.
# To enable judges, also add --provider EXISTING_CONNECTION --model MODEL --enable-llm.
```

The apply command verifies project identity, updates stable dataset item IDs, and upserts only changed definitions. It does not disable unrelated rules. The initial reviewed setup disabled overlapping legacy Core/Slackbot rules listed in each setup snapshot; this avoids duplicate billing. Rollback consists of disabling rules with the `regression/` prefix and restoring only those listed legacy IDs to their previous state. Dataset history and prompt versions remain intact.

## Capture a prompt regression

1. Use the feature runner documented in the corresponding coverage guide. Preparation is offline; actual provider/application calls require the explicit execution flags and supplied synthetic runtime fixtures.
2. Pin/export the current production prompt versions. Keep the fixture, model, source context, and expected outcomes stable. Save the actual response report, including failures. Never substitute reference answers for application outputs.
3. Submit an already executed report using `record.py --apply`. This uploads captured responses only; it does not rerun the application. Use a new run name after a prompt change so the same dataset can be compared in Langfuse.
4. Compare actual outputs, invariant checks, and judge scores. Review `insufficient_evidence`, failed rows, skipped adapters, and provider errors separately. A prepared or skipped case is not a passed test.

```sh
python3 scripts/langfuse/record.py --help
```

Captured-response spans reflect ingestion time, not original inference latency. Reports preserve prompt provenance, actual input hashes, execution level, and any mismatch with subsequently edited fixtures. No prompt-update webhook, schedule, production deployment, or real Slack message was created by this setup.
