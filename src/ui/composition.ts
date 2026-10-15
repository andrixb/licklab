// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// ui/composition: the ONLY file in ui/ allowed to import adapters.
// Composition root: wires concrete adapters to application use cases and hands
// components plain use-case closures. Everything else in ui/ imports this
// module (or application/domain) — never adapters directly.
//
// Chunking: this module is imported by the initial app shell, so it must not
// statically import anything heavy. Dexie, Verovio, the use cases, the local
// band engine and all domain chord/progression code load DYNAMICALLY inside
// the (already async) use-case closures below — the initial payload stays
// inside the budget check (docs/deployment.md, ADR-023). Static imports here
// are types only (erased at build) plus tiny pure helpers.

import type { DexieLickRepository, LickLabDb } from "../adapters/dexie/licks.js";
import type { VerovioRenderer } from "../adapters/notation/verovio.js";
import type { SaveLickInput } from "../application/licks.js";
import type { AbcLickInput } from "../application/lickInput.js";
import type { PlayOptions } from "../application/playback.js";
import type { AudioEngine, BandGenerateOptions, BandLevels, BandPlayback, BandPatternProvider, LickFilter, PianoVoice, BassVariant, PianoVariant, DrumVariant } from "../application/ports.js";
import type { Lick } from "../domain/lick.js";
import type { BandPart, BandStyle } from "../domain/band.js";
import type { CatalogLick } from "../domain/matching.js";
import type { Progression, ProgressionBar } from "../domain/progression.js";

/** Extra playback controls from the workspace control room (all optional). */
export interface WorkspacePlayOpts {
  readonly levels?: BandLevels;
  readonly loop?: boolean;
  /** Beats of count-in silence (0/4/8); default 4. */
  readonly countInBeats?: number;
  readonly band?: BandGenerateOptions;
  readonly pianoVoice?: PianoVoice;
  readonly bassVariant?: BassVariant;
  readonly pianoVariant?: PianoVariant;
  readonly drumVariant?: DrumVariant;
}

export interface PlaybackInfo {
  readonly totalSeconds: number;
  readonly countInBeats: number;
  readonly totalBeats: number;
  readonly tempoBpm: number;
  readonly engineLabel: string;
}

/** Signed-out local-only mode namespace (attaches to the account on first sign-in). */
export const LOCAL_OWNER = "local";

export interface SessionUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly image: string | null;
}

interface DbHandle {
  db: LickLabDb;
  repo: DexieLickRepository;
}

/** Lazily opened Dexie namespace (dynamic import: Dexie stays out of the initial chunk). */
async function openNamespace(namespace: string): Promise<DbHandle> {
  const mod = await import("../adapters/dexie/licks.js");
  const db = new mod.LickLabDb(namespace);
  return { db, repo: new mod.DexieLickRepository(db) };
}

const clock = { nowIso: (): string => new Date().toISOString() };
const ids = { next: (): string => crypto.randomUUID() };

let rendererPromise: Promise<VerovioRenderer> | null = null;
/** Lazily created notation renderer (Verovio WASM still loads on first render). */
function getRenderer(): Promise<VerovioRenderer> {
  if (!rendererPromise) {
    rendererPromise = import("../adapters/notation/verovio.js").then((m) => new m.VerovioRenderer());
  }
  return rendererPromise;
}

/** Lazily opened repo handle for the current namespace (memoized per switch). */
let currentPromise: Promise<DbHandle> | null = null;
function currentRepos(): Promise<DbHandle> {
  if (!currentPromise) currentPromise = openNamespace(LOCAL_OWNER);
  return currentPromise;
}

const ownerOf = (user: SessionUser | null): string => user?.id ?? LOCAL_OWNER;

let currentUser: SessionUser | null = null;

/** Move all signed-out local data into the user's namespace (first sign-in). */
async function attachLocalData(userId: string): Promise<void> {
  const [local, current] = await Promise.all([openNamespace(LOCAL_OWNER), currentRepos()]);
  const rows = await local.repo.list(LOCAL_OWNER, { includeDeleted: true });
  if (rows.length === 0) return;
  for (const lick of rows) {
    await current.repo.save({ ...lick, ownerId: userId });
    if (lick.deletedAt == null) await local.repo.softDelete(lick.id, LOCAL_OWNER, clock.nowIso());
  }
}

/**
 * Bind storage to a session user (null = signed out). Rebuilds the repository,
 * migrates local-only data on first sign-in, and notifies listeners.
 */
