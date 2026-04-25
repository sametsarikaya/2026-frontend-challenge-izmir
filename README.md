# Case Board -- Izmir Investigation

> Jotform Frontend Hackathon 2026 | Samet Sarıkaya

A forensic-themed investigation dashboard that visualizes five Jotform data
sources (check-ins, messages, sightings, personal notes, anonymous tips) and
lets the user track suspects, browse evidence, and reconstruct Podo's last
known route on a map.

## Running locally

```bash
cd 2026-frontend-challenge-izmir
cp .env.example .env    # then fill in values (see below)
npm install
npm run dev
```

The app opens at `http://localhost:5173` (or the next free port).

## Environment variables

Create a `.env` file in the project root. The app needs Jotform API keys and
five form IDs:

```
VITE_JOTFORM_KEYS=<comma-separated API keys>
VITE_FORM_CHECKINS=<form ID>
VITE_FORM_MESSAGES=<form ID>
VITE_FORM_SIGHTINGS=<form ID>
VITE_FORM_NOTES=<form ID>
VITE_FORM_TIPS=<form ID>
```

`VITE_JOTFORM_KEYS` accepts multiple keys separated by commas. The app tries
each key in order and falls back to the next one when a key hits its quota.
All variables are required. The `.env` file is git-ignored and must never be
committed.

## Pages

- `/` -- Dashboard. Three-column layout: filters and people list on the left,
  virtualized timeline in the center, record detail on the right.
- `/timeline` -- Timeline. Chronological feed of all events attributed to Podo,
  filterable by source type (check-ins, messages, sightings, notes, tips) with
  per-type counts.
- `/map` -- Investigation Map. All geo-tagged records plotted on a Leaflet map
  with custom markers per source type, sidebar list and detail panel.
- `/route` -- Route Flow. Chronological stop-by-stop reconstruction of the
  most suspicious person's movements, shown as a polyline on the map.
- `/suspects` -- Suspects. Ranked list of persons of interest with suspicion
  scores and linked evidence records.

## Architecture

Three-page SPA sharing a single `InvestigationModel` built from five Jotform
form APIs. URL is the single source of truth for all selection, filter, and
search state via `useSearchParams`.

Data pipeline:

```
fetchAllSources (multi-key fallback, Promise.allSettled, AbortSignal)
  -> normalizeSubmission (per-source field mapping)
  -> canonicalizeLocations (diacritic-aware merge)
  -> resolveIdentities (union-find fuzzy clustering, Levenshtein scoring)
  -> scorePeople (suspicion signals)
  -> buildHighlights
  -> buildInvestigationModel (search index, related records, geo index)
```

## Stack

- Vite + React 19 + TypeScript (strict)
- Tailwind CSS + CSS custom properties (design tokens)
- react-router-dom v7
- react-leaflet + leaflet
- react-virtuoso

## Trade-offs

- **No global store** -- all state in URL + local `useMemo`. Simple, but deep
  prop drilling in RecordDetail. Would add Zustand for more than five levels.
- **Client-side fuzzy matching** -- runs in main thread on every keystroke but
  is fast enough (under 5 ms) for the dataset size. A web worker would be
  cleaner at scale.
- **Leaflet over MapLibre** -- simpler API, sufficient for the dataset, but
  not vector-tile capable.
- **Location canonicalization** -- frequency-based best spelling after
  diacritic stripping. Works for this dataset; a production system would use
  a geocoding service.
