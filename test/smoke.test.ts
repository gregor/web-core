import { describe, expect, it, beforeAll } from "vitest";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { manualChunksFromMap } from "../config/vite.js";
import { resolveBin } from "../lib/resolve-bin.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = path.join(root, "test/fixtures/app");
const cli = path.join(fixture, "node_modules/.bin/web-core");

/** Run the CLI in a directory and return its exit code. */
function webCore(args: string[], cwd = fixture) {
  const r = spawnSync(cli, args, { cwd, encoding: "utf8" });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

/** A throwaway copy of the fixture, so negative cases cannot corrupt the original. */
function scratchFixture() {
  const dir = mkdtempSync(path.join(tmpdir(), "web-core-fixture-"));
  const dest = path.join(dir, "app");
  cpSync(fixture, dest, { recursive: true });
  rmSync(path.join(dest, "dist"), { recursive: true, force: true });
  return dest;
}

beforeAll(() => {
  if (!existsSync(cli)) {
    throw new Error(
      "fixture not prepared — run `node test/prepare-fixture.mjs` first",
    );
  }
});

describe("bin resolution", () => {
  // Four of these are unreachable by direct subpath because of their `exports`.
  // This is the test that catches a dependency renaming or restricting its bin.
  it.each([
    ["vite", "vite"],
    ["typescript", "tsc"],
    ["eslint", "eslint"],
    ["prettier", "prettier"],
    ["tsx", "tsx"],
    ["concurrently", "concurrently"],
  ])("resolves %s to a real file", (pkg, bin) => {
    expect(existsSync(resolveBin(pkg, bin))).toBe(true);
  });
});

describe("manualChunksFromMap", () => {
  const fn = manualChunksFromMap({
    "vendor-charts": ["recharts"],
    "vendor-react": ["react", "react-router-dom"],
  });

  it("assigns by package name", () => {
    expect(fn("/x/node_modules/recharts/es6/index.js")).toBe("vendor-charts");
    expect(fn("/x/node_modules/react/index.js")).toBe("vendor-react");
  });

  it("does not bucket app code", () => {
    expect(fn("/x/src/App.tsx")).toBeUndefined();
  });

  it("requires an exact package segment, so react does not swallow react-router-dom", () => {
    // react-router-dom is listed explicitly; without the trailing slash in the
    // matcher, `react` alone would have captured it.
    expect(fn("/x/node_modules/react-router-dom/index.js")).toBe(
      "vendor-react",
    );
  });
});

describe("build", () => {
  beforeAll(() => {
    rmSync(path.join(fixture, "dist"), { recursive: true, force: true });
    expect(webCore(["build"]).code).toBe(0);
  });

  it("emits client assets", () => {
    expect(
      readdirSync(path.join(fixture, "dist/assets")).some((f) =>
        f.endsWith(".js"),
      ),
    ).toBe(true);
  });

  it("honours manualChunks", () => {
    // Catches manualChunks silently no-op'ing, which is how a rollup/rolldown
    // output-hook change would show up.
    const assets = readdirSync(path.join(fixture, "dist/assets"));
    expect(assets.some((f) => f.startsWith("vendor-react"))).toBe(true);
  });

  it("emits the server build outside node_modules", () => {
    // Guards the tsconfig outDir gotcha: a shared outDir would land the server
    // build inside node_modules/@gregor_herdmann/web-core.
    expect(existsSync(path.join(fixture, "dist/server/index.js"))).toBe(true);
  });
});

describe("typecheck", () => {
  it("passes on the clean fixture", () => {
    expect(webCore(["typecheck"]).code).toBe(0);
  });

  it("fails on a type error", () => {
    // Without this, a typecheck that matched zero files would look identical to
    // a passing one — which is exactly how a bad `include` would slip through.
    const dir = scratchFixture();
    writeFileSync(
      path.join(dir, "src/lib/util.ts"),
      'export const n: number = "not a number";\n',
    );
    expect(webCore(["typecheck"], dir).code).not.toBe(0);
  });

  it("resolves the @/ alias to the app src, not to web-core", () => {
    const dir = scratchFixture();
    rmSync(path.join(dir, "src/lib/util.ts"));
    const { code, out } = webCore(["typecheck"], dir);
    expect(code).not.toBe(0);
    expect(out).toContain("@/lib/util");
  });
});

describe("lint", () => {
  it("passes on the clean fixture", () => {
    expect(webCore(["lint"]).code).toBe(0);
  });

  it("fails on an unused variable", () => {
    const dir = scratchFixture();
    appendFileSync(path.join(dir, "src/lib/util.ts"), "const unused = 1;\n");
    expect(webCore(["lint"], dir).code).not.toBe(0);
  });
});

describe("format", () => {
  it("passes on the clean fixture", () => {
    expect(webCore(["format"]).code).toBe(0);
  });

  it("fails on a badly formatted file", () => {
    const dir = scratchFixture();
    writeFileSync(
      path.join(dir, "src/lib/util.ts"),
      "export const x   =    {a:1,b:2}\n",
    );
    expect(webCore(["format"], dir).code).not.toBe(0);
  });

  it("ignores dist even when the app has no .prettierignore", () => {
    const dir = scratchFixture();
    rmSync(path.join(dir, ".prettierignore"), { force: true });
    mkdirSync(path.join(dir, "dist"), { recursive: true });
    writeFileSync(path.join(dir, "dist/ugly.js"), "const   x=1\n");
    expect(webCore(["format"], dir).code).toBe(0);
  });
});
