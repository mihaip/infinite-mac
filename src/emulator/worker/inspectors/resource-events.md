# Resource load events

The Resources drawer starts with a reverse-chronological event stream. Each event
owns the bytes captured at that observation; inspecting it never reads the guest
again. The second tab builds a catalog from the first retained capture for each
file/type/ID. It describes captured history, not current residency.

## Capture boundaries

Snow observes entry and return for Resource Manager traps (including open, get,
load, release, detach, close, and ResourceDispatch), common Toolbox consumers
(pictures, icons, patterns, cursors, dialogs, alerts, windows, controls, and menus),
and the indirect loader vector at low memory $07F0. Exact trap opcodes include
the Toolbox auto-pop variants ($0400). Return matching uses PC and SP, retaining
entry registers across nested calls and process switches. The Snow protocol is
documented in `snow/frontend_im/docs/trap-callbacks.md`.

Snow copies dirty RAM pages at every observation, before further guest
instructions. The frontend applies each payload to its mirror in order and calls
JS immediately, before applying the next payload. Consequently the resource bytes
come from the observation even if the guest has already resumed. Ordinary memory
updates share this ordered stream; none may be dropped. Periodic publication runs
independently of whether an ordinary Memory event happened to arrive.

Basilisk II uses its existing post-vCheckLoad compatibility hook for individual
loader events. It also observes the same trap entries and returns in the 2021 UAE
interpreter. JS reads RAM synchronously before the next guest instruction; a
separate RAM mirror is unnecessary. Both cores disable the additional execution
observers when the inspector is unsubscribed or paused.

## What an event means

Capture permanently keeps the **first successful capture per source file/type/ID**
for the emulator session. A **loader callback** means that first capture happened
on a loader return; it is not proof that the OS reread the disk. **First observed**
means a map scan discovered the resource, including resources already resident
when capture started. Later reloads, mutations, process switches, and handle
relocations do not replace its bytes or create another event.

The worker owns a set of captured identities independently of event retention
and the map cache. It checks that set in the map reader, before reading a known
resource's name, handle, heap header, or payload. Only a completed capture adds an
identity: a purged, invalid, or otherwise unavailable resource can still be captured
later. HFS identity is volume name, parent directory ID, and file name; where FCB
metadata is unavailable, the fallback includes map handle, file reference, and
name. Reopening an HFS file under another handle still matches. The set persists
across pause/resume and drawer closure, and resets with the emulator worker.
Evicting an event or cached map never makes an old resource eligible again.

Direct loader attribution validates the reference entry against the handle, walks
map headers to find its owner, then decodes only that resource and its companion
icon mask. It does not enumerate unrelated resources. Other boundaries and the
periodic fallback still scan the current chain. They reuse unchanged maps after
comparing map bytes and file identity, plus master pointers and heap headers
for resources that have not yet been captured. Changes to those pointers can
still trigger discovery; already captured handles need no residency monitoring. The map cache
holds at most 1,024 maps / 8 MiB, and is committed only after a successful walk.
A skipped, validated loader reference is not treated as missing: it must not
trigger a full fallback scan or another unattributed event. A valid loader handle
whose map cannot be found still yields bytes, labeled “Source unavailable.”
These observations deduplicate by executing process, type/ID, reference address,
handle, and heap allocation signature, since a file identity is unavailable.
Distinct unknown allocations remain separate; reuse of the exact same allocation
cannot be distinguished with this fallback identity. Other malformed or ROM-backed handles do not
discard valid events from the same scan. File names and HFS paths use the existing
FCB reader and disk catalog resolver. The application name is CurApName: the
process executing at the observation, which may be a background process. It is
not necessarily the foreground application.

The scan borrows complete heap-block views only for the duration of the call.
New events copy their data and any available icon mask before returning. A new
color icon still reads its companion mask even if that mask already has an event. Captured
bytes are immutable thereafter. Events are batched for publication (normally
within 500 ms, earlier at 64 entries or 4 MiB). The UI virtualizes rows, anchors
scrolling to the visible event when new entries arrive, and retains a selected
event even if it ages out of history. PICT and bitmap thumbnails use the existing
renderers; other types show text, decoded fields, or a byte excerpt. Details reuse
the existing graphical, structured, JSON, and virtualized hex views.

There is no display-only deduplication option or parallel filtered event cache.
Repeated loads stop in the worker and never copy or publish another payload. The
browser catalog is built only while its tab is selected. The capture identity
sets retain small keys for the session, not additional resource byte copies.

This prototype favors coverage. It scans up to 1,024 maps / 200,000 references and
256 MiB per boundary, with the existing 16 MiB valid-heap-block safety limit.
The worker no longer runs the old snapshot byte cache alongside event capture;
periodic snapshot messages now contain only a heartbeat and execution context.
The UI retains at most 50,000 events / 256 MiB of payloads and explicitly reports
older discarded entries. The catalog is reconstructed from that retained window.
The five-minute collapsed-drawer grace period still applies; Pause stops capture.

