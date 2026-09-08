# ResEdit icons

These are ResEdit 2.1.3's original resource type and application icons, extracted
from `.rsrc/ResEdit` in `Library/Developer/ResEdit.zip`, the archive used to build
Infinite HD. Artwork is by Apple Computer, Inc.

Run `uv run scripts/extract-resedit-icons.py` to regenerate them. The 32×32 sprite
cells are indexed by resource type in `types.json`, with 16 cells per row.
Both appearances use the richest original icon available: `icl8`, then `icl4`,
then the monochrome `ICON`. The application icon uses the original `ICN#` mask.
Unknown types use ResEdit's original `????` icon.

Guest resource thumbnails retain their actual colors in either appearance.
