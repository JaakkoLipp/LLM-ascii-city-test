#!/usr/bin/env node
// Scans models/<model-slug>/ and writes demos.json for the portal (index.html).
// Every *.html file in a model folder becomes a demo entry; model.json is optional metadata.
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname;
const MODELS_DIR = join(ROOT, "models");

const titleCase = (slug) =>
  slug.split(/[-_]/).map((w) => (/^\d/.test(w) ? w : w[0].toUpperCase() + w.slice(1))).join(" ")
    .replace(/(\d) (\d)/g, "$1.$2");

const htmlTitle = (file) => {
  const m = readFileSync(file, "utf8").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : null;
};

const lastCommitDate = (file) => {
  try {
    return execFileSync("git", ["log", "-1", "--format=%cI", "--", file], { cwd: ROOT }).toString().trim() || null;
  } catch {
    return null;
  }
};

const models = readdirSync(MODELS_DIR)
  .filter((d) => statSync(join(MODELS_DIR, d)).isDirectory())
  .sort()
  .map((slug) => {
    const dir = join(MODELS_DIR, slug);
    const metaPath = join(dir, "model.json");
    const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, "utf8")) : {};
    const demos = readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(".html"))
      .sort((a, b) => (a === "index.html" ? -1 : b === "index.html" ? 1 : a.localeCompare(b)))
      .map((f) => {
        const full = join(dir, f);
        return {
          file: f,
          path: `models/${slug}/${f}`,
          title: htmlTitle(full) || f,
          size: statSync(full).size,
          updated: lastCommitDate(full),
        };
      });
    const links = (meta.links || []).map((l) => ({ title: l.title || l.url, url: l.url, external: true }));
    return { slug, name: meta.name || titleCase(slug), vendor: meta.vendor || null, notes: meta.notes || null, demos, links };
  })
  .filter((m) => m.demos.length || m.links.length);

writeFileSync(join(ROOT, "demos.json"), JSON.stringify({ generated: new Date().toISOString(), models }, null, 2) + "\n");
console.log(`demos.json: ${models.length} models, ${models.reduce((n, m) => n + m.demos.length, 0)} html demos`);
