import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const workspaceRoot = dirname(dirname(dirname(new URL(import.meta.url).pathname.slice(1))));

export async function resolve(specifier, context, nextResolve) {
  if (process.platform === "win32" && specifier === "zod") {
    const store = join(workspaceRoot, "node_modules", ".pnpm");
    const packageDirectory = (await readdir(store)).find((name) => name.startsWith("zod@"));
    if (!packageDirectory) throw new Error("ZOD_PACKAGE_UNAVAILABLE");
    return {
      shortCircuit: true,
      url: pathToFileURL(join(store, packageDirectory, "node_modules", "zod", "index.js")).href,
    };
  }
  return nextResolve(specifier, context);
}
