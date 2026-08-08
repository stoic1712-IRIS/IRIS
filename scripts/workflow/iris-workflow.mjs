#!/usr/bin/env node

import { resultExitCode, runWorkflow } from "./iris-workflow-lib.mjs";

function print(value, asJson) {
  const output = asJson && typeof value === "string" ? { ok: true, help: value } : value;
  process.stdout.write(
    `${typeof output === "string" ? output : JSON.stringify(output, null, 2)}\n`,
  );
}

runWorkflow(process.argv.slice(2))
  .then((result) => {
    print(result, process.argv.includes("--json"));
    process.exitCode = resultExitCode(result);
  })
  .catch((error) => {
    print({ ok: false, error: error.message }, true);
    process.exitCode = 2;
  });
