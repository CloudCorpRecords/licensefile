/**
 * licensefile types.
 *
 * licensefile builds a dependency license and attribution
 * inventory for a repository. The caller supplies the
 * repository's own license and a list of dependencies with
 * their licenses (where known), and licensefile reports, as
 * pure local computation:
 *
 *   - an inventory entry per dependency, with absent
 *     optional fields carried as null and licenses normalized
 *   - counts grouped by normalized license
 *   - one attribution line per dependency, in name order
 *   - at most one flag per dependency, from the first
 *     matching rule in a fixed precedence order
 *   - a verdict that is blocked exactly when any flag is an
 *     error
 *
 * Nothing is fetched or looked up: the classification comes
 * only from the fixed license class lists and the inputs
 * supplied.
 */

/** One dependency, as supplied by the caller. */
export interface DependencyInput {
  /** Dependency name; required, non-empty, unique. */
  name: string;
  /** Dependency version, when known. */
  version?: string;
  /** SPDX id of the dependency license; missing or empty means unknown. */
  license?: string;
  /** Dependency author, when known. */
  author?: string;
  /** Dependency homepage, when known. */
  homepage?: string;
}

/** One normalized inventory entry. */
export interface InventoryEntry {
  name: string;
  /** The supplied version, or null when absent. */
  version: string | null;
  /** Normalized license: trimmed, or "unknown" when missing/empty. */
  license: string;
  /** The supplied author, or null when absent. */
  author: string | null;
  /** The supplied homepage, or null when absent. */
  homepage: string | null;
}

/** Count of dependencies carrying one normalized license. */
export interface ByLicenseEntry {
  license: string;
  count: number;
}

/** A single flag raised against one dependency. */
export interface LicenseFlag {
  name: string;
  /** Normalized license the flag was raised for. */
  license: string;
  type:
    | "unknown_license"
    | "strong_copyleft_conflict"
    | "weak_copyleft_notice"
    | "unclassified_license";
  severity: "error" | "warning";
}

/** The license catalog for a repository. */
export interface CatalogResult {
  repo_license: string;
  dependency_count: number;
  inventory: InventoryEntry[];
  by_license: ByLicenseEntry[];
  flags: LicenseFlag[];
  attribution_lines: string[];
  verdict: "ok" | "blocked";
}
