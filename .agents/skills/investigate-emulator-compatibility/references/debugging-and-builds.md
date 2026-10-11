# Builds and guest inspection

## Native versus browser

Read the core's `AGENTS.md` and inspect configured build trees before compiling.
For the maintained DingusPPC checkout, from the Infinite Mac root:

```sh
cmake --build dingusppc/build-xcode --config RelWithDebInfo -j 8
```

The native executable is
`dingusppc/build-xcode/bin/RelWithDebInfo/dingusppc.app/Contents/MacOS/dingusppc`.
`dingusppc/build` is the Emscripten tree, not another native build. Use the repo's
Docker toolchain described in `README.md` and `scripts/docker-shell.sh`. Inspect
existing containers and mounts before reusing one; don't bake ephemeral container
IDs into instructions. Within the configured container, the incremental command
is `cmake --build /dingusppc/build -j 8` after activating its Emscripten environment.
Use the README's configure recipe if the tree does not exist.

To test the new WASM in the browser, run on the host after building:

```sh
scripts/import-emulator.sh dingusppc
```

This checks linked JS for undefined dependencies, copies JS/WASM into
`src/emulator/worker/emscripten`, and rewrites the public source map. Building the
submodule alone does not update the core served by the app. Preserve any existing
generated-asset edits and report the imported artifacts as part of the resulting
diff. Reload the test page so an existing worker does not keep running the old
binary. Inspect the current local server/URL instead of assuming a fixed port.

Reproduce the reported machine and OS query parameters. `saved_hd=false` excludes
the user's Saved HD, but is not proof of an identical native PRAM/disk state.
A different emulator may boot the same OS with a different CPU and application
code path. Check whether a fat application actually executes 68K or PPC code.

For timing or audio bugs, explicitly compare modes and backends:

- Native Cubeb and web JS audio paths can use different polling lifecycles.
- A native deterministic mode can exercise code closer to the web poller than
  the normal native callback path. Confirm current flags in source/help.
- Instruction-clock and real-time runs differ in timer scheduling. DingusPPC's
  `--realtime` and Ctrl-Alt-R toggle are useful experiments; record changes and
  confirm the log reports the intended mode.

Don't infer a web fix from native success, or a hardware invariant from a
synthetic component test alone.

## Build scaffolding when it pays for itself

If repeated UI actions, restarts, or state collection dominate the work, build
a small reusable tool before expanding the test matrix. Useful examples include
a launcher that copies disk/PRAM seeds, a bounded exception recorder, a guest
test file that writes results to disk, and a component runner linked against
the emulator's actual CPU/device objects. Start with the smallest capability
that removes the bottleneck; keep diagnostic code separate from the proposed
correctness fix.

One investigation used an experimental native local-socket control channel for
mouse/keyboard injection and framebuffer screenshots after synthetic host input
proved unreliable. This is an example of worthwhile scaffolding, not an assumed
DingusPPC feature: inspect the current checkout before using or extending it.
There is no required socket path, protocol, or client script in this skill.
Such a channel should feed the normal guest input path, with appropriate thread
handoff, and verify the resulting cursor/action from guest state or screenshots.
A successful write to the channel does not establish that the guest consumed it.

Preserve guest actions and test inputs along with automation so reproduction
remains possible without an unmerged control patch. Identify any instrumentation
in the tested binary, especially when snapshots or pauses could change timing.

## Read CPU test results carefully

The native `testppc` runner loads CSV inputs from its working directory; in the
maintained build, run it from `dingusppc/build-xcode/bin/RelWithDebInfo`. Verify
that it found the inputs and executed the intended cases. Tested versions could
exit successfully despite instruction-test failures because the final status
came from the disassembler suite. Read both summaries and compare failing cases,
not just exit status or total counts. Don't hard-code a historical failure count
as acceptable.

Isolate state between cases, including FPSCR enables and host rounding mode.
One CSV runner carried a prior row's exception-enable setting into rows that
omitted it, obscuring the actual FPU results.

## Inspect the guest directly