export async function bindUser(user: SessionUser | null): Promise<void> {
  if (user && currentUser?.id !== user.id) {
    currentPromise = openNamespace(user.id);
    await attachLocalData(user.id);
  }
  if (!user && currentUser) {
    currentPromise = openNamespace(LOCAL_OWNER);
  }
  currentUser = user;
  notifyAuth();
}

export function getSignedInUser(): SessionUser | null {
  return currentUser;
}

const authListeners = new Set<(user: SessionUser | null) => void>();
export function onAuthChange(cb: (user: SessionUser | null) => void): () => void {
  authListeners.add(cb);
  return () => authListeners.delete(cb);
}
function notifyAuth(): void {
  for (const cb of authListeners) cb(currentUser);
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const body = (await res.json()) as { ok: true; data: T } | { ok: false; error: { code: string; message: string } };
  if (!body.ok) throw new Error(body.error.message);
  return body.data;
}

export const auth = {
  async me(): Promise<SessionUser | null> {
    try {
      const data = await fetchJson<{ user: SessionUser }>("/api/me");
      return data.user;
    } catch {
      return null;
    }
  },
  async signIn(provider: "google" | "github"): Promise<void> {
    const { createAuthClient } = await import("better-auth/client");
    const client = createAuthClient({ baseURL: window.location.origin });
    // better-auth v1 returns BetterFetchResponse<T> = { data, error }, not the url directly.
    const res = await client.signIn.social({ provider, callbackURL: window.location.origin });
    if (res?.error) throw new Error(res.error.message ?? "sign-in failed");
    const url = res?.data?.url;
    if (!url) throw new Error("provider not configured");
    window.location.href = url;
  },
  async signOut(): Promise<void> {
    const { createAuthClient } = await import("better-auth/client");
    const client = createAuthClient({ baseURL: window.location.origin });
    const res = await client.signOut();
    if (res?.error) throw new Error(res.error.message ?? "sign-out failed");
    await bindUser(null);
  },
  async deleteAccount(): Promise<void> {
    await fetchJson("/api/account", { method: "DELETE" });
    await bindUser(null);
  },
  /** Server-side account data (identity + providers) as a downloadable JSON. */
  async exportAccount(): Promise<void> {
    const data = await fetchJson<unknown>("/api/account/export");
    downloadJson("licklab-account-export.json", data);
  },
};

/** Full backup of the current library (all licks incl. tombstones). */
export async function exportLibrary(): Promise<void> {
  const current = await currentRepos();
  const licks = await current.repo.list(ownerOf(currentUser), { includeDeleted: true });
  downloadJson("licklab-library-export.json", { schemaVersion: 1, exportedAt: clock.nowIso(), licks });
}

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const lickLab = {
  listLicks: async (filter?: LickFilter): Promise<Lick[]> => {
    const [{ listLicks }, current] = await Promise.all([import("../application/licks.js"), currentRepos()]);
    return listLicks({ repo: current.repo }, ownerOf(currentUser), filter);
  },
  getLick: async (id: string): Promise<Lick | null> => {
    const current = await currentRepos();
    return current.repo.get(id, ownerOf(currentUser));
  },
  createLick: async (input: SaveLickInput): Promise<Lick> => {
    const [{ saveLick }, current] = await Promise.all([import("../application/licks.js"), currentRepos()]);
    return saveLick({ repo: current.repo, clock, ids }, ownerOf(currentUser), input);
  },
  createLickFromAbc: async (input: AbcLickInput): Promise<Lick> => {
    const [{ createLickFromAbc }, current] = await Promise.all([import("../application/lickInput.js"), currentRepos()]);
    return createLickFromAbc({ repo: current.repo, clock, ids }, ownerOf(currentUser), input);
  },
  removeLick: async (id: string): Promise<void> => {
    const [{ deleteLick }, current] = await Promise.all([import("../application/licks.js"), currentRepos()]);
    return deleteLick({ repo: current.repo, clock }, ownerOf(currentUser), id);
  },
  renderNotation: async (abc: string, opts?: { title?: string }): Promise<string> => {
    const renderer = await getRenderer();
    return renderer.renderAbcToSvg(abc, opts);
  },
  ensureSeeded: async (): Promise<void> => {
    const [{ saveLick }, { SEED_LICKS }, current] = await Promise.all([
      import("../application/licks.js"),
      import("../application/seeds.js"),
      currentRepos(),
    ]);
    const owner = ownerOf(currentUser);
    // Example licks are upserted (not skipped when the library is non-empty):
    // stable ids make this idempotent AND self-correcting — an old copy saved
    // with pre-fix degrees is refreshed on next load.
    let n = 0;
    for (const seed of SEED_LICKS) {
      n += 1;
      await saveLick({ repo: current.repo, clock, ids: { next: () => `seed-${n}` } }, owner, seed);
    }
  },
};

