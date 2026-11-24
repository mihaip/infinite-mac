# Infinite Mac

Infinite Mac is a web-based multi-emulator platform for running classic Macintosh operating systems and software in a browser using WebAssembly. See README.md for more information about the project, including build and development instructions.

## Code organization

- Put main entrypoints and public APIs first in each file, followed by secondary helpers and supporting implementation details.
- Group related code by domain and responsibility. Separate parsing, protocol, and data-format mechanics from the feature logic that consumes them.
- Encapsulate related state and behavior in focused modules, classes, hooks, or components. Keep application entrypoints and orchestration readable.
- Keep long exception-handling wrappers shallow by extracting the operation into an implementation helper.
- Replace unexplained literals with descriptive constants. Follow established specification or header names where available, and make units and scope clear in names for limits.
- Comments should explain reasoning and contracts. Use brief TSDoc descriptions for subtle functions so they appear on hover; omit routine parameter descriptions and comments that repeat the code. Link primary documentation for non-obvious formats or behavior.

## Design principles

### General

- Use the smallest abstraction that makes current code clearer. Start with concrete types and operations; let repeated real uses motivate generalization.
- Let actual callers shape the public API. Keep implementation details private, require arguments whose omission has no useful meaning, and remove unused surface area. Encapsulate construction and return fully initialized objects.
- Validate at meaningful boundaries and trust invariants established by our own code. Extra checks, conversions, fallback paths, and special cases should address a concrete requirement or demonstrated failure.
- Base optimizations on measured costs and real bottlenecks. Reuse prepared state and already-known information. Preserve readability when a small allocation or straightforward implementation is cheap enough. Give each limit a specific purpose and avoid redundant safeguards.
- Keep failures diagnosable: log the exception with useful context when dropping data. Preserve useful results when optional enrichment fails.
- Build features in small, coherent increments that can be reviewed and landed independently. Verify behavior with focused tests and representative real configurations. Distinguish observed behavior from assumptions and report what was actually tested.

### Emulator cores and workers

- Keep emulator adapters thin. Put logic shared across cores in TypeScript, usually in the worker; native integrations should supply the observations and access that shared code needs.
- Define emulator capabilities centrally and gate features at the appropriate boundary. Let downstream code trust the resulting configuration instead of repeating emulator-type checks.
- Use shared worker lifecycle mechanisms for buffering and flushing observations. Reject duplicate or unnecessary work before expensive parsing, copying, or cross-thread messaging.

### React and UI

- Subscribe to changing state at the narrowest consumer. Frequent updates should rerender only the components that display them. Use external stores and focused subscription hooks where appropriate.
- Fix shared behavior in the component or state owner responsible for it. Keep supported configurations consistent instead of adding consumer-specific workarounds.
- Make independently useful components self-contained. Give them their own class names and scoped styles, and keep their behavior independent of incidental parent structure.

## Working with emulator cores

When working with emulators that live in Git submodules (e.g. `macemu/` for Baslisk II and SheepShaver, `dingusppc/` for DingusPPC, `snow/` for Snow, etc.), reference the `AGENTS.md` file in the respective submodule before doing anything else.
