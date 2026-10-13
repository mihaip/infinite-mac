# Manifest Guidelines

## Manifest Shape

Floppy manifests:

```json
{
    "src_url": "https://archive.org/download/item/file.moof",
    "is_floppy": true
}
```

CD-ROM manifests:

```json
{
    "src_url": "https://archive.org/download/item/file.iso",
    "cover_image": "https://archive.org/download/item/front.jpg"
}
```

Optional fields seen in existing manifests:

- `cover_image_type`: use only when clearly appropriate, such as known square box art.
- `mode`: preserve or add only when there is evidence the selected CD image needs it, such as existing bin/raw images using `MODE1/2352`. The info helper includes `cue_sheet` text for available CUE files, including archive members when using `--list-archive-members`.
- `self_hosted`: opt into hosting media locally/R2 when requested. Archives are extracted during import; use `src_member` if they contain multiple media candidates.
- `data_offset` and optional `data_size`: expose a filesystem within the decoded CD, in logical bytes after sector conversion. Establish the filesystem base and size from its partition map/volume geometry; the original hosted media stays intact.
- `platform`: use `"BeOS"` for BeOS guest media or `"NeXT"` for NeXT media. The default is `"Macintosh"`; each guest drawer shows only entries matching its platform.
- `is_floppy`: use only for floppy/diskette images.

## Image Selection

- Prefer direct mountable images over archives. Common good extensions: `.moof`, `.dsk`, `.img`, `.iso`, `.toast`.
- For System Software, prefer generic full installation CDs. Do not add machine-specific installation/restore CDs or update-only discs unless explicitly requested.
- Bundled titles such as "Install Me First" can contain generic installers. Establish machine restrictions from credible documentation or requested inspection of the disc contents, rather than the title alone.
- If the script misses a useful media extension, update `scripts/internet-archive-item-info.py`; do not work around it with one-off CLI arguments.
- For floppy drawer entries, use `.moof` when available.
- If an item has multiple floppy images, create one manifest per image and suffix display names with `(Disk 1)`, `(Disk 2)`, etc.
- For multi-disc optical sets, follow the existing convention and use `(Disc 1)`, `(Disc 2)`, etc.
- Prefer `.iso` over bin/cue when both are available unless the bin/cue pair is known to preserve required audio/data layout.
- If using a raw `.bin` CD image, check nearby existing manifests for whether `mode` is needed.
- Do not assume that a CUE's initial `INDEX 01 00:02:00` means the BIN includes 150 leading sectors. Some dumps already start with data sector zero; establish the actual file layout before trimming any bytes.
- BeOS PowerPC guests require the big-endian BFS volume on hybrid discs. An x86-only little-endian BFS volume does not mount in these guests; application architecture and filesystem compatibility are separate checks. ISO9660 and HFS discs can also contain BeOS software.

## Cover Images

- CD-ROM entries should include `cover_image` when the archive item has a plausible cover candidate.
- Start with `best_cover_image` from `scripts/internet-archive-item-info.py`.
- If the best candidate is visibly wrong by filename, choose a better `cover_image_files` URL. Prefer names containing `front`, `cover`, `artwork`, `disc`, `disk`, or `cd`; avoid `back`, `rear`, and thumbnails unless they are the only useful option.
- Do not download, inspect, or otherwise analyze cover images separately. The script reports `width`, `height`, and `aspect_ratio` for every cover candidate; use those fields for decisions such as `cover_image_type: "square"`.
- Floppy entries normally omit cover images.
- Do not add `cover_image_inset`.

## Naming

- Use friendly display names, not raw Internet Archive titles.
- Remove collection suffixes such as `(moof-a-day collection)`.
- Convert leading version notation from `v1.0` to `1.0`, for example `Microsoft Excel 1.0`.
- Remove internal release/revision identifiers, for example `Zork III (r17)` can jus tbe `Zork III`.
- Keep punctuation readable and compatible with existing filenames. The repo uses `﹕` instead of `:` in committed filenames when a colon is needed (to avoid reserved character issues).

## Categories

Use existing `CD-ROMs/` folders when they fit:

- `Games`: games, entertainment, simulations, text adventures.
- `Developer`: SDKs, compilers, WWDC/developer CDs, programming tools.
- `Developer/Apple Developer CDs`: Apple Developer CD Series entries.
- `Graphics`: graphics, fonts, drawing, image tools.
- `Magazines`: magazine cover discs.
- `Multimedia`: interactive media, demos, music/video/art experiences.
- `Productivity`: spreadsheets, databases, office/productivity software.
- `Publishing`: page layout, print, desktop publishing.
- `Reference`: encyclopedias, bookshelves, reference works.
- `System Software`: operating systems, installers, system software.
- `System Software/Compilations`: system recovery or OS anthology sets.
- `Compilations`: general software collections and sampler discs.

Create a new category only when none of the existing folders fits. Mention newly-created categories in the final response.
