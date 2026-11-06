# Maintaining Langfuse evaluator configuration

For running tests or recording results, use the [runbook](core-evaluation-runbook.md). This page covers configuration maintenance shared by Core, Luma and Slackbot.

Set `LANGFUSE_BASE_URL`, `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` for the intended project through normal secret tooling. The scripts do not load dotenv or create model connections.

```sh
python3 scripts/langfuse/manage.py --manifest MANIFEST --profile PROFILE --project-id PROJECT_ID --output setup.json
```

This command is offline by default. Add `--apply` to publish definitions/dataset items. To enable LLM judges, also provide `--provider EXISTING_CONNECTION --model MODEL --enable-llm`. Supported profiles are `mentingo`, `luma` and `slackbot`. The script verifies project identity and upserts stable dataset item IDs and changed definitions; it never starts application experiments.

Core's machine-readable configuration is [remote-setup.json](remote-setup.json). Keep it: `pnpm eval:ai:record` uses its project and dataset IDs. Source definitions live in [manage.py](../../scripts/langfuse/manage.py); [the check reference](core-evaluator-checks.md) explains the rubrics. Online rules score new matching observations asynchronously. Experiment rules score submitted experiment items. Neither launches dataset runs.

To roll back monitoring, disable the owned `regression/` rules and restore only the legacy rule IDs explicitly listed in the setup snapshot. The apply command does not disable unrelated rules. Dataset history and application prompts are separate from evaluator configuration.
