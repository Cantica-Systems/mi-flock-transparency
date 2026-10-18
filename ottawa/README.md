# Ottawa County Flock archive

This is an archive of [Flock Safety transparency portals](https://transparency.flocksafety.com/) for Ottawa County agencies. It collects the data those portals publish (search audits, share lists, and page snapshots) before that material falls off the public record. The portals keep about 30 days of search audits; after that window the same records are only available through FOIA.

- **Holland PD**, `https://transparency.flocksafety.com/holland-mi-pd`

Since 24 September 2026 that portal has not inlined a search-audit CSV. The page links a monthly file published by the City of Holland. The capture follows the link on the page, and the URL fetched for the latest snapshot is [`raw/holland-city-pd/audit.url`](raw/holland-city-pd/audit.url). As of 18 October 2026 it is [Holland PD Audit Log](https://www.cityofholland.com/DocumentCenter/View/9614/Holland-PD-Audit-Log) (CivicPlus document 9614, September 2026).

[`raw/holland-city-pd/audit.csv`](raw/holland-city-pd/audit.csv) is that city file. Its columns are `ID`, `Org Name`, `Total Networks Searched`, `Time Frame`, `Reason`, `Search Time`, `Search Type`, `Text Prompt`, and `Moderation` (a leading space follows each comma in the header). [`data/holland-city-pd/YYYY-MM.csv`](data/holland-city-pd/) keeps the five columns below. Rows taken from the city file use those columns: `id` is `ID`, `searchDate` is `Search Time` in UTC with no fractional seconds, `networkCount` is `Total Networks Searched`, `offenseType` is the category before ` - ` in `Reason`, and `userId` is blank. Rows already stored from the portal CSV are left as they were. `Search Type`, `Time Frame`, and the free-text half of `Reason` are only in `audit.csv`.

Kent County agencies are in [kent-co-mi-flock](../kent/).

Latest summary: [`SNAPSHOT.md`](SNAPSHOT.md).

## Layout

```
data/
  holland-city-pd/
    YYYY-MM.csv              search audits, append-only, deduped on Flock id
    unknown.csv              no Flock id, or searchDate that didn't parse (rare)
    sharing_outbound.csv     agencies granted access to this agency’s data
    sharing_inbound.csv      agencies sharing their data with this agency
    stats.csv                portal totals, one row per snapshot

raw/
  holland-city-pd/page.txt   visible portal text; git history is the series
  holland-city-pd/audit.csv  search-audit file linked from the portal
  holland-city-pd/audit.url  URL that file was fetched from
```

Search-audit CSVs are partitioned by **search time**. A search from 31 August lives in `2026-08.csv` even if it first appeared here in September. Ids already stored are left as-is.

Share lists are the current portal snapshot. `git log -p data/holland-city-pd/sharing_outbound.csv` shows when partners were added or removed.

Agencies pick which summary widgets to publish. A blank `stats.csv` cell (shown as a dash in [`SNAPSHOT.md`](SNAPSHOT.md)) means that figure was not on the page. The public search-audit CSV is the record this archive is built from; a portal with no audit file is not a completed snapshot.

Guessed slugs (ad-hoc probe, not daily): Ottawa County MI SO, Grand Haven MI DPS, Zeeland MI PD, Grand Valley State University MI.

## Columns (search audits)

| Column | Meaning |
|---|---|
| `id` | Flock search UUID |
| `userId` | redacted by the portal (`***`) |
| `searchDate` | UTC timestamp of the search |
| `networkCount` | networks/devices included in that search |
| `offenseType` | stated search reason |

Maintained by Cantica Systems (https://cantica.dev), independent of Flock Safety and of the agencies listed. See [About this archive](../README.md#about-this-archive) for trademark, ownership, privacy, accuracy, and licensing notes.
