/**
 * licensefile core: dependency license and attribution
 * inventory, with mismatches against the repository license
 * flagged.
 *
 *   catalogLicenses(repoLicense, dependencies) -> catalog
 *
 * Behaviour:
 * - License classes are exact, case-sensitive SPDX ids:
 *   a fixed permissive set, a fixed strong-copyleft set, and
 *   a fixed weak-copyleft set (see the sets below).
 * - A strong-copyleft license's family is "AGPL" when it
 *   starts with "AGPL" and "GPL" when it starts with "GPL".
 *   The same rule gives the repository license's family; a
 *   repository license that is not itself strong copyleft
 *   has no family.
 * - Each dependency license is normalized: trimmed, with a
 *   missing or empty value becoming "unknown".
 * - Each dependency gets at most one flag — the first rule
 *   that matches, in this order:
 *     1. normalized license is "unknown" -> unknown_license
 *        (warning)
 *     2. license is strong copyleft and the repository
 *        license's family differs from the dependency's
 *        family -> strong_copyleft_conflict (error)
 *     3. license is weak copyleft and the repository license
 *        is permissive -> weak_copyleft_notice (warning)
 *     4. license is in none of the three sets and differs
 *        from the repository license ->
 *        unclassified_license (warning)
 * - inventory holds one entry per dependency, sorted by
 *   name ascending, with absent version/author/homepage
 *   carried as null.
 * - by_license counts dependencies per normalized license,
 *   sorted by count descending, ties by license ascending.
 * - attribution_lines holds one line per dependency in
 *   name order: "<name>@<version or "unknown">" followed
 *   by " — <license>" and, when an author is present,
 *   " — <author>" (space, em dash, space as separator).
 * - flags are sorted by name ascending, then type
 *   ascending. The verdict is "blocked" when any flag has
 *   severity "error", otherwise "ok".
 *
 * Validation is strict and path-naming: any malformed input
 * throws an Error naming the offending path (for example
 * "dependencies[3].name is required") and no partial result
 * is produced.
 */
import type {
  ByLicenseEntry,
  CatalogResult,
  DependencyInput,
  InventoryEntry,
  LicenseFlag,
} from "./types.js";

export const VERSION = "0.1.0";

const PERMISSIVE = new Set([
  "MIT",
  "ISC",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "Apache-2.0",
  "Unlicense",
  "CC0-1.0",
  "0BSD",
  "Python-2.0",
  "Zlib",
]);

const STRONG_COPYLEFT = new Set([
  "GPL-2.0-only",
  "GPL-2.0-or-later",
  "GPL-3.0-only",
  "GPL-3.0-or-later",
  "AGPL-3.0-only",
  "AGPL-3.0-or-later",
]);

