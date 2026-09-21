# Kent County Flock archive

This is an archive of [Flock Safety transparency portals](https://transparency.flocksafety.com/) for Kent County agencies. It collects the data those portals publish (search audits, share lists, and page snapshots) before that material falls off the public record. The portals keep about 30 days of search audits; after that window the same records are only available through FOIA.

- **Grand Rapids City PD**, `https://transparency.flocksafety.com/grand-rapids-mi-pd`
- **Kent County Sheriff’s Office**, `https://transparency.flocksafety.com/kent-county-mi-so`
- **Walker PD**, `https://transparency.flocksafety.com/walker-mi-pd`
- **Wyoming PD**, `https://transparency.flocksafety.com/wyoming-mi-pd`
- **Grandville PD**, `https://transparency.flocksafety.com/grandville-pd-mi`
- **Lowell PD**, `https://transparency.flocksafety.com/lowell-mi-pd`
- **Rockford Dept of Public Safety**, `https://transparency.flocksafety.com/rockford-dept-of-public-safety-mi`

Latest summary: [`SNAPSHOT.md`](SNAPSHOT.md).

## Layout

```
data/
  grand-rapids-city-pd/
    YYYY-MM.csv              search audits, append-only, deduped on Flock id
    unknown.csv              no Flock id, or searchDate that didn't parse (rare)
    sharing_outbound.csv     agencies granted access to this agency’s data
    sharing_inbound.csv      agencies sharing their data with this agency
    stats.csv                portal totals, one row per snapshot
  kent-county-so/
    …same files…
  walker-city-pd/
  wyoming-city-pd/
  grandville-city-pd/
  lowell-city-pd/
  rockford-dps/

raw/
  <agency>/page.txt          visible portal text; git history is the series
  <agency>/page.html         full HTML as served, including the inlined audit CSV
```

Search-audit CSVs are partitioned by **search time**. A search from 31 August lives in `2026-08.csv` even if it first appeared here in September. Ids already stored are left as-is.

Share lists are the current portal snapshot. `git log -p data/kent-county-so/sharing_outbound.csv` shows when partners were added or removed.

Agencies pick which summary widgets to publish. A blank `stats.csv` cell (shown as a dash in [`SNAPSHOT.md`](SNAPSHOT.md)) means that figure was not on the page. The public search-audit CSV is the record this archive is built from; a portal with no audit file is not a completed snapshot.

Guessed slugs (ad-hoc probe, not daily): Kentwood MI PD, East Grand Rapids MI PD, Plainfield Twp MI.

## Columns (search audits)

| Column | Meaning |
|---|---|
| `id` | Flock search UUID |
| `userId` | redacted by the portal (`***`) |
| `searchDate` | UTC timestamp of the search |
| `networkCount` | networks/devices included in that search |
| `offenseType` | stated search reason |

Maintained by Cantica Systems (https://cantica.dev), independent of Flock Safety and of the agencies listed. See [About this archive](../README.md#about-this-archive) for trademark, ownership, privacy, accuracy, and licensing notes.
