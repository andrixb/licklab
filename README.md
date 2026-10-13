# LickLab

Store jazz licks and try them over real standards. Local-first PWA + thin
Cloudflare Worker API + D1 synced copy. Multi-user with strict per-user
isolation; fully usable offline at the instrument.

UX takes cues from realbook.site (lead sheets, transposition, band playback)
and earbop.app — studied for UX only.

## Legal reasoning (summary)

- **No scraping:** realbook.site forbids automated bulk download/redistribution.
  LickLab links out to score pages (`Song.externalUrl`) and imports only files
  you provide. Bundled tunes are public-domain or self-written.
- **No YouTube extraction:** IFrame playback + speed/A-B loops only; no audio
  access, download, or caching (YouTube API ToS).
- **Cloud stores little:** D1 holds licks, chord changes + metadata, loop
  markers. Imported scores/MusicXML melodies and all audio stay in your browser
  (IndexedDB/OPFS), never uploaded — so the cloud never redistributes
  copyrighted scores or recordings.
- **Samples:** VSCO 2 CE double bass (CC0), Virtuosity Drums (CC0), Salamander
  piano (CC BY 3.0 — see in-app attribution page). Full terms in `docs/legal.md`.

## Quick start

```bash
npm ci
npm run dev        # app on :5173 (/api proxied to :8787)
npx wrangler dev   # Worker + local D1
npm run typecheck && npm run lint && npm run test && npm run build
```

See `AGENTS.md` for all commands and `docs/STATUS.md` for current state.
