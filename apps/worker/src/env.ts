import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function loadNearestEnvFile(importMetaUrl: string) {
  let directory = dirname(fileURLToPath(importMetaUrl));

  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = join(directory, ".env");

    if (existsSync(candidate)) {
      loadEnvFile(candidate);
      return;
    }

    const parent = dirname(directory);

    if (parent === directory) {
      return;
    }

    directory = parent;
  }
}

function loadEnvFile(path: string) {
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
