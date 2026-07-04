#!/usr/bin/env bash
# Deploy the cheat-menu mod from this repo into the live GTA SA:DE CLEO folder.
# Source of truth = this repo's cheat-menu/ subdir. The game reads from the F: drive.
#
#   ./deploy.sh            deploy (overlay; never deletes)
#   ./deploy.sh -n         dry-run (show what would change)
#   ./deploy.sh --delete   deploy AND remove game-dir files no longer in the repo
#
# config.ini is excluded both ways: it's the player's live runtime settings.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$REPO_DIR/cheat-menu/"
DST="/mnt/f/SteamLibrary/steamapps/common/GTA San Andreas - The Definitive Edition/Gameface/Binaries/Win64/CLEO/cheat-menu/"

DRY=""; DEL=""
for a in "$@"; do
  case "$a" in
    -n|--dry-run) DRY="--dry-run" ;;
    --delete)     DEL="--delete" ;;
    *) echo "unknown arg: $a" >&2; exit 2 ;;
  esac
done

[ -d "$DST" ] || { echo "Game CLEO dir not found: $DST" >&2; exit 1; }

echo "Deploy ${DRY:+(DRY-RUN) }${DEL:+(--delete) }"
echo "  from: $SRC"
echo "    to: $DST"
echo
# -rlt: recurse, copy symlinks as symlinks, preserve mtimes. No -p/-g/-o: perms/owner
# are meaningless on the Windows DrvFs mount and only cause churn.
# --checksum: compare by content, not size+mtime, so only genuine changes transfer
# (mtimes always differ across the ext4<->DrvFs boundary otherwise).
rsync -rlt --checksum --itemize-changes $DRY $DEL \
  --exclude 'config.ini' \
  --exclude '.git' \
  "$SRC" "$DST"
echo
echo "Done.${DRY:+ (nothing written — dry run)}"
if [ -z "$DRY" ]; then echo "Reload CLEO scripts in-game (or restart) to pick up changes."; fi
exit 0