// ---- Workspace (progression + band) ----

const starterPack: { cache: Promise<CatalogLick[]> | null } = { cache: null };

async function catalogLicks(): Promise<CatalogLick[]> {
  if (!starterPack.cache) {
    starterPack.cache = fetch("/starter-pack.json")
      .then((r) => r.json() as Promise<{ licks: unknown[] }>)
      .then((file) => import("../adapters/catalog/starter-pack.js").then((m) => m.createStarterPackCatalog(async () => file).fetchPublicLicks()));
  }
  const [starter, own] = await Promise.all([
    starterPack.cache.catch(() => [] as CatalogLick[]),
    lickLab.listLicks(),
  ]);
  return [...own.map((lick) => ({ lick, likes: 0 })), ...starter];
}

async function draftProgression(input: string): Promise<Progression> {
  const { parseProgressionInput } = await import("../domain/progression.js");
  const now = clock.nowIso();
  return {
    id: "draft",
    title: "",
    key: "",
    bars: parseProgressionInput(input),
    ownerId: ownerOf(currentUser),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    schemaVersion: 1,
  };
}

// Tone (~200KB) loads lazily on FIRST play — keeps the initial payload
// inside the budget check (docs/deployment.md).
let enginePromise: Promise<AudioEngine> | null = null;
let engine: AudioEngine | null = null;
/** Set when the engine CHUNK itself fails to load (before any AudioEngine exists). */
let importError: string | null = null;
/** Reload at most once per tab: lets a stranded tab heal without ever looping. */
const CHUNK_RELOAD_KEY = "licklab:chunk-reloaded";

/**
 * A failed dynamic chunk import is the signature of a stranded tab: the page is
 * running a build whose hashed assets a newer deploy has pruned, and the static
 * server answers the SPA fallback (200 text/html) instead of the chunk. The UI
 * only ever shows a silent "Uncaught (in promise) TypeError" for that.
 */
function isStaleChunkFailure(e: unknown): boolean {
  return (
    e instanceof TypeError &&
    /dynamically imported module|failed to fetch|loading chunk|chunkloaderror/i.test(e instanceof Error ? e.message : String(e))
  );
}

/** The audio engine chunk failed to arrive (offline mid-deploy, stranded tab). */
function markImportFailed(e: unknown): void {
  importError = e instanceof Error ? e.message : "audio engine unavailable";
  // Heal the stranded tab: the fresh index.html references chunks that exist.
  try {
    if (isStaleChunkFailure(e) && !sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
      location.reload();
    }
  } catch {
    // sessionStorage/location may be unavailable in some embeds; the alert still shows.
  }
}
function getEngine(): Promise<AudioEngine> {
  if (!enginePromise) {
    enginePromise = import("../adapters/tone/engine.js").then((m) => {
      engine = m.createToneEngine();
      return engine;
    });
  }
  return enginePromise;
}

let currentPlayback: BandPlayback | null = null;
let lastInfo: PlaybackInfo | null = null;
const playListeners = new Set<() => void>();

/**
 * Pattern source per style: jmove (lazy, MIT) for swing/ballad/bossa, local
 * domain engine for straight. Any jmove failure (import, generation) falls
 * back to local so playback still starts — the info label says which won.
 * The local provider is dynamically imported too: it pulls the domain band
 * engine (and chord reading) which must stay out of the initial chunk.
 */
async function withProvider<T>(
  style: BandStyle,
  run: (provider: BandPatternProvider) => Promise<T>,
): Promise<{ result: T; engineLabel: string }> {
  if (style === "straight") {
    const { createLocalBandProvider } = await import("../adapters/local/band.js");
    return { result: await run(createLocalBandProvider()), engineLabel: "local" };
  }
  try {
    const mod = await import("../adapters/jmove/generator.js");
    const version = await mod.jmoveVersion().catch(() => "?");
    const out = await run(mod.createJmoveBandProvider());
    return { result: out, engineLabel: `jmove ${version}` };
  } catch {
    const { createLocalBandProvider } = await import("../adapters/local/band.js");
    return { result: await run(createLocalBandProvider()), engineLabel: "local" };
  }
}

