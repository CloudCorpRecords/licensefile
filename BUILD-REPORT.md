# licensefile — Build Report

MCP Rebuild 1000, Batch 13. Original program build from the
packages-100 plan (cluster D #49), built from the spec in
`~/workspace/mcp-rebuild-100/specs-batch13/licensefile.md`
(read first). There is no external original; the tool
surface is the program's defined spec. Local build only —
nothing pushed or published.

Identity: repo `licensefile`, npm `@reneturcios/licensefile`,
MCP name `io.github.CloudCorpRecords/licensefile`, version
`0.1.0`, bin `licensefile` → `dist/cli.js`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json`, `server.json` (description "Dependency
  license and attribution inventory, with copyleft and
  unknown-license conflicts flagged.", 98 chars ≤100; npm
  entry carries `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/licensefile:0.1.0` carries
  **no** `version` field), `Dockerfile` (node:20-alpine
  two-stage, label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/licensefile"`),
  `tsconfig.json`, `.gitignore`, `LICENSE` (MIT, Copyright
  (c) 2026 Rene Turcios), `README.md` (fresh text),
  `CHANGELOG.md` (single 0.1.0 entry, 2026-10-27),
  `package-lock.json` (Route 3, see below)
- `src/index.ts`, `src/cli.ts` (`catalog --input
  <args.json>` where the file holds the full arguments
  object, `mcp`, `--version`; exit 2 usage / 1 runtime
  error, argument validation before any file read),
  `src/mcp.ts`, `src/types.ts`, `src/licensefile.ts` (core,
  `VERSION = "0.1.0"`)
- `test/licensefile.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (publish-container `IMAGE = ghcr.io/cloudcorprecords/licensefile`,
  smoke-test server-name assertion `licensefile`)

## Tools implemented (1)

- `catalog_licenses` — arguments: `repo_license` (string,
  required, non-empty SPDX id) and `dependencies` (array,
  required, minItems 1) of `{name (string, required,
  non-empty, unique), version (string, optional), license
  (string, optional; missing/empty means unknown), author
  (string, optional), homepage (string, optional)}`.

  Returns `{repo_license, dependency_count, inventory,
  by_license, flags, attribution_lines, verdict}`:
  licenses are normalized (trimmed; missing/empty →
  `unknown`) and classified against the exact permissive,
  strong-copyleft, and weak-copyleft SPDX lists in the
  spec; a strong-copyleft license's family is `AGPL` when
  it starts with `AGPL` and `GPL` when it starts with
  `GPL`. Each dependency gets at most one flag, the first
  matching rule in order: `unknown_license` (warning),
  `strong_copyleft_conflict` (error, when the repository
  license's family differs — a non-strong repository
  license has no family), `weak_copyleft_notice` (warning,
  weak copyleft in a permissive repository), then
  `unclassified_license` (warning, in none of the three
  sets and not equal to `repo_license`). `inventory` is
  name-sorted with absent version/author/homepage as null;
  `by_license` is count-descending with license-ascending
  ties; `attribution_lines` are name-ordered
  `"<name>@<version or "unknown"> — <license>"` plus
  `" — <author>"` when an author is present (space, em
  dash, space); flags are name-sorted, then type; the
  verdict is `blocked` on any error flag, else `ok`.

  The fixture literal
  (`harness/fixtures/licensefile-tools-original.json`) and
  the `src/mcp.ts` literal are identical, with no `$schema`
  and no `additionalProperties`.

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server` with an
  explicit inputSchema literal exactly matching the
  fixture, per the standing fleet rule (no McpServer/zod
  schema conversion). Every `tools/call` is validated by
  the core itself, so the MCP and CLI paths share one
  validation implementation.
- Validation is path-naming and total: a missing/empty
  `repo_license`, missing/empty `dependencies`, a
  dependency missing a name or with an empty or duplicate
  name, or a non-string version/license/author/homepage
  throws an Error naming the offending path (e.g.
  `dependencies[3].name is required`) and produces no
  partial result (MCP: `isError`; CLI: exit 1).
- Local choices where the spec is silent (see also
  "Gaps"): `repo_license` is trimmed before classification
  and echoed trimmed in the output; presence of the
  optional dependency fields means "not undefined", so an
  empty-string version or author is carried as supplied
  (only `license` has the spec's explicit empty → unknown
  rule).

## Verification (foreground, this session)

- `npx tsc` exit 0 (`dist/cli.js` built)
- `npm test` (`tsx --test test/*.test.ts`): **31 tests,
  31 pass, 0 fail** — inventory sorting and null fields,
  license normalization (missing, empty, whitespace-only
  → unknown; trimming), by_license ordering (count
  descending, license ascending), attribution lines exact
  including the em dash, absent-version `unknown`, and
  author omission, every flag rule (unknown warning, GPL
  in MIT error + blocked verdict, GPL in GPL same-family
  no flag, AGPL in AGPL no flag, AGPL in GPL
  family-mismatch error, GPL in AGPL family-mismatch
  error, LGPL in MIT weak notice, other weak licenses in a
  permissive repo, LGPL in GPL no weak notice, weak in an
  unclassified repo no notice, unclassified warning,
  unclassified equal to `repo_license` no flag, permissive
  in a GPL repo no flag, case-sensitivity), flag
  precedence (at most one flag, first matching rule), flag
  name sorting, and every validation path (repo_license
  missing/empty/non-string, dependencies missing/empty,
  non-object dependency, missing/empty/non-string name
  naming the path including `dependencies[3]`, duplicate
  name, non-string version/license/author/homepage)
- `dist/cli.js --version` → `0.1.0`; unknown command exits
  2 with usage; `catalog` with no `--input` exits 2;
  `catalog --input <valid file>` exits 0 and prints the
  catalog JSON (verified on a 3-dependency MIT example:
  weak notice for the LGPL dependency, strong-copyleft
  error for the GPL dependency, verdict `blocked`, and
  the first attribution line checked byte-for-byte:
  `alpha@1.0.0 — MIT — Ann Example`); `catalog --input
  <invalid file>` (duplicate name) exits 1 naming
  `dependencies[1].name`
- Parity: `harness/parity.py` vs
  `harness/fixtures/licensefile-tools-original.json` →
  **PASS, parity 100.0, identical_tools 1/1**

## Lockfile status

`package-lock.json` generated clean via Route 3 (temp copy
without `node_modules`/`dist`/`package-lock.json`, offline
`npm install --package-lock-only --ignore-scripts
--offline`), verified: parses, name
`@reneturcios/licensefile`, **128 package entries**. Local
`node_modules` was installed via `npm install
--ignore-scripts --offline` for build/test; gitignored.

## Gaps / honest notes

- **repo_license trimming:** the spec defines trimming
  only for dependency licenses. The repository license is
  trimmed before the empty check, classification, and
  output, so a padded value behaves like its trimmed SPDX
  id; clean inputs are unaffected.
- **Optional-field presence:** only `license` has an
  explicit missing/empty rule in the spec. For `version`,
  `author`, and `homepage`, "absent" is implemented as
  undefined; an empty string is a present (empty) value,
  carried into the inventory and the attribution line.
  The usual shapes (field present with a value, or field
  omitted) are unaffected, and the choice is pinned here
  rather than hidden.
- Container build not exercised locally; the
  publish-container workflow smoke-tests the image at
  publish time.
- Nothing pushed or published; this is a local build only.
