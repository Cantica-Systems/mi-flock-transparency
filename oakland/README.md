# Oakland County Flock archive

This is an archive of [Flock Safety transparency portals](https://transparency.flocksafety.com/) for Oakland County CLEMIS agencies. It collects the data those portals publish (search audits, share lists, and page snapshots) before that material falls off the public record. The portals keep about 30 days of search audits; after that window the same records are only available through FOIA.

- **Ferndale MI PD**
- **Troy MI PD**

Other Michigan counties are sibling folders in this repo. See the [root README](../README.md).

Latest summary: [`SNAPSHOT.md`](SNAPSHOT.md).

## Layout

```
data/
  <agency>/
    YYYY-MM.csv
    sharing_outbound.csv
    sharing_inbound.csv
    stats.csv

raw/
  <agency>/page.txt
  <agency>/page.html
```

Watched daily for a search-audit CSV: Troy MI PD.

Guessed slugs (ad-hoc probe, not daily): Oakland County MI SO, Southfield MI PD, Royal Oak MI PD, Farmington Hills MI PD, Farmington Dept of Public Safety MI, Novi MI PD, West Bloomfield Twp MI PD, Bloomfield Twp MI PD, Madison Heights MI PD, Oak Park MI DPS, Hazel Park MI PD, Huntington Woods MI DPS, Rochester MI PD, Beverly Hills MI PD, Franklin Village PD MI, White Lake Twp MI PD, Wixom MI PD, Walled Lake MI PD, South Lyon MI PD, Milford MI PD, Orchard Lake MI PD, Lake Orion MI PD. Ferndale MI PD is live but titled inactive.

Maintained by Cantica Systems (https://cantica.dev), independent of Flock Safety and of the agencies listed. See [About this archive](../README.md#about-this-archive) for trademark, ownership, privacy, accuracy, and licensing notes.
