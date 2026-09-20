# Michigan Flock transparency archive

One repo for [Flock Safety transparency portals](https://transparency.flocksafety.com/) in Michigan, grouped by county. Each portal's search audits, share lists, and page snapshots are copied here before they age off the public page (about 30 days). After that window the same records are only available through FOIA.

| County | Folder | Live portals |
|---|---|---|
| Kent | [`kent/`](kent/) | Grand Rapids PD, Kent County SO, Walker, Wyoming, Grandville, Lowell, Rockford DPS |
| Ottawa | [`ottawa/`](ottawa/) | Holland PD |
| Kalamazoo | [`kalamazoo/`](kalamazoo/) | Kalamazoo DPS, Portage PD |
| Muskegon | [`muskegon/`](muskegon/) | none yet — Muskegon PD portal is live without a public search-audit CSV |
| Allegan | [`allegan/`](allegan/) | none yet — guessed slugs kept for ad-hoc probe |
| Wayne | [`wayne/`](wayne/) | Taylor PD, Sumpter Twp PD |
| Oakland | [`oakland/`](oakland/) | none yet — Ferndale portal is inactive; Troy has no audit CSV |
| Macomb | [`macomb/`](macomb/) | none yet — guessed slugs kept for ad-hoc probe |
| Washtenaw | [`washtenaw/`](washtenaw/) | none yet — Milan portal has no public search-audit CSV |
| Genesee | [`genesee/`](genesee/) | none yet — guessed slugs kept for ad-hoc probe |
| St. Clair | [`st-clair/`](st-clair/) | none yet — guessed slugs kept for ad-hoc probe |
| Lenawee | [`lenawee/`](lenawee/) | none yet — guessed slugs kept for ad-hoc probe |

Maintained by Cantica Systems (https://cantica.dev), independent of Flock Safety and of the agencies listed. See [About this archive](#about-this-archive) for trademark, ownership, privacy, and accuracy notes.

Latest per-county summary: `kent/SNAPSHOT.md`, `ottawa/SNAPSHOT.md`, and so on.

## Layout

```
<county>/
  README.md
  SNAPSHOT.md
  data/<agency>/YYYY-MM.csv
  data/<agency>/sharing_*.csv
  data/<agency>/stats.csv
  raw/<agency>/page.txt
  raw/<agency>/page.html
```

Search-audit CSVs are partitioned by **search time**. Share lists are the current portal snapshot; `git log -p <county>/data/<agency>` is the history. Kent and Ottawa dumps were grafted from the old `*-co-mi-flock` repos (now archived).

## Columns (search audits)

| Column | Meaning |
|---|---|
| `id` | Flock search UUID |
| `userId` | redacted by the portal (`***`) |
| `searchDate` | UTC timestamp of the search |
| `networkCount` | networks/devices included in that search |
| `offenseType` | stated search reason |

## About this archive

This archive is maintained by Cantica Systems (https://cantica.dev). It is independent of Flock Safety and of the agencies listed above, and is not affiliated with, endorsed by, sponsored by, or connected to any of them.

Flock Safety® is a registered trademark of Flock Group Inc. The name appears in this repository only to identify whose product the agencies use and whose portals these records were published on. No affiliation, sponsorship, or endorsement is implied, and no claim is made to the mark. Flock's own trademark notice is at https://www.flocksafety.com/legal/trademark-notice.

### What is archived, and who owns it

The records here were published by the listed law enforcement agencies on transparency portals that Flock Safety hosts on their behalf. Under Flock's published data-ownership terms, this material is the agency's data rather than Flock's. The search audits, share lists, and summary figures are copied verbatim, with no edits to values.

The files under `raw/` are page snapshots kept for provenance, so any figure in this archive can be traced back to the page it came from. Those snapshots include the portal's own layout, styling, images, and editorial text, which remain the property of Flock Group Inc. and of the respective agencies. Nothing in this repository licenses that material to anyone.

### Privacy

The portals redact the identity of the person who ran each search, publishing `***` in the `userId` column. This archive adds nothing to what the agency published. A search-audit row carries a search id, a timestamp, a device count, and a category drawn from a fixed list. The rows hold no license plates, vehicle descriptions, search locations, case numbers, or information about the people a search concerned.

### Accuracy

This archive is provided as is, with no warranty. Every figure is whatever the portal displayed at capture time. Agencies choose which summary widgets to publish, change portal contents without notice, and sometimes rebuild a portal in a way that drops fields. A capture can also be incomplete when a portal is unreachable. A blank value means the figure was absent from the page, not that it was zero.

Read the label next to a figure before comparing agencies. Kent County Sheriff's Office counts hotlist alerts including nationwide partners, while other agencies count their own hits only. The two are not the same measure.

Coverage follows which agencies publish a portal, not which agencies operate the technology. An agency absent from this archive may still run cameras.

This is a convenience copy for research and public accountability. It is not an official record and it is not legal advice. For an authoritative or evidentiary copy, request the records from the agency under the Michigan Freedom of Information Act.

### Corrections

Agencies and members of the public who find an error can reach Cantica Systems at https://cantica.dev. Corrections and removal requests are reviewed.
