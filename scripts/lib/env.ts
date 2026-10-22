import { readFileSync } from "node:fs";

/**
 * Reads a value from the environment, falling back to an env-style file.
 *
 * The ingestion runs on whatever machine has poppler and network access, which
 * is not always a shell where the variables are exported. Passing `--env-file`
 * keeps the secret out of the command line and out of the process list.
 */
export function readSetting(
  name: string,
  envFile?: string,
): string | undefined {
  const fromEnv = process.env[name];
  if (fromEnv) return fromEnv;
  if (!envFile) return undefined;

  const content = readFileSync(envFile, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator === -1) continue;
    if (line.slice(0, separator).trim() !== name) continue;
    return line
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }

  return undefined;
}

export function requireSetting(name: string, envFile?: string): string {
  const value = readSetting(name, envFile);
  if (!value) {
    throw new Error(
      `Variable manquante: ${name} (exportez-la ou passez --env-file <chemin>)`,
    );
  }
  return value;
}
