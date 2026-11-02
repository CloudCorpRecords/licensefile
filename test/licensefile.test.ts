import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { catalogLicenses } from "../src/licensefile.js";

/**
 * All tests are pure local computation over inline dependency
 * lists: no filesystem, no network. Each behaviour in the
 * spec is pinned by its own case, including flag precedence
 * and every validation path.
 */

describe("catalogLicenses — inventory and normalization", () => {
  it("builds inventory sorted by name with supplied fields carried", () => {
    const out = catalogLicenses("MIT", [
      { name: "zlib-pkg", version: "1.0.0", license: "Zlib", author: "Zed", homepage: "https://example.com/z" },
      { name: "alpha", version: "2.1", license: "MIT", author: "Ann" },
    ]);
    assert.equal(out.repo_license, "MIT");
    assert.equal(out.dependency_count, 2);
    assert.deepEqual(
      out.inventory.map((e) => e.name),
      ["alpha", "zlib-pkg"],
    );
    assert.deepEqual(out.inventory[0], {
      name: "alpha",
      version: "2.1",
      license: "MIT",
      author: "Ann",
      homepage: null,
    });
    assert.equal(out.verdict, "ok");
    assert.deepEqual(out.flags, []);
  });

  it("carries absent version, author, and homepage as null in inventory", () => {
    const out = catalogLicenses("MIT", [{ name: "bare", license: "ISC" }]);
    assert.deepEqual(out.inventory, [
      { name: "bare", version: null, license: "ISC", author: null, homepage: null },
    ]);
  });

  it("normalizes a missing license to unknown", () => {
    const out = catalogLicenses("MIT", [{ name: "a" }]);
    assert.equal(out.inventory[0].license, "unknown");
  });

  it("normalizes an empty or whitespace-only license to unknown", () => {
    const out = catalogLicenses("MIT", [
      { name: "a", license: "" },
      { name: "b", license: "   " },
    ]);
    assert.deepEqual(
      out.inventory.map((e) => e.license),
      ["unknown", "unknown"],
    );
    assert.deepEqual(out.by_license, [{ license: "unknown", count: 2 }]);
  });

  it("trims a supplied license before classification and inventory", () => {
    const out = catalogLicenses("MIT", [{ name: "a", license: "  Apache-2.0  " }]);
    assert.equal(out.inventory[0].license, "Apache-2.0");
    assert.deepEqual(out.flags, []);
  });
});

describe("catalogLicenses — by_license ordering", () => {
  it("sorts by count descending, ties by license ascending", () => {
    const out = catalogLicenses("MIT", [
      { name: "a", license: "MIT" },
      { name: "b", license: "MIT" },
      { name: "c", license: "ISC" },
      { name: "d", license: "Apache-2.0" },
      { name: "e", license: "Apache-2.0" },
      { name: "f", license: "BSD-3-Clause" },
    ]);
    assert.deepEqual(out.by_license, [
      { license: "Apache-2.0", count: 2 },
      { license: "MIT", count: 2 },
      { license: "BSD-3-Clause", count: 1 },
      { license: "ISC", count: 1 },
    ]);
  });
});

describe("catalogLicenses — attribution lines", () => {
  it("formats lines exactly with em dash, in name order, omitting absent author", () => {
    const out = catalogLicenses("MIT", [
      { name: "beta", version: "0.2", license: "ISC" },
      { name: "alpha", version: "1.0.0", license: "MIT", author: "Ann Example" },
    ]);
    assert.deepEqual(out.attribution_lines, [
      "alpha@1.0.0 — MIT — Ann Example",
      "beta@0.2 — ISC",
    ]);
  });

  it("uses unknown for an absent version in the attribution line", () => {
    const out = catalogLicenses("MIT", [{ name: "a", license: "MIT", author: "Ann" }]);
    assert.deepEqual(out.attribution_lines, ["a@unknown — MIT — Ann"]);
  });

  it("uses the normalized license in the attribution line", () => {
    const out = catalogLicenses("MIT", [{ name: "a", version: "3" }]);
    assert.deepEqual(out.attribution_lines, ["a@3 — unknown"]);
  });
});

