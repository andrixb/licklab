// application ports (interfaces owned by the application layer).
// Full list per spec; implementations live in adapters/ or worker/.
// UI talks to use cases; use cases talk to these ports; never to adapters directly.

export interface LickRepository {
  list(): Promise<unknown[]>;
}
export interface SongRepository {
  list(): Promise<unknown[]>;
}
export interface SyncRemote {
  pullChanges(since: string): Promise<unknown[]>;
  pushChanges(changes: unknown[]): Promise<void>;
}
export interface SessionVerifier {
  verify(request: Request): Promise<{ ownerId: string } | null>;
}
export interface RateLimiter {
  check(key: string): Promise<{ allowed: boolean }>;
}
export interface AudioEngine {
  readonly name: "audio-engine";
}
export interface BackingProvider {
  readonly name: "backing-provider";
}
export interface NotationRenderer {
  readonly name: "notation-renderer";
}
export interface MidiInput {
  readonly name: "midi-input";
}
export interface SongImporter {
  readonly name: "song-importer";
}
export interface Exporter {
  readonly name: "exporter";
}
export interface TimeStretchPlayer {
  readonly name: "time-stretch-player";
}
export interface YouTubeLoopPlayer {
  readonly name: "youtube-loop-player";
}
export interface Clock {
  nowIso(): string;
}
export interface IdGenerator {
  next(): string;
}
