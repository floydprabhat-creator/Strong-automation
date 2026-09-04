/**
 * Podio API client — authentication and raw reads.
 *
 * Authenticates with the refresh token written by `npm run podio:auth`
 * (docs/env-and-secrets.md). The access token is short-lived and kept in memory
 * only; the refresh token is re-read from disk and rotated back when Podio
 * issues a new one, so a long-running process never falls out of sync with the
 * file.
 *
 * Read-only by design. Every write to Podio is a publish-path concern and
 * belongs to the worker (docs/features/01-podio-integration.md), not here.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertServerOnly } from "@/lib/env/read";

const TOKEN_URL = "https://podio.com/oauth/token";
const API_BASE = "https://api.podio.com";
/** Refresh a minute early rather than racing the expiry. */
const EXPIRY_MARGIN_MS = 60_000;

export class PodioError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PodioError";
  }
}

interface AccessToken {
  value: string;
  expiresAt: number;
}

let cachedToken: AccessToken | null = null;

function tokenFilePath(): string {
  return path.resolve(
    process.cwd(),
    process.env.PODIO_TOKEN_FILE?.trim() || ".secrets/podio-token.json",
  );
}

async function readRefreshToken(): Promise<string> {
  const file = tokenFilePath();
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as {
      refreshToken?: string;
    };
    if (!parsed.refreshToken) throw new Error("no refreshToken field");
    return parsed.refreshToken;
  } catch {
    throw new PodioError(
      `No usable Podio token at ${file}. Run \`npm run podio:auth\` to authorize.`,
      401,
    );
  }
}

/** Podio rotates the refresh token on use; losing the new one costs a re-auth. */
async function persistRefreshToken(refreshToken: string): Promise<void> {
  const file = tokenFilePath();
  const existing = JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
  await writeFile(
    file,
    `${JSON.stringify({ ...existing, refreshToken, obtainedAt: new Date().toISOString() }, null, 2)}\n`,
    { mode: 0o600 },
  );
}

async function accessToken(): Promise<string> {
  assertServerOnly("lib/integrations/podio");

  if (cachedToken && cachedToken.expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
    return cachedToken.value;
  }

  const clientId = process.env.PODIO_CLIENT_ID?.trim();
  const clientSecret = process.env.PODIO_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new PodioError("PODIO_CLIENT_ID / PODIO_CLIENT_SECRET are not set.", 401);
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: await readRefreshToken(),
    }),
  });

  if (!response.ok) {
    // The body echoes request parameters, so the status is all that's safe to report.
    throw new PodioError(
      `Podio token refresh failed (HTTP ${response.status}). Re-run \`npm run podio:auth\`.`,
      response.status,
    );
  }

  const token = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  if (token.refresh_token) await persistRefreshToken(token.refresh_token);

  cachedToken = {
    value: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  };
  return cachedToken.value;
}

async function request<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...init,
    headers: {
      ...init.headers,
      authorization: `OAuth2 ${await accessToken()}`,
      "content-type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new PodioError(`Podio ${endpoint} failed (HTTP ${response.status})`, response.status);
  }
  return (await response.json()) as T;
}

/* -------------------------------------------------------------------------- */
/* Raw shapes — only the parts this app reads                                 */
/* -------------------------------------------------------------------------- */

export interface PodioFieldValue {
  value?: unknown;
  start?: string;
}

export interface PodioField {
  external_id: string;
  type: string;
  values?: PodioFieldValue[];
  config?: { label?: string; settings?: { options?: { id: number; text: string }[] } };
}

export interface PodioFile {
  file_id: number;
  name: string;
  size: number;
  mimetype: string;
}

export interface PodioItem {
  item_id: number;
  title: string;
  created_on: string;
  last_event_on?: string;
  fields?: PodioField[];
  files?: PodioFile[];
}

export interface PodioApp {
  app_id: number;
  space_id: number;
  config?: { name?: string };
  fields?: PodioField[];
}

export interface PodioFilterResult {
  total: number;
  filtered: number;
  items: PodioItem[];
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

export function getApp(appId: string): Promise<PodioApp> {
  return request<PodioApp>(`/app/${appId}`);
}

export function getItem(itemId: number | string): Promise<PodioItem> {
  return request<PodioItem>(`/item/${itemId}`);
}

export function filterItems(
  appId: string,
  body: Record<string, unknown>,
): Promise<PodioFilterResult> {
  return request<PodioFilterResult>(`/item/app/${appId}/filter/`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Downloads an item attachment — the Kiosk-generated HTML that is the artifact
 * to publish (docs/features/02-git-integration.md).
 */
export async function downloadFile(fileId: number): Promise<string> {
  const response = await fetch(`${API_BASE}/file/${fileId}/raw`, {
    headers: { authorization: `OAuth2 ${await accessToken()}` },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new PodioError(`Podio file ${fileId} download failed (HTTP ${response.status})`, response.status);
  }
  return response.text();
}

/** Category option IDs are per-app, so they're resolved rather than hardcoded. */
export async function categoryOptionIds(
  appId: string,
  externalId: string,
): Promise<Map<string, number>> {
  const app = await getApp(appId);
  const field = app.fields?.find((f) => f.external_id === externalId);
  const options = field?.config?.settings?.options ?? [];
  return new Map(options.map((option) => [option.text, option.id]));
}