MacsBug is useful when already available, but isn't a prerequisite. Native host
LLDB, DingusPPC's debugger, and small source probes often expose the failure more
directly. Launch in a PTY when using the CLI debugger. Ctrl-C enters it; inspect
`help` for the actual build. Useful commands include:

```text
regs
fregs
mregs
regions
disas 20,0xADDRESS
dump 32b,0xADDRESS
until 0xADDRESS
go
quit
```

The first command after a signal was occasionally discarded in tested builds;
verify that commands ran before interpreting missing output. `context 68k`
depends on build support; don't assume it exists. A zero exit after debugger
`quit` says nothing about guest success.

With LLDB, inspect `ppc_state`, PCs/LR/MSR, guest memory mappings, and the relevant
device state. Optimized C++ accessors can be unavailable; inspect fields rather
than calling guest-mutating functions. Resolve host ASLR/symbol addresses afresh
for each executable. Keep host pointers, guest physical addresses, guest virtual
addresses, and module-relative offsets distinct.

When the PPC is executing Apple's 68K emulator, its PPC PC alone can be unhelpful.
Some tested ROM paths keep an advanced 68K PC in r24 and D0-D7 in r8-r15. Verify
that mapping from the running ROM's dispatch code before relying on it. Use the
archive's guest-tracing playbook for detailed recovery and offline snapshots.

## Extract and correlate application code

Classic Mac files have data and resource forks. Extract both with `machfs` or the
archive's `hfs_forks.py`; ordinary host file copies may lose essential code or
metadata. PEF fragments (`Joy!peff`) may live inside a larger data/resource fork.
The local `/Users/mihai/Developer/source/retro/resource_dasm/m68kdasm` supports
68K and PEF inspection; check its help for the installed version. Match runtime
instruction bytes to section offsets before assigning a load base, since PEF
compression and relocations affect mapping. Inspect import transition vectors
(entry and TOC) to identify calls such as `Microseconds`.

An emulator disassembler can reject an encoding for the same mistaken reason
as its interpreter. Preserve the raw opcode and decode its fields independently;
`dc.l` output alone is not proof of an illegal instruction on the selected CPU.
Consult that processor's manual, including model-specific compatibility notes.

## Instrument without drowning the signal

Use a bounded event ring around the relevant PC/address/device transition. Useful
fields are guest time, PPC/68K PC, operation, register/address, value, interrupt
flags, timer identity/deadline/active state, and the last writer or caller. Dump
on the first violation. Logging every MMIO read during boot can bury the cause,
consume gigabytes, and alter real-time behavior.

For timer races, capture counter readback and flag transitions on the same time
axis. For repeated DMA/audio startup, count registrations and inspect queue
membership. For crashes, capture the exception site and preceding state before
following the eventual error dialog or blank screen.

Diagnostic memory reads can modify MMU state, set PTE bits, or acknowledge MMIO
interrupts. Inspect stored device fields or captured physical memory when live
reads would perturb the hypothesis. In exception paths using `longjmp`, destroy
C++ strings/vectors before calling the nonreturning handler.

Small probes should link the actual emulator implementation and check meaningful
boundaries. Reproduce the failure in the guest before claiming the probe proves
its cause. Preserve CRLF where the source uses it;
`git -c core.whitespace=cr-at-eol diff --check` avoids treating those line endings
as newly introduced whitespace errors.

## UI friction encountered in these investigations

A black screen may be a game gamma change hiding a live Finder/error handler;
sample guest state before declaring an emulator freeze. A locked host prevents
native window interaction but does not prevent code analysis or component tests.
If app selection is ambiguous, target the intended window; an isolated copied
app with a distinct bundle ID can help when multiple builds share an identity.

For guest input, short synthetic key presses can be missed; modest held presses
worked better. Native mouse input is relative and large automation jumps can be
clipped, so inspect the guest cursor and use smaller movements. Mouse grab may
not work with synthetic absolute events. Check the game's actual controls:
Abuse's bundled `lisp/input.lsp` used I/J/K/L, not arrow keys or WASD. Do not
mistake an ineffective input action for stalled emulation.
