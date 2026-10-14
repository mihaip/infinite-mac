---
name: update-disk-images
description: Publish already-modified Infinite Mac disk images to their GitHub release assets and refresh the corresponding cache versions in scripts/disks.py. Use for BeOS, Mac OS, Mac OS X, NeXT, and other release-backed disks, including BeOS Infinite HD.
---

# Update Disk Images

Start with disk images whose guest changes are complete. Package and verify the
images, replace the affected release assets, and update their source URLs so the
importer downloads the new contents. Guest installation and emulator debugging
are outside this skill's workflow.

## Locate the affected assets

Work from the Infinite Mac repository root. Read `scripts/disks.py` to map each
modified image to its `Disk` definition, exact archive member name (`Disk.name`),
release tag, asset name, and ordered `urls` list. Local edited images are often in
`/Users/mihai/Developer/Retro/Infinite Mac Images/`; use the paths established by
the current task.

These release families are possibilities; derive the actual tags from the
current definitions rather than assuming these dates remain current:

| Disk family | Example release tag |
| --- | --- |
| BeOS | `beos-disk-images-2026-09-30` |
| Mac OS | `mac-os-disk-images-2025-11-30` |
| Mac OS X | `mac-os-x-disk-images-2025-08-14` |
| NeXTSTEP / OPENSTEP | `next-disk-images-2025-08-14` |
| A/UX | `aux-disk-images-2026-09-23` |

Select only images modified for this task. An OS release and its Infinite HD
asset can share a GitHub release without both needing replacement.

**Special case: BeOS Infinite HD.** This software collection is not an OS
release, but its image is also hosted in the BeOS disk-images release. For
`INFINITE_HD_BEOS`, the local source is `Images/Infinite HD (BeOS).dsk`, the ZIP
member is `Infinite HD (BeOS).dsk`, and the release asset is
`Infinite.HD.BeOS.dsk.zip`. Publish it through the same workflow and bump its own
URL in `scripts/disks.py`; updating it does not require replacing the BeOS OS
images. Do not assume that other Infinite HD variants have release assets:
inspect their current definitions and the import pipeline first.

## Back up and package

- Confirm the guest shut down cleanly and no emulator is writing to the edited
  image. Packaging is a read-only operation on that image.
- Use `gh` against `mihaip/infinite-mac`. Save release metadata and download the
  exact affected original assets into a durable backup directory outside the
  working tree before replacing anything. Keep originals separate from staged
  replacements. Useful commands, with variables set for the selected release:

  ```sh
  gh release view "$tag" --repo mihaip/infinite-mac --json tagName,url,assets
  gh release download "$tag" --repo mihaip/infinite-mac --pattern "$asset" --dir "$backup_dir"
  ```

- Record original asset IDs, names, sizes, SHA-256 digests, and labels. Verify
  downloaded originals against GitHub's digests when available. If a pre-edit
  image backup exists, compare it with the original ZIP member to establish
  provenance; investigate differences before assuming it is the same base.
- Inspect the original ZIP's member list. Preserve the external asset name and
  exact internal disk filename: `Disk.read()` calls `zip.read(self.name)`.
  Preserve ancillary members such as `__MACOSX/._…` and relevant archive metadata;
  replace the disk member's contents with the edited image. Use ZIP Deflate and
  preserve the disk bytes; do not reconstruct the guest filesystem from files.
- **Split assets:** Some definitions, including Mac OS X 10.4.11, list `.zip.0`
  and `.zip.1` URLs. Splitting keeps each asset under
  [GitHub's 2 GiB release asset limit](https://docs.github.com/en/enterprise-cloud%40latest/repositories/releasing-projects-on-github/about-releases).
  `Disk.path()` concatenates those bytes in list order before opening the ZIP.
  Reassemble the original parts to inspect it, build one updated ZIP, then split
  it using the existing naming/order, keeping every part below the limit. These
  are pieces of one ZIP, not independent ZIP archives.
- Verify each staged ZIP by streaming its disk member through SHA-256 and
  comparing it with the edited source image; reading to EOF also checks the ZIP
  member's CRC. Check ancillary members are preserved. For split assets, verify
  the reassembled staged archive and hash each part separately. Save a manifest
  mapping source images, archive members, asset names, sizes, and hashes.

## Replace and verify the published assets

Use the current task's publishing authorization. A request only to prepare
archives does not authorize uploading them. A request to update the release
assets authorizes replacing those specified assets without another confirmation.

Before uploading, check that the selected remote assets still match the saved
metadata. Resolve intervening changes rather than overwriting them blindly.
Upload the explicit staged files, preserving any existing display labels:

```sh
gh release upload "$tag" --repo mihaip/infinite-mac --clobber "$staged_asset"
```

`--clobber` deletes the old asset before uploading its replacement, which is why
the original downloads must already be backed up. Preserve the release tag,
notes, and unrelated assets.

Fetch release metadata again. Require every replacement to be `uploaded`, have
the expected name and size, and have a GitHub SHA-256 digest matching its staged
file. If GitHub does not expose a digest, download the replacement into a fresh
directory and compare its hash. Confirm unaffected asset IDs and digests remain
unchanged, and save the verification results alongside the backups.

If an upload fails, inspect the remote state first. Retry only the missing or
failed replacement once after diagnosing the error; do not clobber an already
verified upload again. On another failure or a content mismatch, retain backups,
report the exact incomplete assets, and leave their cache versions unchanged.

## Refresh the importer cache

After successful upload verification, update every affected URL in
`scripts/disks.py`: add `?v=2` if it has no version, otherwise increment the
existing numeric `v`. Preserve other query parameters. For a split ZIP, advance
the version on every part URL together. Leave unrelated disk definitions alone.

This is necessary even though the GitHub asset filename stays the same:
`scripts/urls.py` hashes the full URL for its local cache key, and `Disk.path()`
also hashes the ordered URLs when caching a concatenated image. Replacing the
remote asset alone leaves existing importer caches pointing at the old bytes.

Review the diff, check Python syntax without importing the download pipeline,
and run `git diff --check`. Report the updated disks, release link, verification
result, backup location, and changed definitions. Commit only if requested.
Rebuilding served chunks with `import-disks`, syncing them, and deploying the
site are further steps when included in the user's requested scope; publishing
source ZIPs and bumping their URLs does not itself update the live site.
