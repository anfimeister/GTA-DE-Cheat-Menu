# Fork features

Changes in this fork beyond upstream mateusz-korbut/GTA-DE-Cheat-Menu.

## Engine-wide (all games)

- **Crash guard** — per-frame player/game writes are skipped while the player isn't in
  control (loading/cutscenes), where the ped handle is invalid and writes crash the game.
- **CLEO Redux 1.5.0 loader** — `mod.json` permission manifest so the menu loads on 1.5.0.
- **Density resync** — ped/car density sliders snap back to what the game actually uses
  after it resets them on load.

## Per-game features

- San Andreas → [san-andreas.md](san-andreas.md)
