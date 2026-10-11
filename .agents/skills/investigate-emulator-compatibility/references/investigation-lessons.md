# Lessons from recent investigations

These are historical findings and investigation patterns, not instructions to
apply the same fix to a new report. Source revisions and current behavior may
have changed.

## Choose workloads that expose the requested behavior

For a PowerPC-focused survey, confirm the application actually runs PPC code.
An old 68K title's failure is stronger evidence of an emulator defect when the
same version works on contemporary PPC hardware or a suitable emulator control.
An alternative emulator is only a positive control after that workload succeeds
there; MCL itself had reported SheepShaver problems.

Use a concrete milestone beyond launch: exercise vector access in a language
runtime, calculate a known result, or complete a render. Graphing Calculator's
3D demo looked plausible while targeted MCL arithmetic exposed several FPU
defects. Distinguish application failures from independent CPU defects found
through one application, and consolidate symptoms that share a cause rather
than counting them as separate compatibility issues.

## MCL: the loudest exception was downstream of the bug

MCL 4.2 patched stalled at launch with repeated illegal instructions in error
reporting code. Capturing the first exception found a valid vector bounds check:
`twlge r23,r3`, with index 0 and tagged length 24. The interpreter had swapped
rA/rB and tested 24 >= 0. The same check failed inside the error handler,
recursing and consuming more stack each time. Fixing the original decode reached
the listener and restored vector access and large-integer arithmetic.

Capture the instruction and its operands before exception entry changes state.
Check manual bit numbering: PowerPC numbers from the MSB, so rA's bits 11–15
use host shift 16, and rB's bits 16–20 use shift 11. Prefer existing decode
helpers when they match the instruction format. Keep semantic fixes separate
from broader helper cleanup. Use unequal operands and signed/unsigned boundary
values in tests; equality alone would hide this swap. The `tw` regression probe
covered all 32 trap-option masks.

Reference: [MPC601 manual, `tw`, printed p. 10-214](https://www.nxp.com/docs/en/user-guide/MPC601UM.pdf#page=768).

## FPU: test results, control side effects, and sequences

A guest language with a PPC assembler can expose small instruction sequences
without building a new Mac application. MCL probes wrote results to a guest
file for extraction, making repeated numerical checks easier than reading
screenshots. Confirm the code executes the intended instructions and record
raw register bits when printed decimal values could hide a difference.

The useful probes tested more than normal arithmetic:

- Seed the destination before an exceptional operation. A 601 `fdiv` early
  return on negative zero left the old finite value instead of infinity.
- Change FPSCR through guest instructions, then perform arithmetic. Setting
  the emulated FPSCR field directly misses synchronization with host rounding.
- Set exception enables before compares and read them afterward. A compare
  silently cleared VE even though its comparison result was correct.
- Test exception status with its enable absent, matching, and unrelated. FEX
  was being derived from status alone instead of status masked by enables.
- Run result-class transitions, such as negative to positive to zero to NaN.
  Starting each operation from a clear FPSCR hid accumulating FPRF bits.

Native rounding was fixed by synchronizing FPSCR writes with host rounding;
the tested Emscripten runtime's `fesetround` was a no-op, so the WASM probe still
rounded to nearest. Compile the same component probe for each backend when
host arithmetic facilities matter. Report unresolved backend behavior explicitly;
a successful build or FPSCR readback does not establish the arithmetic result.

## Barrack: CPU model and decoder agreement

The native 6100 crashed on `0xB4A0082C`, encoding `sthu r5,0x82c(r0)`.
DingusPPC rejected the zero rA field, but the 601 permits it for POWER
compatibility: zero base, store performed, register update suppressed. Later
CPUs have different restrictions. The emulator disassembler also rejected the
encoding and printed `dc.l`, making two implementations of the same assumption
look like independent evidence.

Read the processor's compatibility prose as well as its generic instruction
pseudocode. Test affected immediate/indexed forms and neighboring CPU models.
The 601 manual's `(rA|0)` means zero when the **index** rA is zero; it does not
mean bitwise OR or testing GPR0's contents.

Reference: [MPC601 manual](https://www.nxp.com/docs/en/user-guide/MPC601UM.pdf),
§3.5.3 and the instruction descriptions. The separate nuke-ball report was not
resolved by proving that the 6100 instruction crash was fixed.

On the 7500, repeated zero-opcode exceptions at a ROM address turned out to be
intentional Open Firmware control flow. Trace entry and return before assuming
an exception log is a guest fault. Zero instructions are not universally benign.

## Abuse: tiny race, persistent clock failure

The game's intro waited on `Microseconds` for 150 ms. T2 readback wrapped at
N+1 clocks while the IRQ was scheduled at N+3. Mac OS saw a wrapped high byte
and no pending flag, then read the low byte just after the IRQ arrived. The
low-byte read acknowledged the interrupt before the OS serviced/rearmed the
one-shot timer. Returned time then cycled within one roughly 83.66 ms period.
A roughly 2.55 microsecond inconsistency explained an apparently indefinite wait.

The useful trace recorded T2CH, IFR, and T2CL reads at guest PCs, not just the
final waiting loop. Check register side effects, counter/IRQ phase consistency,
and overdue callbacks when host time advances between timer-queue polls.
[W65C22 timing diagram](https://www.westerndesigncenter.com/wdc/documentation/w65c22.pdf#page=17)
and the SuperMario `OS/TimeMgr/TimeMgr.a` ReadTime comments helped explain it;
disassembly of the actual guest ROM confirmed the sequence.

A separate real-time launch black screen was traced to overdue VBL assert and
deassert timers collapsing onto one deadline. It remained separate from the VIA
fix. Likewise, responsive gameplay did not establish that Finder audio after
quitting was correct.

## Solarian II: native success can miss the relevant backend

Repeated sound-DMA starts reached `start_out_stream()` without closing the
stream. The JS poller and native **deterministic** Cubeb poller could enqueue the
same active timer twice, corrupting the timer queue. Ordinary native audio was
not an equivalent control. Trace the start/stop/close lifecycle and timer identity,
not only overall timer counts or whether muting avoids the symptom.

An audit found similar-looking registrations in other devices, but component
tests did not establish their hardware semantics or guest impact. Those broader
changes were withdrawn. Keep verified backend fixes separate from timer API
refactoring and speculative device changes; a new assertion in shared machinery
can turn a diagnostic into an unrelated guest regression.

## Boot and transfer reports: validate the exact milestone

BlueSCSI testing distinguished a native Curio discovery hang from a browser
report that reached file enumeration. An empty-directory response exercised a
one-byte count; populated listings used 40 bytes per entry. Reaching the former
was not proof about the latter, and moving the device to MESH did not prevent
software from probing an absent Curio target.

Other boot investigations distinguished bad installed ROM/System combinations
from emulator bugs and traced a late invalid callback back to earlier firmware
initialization. Use known-compatible media and track the first bad value or
failed handshake. The archive's `playbooks/classic-mac-boot-baselines.md` and
`playbooks/classic-mac-guest-tracing.md` retain those detailed workflows.
