#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveBin } from "../lib/resolve-bin.js";

/** Run a tool. cwd is deliberately not set, so it stays the consumer repo. */
function run(pkg, binName, args) {
  const { status, error } = spawnSync(
    process.execPath,
    [resolveBin(pkg, binName), ...args],
    {
      stdio: "inherit",
      env: process.env,
    },
  );
  if (error) throw error;
  return status ?? 1;
}

const LINT_TARGETS = ["src", "server"];

// Shipped baseline ignore. Only two of the five apps ever had a .prettierignore,
// so `format` failed locally after a build in the other three. --ignore-path may
// be repeated, and a missing file is not an error, so an app's own
// .prettierignore still applies on top of this.
const PRETTIER_IGNORE = [
  "--ignore-path",
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../config/prettierignore",
  ),
  "--ignore-path",
  ".prettierignore",
];

const commands = {
  "build:frontend": (rest) => run("vite", "vite", ["build", ...rest]),
  "build:server": (rest) =>
    run("typescript", "tsc", ["-p", "tsconfig.server.json", ...rest]),
  build(rest) {
    const code = commands["build:frontend"](rest);
    return code === 0 ? commands["build:server"](rest) : code;
  },
  typecheck(rest) {
    const code = run("typescript", "tsc", ["--noEmit", ...rest]);
    return code === 0
      ? run("typescript", "tsc", [
          "-p",
          "tsconfig.server.json",
          "--noEmit",
          ...rest,
        ])
      : code;
  },
  lint: (rest) => run("eslint", "eslint", [...LINT_TARGETS, ...rest]),
  "lint:fix": (rest) =>
    run("eslint", "eslint", [...LINT_TARGETS, "--fix", ...rest]),
  format: (rest) =>
    run("prettier", "prettier", [...PRETTIER_IGNORE, "--check", ".", ...rest]),
  "format:fix": (rest) =>
    run("prettier", "prettier", [...PRETTIER_IGNORE, "--write", ".", ...rest]),
  preview: (rest) => run("vite", "vite", ["preview", ...rest]),
  // Raw passthroughs, so app-shaped invocations keep their arguments in the app.
  vite: (rest) => run("vite", "vite", rest),
  tsc: (rest) => run("typescript", "tsc", rest),
  tsx: (rest) => run("tsx", "tsx", rest),
  eslint: (rest) => run("eslint", "eslint", rest),
  prettier: (rest) => run("prettier", "prettier", rest),
  concurrently: (rest) => run("concurrently", "concurrently", rest),
};

const [cmd, ...rest] = process.argv.slice(2);

if (!cmd || cmd === "--help" || cmd === "-h") {
  console.log(
    `web-core <command> [...args]\n\n  ${Object.keys(commands).join("\n  ")}`,
  );
  process.exit(cmd ? 0 : 1);
}
if (!Object.hasOwn(commands, cmd)) {
  console.error(`web-core: unknown command "${cmd}"\nRun "web-core --help".`);
  process.exit(1);
}
process.exit(commands[cmd](rest));