This is not a trace of every memory read. Direct calls to saved trap handlers can
bypass A-line observation; custom loading that bypasses both the Resource Manager
and the watched vector can be missed. ROM resource blocks are not exposed by the
current RAM reader. A resource loaded and discarded entirely inside unobserved
code can evade the periodic fallback. Unusual stack unwinding can defeat return
matching; pending calls are bounded to 4,096 and cleared on reconfiguration.

## Performance checks (2026-09-08)

The original event prototype decoded every map on every observation and also ran
the earlier snapshot collector every 500 ms. The UI rebuilt the history catalog
even while the event stream was selected. Those duplicate paths have been removed.
HFS directory paths were already cached; resolution is now requested only for
files that actually emit an event. Trap registrations remain enabled to discover
new resources; repeated loads are rejected once their identity is available in JS.

Before permanent first-capture deduplication, a Node microbenchmark with one map
containing 1,000 resident resources, after
100 warmup iterations and over 1,000 measured iterations, gave:

| Operation | Time for 1,000 calls | Guest-memory reads per call |
| --- | ---: | ---: |
| Full map decode (previous loader path) | 489 ms | 10,020 |
| Targeted loader capture, including the byte copy | 4.5 ms | 32 |
| Unchanged-map safety scan | 198 ms | 3,020 |

These isolate JS parsing/capture; they do not measure game frame rate, Snow's
memory-delta transport, or UI rendering. The logic tests include the 1,000-resource
fixture and check bounded read counts, rather than flaky elapsed-time thresholds.

Snow also previously cloned the complete register file (including software FPU
values) before every instruction while observing calls. It now borrows registers
and clones them only for actual observations. Non-A-line opcodes bypass trap
lookup, registered traps use binary search, and a counting PC filter bypasses
pending-return traversal when no pending call can match. Filter collisions still
use the original exact PC/SP checks. Dirty memory pages are still copied at every
registered boundary; this preserves transient data and remains a cost.

In a live System 7.1 / Snow IIcx idle Finder check, the speed readout was about
1.5× with the initial optimized JS path and about 2.4× after eliminating the
per-instruction register clone. Before enabling capture the same fresh guest
reported about 3.0×. These are spot checks of emulation throughput, not an
Apeiron gameplay benchmark.

Permanent first-capture deduplication additionally removes repeat payload reads,
copies, worker-to-UI event transport, and retention churn. Unchanged-map safety
scans no longer revisit heap headers of successfully captured resources. The
remaining Snow callback and dirty-page mirror costs precede JS attribution;
this change does not suppress those observations or alter either core's hooks.

## Validation

`npm run test:inspector` includes repeated loader calls, immutable bytes after
purge/release, process switches, relocation, catalog reconstruction, retention,
large payloads, unavailable provenance, permanent first-capture identity,
cached-map invalidation, targeted reads, and invalid-handle isolation. Repeat-load
tests verify zero resource payload/handle reads and no repeated path lookup or
UI publication. Previously captured companion masks remain available to new color
icons, failed reads can be retried, and map/event eviction preserves deduplication.
The transient
PICT tests drive both core-facing callback paths and destroy the live resource
before the first periodic scan. They are protocol/logic tests, not UI tests or
claims that a real guest executed a particular trap.

Snow's `execution_callbacks` unit tests exercise nested returns, independent
process stacks, exact vector return stacks, saved entry registers, and auto-pop.
Both emulator Wasm builds must be rebuilt and imported when their hooks change.

Manual scenarios, on a fresh `resedit=true&saved_hd=false` guest:

1. System 7.1, Snow IIcx without MODE32: start capture, then open Infinite HD →
   Control Panels & Extensions → Aaron → Aaron Docs in TeachText. Filter “Aaron”
   or “PICT”. Inspect PICT 1000 and its 168 × 73 color logo, then close the document
   and confirm that the same event and bytes remain. Reopening it should leave the
   original event intact and add no duplicate. The first capture must not rely on
   the periodic scan to catch the short-lived file.
2. Launch an Ambrosia game such as Maelstrom. Check that startup produces distinct
   picture/icon/string events with the game as the executing application and its
   resource file as source. Start a game, quit, and inspect earlier event details.
3. Repeat with Basilisk II, System 7.1 and Mac OS 8.1. Toggle Pause, close/reopen the
   drawer, and use the popout. Scroll away from the newest events during activity;
   incoming entries should leave the visible event and selection stable.

During this implementation Snow produced the new live stream before the host
locked. The actual Aaron Docs PICT was separately passed through both callback
paths using a simulated map, destroyed in guest RAM, and decoded from the retained
event with the built Wasm renderer: 7,164 bytes, 168 × 73, identical payloads.
The user subsequently confirmed Apeiron resource loads and graphical event
contents in the live Snow guest. After the performance changes, live Finder
capture, first-load filtering, and browser details were checked again. The
optimized pipeline's Aaron Docs coverage is still exercised by the transient
callback fixtures; no new full live Aaron Docs run was completed in this pass.

After permanent first-capture deduplication, all 52 inspector logic tests passed.
A fresh System 7.1 / Snow IIcx session remained at 171 events while idle. Finder
activity discovered seven additional resources (including loader-return events);
repeating it left the count at 178. Opening CODE 11 still displayed its retained
4,874-byte payload in the detail view. These checks exercise the live UI manually;
no UI tests were added.
