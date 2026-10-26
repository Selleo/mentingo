These four SQL files are the original, unpatched migrations shipped by
`@workflow/world-postgres@5.0.5`. They intentionally create and alter enums in
`public`. The isolated PostgreSQL regression suite overlays these historical
files onto the installed SDK migrations to construct real legacy databases,
then upgrades them using the installed, patched SDK. Keep these fixtures
unchanged when updating the package patch; their original migration hashes
are part of the upgrade coverage.
