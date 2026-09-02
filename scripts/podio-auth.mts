/**
 * One-time Podio authorization for `PODIO_AUTH_MODE=user`.
 *
 *   npm run podio:auth
 *
 * Runs the OAuth2 authorization-code flow: opens a local listener, prints a URL
 * to approve in the browser you are already signed into (Google SSO included),
 * exchanges the returned code, and writes the refresh token to
 * `PODIO_TOKEN_FILE` with 0600 permissions.
 *
 * Why this rather than a password grant: an account created through Google
 * sign-in has no Podio password to grant with, and storing one would be worse
 * than storing a refresh token that can be revoked from Podio's own settings.
 *
 * Why this rather than an app token: an app token needs admin rights on each
 * app, and is scoped to that one app — it cannot read the linked Content Pages
 * records the Git matcher depends on (docs/features/02-git-integration.md).
 *
 * The access token is short-lived and is NOT stored; the worker exchanges the
 * refresh token for a new one at startup.
 */

import { createServer } from "node:http";
import { createRequire } from "node:module";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");

const AUTHORIZE_URL = "https://podio.com/oauth/authorize";
const TOKEN_URL = "https://podio.com/oauth/token";
const API_BASE = "https://api.podio.com";
/** Long enough to log in and approve, short enough not to sit forever. */
const TIMEOUT_MS = 5 * 60_000;

const projectDir = process.cwd();
loadEnvConfig(projectDir, process.env.NODE_ENV !== "production");

const clientId = required("PODIO_CLIENT_ID");
const clientSecret = required("PODIO_CLIENT_SECRET");
const redirectUri =
  process.env.PODIO_REDIRECT_URI?.trim() ||
  "http://localhost:8321/podio/callback";
const tokenFile = path.resolve(
  projectDir,
  process.env.PODIO_TOKEN_FILE?.trim() || ".secrets/podio-token.json",
);

const redirect = new URL(redirectUri);
const state = randomUUID();

const code = await captureAuthorizationCode();
const token = await exchange(code);
persist(token);
await listApps(token.access_token);

console.log(
  `\nDone. Set PODIO_AUTH_MODE=user in .env, and PODIO_APP_ID from the list above.`,
);

/* -------------------------------------------------------------------------- */

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(
      `${name} is not set. Generate an API key at https://podio.com/settings/api ` +
        `(register the domain "${redirect.hostname}"), put the values in .env, then re-run.`,
    );
    process.exit(1);
  }
  return value;
}

/** Serves the redirect URI just long enough to catch one callback. */
function captureAuthorizationCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
      if (url.pathname !== redirect.pathname) {
        res.writeHead(404).end();
        return;
      }

      const error = url.searchParams.get("error");
      const returnedState = url.searchParams.get("state");
      const returnedCode = url.searchParams.get("code");

      const fail = (message: string) => {
        res.writeHead(400, { "content-type": "text/plain" }).end(message);
        server.close();
        clearTimeout(timer);
        reject(new Error(message));
      };

      if (error) return fail(`Podio returned an error: ${error}`);
      // A mismatched state means the response isn't from the request we made.
      if (returnedState !== state) return fail("State mismatch — aborting.");
      if (!returnedCode) return fail("No authorization code in the callback.");

      res
        .writeHead(200, { "content-type": "text/plain" })
        .end("Podio authorization complete. You can close this tab.");
      server.close();
      clearTimeout(timer);
      resolve(returnedCode);
    });

    const timer = setTimeout(() => {
      server.close();
      reject(new Error("Timed out waiting for the Podio callback."));
    }, TIMEOUT_MS);

    server.listen(Number(redirect.port || 80), redirect.hostname, () => {
      const authorize = new URL(AUTHORIZE_URL);
      authorize.searchParams.set("client_id", clientId);
      authorize.searchParams.set("redirect_uri", redirectUri);
      authorize.searchParams.set("response_type", "code");
      authorize.searchParams.set("state", state);

      console.log(
        `\nOpen this URL, sign in as usual, and approve access:\n\n${authorize}\n\nWaiting for the callback on ${redirectUri} ...`,
      );
    });
  });
}

interface PodioToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

async function exchange(authorizationCode: string): Promise<PodioToken> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code: authorizationCode,
    redirect_uri: redirectUri,
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    // The body can echo request parameters, so report status only.
    throw new Error(
      `Token exchange failed: HTTP ${response.status}. Check that the API key's registered domain matches "${redirect.hostname}".`,
    );
  }

  return (await response.json()) as PodioToken;
}

function persist(token: PodioToken): void {
  mkdirSync(path.dirname(tokenFile), { recursive: true, mode: 0o700 });
  writeFileSync(
    tokenFile,
    `${JSON.stringify(
      {
        refreshToken: token.refresh_token,
        obtainedAt: new Date().toISOString(),
        // Recorded for diagnostics only — the worker always refreshes at startup.
        accessTokenExpiresIn: token.expires_in,
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
  chmodSync(tokenFile, 0o600);
  console.log(
    `\nRefresh token written to ${path.relative(projectDir, tokenFile)} (0600). Never commit it.`,
  );
}

/**
 * Prints app IDs, because `PODIO_APP_ID` otherwise comes from the Developer
 * page — which needs the admin rights this whole flow exists to avoid needing.
 */
async function listApps(accessToken: string): Promise<void> {
  const headers = { authorization: `OAuth2 ${accessToken}` };

  const orgs = (await getJson(`${API_BASE}/org/`, headers)) as {
    name: string;
    spaces: { space_id: number; name: string }[];
  }[];

  console.log("\nApps you can reach:");
  for (const org of orgs) {
    for (const space of org.spaces ?? []) {
      const apps = (await getJson(
        `${API_BASE}/app/space/${space.space_id}/`,
        headers,
      )) as { app_id: number; config?: { name?: string } }[];

      for (const app of apps) {
        console.log(
          `  ${String(app.app_id).padEnd(10)} ${org.name} / ${space.name} / ${app.config?.name ?? "(unnamed)"}`,
        );
      }
    }
  }
}

async function getJson(url: string, headers: Record<string, string>) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GET ${url} failed: HTTP ${response.status}`);
  }
  return response.json();
}
