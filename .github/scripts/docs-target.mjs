#!/usr/bin/env node
/**
 * Computes which parts of the docs site the current workflow run must publish.
 *
 * Inputs (env):
 *   GITHUB_REF       triggering ref (e.g. refs/heads/main, refs/tags/v1.2.3)
 *   SITE_STATE_DIR   dir containing the persisted site state (default "site")
 *
 * Outputs: appended as KEY=VALUE lines to $GITHUB_OUTPUT (when present) and
 * logged to stdout for local debugging:
 *   subpath      target subpath under /react-sequent/ ("dev" or a tag)
 *   doc_ref      git ref for "Edit this page" links
 *   root_action  none | promote | bootstrap
 *   root_tag     tag to promote/bootstrap from ("" when none / dev fallback)
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REF = process.env.GITHUB_REF ?? "";
const STATE_DIR = process.env.SITE_STATE_DIR ?? "site";

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

/** Parses a vX.Y.Z[-pre[.ident]] tag; null when not publishable. */
function parseTag(tag) {
  const match = /^v(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z][0-9A-Za-z.-]*))?$/.exec(tag);
  if (!match) return null;
  return {
    tag,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
  };
}

/** Semver precedence of two parseTag() results: -1 | 0 | 1. */
function compareVersions(a, b) {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  if (a.prerelease === null && b.prerelease === null) return 0;
  if (a.prerelease === null) return 1;
  if (b.prerelease === null) return -1;
  const as = a.prerelease.split(".");
  const bs = b.prerelease.split(".");
  for (let i = 0; i < Math.max(as.length, bs.length); i++) {
    if (i >= as.length) return -1;
    if (i >= bs.length) return 1;
    const x = as[i];
    const y = bs[i];
    const xn = /^\d+$/.test(x);
    const yn = /^\d+$/.test(y);
    if (xn && yn) {
      if (Number(x) !== Number(y)) return Number(x) < Number(y) ? -1 : 1;
    } else if (xn !== yn) {
      return xn ? -1 : 1; // numeric identifiers sort below alphanumeric
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

const allTags = execFileSync("git", ["tag", "--list", "v*"], { encoding: "utf8" })
  .split("\n")
  .map((tag) => tag.trim())
  .filter(Boolean)
  .map(parseTag)
  .filter(Boolean);

const releases = allTags
  .filter((tag) => tag.prerelease === null)
  .sort((a, b) => compareVersions(b, a));

const rootTagPath = join(STATE_DIR, "root-tag.txt");
const currentRoot = existsSync(rootTagPath)
  ? readFileSync(rootTagPath, "utf8").trim()
  : "";

let subpath = "dev";
let docRef = "main";
let rootAction = "none";
let rootTag = "";

if (REF.startsWith("refs/tags/")) {
  const tagName = REF.slice("refs/tags/".length);
  const parsed = parseTag(tagName);
  if (!parsed) {
    fail(`Tag "${tagName}" does not match the vX.Y.Z shape; refusing to publish.`);
  }
  subpath = tagName;
  docRef = tagName;
  if (parsed.prerelease === null) {
    const current = currentRoot ? parseTag(currentRoot) : null;
    if (!current || compareVersions(parsed, current) > 0) {
      rootAction = "promote";
      rootTag = tagName;
    }
  }
} else if (!currentRoot && !existsSync(join(STATE_DIR, "index.html"))) {
  // main push / manual dispatch with no published root yet: seed it.
  rootAction = "bootstrap";
  rootTag = releases.length > 0 ? releases[0].tag : "";
}

const outputs = {
  subpath,
  doc_ref: docRef,
  root_action: rootAction,
  root_tag: rootTag,
};

if (process.env.GITHUB_OUTPUT) {
  const lines = Object.entries(outputs)
    .map(([key, value]) => `${key}=${value}\n`)
    .join("");
  appendFileSync(process.env.GITHUB_OUTPUT, lines);
}
console.log(JSON.stringify(outputs, null, 2));
