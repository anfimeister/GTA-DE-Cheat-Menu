# San Andreas — fork features

Additions specific to GTA: San Andreas – The Definitive Edition, on top of the
upstream cheat menu. All teleport/export data lives under `cheat-menu/modules/sa/`.

## Teleport categories

The Teleports tab gains collectible and mission sub-categories, nested under
collapsing headers:

- Stunt jumps
- Spray tags
- Snapshots
- Horseshoes
- Oysters
- Girlfriends+ (girlfriend homes and date spots)
- Export dock

Coordinates verified against community data (AlzKrak / Azar1K).

## Waypoint & mission-blip teleport

Buttons (and hotkeys, below) that teleport the player to the map waypoint or the
current mission blip. SA:DE exposes no SCM/API getter for blip positions, so the
coordinates are read directly from `CRadar::ms_RadarTrace` in game memory. The array
is located at runtime by signature scan (verified against SanAndreas.exe build
1.0.113.21181), never hardcoded, so it tolerates ASLR and has a good chance of
surviving game patches.

## Export mission car lists

The car spawner gains the three San Fierro docks export/import lists as their own
categories (Export List 1–3).

## Hotkeys

Shortcuts for the teleport actions, bound to Shift + F-keys. They sit on the F-keys to
stay clear of the Ctrl/sneak key, which otherwise interferes with normal gameplay.

- Shift + F6  — teleport to map waypoint      (toggle in the Teleports tab)
- Shift + F7  — teleport to mission blip       (toggle in the Teleports tab)
- Shift + F8  — save current position
- Shift + F9  — teleport to saved position
- Shift + F10 — teleport to previous position
- Shift + F11 — save current position with a name
