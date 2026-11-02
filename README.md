# licensefile

A repository can only ship what its dependencies' licenses
allow. licensefile takes the repository's own license and a
list of its dependencies, and turns that into a single
catalog you can act on:

- **Inventory** — one entry per dependency, sorted by name,
  with the license normalized (trimmed; a missing or empty
  license becomes `unknown`) and absent version, author, or
  homepage carried as `null`
- **Counts by license** — how many dependencies carry each
  normalized license, sorted by count descending with ties
  broken by license name
- **Attribution lines** — one line per dependency in name
  order, shaped `name@version — license — author`, where a
  missing version reads `unknown` and the author segment is
  left off entirely when no author was supplied
- **Flags** — at most one per dependency, from the first
  matching rule: an unknown license warns; a strong-copyleft
  license whose family (`GPL` vs `AGPL`) differs from the
  repository license's family is an error; a weak-copyleft
  license in a permissive-licensed repository draws a
  notice; and a license belonging to none of the known
  classes, when it is not the repository's own license, is
  reported as unclassified
- **Verdict** — `blocked` when any flag is an error,
  otherwise `ok`

License classes are the exact, case-sensitive SPDX ids in
the spec: a permissive set (MIT, ISC, the BSD clauses,
Apache-2.0, and friends), a strong-copyleft set (the GPL
and AGPL variants), and a weak-copyleft set (the LGPL
variants, MPL-2.0, EPL, EUPL-1.2). Everything is computed
locally from the inputs: no network, no configuration, and
no license database is consulted. Invalid input — a missing
repository license, an empty dependency list, a dependency
without a name, a duplicate name, or a wrongly typed field
— is rejected with an error naming the offending path, and
no partial catalog is produced.

## CLI

```bash
npx @reneturcios/licensefile catalog --input args.json
npx @reneturcios/licensefile --version
```

`args.json` contains the full arguments object:

```json
{
  "repo_license": "MIT",
  "dependencies": [
    { "name": "alpha", "version": "1.0.0", "license": "MIT", "author": "Ann Example" },
    { "name": "beta", "version": "0.2", "license": "LGPL-2.1-only" },
    { "name": "gamma", "license": "GPL-3.0-only" }
  ]
}
```

`version`, `license`, `author`, and `homepage` are optional
per dependency. The catalog is printed as JSON.

Exit codes: `0` on success, `1` on a runtime error
(including an unreadable or invalid input file, or invalid
input), `2` on a usage error.

## MCP server

```bash
npx -y @reneturcios/licensefile mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "licensefile": {
      "command": "npx",
      "args": ["-y", "@reneturcios/licensefile", "mcp"]
    }
  }
}
```

### Tools

- `catalog_licenses` — Build a dependency license and
  attribution inventory for a repository.
  - `repo_license` (string, required) — SPDX id of the
    repository's own license, e.g. `MIT`
  - `dependencies` (array, required, at least one) —
    dependencies as `{name, version?, license?, author?,
    homepage?}` objects; `name` is required and must be
    unique

  Returns `{repo_license, dependency_count, inventory,
  by_license, flags, attribution_lines, verdict}`.

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/licensefile
docker run --rm -v "$PWD:/w" ghcr.io/cloudcorprecords/licensefile catalog --input /w/args.json
```

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # tsx --test test/*.test.ts (pure local, no network)
npm run dev     # run the CLI from source
```

## License

MIT — Copyright (c) 2026 Rene Turcios
