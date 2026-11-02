# Changelog

## 0.1.0 (2026-10-27)

- Initial release: `catalog_licenses` MCP tool and
  `catalog` CLI command building a dependency license and
  attribution inventory for a repository.
- Normalized licenses, per-license counts, name-ordered
  attribution lines, and one flag per dependency at most —
  unknown licenses, strong-copyleft family conflicts,
  weak-copyleft notices, and unclassified licenses — with
  a `blocked` verdict on any error flag and path-naming
  validation errors.
