#!/usr/bin/env node
// Collects every plugin's compiled .wasm + manifest.json into
// apps/host/public/plugins/, and writes an index.json the host reads at runtime.

import { mkdir, readdir, readFile, writeFile, copyFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const pluginsDir = join(root, "packages", "plugins");
const outDir = join(root, "apps", "host", "public", "plugins");

async function main() {
  const entries = await readdir(pluginsDir, { withFileTypes: true });
  const pluginDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  await mkdir(outDir, { recursive: true });

  const index = [];

  for (const name of pluginDirs) {
    const pluginDir = join(pluginsDir, name);
    const manifestPath = join(pluginDir, "manifest.json");
    const wasmPath = join(pluginDir, "build", "plugin.wasm");

    if (!existsSync(manifestPath)) {
      console.warn(`[bundle] skipping ${name}: no manifest.json`);
      continue;
    }
    if (!existsSync(wasmPath)) {
      console.warn(`[bundle] skipping ${name}: no build/plugin.wasm (did the build run?)`);
      continue;
    }

    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const dest = join(outDir, name);
    await mkdir(dest, { recursive: true });

    await copyFile(wasmPath, join(dest, "plugin.wasm"));
    const outManifest = { ...manifest, wasm: `${name}/plugin.wasm` };
    await writeFile(join(dest, "manifest.json"), JSON.stringify(outManifest, null, 2));

    const size = (await stat(wasmPath)).size;
    console.log(`[bundle] ${name.padEnd(12)} ${(size / 1024).toFixed(1).padStart(6)} KB`);

    index.push({ name, manifest: `${name}/manifest.json` });
  }

  await writeFile(join(outDir, "index.json"), JSON.stringify(index, null, 2));
  console.log(`[bundle] wrote index.json with ${index.length} plugins`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
