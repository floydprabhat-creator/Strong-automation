/**
 * Domain types.
 *
 * These mirror the Appwrite collections documented in
 * `docs/features/05-appwrite-data-layer.md`. They are the contract shared by the
 * `web` and `worker` processes (docs/features/11-runtime-architecture.md), so
 * changes here must stay in step with the Appwrite schema.
 */

/* -------------------------------------------------------------------------- */
/* Platforms & dealerships                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Adapter implementations. Auto Go and Fox Dealer deliberately share `wordpress`.
 *
 * These four cover the five in-scope platforms and nothing else. The live Podio
 * dropdown holds 27 options — including high-volume ones like Dealer Inspire and
 * DealerOn — which are deliberately out of scope and filtered out before they
 * reach the app (docs/features/06-platform-adapters.md).
 */
export type AdapterKey = "dealercom" | "apollo" | "eprocess" | "wordpress";

export type PublishMode = "api" | "playwright";

export interface Platform {
  id: string;
  name: string;
  adapterKey: AdapterKey;
  /** Applies to publish/update/verify only — login is always browser-based. */
  publishMode: PublishMode;
  /** The page Dashlane autofills against. */
  loginUrl: string;
  /** True for Dealer eProcess; gates selection until VPN is verified. */
  requiresVpn: boolean;
  /** Whether many dealerships share one login domain (autofill ambiguity risk). */
  sharedLoginPortal: boolean;
  /** Where each piece of code goes on this platform. Null until confirmed by a spike. */
  codeMapping: {
    html: string | null;
    css: string | null;
    js: string | null;
  };
}

export interface Dealership {
  id: string;
  name: string;
  /** Podio `Client Code`, e.g. "BFB" — the Git folder key. */
  clientCode: string;
  clientUrl: string;
  platformIds: string[];
}

/* -------------------------------------------------------------------------- */
/* Jobs                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Engine states. Distinct from Podio's own statuses — see the mapping table in
 * docs/features/07-publishing-job-engine.md.
 *
 * `failed` is terminal: there are no automatic retries. Only an explicit operator
 * action returns a job to `queued`.
 * `deferred` means a precondition (VPN, Dashlane re-auth) isn't met yet — it is
 * NOT a failure and must never appear in the failure queue.
 */
export type JobStatus =
  | "draft"
  | "ready"
  | "queued"
  | "publishing"
  | "published"
  | "failed"
  | "deferred";

/**
 * Diagnostic classification of a failure. Drives what the operator needs to fix,
 * not what the engine does next (the engine always stops).
 */
export type ErrorClass =
  | "transient"
  | "auth"
  | "config"
  | "content"
  | "verification"
  | "unknown";

/** Pipeline steps, in execution order. Used for "which step failed". */
export type PipelineStep =
  | "select"
  | "claim"
  | "resolve-source"
  | "normalize"
  | "credentials"
  | "login"
  | "publish"
  | "verify"
  | "write-back";

export interface Job {
  id: string;
  /** Unique — the identity that survives Podio being reset on failure. */
  podioItemId: string;
  title: string;
  dealershipId: string;
  platformId: string;
  pageType: string;
  /** Podio `Due By`, drives current-month / next-month selection. */
  dueBy: string;
  /**
   * Podio `Assigned To`, which doubles as the claim/lock: `Rubico` means the
   * automation holds it, empty means it is back in the human pool
   * (docs/features/01-podio-integration.md). Optional because it is Podio's
   * state, not the engine's.
   */
  podioAssignee?: string | null;
  status: JobStatus;
  /** Pinned at job start; all reads happen at this SHA. */
  gitCommitHash: string | null;
  /** Resolved source file within the shared repo. */
  sourceFile: string | null;
  /** Count of operator-initiated retries, not a budget the engine spends. */
  attemptCount: number;
  publishedUrl: string | null;
  errorSummary: string | null;
  errorClass: ErrorClass | null;
  failedStep: PipelineStep | null;
  /** Why the job is deferred, when status is `deferred`. */
  deferredReason: string | null;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Attempts, artifacts, logs                                                  */
/* -------------------------------------------------------------------------- */

export type ArtifactType = "screenshot" | "trace" | "console" | "network";

export interface Artifact {
  id: string;
  step: PipelineStep;
  type: ArtifactType;
  /** Always set — artifacts are written locally first. */
  localPath: string;
  /** Only set once the upload to Appwrite Storage succeeded. */
  storageFileId: string | null;
  /** Query string stripped before storing. */
  capturedUrl: string | null;
  label: string;
  capturedAt: string;
}

export interface Attempt {
  id: string;
  jobId: string;
  attemptNumber: number;
  startedAt: string;
  finishedAt: string | null;
  outcome: "success" | "failure" | "running";
  errorClass: ErrorClass | null;
  failedStep: PipelineStep | null;
  errorDetail: string | null;
  verificationResult: string | null;
  artifacts: Artifact[];
  /** True when the operator initiated this attempt rather than the poll loop. */
  operatorInitiated: boolean;
}

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  id: string;
  jobId: string;
  attemptId: string | null;
  level: LogLevel;
  step: PipelineStep | null;
  message: string;
  timestamp: string;
}

/* -------------------------------------------------------------------------- */
/* Source review                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The one permitted code modification: entity decoding inside the commented
 * metadata block only (docs/features/03-code-processing.md). Surfaced in the UI
 * so the operator can confirm nothing outside that block changed.
 */
export interface SourceReview {
  jobId: string;
  filePath: string;
  commitHash: string;
  originalMetadataBlock: string;
  processedMetadataBlock: string;
  /** Byte length of the whole file, to show how little was touched. */
  totalBytes: number;
  /** Number of characters changed by normalization. */
  changedChars: number;
}

/* -------------------------------------------------------------------------- */
/* Worker & operator gates                                                    */
/* -------------------------------------------------------------------------- */

export type WorkerState = "running" | "idle" | "stopped" | "waiting-for-operator";

export type GateKind = "vpn" | "dashlane";

/**
 * An operator-gated precondition: the worker cannot proceed until a human does
 * something on this machine. One mechanism serves both VPN and Dashlane re-auth
 * (docs/features/11-runtime-architecture.md).
 */
export interface OperatorGate {
  id: string;
  kind: GateKind;
  /** Jobs waiting on this gate — one prompt covers the whole batch. */
  affectedJobCount: number;
  raisedAt: string;
  message: string;
  /** What the operator must do. */
  actionLabel: string;
  /** Set once the worker has independently verified the precondition holds. */
  verifiedAt: string | null;
}

export interface WorkerStatus {
  state: WorkerState;
  /** Why the worker stopped, e.g. a tripped auth circuit breaker. */
  stoppedReason: string | null;
  lastPollAt: string | null;
  currentJobId: string | null;
  /** Dashlane session expiry — the ~14-day window. */
  dashlaneSessionExpiresAt: string | null;
  vpnConnected: boolean;
}