describe("catalogLicenses — flags", () => {
  it("flags an unknown license as a warning and leaves the verdict ok", () => {
    const out = catalogLicenses("MIT", [{ name: "a" }]);
    assert.deepEqual(out.flags, [
      { name: "a", license: "unknown", type: "unknown_license", severity: "warning" },
    ]);
    assert.equal(out.verdict, "ok");
  });

  it("flags a GPL dependency in an MIT repo as an error and blocks the verdict", () => {
    const out = catalogLicenses("MIT", [{ name: "g", license: "GPL-3.0-only" }]);
    assert.deepEqual(out.flags, [
      { name: "g", license: "GPL-3.0-only", type: "strong_copyleft_conflict", severity: "error" },
    ]);
    assert.equal(out.verdict, "blocked");
  });

  it("does not flag a GPL dependency in a GPL repo of the same family", () => {
    const out = catalogLicenses("GPL-2.0-only", [
      { name: "g", license: "GPL-3.0-or-later" },
    ]);
    assert.deepEqual(out.flags, []);
    assert.equal(out.verdict, "ok");
  });

  it("does not flag an AGPL dependency in an AGPL repo of the same family", () => {
    const out = catalogLicenses("AGPL-3.0-only", [
      { name: "g", license: "AGPL-3.0-or-later" },
    ]);
    assert.deepEqual(out.flags, []);
  });

  it("flags an AGPL dependency in a GPL repo as a family-mismatch error", () => {
    const out = catalogLicenses("GPL-3.0-only", [
      { name: "g", license: "AGPL-3.0-only" },
    ]);
    assert.deepEqual(out.flags, [
      { name: "g", license: "AGPL-3.0-only", type: "strong_copyleft_conflict", severity: "error" },
    ]);
    assert.equal(out.verdict, "blocked");
  });

  it("flags a GPL dependency in an AGPL repo as a family-mismatch error", () => {
    const out = catalogLicenses("AGPL-3.0-only", [
      { name: "g", license: "GPL-3.0-only" },
    ]);
    assert.equal(out.flags[0]?.type, "strong_copyleft_conflict");
    assert.equal(out.verdict, "blocked");
  });

  it("flags an LGPL dependency in an MIT repo as a weak-copyleft notice", () => {
    const out = catalogLicenses("MIT", [{ name: "l", license: "LGPL-2.1-only" }]);
    assert.deepEqual(out.flags, [
      { name: "l", license: "LGPL-2.1-only", type: "weak_copyleft_notice", severity: "warning" },
    ]);
    assert.equal(out.verdict, "ok");
  });

  it("flags other weak-copyleft licenses in a permissive repo", () => {
    const out = catalogLicenses("Apache-2.0", [{ name: "m", license: "MPL-2.0" }]);
    assert.deepEqual(out.flags, [
      { name: "m", license: "MPL-2.0", type: "weak_copyleft_notice", severity: "warning" },
    ]);
  });

  it("does not give a weak notice for an LGPL dependency in a GPL repo", () => {
    const out = catalogLicenses("GPL-3.0-only", [
      { name: "l", license: "LGPL-3.0-only" },
    ]);
    assert.deepEqual(out.flags, []);
  });

  it("does not give a weak notice when the repo license is unclassified", () => {
    const out = catalogLicenses("LicenseRef-Custom", [
      { name: "l", license: "LGPL-2.1-or-later" },
    ]);
    assert.deepEqual(out.flags, []);
  });

  it("flags a license in none of the three sets as unclassified", () => {
    const out = catalogLicenses("MIT", [{ name: "u", license: "LicenseRef-Weird" }]);
    assert.deepEqual(out.flags, [
      { name: "u", license: "LicenseRef-Weird", type: "unclassified_license", severity: "warning" },
    ]);
    assert.equal(out.verdict, "ok");
  });

  it("does not flag an unclassified license equal to the repo license", () => {
    const out = catalogLicenses("LicenseRef-Custom", [
      { name: "u", license: "LicenseRef-Custom" },
    ]);
    assert.deepEqual(out.flags, []);
  });

  it("does not flag permissive dependencies in any repo", () => {
    const out = catalogLicenses("GPL-3.0-only", [
      { name: "a", license: "MIT" },
      { name: "b", license: "BSD-2-Clause" },
      { name: "c", license: "CC0-1.0" },
    ]);
    assert.deepEqual(out.flags, []);
  });

  it("is case-sensitive: a lowercase mit is unclassified, not permissive", () => {
    const out = catalogLicenses("MIT", [{ name: "a", license: "mit" }]);
    assert.deepEqual(out.flags, [
      { name: "a", license: "mit", type: "unclassified_license", severity: "warning" },
    ]);
  });

  it("gives at most one flag per dependency, the first matching rule (precedence)", () => {
    // "unknown" is in none of the three sets and differs from the
    // repo license, so rule 4 could also match — rule 1 must win.
    const unknown = catalogLicenses("MIT", [{ name: "a" }]);
    assert.equal(unknown.flags.length, 1);
    assert.equal(unknown.flags[0].type, "unknown_license");
    // A strong-copyleft conflict must be the only flag for its dep.
    const strong = catalogLicenses("MIT", [{ name: "g", license: "GPL-2.0-only" }]);
    assert.equal(strong.flags.length, 1);
    assert.equal(strong.flags[0].type, "strong_copyleft_conflict");
    // A weak-copyleft notice must be the only flag for its dep.
    const weak = catalogLicenses("MIT", [{ name: "l", license: "EPL-2.0" }]);
    assert.equal(weak.flags.length, 1);
    assert.equal(weak.flags[0].type, "weak_copyleft_notice");
  });

  it("sorts flags by name ascending", () => {
    const out = catalogLicenses("MIT", [
      { name: "zeta" },
      { name: "alpha", license: "GPL-3.0-only" },
      { name: "mid", license: "LicenseRef-X" },
    ]);
    assert.deepEqual(
      out.flags.map((f) => f.name),
      ["alpha", "mid", "zeta"],
    );
    assert.equal(out.verdict, "blocked");
  });
});

