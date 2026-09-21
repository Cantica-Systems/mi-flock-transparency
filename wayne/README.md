# Wayne County Flock archive

This is an archive of [Flock Safety transparency portals](https://transparency.flocksafety.com/) for Wayne County CLEMIS agencies. It collects the data those portals publish (search audits, share lists, and page snapshots) before that material falls off the public record. The portals keep about 30 days of search audits; after that window the same records are only available through FOIA.

- **Taylor MI PD**, `https://transparency.flocksafety.com/taylor-mi-pd`
- **Sumpter Twp MI PD**, `https://transparency.flocksafety.com/sumpter-twp-mi-pd`

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

Watched daily for a search-audit CSV: Livonia MI PD, Highland Park MI PD.

Guessed slugs (ad-hoc probe, not daily): Dearborn MI PD, Dearborn Heights MI PD, Westland MI PD, Canton Township MI PD, Inkster MI PD, Garden City MI PD, Redford Twp MI PD, Romulus MI PD, Van Buren MI PD, Huron Township MI PD, Melvindale MI PD, Hamtramck MI PD, Harper Woods MI DPS, Grosse Pointe Woods MI DPS, Grosse Pointe Park MI DPS, Plymouth MI PD, Plymouth Township MI PD, Northville MI PD, Northville Twp MI PD, Detroit MI PD.

Maintained by Cantica Systems (https://cantica.dev), independent of Flock Safety and of the agencies listed. See [About this archive](../README.md#about-this-archive) for trademark, ownership, privacy, accuracy, and licensing notes.
