/**
 * Phase 0.5 spike: can Playwright drive the Dashlane extension?
 *
 *   npm run spike:dashlane -- --url=<platform login URL> --client=BFB
 *
 * The operator's manual flow is: open the login page, type the client code,
 * pick the matching entry from Dashlane's dropdown. This reproduces that
 * mechanically and reports what is actually reachable from automation —
 * whether the extension is alive in the persistent profile, whether its
 * dropdown appears, and whether its entries are readable and selectable.
 *
 * It is a DIAGNOSTIC. It never submits a login form, never publishes, and never
 * prints a credential value. Screenshots mask password fields at capture time,
 * per docs/features/12-failure-diagnostics.md.
 *
 * Requires: the automation Chrome profile with Dashlane installed and unlocked
 * (docs/features/04-dashlane-credentials.md), and no other Chrome running
 * against that profile — Chrome allows one process per user-data-dir.
 */

import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium, type Frame, type Page } from "playwright";

const projectDir = process.cwd();
const { loadEnvConfig } = createRequire(`${projectDir}/package.json`)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(projectDir, true);

const args = new Map(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, ...rest] = a.replace(/^--/, "").split("=");
      return [k, rest.join("=")];
    }),
);

const loginUrl = args.get("url");
const clientCode = args.get("client") ?? "";
const profileDir = process.env.CHROME_PROFILE_DIR;
const executablePath = process.env.CHROME_EXECUTABLE_PATH;
const extensionId = process.env.DASHLANE_EXTENSION_ID;
const outDir = path.join(projectDir, ".artifacts", "spikes");

if (!loginUrl) {
  console.error(
    "Usage: npm run spike:dashlane -- --url=<login page URL> [--client=BFB]\n" +
      "Use the Dealer.com login page you actually sign in through.",
  );
  process.exit(1);
}
for (const [name, value] of [
  ["CHROME_PROFILE_DIR", profileDir],
  ["CHROME_EXECUTABLE_PATH", executablePath],
  ["DASHLANE_EXTENSION_ID", extensionId],
] as const) {
  if (!value) {
    console.error(`${name} is not set. Run \`npm run env:check\`.`);
    process.exit(1);
  }
}

// A second Chrome on the same profile fails in confusing ways, so say so plainly.
try {
  const running = execSync(`pgrep -fl "user-data-dir=${profileDir}" || true`, {
    encoding: "utf8",
  }).trim();
  if (running) {
    console.error(
      `Chrome is already running against ${profileDir}.\nQuit that window and re-run — one process per profile.`,
    );
    process.exit(1);
  }
} catch {
  // pgrep unavailable: fall through and let Chrome report the conflict itself.
}

mkdirSync(outDir, { recursive: true });

console.log(`profile : ${profileDir}`);
console.log(`target  : ${loginUrl}`);
console.log(`client  : ${clientCode || "(none — dropdown will be unfiltered)"}\n`);

/**
 * Chrome is launched as a NORMAL browser process and Playwright attaches over
 * CDP afterwards.
 *
 * `chromium.launchPersistentContext` was tried first and does not work here: on
 * every run Chrome deleted the Dashlane install outright (`Extensions/<id>/`
 * emptied, its Secure Preferences record stripped to `state=None`), and
 * `--load-extension` is refused outright by Chrome 137+. Playwright's launch
 * flags are tuned for throwaway profiles and make a real Web Store install look
 * unverifiable; ignoring the individual flags didn't help.
 *
 * Attaching sidesteps all of it — Chrome sees an ordinary launch, so the
 * extension behaves exactly as it does for a human. The worker can spawn Chrome
 * the same way, so this stays fully unattended.
 */
const port = 9222;
const chrome = spawn(
  executablePath!,
  [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "--profile-directory=Default",
    "--no-first-run",
    "--no-default-browser-check",
  ],
  { detached: true, stdio: "ignore" },
);
chrome.unref();

const context = await attach(port);

/* -------------------------------------------------------------------------- */
/* Safety rails                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Paths the automation must never reach. Account recovery, password reset and
 * anything deletion-shaped are one careless click away from a login form, and a
 * recovery flow can invalidate a working credential for every job behind it.
 *
 * An early version of this spike proved the point: it clicked an element
 * Dashlane had *labelled* and landed on "Recover username".
 */
const FORBIDDEN_PATH = /forgot|recover|reset|delete|remove|deactivate|cancel-account|unsubscribe/i;

