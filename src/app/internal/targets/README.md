# Emulator preview targets

`/_emulators` uses these PNGs to recognize a successful boot and pause the guest. Each file is named after a preview's machine, disk, and optional variant. The same case in several presets shares its target.

To create or update a target:

1. Run the preview and wait for the idle desktop. If it matched an older target, choose **Resume** from its menu to interact without immediately matching again.
2. Choose **Save Target Image…**. This pauses the guest and freezes its latest screen in a lightbox.
3. Drag a rectangle or enter exact coordinates. Include distinctive content that appears after boot, such as desktop icons or a startup application. Exclude clocks, blinking cursors, animated indicators, and changing text.
4. Choose **Save PNG**, then move the downloaded file into this directory, replacing the file with the same name. Keep the suggested filename.
5. Restart the preview to verify it matches on a fresh boot.

The file contains only the selected rectangle. A standard PNG `tEXt` chunk named `InfiniteMacTarget` contains JSON with `x`, `y`, `screenWidth`, and `screenHeight`. This keeps the target and its position together in one replaceable file. Image editors or optimizers that strip PNG metadata will remove the coordinates; use the capture dialog to replace targets instead.

Comparison is exact for all RGB pixels in the rectangle, at the same screen resolution; alpha is ignored. It runs at most four times per second (to reduce overhead) per active
guest and stops at the first different pixel. Missing or invalid targets are shown explicitly.

The governor admits one guest every 750 ms, with a default limit of half the browser's reported logical cores, clamped to 4–8 (4 when unavailable). Override the limit and boot timeout using the toolbar. The default five-minute budget allows slow PowerPC and NeXT boots to finish. A match, timeout, exit, error, or manual pause releases the slot. Timeouts and failures dispose of the guest and retain its last screen for inspection and target capture. A guest without a reference is marked **Needs target**, rather than counted as a failed match. Use **Start** to retry.
