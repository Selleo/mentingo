# Candidate authoring contract fixtures

These JSON documents are examples validated against the current Luma Pydantic authoring contracts. They are not a frozen release contract or production course data.

- `create-session.json`: existing-course binding and author identity supplied by trusted Core.
- `request-exact-outline.json`: exact chapter/lesson identities and selected source permissions.
- `content-operation.json`: targeted content update with stable block identity.
- `quiz-operation.json`: all ten new assessment question types; blank markers use Core's `<blank-answer-UUID>` format. Photo paths are placeholders requiring authorized asset staging.
- `mentor-operation.json`: typed teacher configuration. Creation still requires Core-valid judge configuration; the current nullable example is not proof of creation eligibility.

AI producer structural validation passed. Core reports five TypeBox fixture tests passed. Full semantic validation, asset references, apply transaction behavior and SDK consumer tests remain distinct requirements. Baseline hashes here are placeholders, not hashes of live course data.