const WEAK_COPYLEFT = new Set([
  "LGPL-2.1-only",
  "LGPL-2.1-or-later",
  "LGPL-3.0-only",
  "LGPL-3.0-or-later",
  "MPL-2.0",
  "EPL-1.0",
  "EPL-2.0",
  "EUPL-1.2",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function familyOf(license: string): string | null {
  if (!STRONG_COPYLEFT.has(license)) return null;
  if (license.startsWith("AGPL")) return "AGPL";
  if (license.startsWith("GPL")) return "GPL";
  return null;
}

function normalizeLicense(raw: string | undefined): string {
  if (raw === undefined) return "unknown";
  const trimmed = raw.trim();
  return trimmed.length === 0 ? "unknown" : trimmed;
}

function validateDependency(
  raw: unknown,
  index: number,
  seen: Set<string>,
): DependencyInput {
  const path = `dependencies[${index}]`;
  if (!isRecord(raw)) throw new Error(`${path} must be an object`);
  if (raw.name === undefined) throw new Error(`${path}.name is required`);
  if (typeof raw.name !== "string" || raw.name.trim().length === 0) {
    throw new Error(`${path}.name must be a non-empty string`);
  }
  if (seen.has(raw.name)) {
    throw new Error(`${path}.name is a duplicate dependency name`);
  }
  seen.add(raw.name);
  for (const field of ["version", "license", "author", "homepage"] as const) {
    if (raw[field] !== undefined && typeof raw[field] !== "string") {
      throw new Error(`${path}.${field} must be a string`);
    }
  }
  const dep: DependencyInput = { name: raw.name };
  if (raw.version !== undefined) dep.version = raw.version as string;
  if (raw.license !== undefined) dep.license = raw.license as string;
  if (raw.author !== undefined) dep.author = raw.author as string;
  if (raw.homepage !== undefined) dep.homepage = raw.homepage as string;
  return dep;
}

function validateArgs(
  repoLicense: unknown,
  dependencies: unknown,
): { repoLicense: string; dependencies: DependencyInput[] } {
  if (repoLicense === undefined) throw new Error("repo_license is required");
  if (typeof repoLicense !== "string") {
    throw new Error("repo_license must be a string");
  }
  const repo = repoLicense.trim();
  if (repo.length === 0) {
    throw new Error("repo_license must be a non-empty string");
  }
  if (dependencies === undefined) {
    throw new Error("dependencies is required");
  }
  if (!Array.isArray(dependencies) || dependencies.length === 0) {
    throw new Error("dependencies must be a non-empty array");
  }
  const seen = new Set<string>();
  const validated = dependencies.map((d, i) =>
    validateDependency(d, i, seen),
  );
  return { repoLicense: repo, dependencies: validated };
}

function flagFor(
  dep: DependencyInput,
  license: string,
  repoLicense: string,
): LicenseFlag | null {
  if (license === "unknown") {
    return {
      name: dep.name,
      license,
      type: "unknown_license",
      severity: "warning",
    };
  }
  if (STRONG_COPYLEFT.has(license)) {
    if (familyOf(repoLicense) !== familyOf(license)) {
      return {
        name: dep.name,
        license,
        type: "strong_copyleft_conflict",
        severity: "error",
      };
    }
    return null;
  }
  if (WEAK_COPYLEFT.has(license) && PERMISSIVE.has(repoLicense)) {
    return {
      name: dep.name,
      license,
      type: "weak_copyleft_notice",
      severity: "warning",
    };
  }
  if (
    !PERMISSIVE.has(license) &&
    !WEAK_COPYLEFT.has(license) &&
    license !== repoLicense
  ) {
    return {
      name: dep.name,
      license,
      type: "unclassified_license",
      severity: "warning",
    };
  }
  return null;
}

function byNameAsc(a: { name: string }, b: { name: string }): number {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

/** Catalog dependency licenses against the repository license. */
export function catalogLicenses(
  repoLicense: unknown,
  dependencies: unknown,
): CatalogResult {
  const { repoLicense: repo, dependencies: deps } = validateArgs(
    repoLicense,
    dependencies,
  );

  const normalized = deps.map((dep) => ({
    dep,
    license: normalizeLicense(dep.license),
  }));

  const sorted = [...normalized].sort((a, b) => byNameAsc(a.dep, b.dep));

  const inventory: InventoryEntry[] = sorted.map(({ dep, license }) => ({
    name: dep.name,
    version: dep.version !== undefined ? dep.version : null,
    license,
    author: dep.author !== undefined ? dep.author : null,
    homepage: dep.homepage !== undefined ? dep.homepage : null,
  }));

  const counts = new Map<string, number>();
  for (const { license } of normalized) {
    counts.set(license, (counts.get(license) ?? 0) + 1);
  }
  const byLicense: ByLicenseEntry[] = [...counts.entries()]
    .map(([license, count]) => ({ license, count }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        (a.license < b.license ? -1 : a.license > b.license ? 1 : 0),
    );

  const flags: LicenseFlag[] = [];
  for (const { dep, license } of normalized) {
    const flag = flagFor(dep, license, repo);
    if (flag) flags.push(flag);
  }
  flags.sort(
    (a, b) =>
      byNameAsc(a, b) || (a.type < b.type ? -1 : a.type > b.type ? 1 : 0),
  );

  const attributionLines = sorted.map(({ dep, license }) => {
    const version = dep.version !== undefined ? dep.version : "unknown";
    let line = `${dep.name}@${version} — ${license}`;
    if (dep.author !== undefined) line += ` — ${dep.author}`;
    return line;
  });

  return {
    repo_license: repo,
    dependency_count: deps.length,
    inventory,
    by_license: byLicense,
    flags,
    attribution_lines: attributionLines,
    verdict: flags.some((f) => f.severity === "error") ? "blocked" : "ok",
  };
}

/** Render a payload as the JSON text block MCP clients show. */
export function formatPayload(payload: unknown): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
}
