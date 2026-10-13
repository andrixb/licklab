# ADR-015: Default lick license — CC BY 4.0

Status: Proposed (pending legal review of docs/legal.md before launch).
Context: Short original phrases sit near the edge of copyrightability; a
clear, permissive default plus explicit contributor terms reduces risk and
matches the community goal. GPL code (ADR-009) + CC content is compatible
(licenses are for the data, code stays GPL).
Decision: Authors pick a license at submission from a small allowlist
(default **CC BY 4.0**; alternatives CC0, CC BY-SA 4.0, "private — all
rights reserved" for unlisted/private). Contributor terms (draft in
docs/legal.md): contributor owns/has rights to the phrase, grants LickLab
the license needed to display/transpose/play it, and the chosen license to
other users. Performer/source fields are labeled contributor claims.
Takedown flow (docs/moderation.md) applies regardless of license.
Consequences: license string stored per lick + in exports; changing
defaults later = migration + re-consent, not silent relicensing.
