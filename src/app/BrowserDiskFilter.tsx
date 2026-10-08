import {
    DISKS_BY_YEAR,
    ALL_DISKS,
    type SystemDiskDef,
    type PlaceholderDiskDef,
} from "@/defs/disks";
import {type RefObject, useEffect, useState} from "react";
import classNames from "classnames";
import {
    type Appearance,
    AppearanceProvider,
    appearanceSystemFont,
} from "@/controls/Appearance";
import {DialogFrame} from "@/controls/Dialog";
import {Select} from "@/controls/Select";
import {useIsoPersistentState} from "@/lib/useIsoPersistentState";
import {iso} from "@/lib/iso";
import {isBeOSLaunched} from "@/flags";
import "@/app/BrowserDiskFilter.css";

export function browserDisks() {
    type Filter = (d: SystemDiskDef | PlaceholderDiskDef) => boolean;

    const beosLaunched = isBeOSLaunched();

    const beosFilter: Filter = d => beosLaunched || d.family !== "beos";

    function makeEntry(label: string, filter: Filter) {
        return {
            label,
            all: ALL_DISKS.filter(filter).filter(beosFilter),
            byYear: Object.fromEntries(
                Object.entries(DISKS_BY_YEAR)
                    .map(([year, disks]) => [
                        year,
                        disks.filter(filter).filter(beosFilter),
                    ])
                    .filter(([, disks]) => disks.length > 0)
            ) as {[year: string]: (SystemDiskDef | PlaceholderDiskDef)[]},
        };
    }

    return {
        "all": makeEntry("All", () => true),
        "notable": makeEntry("Notable", d => d.notable ?? false),
        "aux": makeEntry("A/UX", d => d.family === "aux"),
        "next": makeEntry("NeXT", d => d.family === "next"),
        "beos": makeEntry("BeOS", d => d.family === "beos"),
        "macosx": makeEntry("Mac OS X", d => d.family === "macosx"),
    } as const;
}
type DiskFilter = keyof ReturnType<typeof browserDisks>;

export function useBrowserDiskFilter() {
    const filterParam = iso().location.searchParams.get("filter");
    let defaultValue: DiskFilter = "notable";
    let useClientState = false;
    // If using query params, we go into a temporary client state.
    if (filterParam && filterParam.toLowerCase() in browserDisks()) {
        defaultValue = filterParam as DiskFilter;
        useClientState = true;
    }

    const clientState = useState<DiskFilter>(defaultValue);
    const persistentState = useIsoPersistentState<DiskFilter>(
        defaultValue,
        "diskFilter"
    );
    return useClientState ? clientState : persistentState;
}

export function BrowserDiskFilter({
    value,
    onChange,
    browserRef,
}: {
    value: DiskFilter;
    onChange: (v: DiskFilter) => void;
    browserRef: RefObject<HTMLDivElement>;
}) {
    const appearance = useDiskFilterAppearance(browserRef, value);
    const [appearances, setAppearances] = useState<{
        current: Appearance;
        previous?: Appearance;
    }>({current: appearance});
    if (appearances.current !== appearance) {
        setAppearances({current: appearance, previous: appearances.current});
    }

    const renderFilters = (skin: Appearance, previous = false) => (
        <AppearanceProvider appearance={skin}>
            <DialogFrame className="Disk-Filters">
                <label
                    htmlFor={previous ? undefined : "disk-filter"}
                    className={classNames(
                        "Disk-Filters-Label",
                        appearanceSystemFont(skin)
                    )}>
                    Releases:
                </label>
                <Select
                    id={previous ? undefined : "disk-filter"}
                    tabIndex={previous ? -1 : undefined}
                    value={value}
                    onChange={event =>
                        onChange(event.target.value as DiskFilter)
                    }>
                    {Object.entries(browserDisks()).map(
                        ([filter, {label, all}]) =>
                            all.length > 0 && (
                                <option key={filter} value={filter}>
                                    {label} ({all.length})
                                </option>
                            )
                    )}
                </Select>
            </DialogFrame>
        </AppearanceProvider>
    );

    // Keep the live controls mounted and focused; the old panel is visual only.
    return (
        <div className="Disk-Filters-Container">
            {renderFilters(appearance)}
            {appearances.previous && (
                <div
                    key={`${appearances.previous}-${appearance}`}
                    className="Disk-Filters-PreviousAppearance"
                    aria-hidden="true"
                    ref={element => {
                        if (element) element.inert = true;
                    }}
                    onAnimationEnd={() =>
                        setAppearances({current: appearance})
                    }>
                    {renderFilters(appearances.previous, true)}
                </div>
            )}
        </div>
    );
}

function useDiskFilterAppearance(
    browserRef: RefObject<HTMLDivElement>,
    filter: DiskFilter
) {
    const [appearance, setAppearance] = useState<Appearance>(
        () => browserDisks()[filter].all[0]?.appearance ?? "Classic"
    );
    useEffect(() => {
        const browser = browserRef.current;
        if (!browser) return;

        let positions: {top: number; appearance: Appearance}[] = [];
        let frame: number | undefined;
        const updateAppearance = () => {
            if (!positions.length) return;
            // Find the two disk tops surrounding the viewport top. Equal tops
            // use the first disk in reading order, including on a wrapped grid.
            const top = window.scrollY;
            let low = 0;
            let high = positions.length;
            while (low < high) {
                const mid = (low + high) >>> 1;
                if (positions[mid].top < top) low = mid + 1;
                else high = mid;
            }
            const before = positions[Math.max(0, low - 1)];
            const after = positions[Math.min(low, positions.length - 1)];
            setAppearance(
                top - before.top <= after.top - top
                    ? before.appearance
                    : after.appearance
            );
        };
        const measure = () => {
            positions = Array.from(
                browser.querySelectorAll<HTMLElement>(".Disk[data-appearance]"),
                disk => ({
                    top: disk.getBoundingClientRect().top + window.scrollY,
                    appearance: disk.dataset.appearance as Appearance,
                })
            )
                .sort((a, b) => a.top - b.top)
                .filter(
                    (disk, i, disks) => i === 0 || disk.top !== disks[i - 1].top
                );
            updateAppearance();
        };
        const onScroll = () => {
            frame ??= requestAnimationFrame(() => {
                frame = undefined;
                updateAppearance();
            });
        };

        // Cache layout only when it changes. Scrolling does no DOM measurement
        // and O(log n) work; only the filter rerenders when the skin changes.
        const observer = new ResizeObserver(measure);
        observer.observe(browser);
        measure();
        window.addEventListener("scroll", onScroll, {passive: true});
        return () => {
            observer.disconnect();
            window.removeEventListener("scroll", onScroll);
            if (frame !== undefined) cancelAnimationFrame(frame);
        };
    }, [browserRef, filter]);
    return appearance;
}