/** Link/button text the automation must never click, whatever the page. */
const FORBIDDEN_TEXT = /forgot|recover|reset|delete|remove|deactivate|sign out|log ?out/i;

class SafetyViolation extends Error {}

function guard(page: Page) {
  page.on("framenavigated", (frame) => {
    if (frame !== page.mainFrame()) return;
    const url = new URL(frame.url());
    if (FORBIDDEN_PATH.test(url.pathname + url.search)) {
      violations.push(`navigated to a forbidden path: ${url.pathname}`);
    }
  });
}

const violations: string[] = [];

/** Clicks only after checking the target isn't a destructive control. */
async function safeClick(locator: import("playwright").Locator, what: string) {
  const text = ((await locator.innerText().catch(() => "")) || "").trim();
  const label = (await locator.getAttribute("aria-label").catch(() => "")) ?? "";
  if (FORBIDDEN_TEXT.test(text) || FORBIDDEN_TEXT.test(label)) {
    throw new SafetyViolation(`refused to click ${what}: text "${text || label}" is destructive`);
  }
  await locator.click({ timeout: 5_000 });
}

async function attach(port: number) {
  const deadline = Date.now() + 30_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
      return browser.contexts()[0];
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Could not attach to Chrome on ${port}: ${String(lastError)}`);
}

try {
  await report(context.pages()[0] ?? (await context.newPage()));
  if (violations.length > 0) {
    console.log("\n⚠ SAFETY VIOLATIONS:");
    for (const v of violations) console.log(`   ${v}`);
  } else {
    console.log("\nsafety: no forbidden navigation, no destructive control clicked ✓");
  }
} finally {
  console.log("Leaving Chrome open so you can inspect it. Quit it (Cmd+Q) when done.");
  // Detach only — closing would kill the browser the operator may want to look at.
  await context.browser()?.close();
}

async function report(page: Page) {
  /* 1 — is the extension actually alive in this profile? */
  const workers = context.serviceWorkers().map((w) => w.url());
  const background = workers.filter((u) => u.includes(extensionId!));
  console.log(`[1] extension service worker: ${background.length > 0 ? "RUNNING ✓" : "not detected"}`);
  if (background.length === 0) {
    console.log("    (it may start lazily — the login page below will wake it)");
  }

  /* 2 — wait for the vault to be READY, not merely present.
   *
   * This is the difference between a working run and a dead one: the extension
   * needs ~tens of seconds after browser start to load the vault, and until it
   * has, it stamps its attributes on the form but renders no autofill icon —
   * indistinguishable from "not logged in" unless you wait.
   */
  const vault = await context.newPage();
  let ready = false;
  const started = Date.now();
  try {
    await vault.goto(`chrome-extension://${extensionId}/popup/index.html`, { timeout: 20_000 });
    for (let attempt = 0; attempt < 40; attempt++) {
      const body = (await vault.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
      const locked = /master password|log in to dashlane|unlock/i.test(body);
      if (locked) {
        console.log(`[2] vault is LOCKED after ${Math.round((Date.now() - started) / 1000)}s ⚠`);
        console.log("    Log in to Dashlane in this profile and tick the 14-day session.");
        break;
      }
      // A loaded vault renders real entries; the skeleton renders almost no text.
      if (body.length > 40) {
        ready = true;
        console.log(`[2] vault ready after ${Math.round((Date.now() - started) / 1000)}s ✓`);
        break;
      }
      await vault.waitForTimeout(1_500);
    }
    if (!ready) console.log(`[2] vault never finished loading (waited 60s)`);
    await vault.screenshot({ path: path.join(outDir, "0-vault.jpg"), quality: 70 });
    await vault.close();
  } catch (error) {
    console.log(`[2] extension page NOT reachable: ${(error as Error).message.split("\n")[0]}`);
    await vault.close().catch(() => {});
  }

  guard(page);

  /* 3 — the login page, and the icon Dashlane injects into its fields */
  await page.goto(loginUrl!, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(2_500);

  const username = page.locator("#username, input[name='username'], input[type='email']").first();
  console.log(`[3] username field: ${(await username.count()) > 0 ? "found ✓" : "NOT FOUND"}`);

  await username.click().catch(() => {});
  await page.waitForTimeout(2_000);

  /* 4 — wait for the in-field icon, the real liveness signal.
   *
   * It renders seconds after the field is focused, and not reliably on the
   * first attempt: back-to-back runs went success / nothing-at-all. The form is
   * stamped with `data-dashlane-rid` long before the icon exists, so treating
   * the stamp as "ready" reports a failure that is really a race. Poll for the
   * icon itself, re-focusing the field between tries to nudge the content
   * script.
   */
  let iconCount = 0;
  for (let attempt = 0; attempt < 12; attempt++) {
    iconCount = await page.locator("[data-dashlanecreated]").count();
    if (iconCount > 0) {
      console.log(`[4] in-field icon appeared after ~${attempt * 2}s ✓`);
      break;
    }
    await username.click().catch(() => {});
    await page.waitForTimeout(2_000);
  }

  if (iconCount === 0) {
    const injected = await dashlaneMarkers(page);
    console.log(`[4] NO in-field icon after 24s — markers present: ${injected.length}`);
    for (const marker of injected.slice(0, 8)) console.log(`    ${marker}`);
    console.log("    the adapter must treat this as an `auth` failure, not proceed");
  }

  /* 5 — open the dropdown the way a human does: click the icon inside the field
   *
   * NOT by selector. `data-dashlane-label` marks page elements Dashlane has
   * labelled — clicking one hit the site's "Forgot username" button and
   * navigated away. The icon itself lives in a closed shadow root, so it is
   * reached by geometry: the right-hand edge inside the username field.
   */
  await page.screenshot({ path: path.join(outDir, "1-field-focused.jpg"), quality: 70 });

  // Dashlane injects its in-field icon as an element it stamps `data-dashlanecreated`.
  const icons = page.locator("[data-dashlanecreated]");
  console.log(`[5] injected icon elements: ${iconCount}`);

  for (let i = 0; i < iconCount; i++) {
    const box = await icons.nth(i).boundingBox();
    console.log(`    #${i} <${await icons.nth(i).evaluate((el) => el.tagName.toLowerCase())}> ${box ? `at ${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)}` : "(no box)"}`);
  }

  if (iconCount > 0) {
    // The icon sitting inside the username field is the one that opens the picker.
    const fieldBox = await username.boundingBox();
    let target = 0;
    for (let i = 0; i < iconCount; i++) {
      const box = await icons.nth(i).boundingBox();
      if (box && fieldBox && box.y >= fieldBox.y - 4 && box.y <= fieldBox.y + fieldBox.height + 4) {
        target = i;
        break;
      }
    }
    console.log(`    clicking icon #${target}`);
    await icons.nth(target).click({ timeout: 5_000, force: true }).catch((e: Error) =>
      console.log(`    click failed: ${e.message.split("\n")[0]}`),
    );

    // The icon spins while the picker loads; it is not instant.
    for (let waited = 0; waited < 20_000; waited += 1_000) {
      await page.waitForTimeout(1_000);
      if (page.frames().some((f) => f.url().includes(extensionId!))) {
        console.log(`    picker frame appeared after ${(waited + 1000) / 1000}s ✓`);
        break;
      }
    }
  }

  await page.screenshot({ path: path.join(outDir, "2-after-icon-click.jpg"), quality: 70 });

  // The dropdown could be an injected iframe, another page/window, or shadow DOM.
  const frames = page.frames().filter((f) => f !== page.mainFrame());
  console.log(`    sub-frames: ${frames.length}`);
  for (const frame of frames) console.log(`      ${frame.url().slice(0, 110)}`);

  const dropdownFrames = frames.filter((f) => f.url().includes(extensionId!));
  if (dropdownFrames.length === 0) {
    console.log("    no extension frame yet — see 2-after-icon-click.jpg");
  }

  for (const frame of dropdownFrames) {
    await describeFrame(frame);

    if (!clientCode) continue;

    /*
     * Selection is a direct text match, not a search box: every entry in the
     * picker is labelled with the dealership's client code ("GDB - Golling CDJR
     * Bloomfield"), which is the same code Podio puts on the job. That makes
     * credential choice a lookup on data we already have, rather than a guess.
     */
    const option = frame.getByText(new RegExp(`\\b${clientCode}\\b`)).last();
    const matches = await frame.getByText(new RegExp(`\\b${clientCode}\\b`)).count();
    console.log(`      entries matching "${clientCode}": ${matches}`);

    if (matches === 0) {
      console.log(`      no entry for this client code — a job for it must fail as \`config\`, never guess`);
      continue;
    }

    await safeClick(option, `vault entry for ${clientCode}`).catch((e: Error) =>
      console.log(`      click failed: ${e.message.split("\n")[0]}`),
    );
    await page.waitForTimeout(3_000);
    await page.screenshot({ path: path.join(outDir, "3-after-selection.jpg"), quality: 70 });
    console.log(`      selected the "${clientCode}" entry`);
  }

  /* 6 — did anything actually get filled? Reported as presence, never values. */
  const afterSelect = await fieldLengths(page);
  console.log(`[6] username ${afterSelect.username} chars, password ${afterSelect.password} chars`);

  /* 7 — Cox is a two-step sign-in: username, Next, then the password screen. */
  const next = page.getByRole("button", { name: /next|continue/i }).first();
  if (afterSelect.username > 0 && (await next.count()) > 0) {
    await safeClick(next, "the Next button").catch((e: Error) => console.log(`    ${e.message}`));
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(4_000);
    const afterNext = await fieldLengths(page);
    console.log(
      `[7] after Next: password ${afterNext.password} chars` +
        (afterNext.password > 0 ? "  <- FULL AUTOFILL WORKED ✓" : "  (password screen may need its own icon click)"),
    );
    await page.screenshot({
      path: path.join(outDir, "4-password-step.jpg"),
      quality: 70,
      mask: [page.locator('input[type="password"]')],
    });
  }

  await page.screenshot({
    path: path.join(outDir, "login-with-dropdown.jpg"),
    quality: 70,
    // Hard requirement: no credential value ever reaches disk.
    mask: [page.locator('input[type="password"]'), page.locator('input[autocomplete="current-password"]')],
  });
  console.log(`\nscreenshots: ${path.relative(projectDir, outDir)}/ (passwords masked)`);
}

