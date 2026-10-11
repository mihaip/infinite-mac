---
name: investigate-emulator-compatibility
description: Investigate classic software compatibility bugs in Infinite Mac emulator cores by reproducing guest failures, comparing native and web builds, and tracing CPU or device state. Use for crashes, hangs, slow gameplay, boot failures, and sound or video regressions.
---

# Investigate emulator compatibility

Turn a compatibility report into a repeatable reproduction, a causal explanation,
and a focused fix when the evidence supports one. These recipes are strongest
for DingusPPC; use the selected core's own build and debugger instructions for
other emulators.

Read the relevant submodule's `AGENTS.md` before working in it. The repository
requires asking before creating worktrees. Keep the user's existing edits and
in-progress experiments intact.

## Establish what is being compared

Record the emulator revision and patch, binary/configuration, machine/CPU, ROM,
OS image, RAM, application version, disk attachment order, working directory,
PRAM/NVRAM seeds, and clock/audio modes. A URL alone does not capture native
persistent state. Use private writable media and repeatable seed copies.

Separate distinct symptoms in a report, there may be multiple issues flagged
in a report, and they can have distinct causes.

Choose a visible or guest-state milestone and an observation period appropriate
to the failure. Sample an apparent hang to distinguish a stable wait from slow
progress. Keep one uninterrupted run for timing-sensitive failures; breakpoints
and verbose logging can change the outcome.

## Prepare and reproduce

- Read [media-and-runs.md](references/media-and-runs.md) to build a filtered
  Infinite HD, wrap a bare HFS image, and control native boot state.
- Start with the reported environment when practical. Native DingusPPC is often
  the fastest way to iterate and inspect guest state, but native success does
  not clear the web backend. Keep a known-working emulator as a behavioral
  control, accounting for CPU model and 68K/PPC application differences.
- Read [debugging-and-builds.md](references/debugging-and-builds.md) for native
  versus WASM builds, guest inspection, and focused instrumentation.
- Consult [investigation-lessons.md](references/investigation-lessons.md) when
  choosing survey workloads or probes for exceptions, FPU results, timer/audio
  stalls, or boot/media problems. These are examples, not a diagnosis of the
  next report.

For repeated investigations, invest in tooling that removes the actual
bottleneck: repeatable launches, input replay, state capture, or component
probes. See the scaffolding guidance in
[debugging-and-builds.md](references/debugging-and-builds.md); experimental
control tooling from an earlier investigation may not exist in this checkout.

## Find the first wrong event

Identify the guest operation that should make progress: an instruction, clock
read, callback, DMA transfer, interrupt, or device handshake. Capture a bounded
history around the first violation, with guest PCs and relevant state. Trace
back from a later crash or error loop instead of patching its last bad access.

Confirm semantics against the actual CPU/device manual and running guest code.
Historical Apple sources help name routines, but may differ from the installed
ROM. A component probe should exercise actual emulator code; a model of the
proposed algorithm can only confirm its own assumptions.

Prefer the hardware correction over a symptom guard. Audit analogous paths,
including native and JS backends, but do not turn that audit into speculative
changes to unrelated devices. Distinguish the minimum reproduction fix from
related correctness coverage, diagnostics, and refactoring.

## Verify and hand off

Re-run the original failure with the same inputs and add targeted boundary or
model checks justified by the change. Compile each affected target. A successful
WASM build, browser boot, and successful application workload are three distinct
claims; report exactly which were checked.

Establish the test suite's baseline and compare individual failures before and
after. A zero process exit or unchanged failure count alone can miss regressions.

Remove temporary tracing from the proposed patch. Preserve useful commands,
input identities, first-failure evidence, and unresolved hypotheses in concise
investigation notes. Temporary `/tmp` files are working evidence, not durable
skill dependencies. State what was left in the checkout, including imported
JS/WASM assets, and distinguish an intentional debugger stop from a crash.

Do not make "drive-by" fixes - if you notice additional things that could be 
improved, or dead code that could be removed, include it in your final report,
but do not make modifications.