async function infoFor(bars: readonly ProgressionBar[], tempoBpm: number, countInBeats: number, engineLabel: string): Promise<PlaybackInfo> {
  const { flattenProgression } = await import("../domain/progression.js");
  const flat = flattenProgression(bars);
  const totalBeats = flat.reduce((n, c) => n + c.beats, 0);
  return { totalSeconds: ((totalBeats + countInBeats) * 60) / tempoBpm, countInBeats, totalBeats, tempoBpm, engineLabel };
}

/** PlayOptions without provider (exactOptionalPropertyTypes-safe). */
function basePlayOptions(style: BandStyle, parts: BandPart, playOpts?: WorkspacePlayOpts): PlayOptions {
  return {
    style,
    tempoBpm: parts.tempoBpm,
    parts,
    ...(playOpts?.band !== undefined ? { bandOpts: playOpts.band } : {}),
    ...(playOpts?.countInBeats !== undefined ? { countInBeats: playOpts.countInBeats } : {}),
    ...(playOpts?.levels !== undefined ? { levels: playOpts.levels } : {}),
    ...(playOpts?.loop !== undefined ? { loop: playOpts.loop } : {}),
  };
}

/**
 * A newer build finished installing in the background (service worker update).
 * Reloading mid-chorus would cut the music, so reload now if idle, otherwise
 * right after the current playback ends. Without this a long-lived practice
 * tab keeps running pruned chunks forever ("plays" old code that no longer
 * matches the deployed samples).
 */
let updatePending = false;
function maybeReloadForUpdate(): void {
  if (updatePending && currentPlayback === null) {
    try {
      location.reload();
    } catch {
      // non-browser test runtimes; ignore
    }
  }
}
/** Called by the PWA update registration when a new version is ready. */
export function noteAppUpdateReady(): void {
  updatePending = true;
  maybeReloadForUpdate();
}

async function runPlayback(
  make: (engine: AudioEngine) => Promise<{ playback: BandPlayback | null; info: PlaybackInfo | null }>,
  playOpts?: WorkspacePlayOpts,
): Promise<boolean> {
  currentPlayback?.stop();
  let engine: AudioEngine;
  try {
    engine = await getEngine();
  } catch (e) {
    markImportFailed(e);
    for (const l of playListeners) l();
    return false;
  }
  console.log('[runPlayback] playOpts:', JSON.stringify(playOpts));
  // Apply voice variants BEFORE unlocking so the engine loads the correct samples
  if (playOpts?.pianoVoice) {
    try {
      await engine.setPianoVoice(playOpts.pianoVoice);
    } catch {
      /* older engines ignore voice selection */
    }
  }
  // Apply voice variants before unlocking so the correct samples are loaded
  if (playOpts?.bassVariant) {
    console.log('[runPlayback] Setting bassVariant:', playOpts.bassVariant);
    try {
      await engine.setBassVariant(playOpts.bassVariant);
    } catch {
      /* older engines ignore variant selection */
    }
  }
  if (playOpts?.pianoVariant) {
    console.log('[runPlayback] Setting pianoVariant:', playOpts.pianoVariant);
    try {
      await engine.setPianoVariant(playOpts.pianoVariant);
    } catch {
      /* older engines ignore variant selection */
    }
  }
  if (playOpts?.drumVariant) {
    console.log('[runPlayback] Setting drumVariant:', playOpts.drumVariant);
    try {
      await engine.setDrumVariant(playOpts.drumVariant);
    } catch {
      /* older engines ignore variant selection */
    }
  }
  // Pre-load the samples so a failure is visible immediately rather than the UI
  // claiming play while nothing sounds. The engine records the reason.
  try {
    await engine.unlock();
  } catch {
    return false;
  }
  const resolved = await make(engine);
  if (!resolved.playback) return false;
  currentPlayback = resolved.playback;
  lastInfo = resolved.info;
  for (const l of playListeners) l();
  await resolved.playback.finished;
  if (currentPlayback === resolved.playback) currentPlayback = null;
  for (const l of playListeners) l();
  maybeReloadForUpdate();
  return true;
}