describe("catalogLicenses — validation", () => {
  it("rejects a missing, empty, or non-string repo_license", () => {
    assert.throws(() => catalogLicenses(undefined, [{ name: "a" }]), /repo_license is required/);
    assert.throws(() => catalogLicenses("", [{ name: "a" }]), /repo_license must be a non-empty string/);
    assert.throws(() => catalogLicenses("   ", [{ name: "a" }]), /repo_license must be a non-empty string/);
    assert.throws(() => catalogLicenses(42, [{ name: "a" }]), /repo_license must be a string/);
  });

  it("rejects missing or empty dependencies", () => {
    assert.throws(() => catalogLicenses("MIT", undefined), /dependencies is required/);
    assert.throws(() => catalogLicenses("MIT", []), /dependencies must be a non-empty array/);
    assert.throws(() => catalogLicenses("MIT", "nope"), /dependencies must be a non-empty array/);
  });

  it("rejects a dependency that is not an object, naming the path", () => {
    assert.throws(
      () => catalogLicenses("MIT", [{ name: "a" }, "nope"]),
      /dependencies\[1\] must be an object/,
    );
  });

  it("rejects a dependency missing a name or with an empty name, naming the path", () => {
    assert.throws(
      () => catalogLicenses("MIT", [{ license: "MIT" }]),
      /dependencies\[0\]\.name is required/,
    );
    assert.throws(
      () => catalogLicenses("MIT", [{ name: "a" }, { name: "b" }, { name: "c" }, {}]),
      /dependencies\[3\]\.name is required/,
    );
    assert.throws(
      () => catalogLicenses("MIT", [{ name: "" }]),
      /dependencies\[0\]\.name must be a non-empty string/,
    );
    assert.throws(
      () => catalogLicenses("MIT", [{ name: 7 }]),
      /dependencies\[0\]\.name must be a non-empty string/,
    );
  });

  it("rejects a duplicate dependency name, naming the path", () => {
    assert.throws(
      () => catalogLicenses("MIT", [{ name: "a" }, { name: "b" }, { name: "a" }]),
      /dependencies\[2\]\.name is a duplicate dependency name/,
    );
  });

  it("rejects a non-string version, license, author, or homepage, naming the path", () => {
    assert.throws(
      () => catalogLicenses("MIT", [{ name: "a", version: 1 }]),
      /dependencies\[0\]\.version must be a string/,
    );
    assert.throws(
      () => catalogLicenses("MIT", [{ name: "a", license: 2 }]),
      /dependencies\[0\]\.license must be a string/,
    );
    assert.throws(
      () => catalogLicenses("MIT", [{ name: "a" }, { name: "b", author: true }]),
      /dependencies\[1\]\.author must be a string/,
    );
    assert.throws(
      () => catalogLicenses("MIT", [{ name: "a", homepage: null }]),
      /dependencies\[0\]\.homepage must be a string/,
    );
  });
});