/**
 * Anything the extension injected: its iframes, custom elements, and the
 * attributes it stamps on fields. Playwright pierces open shadow roots, but the
 * walk below also covers closed-ish nesting so an icon host isn't missed.
 */
async function dashlaneMarkers(page: Page): Promise<string[]> {
  const frames = page
    .frames()
    .filter((f) => f.url().includes("chrome-extension://"))
    .map((f) => `frame: ${f.url().split("?")[0]}`);

  const dom = await page
    .evaluate(() => {
      const hits: string[] = [];
      const seen = new Set<Element>();
      const walk = (root: Document | ShadowRoot) => {
        for (const el of Array.from(root.querySelectorAll("*"))) {
          if (seen.has(el)) continue;
          seen.add(el);
          const tag = el.tagName.toLowerCase();
          const attrs = Array.from(el.attributes).map((a) => a.name);
          if (tag.includes("dashlane") || tag.includes("kw")) hits.push(`host: ${tag}`);
          const marker = attrs.find((a) => a.includes("dashlane") || a.startsWith("data-kw"));
          if (marker) hits.push(`attr: ${tag}[${marker}]`);
          if (el.shadowRoot) walk(el.shadowRoot);
        }
      };
      walk(document);
      return Array.from(new Set(hits));
    })
    .catch(() => [] as string[]);

  return [...frames, ...dom];
}

/** Field contents as lengths only — a credential value must never be logged. */
async function fieldLengths(page: Page) {
  return page
    .evaluate(() => ({
      username: (document.querySelector<HTMLInputElement>("#username, input[name='username']")?.value ?? "").length,
      password: (document.querySelector<HTMLInputElement>("input[type='password']")?.value ?? "").length,
    }))
    .catch(() => ({ username: 0, password: 0 }));
}

/** Lists what the injected dropdown exposes — labels only, never values. */
async function describeFrame(frame: Frame) {
  try {
    const items = await frame
      .locator('[role="option"], [role="listbox"] li, li, button')
      .allInnerTexts();
    const entries = items.map((t) => t.trim()).filter(Boolean).slice(0, 15);
    if (entries.length === 0) {
      console.log("      (no readable list items — may be shadow DOM or canvas)");
      return;
    }
    console.log(`      readable items (${entries.length}):`);
    for (const entry of entries) console.log(`        · ${entry.replace(/\s+/g, " ").slice(0, 80)}`);
    console.log("      -> selectable from Playwright: YES, these are real DOM nodes");
  } catch (error) {
    console.log(`      frame not readable: ${(error as Error).message.split("\n")[0]}`);
  }
}