export const workspace = {
  matches: async (input: string) => {
    const [{ findLicksForProgression }] = await Promise.all([import("../application/matching.js")]);
    const progression = await draftProgression(input);
    return { progression, result: findLicksForProgression(progression, await catalogLicks()) };
  },
  playChorus: (input: string, style: BandStyle, parts: BandPart, playOpts?: WorkspacePlayOpts) =>
    runPlayback(async (e) => {
      const [{ playChorus }] = await Promise.all([import("../application/playback.js")]);
      const bars = (await draftProgression(input)).bars;
      const countIn = playOpts?.countInBeats ?? 4;
      const base = basePlayOptions(style, parts, playOpts);
      const { result: playback, engineLabel } = await withProvider(style, (p) => playChorus(e, bars, { ...base, provider: p }));
      return { playback, info: await infoFor(bars, parts.tempoBpm, countIn, engineLabel) };
    }, playOpts),
  auditionLick: (input: string, lick: Lick, style: BandStyle, parts: BandPart, playOpts?: WorkspacePlayOpts) =>
    runPlayback(async (e) => {
      const [{ auditionLick }] = await Promise.all([import("../application/playback.js")]);
      const p = await draftProgression(input);
      const countIn = playOpts?.countInBeats ?? 4;
      const base = basePlayOptions(style, parts, playOpts);
      const { result: playback, engineLabel } = await withProvider(style, async (provider) =>
        auditionLick(e, p.bars, await findSegmentsFor(p), lick, { ...base, provider }),
      );
      return { playback, info: playback ? await infoFor(p.bars, parts.tempoBpm, countIn, engineLabel) : null };
    }, playOpts),
  playSoloChorus: (
    input: string,
    placements: readonly { lick: Lick; segmentIndex: number }[],
    style: BandStyle,
    parts: BandPart,
    playOpts?: WorkspacePlayOpts,
  ) =>
    runPlayback(async (e) => {
      const [{ playSoloChorus }] = await Promise.all([import("../application/playback.js")]);
      const p = await draftProgression(input);
      const countIn = playOpts?.countInBeats ?? 4;
      const base = basePlayOptions(style, parts, playOpts);
      const { result: playback, engineLabel } = await withProvider(style, async (provider) =>
        playSoloChorus(e, p.bars, await findSegmentsFor(p), placements, { ...base, provider }),
      );
      return { playback, info: await infoFor(p.bars, parts.tempoBpm, countIn, engineLabel) };
    }, playOpts),
  playTwelveKeys: (lick: Lick, style: BandStyle, parts: BandPart, playOpts?: WorkspacePlayOpts) =>
    runPlayback(async (e) => {
      const [{ playTwelveKeys }] = await Promise.all([import("../application/playback.js")]);
      const base = basePlayOptions(style, parts, playOpts);
      const { result: playback, engineLabel } = await withProvider(style, (provider) => playTwelveKeys(e, lick, { ...base, provider }));
      const ctxBeats = lick.harmonicContext.chords.reduce((n, c) => n + c.beats, 0);
      const totalBeats = 12 * ctxBeats;
      return {
        playback,
        info: playback
          ? { totalSeconds: ((totalBeats + 4) * 60) / parts.tempoBpm, countInBeats: 0, totalBeats, tempoBpm: parts.tempoBpm, engineLabel }
          : null,
      };
    }, playOpts),
  stop(): void {
    currentPlayback?.stop();
    currentPlayback = null;
    for (const l of playListeners) l();
    maybeReloadForUpdate();
  },
  get isPlaying(): boolean {
    // Read the engine, not local state: a failed sample load must not leave the
    // UI claiming playback (Tone would stay silent forever otherwise).
    return currentPlayback !== null && engine?.isPlaying === true;
  },
  /** Transport position in seconds (playhead display; 0 when idle). */
  positionSeconds(): number {
    try {
      return engine?.getPositionSeconds() ?? 0;
    } catch {
      return 0;
    }
  },
  playbackInfo(): PlaybackInfo | null {
    return lastInfo;
  },
  get audioError(): string | null {
    return importError ?? engine?.lastError ?? null;
  },
  onPlayChange(cb: () => void): () => void {
    playListeners.add(cb);
    return () => playListeners.delete(cb);
  },
  async setBassVariant(variant: BassVariant): Promise<void> {
    if (engine) await engine.setBassVariant(variant);
  },
  async setPianoVariant(variant: PianoVariant): Promise<void> {
    if (engine) await engine.setPianoVariant(variant);
  },
  async setDrumVariant(variant: DrumVariant): Promise<void> {
    if (engine) await engine.setDrumVariant(variant);
  },
  setLevels(levels: BandLevels): void {
    try {
      engine?.setLevels(levels);
    } catch {
      /* engine not loaded yet; levels apply on next Play via playOpts */
    }
  },
};

async function findSegmentsFor(p: Progression) {
  const { analyzeProgression } = await import("../domain/progression.js");
  return analyzeProgression(p);
}

