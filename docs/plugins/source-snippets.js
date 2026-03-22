/**
 * source-snippets — Docusaurus plugin that extracts tagged regions from
 * the library source at build time and exposes them as a virtual module.
 *
 * Usage in source files:
 *   // #region doc:signature
 *   export function useFlowInit<TResult = unknown>() { ... }
 *   // #endregion doc:signature
 *
 * Usage in MDX (via useGlobalData):
 *   import { usePluginData } from "@docusaurus/useGlobalData";
 *   const { snippets } = usePluginData("source-snippets");
 */
const fs = require("node:fs");
const path = require("node:path");

const REGION_START = /\/\/\s*#region\s+doc:(\S+)/;
const REGION_END = /\/\/\s*#endregion\s+doc:(\S+)/;

/** Files to scan for doc regions, relative to the library root (one level up from docs/). */
const SOURCE_FILES = [
  "src/hooks/useFlowInit.ts",
  "src/hooks/useStep.ts",
  "src/hooks/useFlowContext.ts",
  "src/components/FlowOutlet.tsx",
  "src/internal/normalizer.ts",
];

function extractRegions(filePath, relativeKey) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const regions = {};
  const active = new Set();

  for (const line of lines) {
    const startMatch = line.match(REGION_START);
    if (startMatch) {
      const name = startMatch[1];
      regions[name] = [];
      active.add(name);
      continue;
    }

    const endMatch = line.match(REGION_END);
    if (endMatch) {
      active.delete(endMatch[1]);
      continue;
    }

    for (const name of active) {
      regions[name].push(line);
    }
  }

  const result = {};
  for (const [name, contentLines] of Object.entries(regions)) {
    const trimmed = trimBlankEdges(contentLines);
    const dedented = dedent(trimmed);
    result[`${relativeKey}:${name}`] = dedented.join("\n");
  }
  return result;
}

function trimBlankEdges(lines) {
  let start = 0;
  while (start < lines.length && lines[start].trim() === "") start++;
  let end = lines.length - 1;
  while (end > start && lines[end].trim() === "") end--;
  return lines.slice(start, end + 1);
}

function dedent(lines) {
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length === 0) return lines;
  const minIndent = Math.min(
    ...nonEmpty.map((l) => l.match(/^(\s*)/)[1].length),
  );
  return lines.map((l) => l.slice(minIndent));
}

module.exports = function sourceSnippetsPlugin() {
  return {
    name: "source-snippets",

    async contentLoaded({ actions }) {
      const libRoot = path.resolve(__dirname, "..", "..");
      const allSnippets = {};

      for (const rel of SOURCE_FILES) {
        const abs = path.resolve(libRoot, rel);
        if (!fs.existsSync(abs)) continue;
        const key = path.basename(rel);
        Object.assign(allSnippets, extractRegions(abs, key));
      }

      actions.setGlobalData({ snippets: allSnippets });
    },
  };
};
