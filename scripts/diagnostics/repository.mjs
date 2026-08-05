import { execFileSync } from "node:child_process";

function run(command, args) {
  return execFileSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  }).trim();
}

function runGit(args) {
  try {
    return run("git", args);
  } catch (error) {
    if (process.platform !== "linux" || process.env.WSL_INTEROP === undefined) {
      throw error;
    }

    const windowsWorkingDirectory = run("wslpath", ["-w", process.cwd()]);
    return run("git.exe", ["-C", windowsWorkingDirectory, ...args]);
  }
}

const packageManager = process.env.npm_config_user_agent?.split(" ")[0] ?? "unknown";

const diagnostics = {
  node: process.version,
  packageManager,
  git: runGit(["--version"]),
  branch: runGit(["branch", "--show-current"]),
  revision: runGit(["rev-parse", "HEAD"]),
  worktreeStatus: runGit(["status", "--short"]),
};

console.log(JSON.stringify(diagnostics, null, 2));
