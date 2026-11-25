import {useRef} from "react";
import {
    elementScroll,
    observeElementOffset,
    observeElementRect,
    useVirtualizer,
} from "@tanstack/react-virtual";

/** Virtualize measured rows and follow appended items while pinned to the end. */
export function useVirtualizedList({
    count,
    getItemKey,
    estimateSize,
    overscan,
}: {
    count: number;
    getItemKey: (index: number) => number;
    estimateSize: (index: number) => number;
    overscan: number;
}) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const reportScrollOffset =
        useRef<(offset: number, isScrolling: boolean) => void>();
    // TanStack Virtual exposes mutable state through the virtualizer instance.
    // oxlint-disable-next-line react/incompatible-library
    const virtualizer = useVirtualizer<HTMLDivElement, HTMLElement>({
        count,
        getScrollElement: () => scrollRef.current,
        getItemKey,
        estimateSize,
        overscan,
        anchorTo: "end",
        followOnAppend: true,
        scrollEndThreshold: 8,
        // Following a burst of items can scroll past the rendered rows before
        // the browser sends a scroll event, briefly showing a blank list. Report
        // non-smooth scroll changes after React finishes its current update but
        // before the browser draws the next frame, so the new rows render in time.
        observeElementOffset(instance, onOffset) {
            reportScrollOffset.current = onOffset;
            const unsubscribe = observeElementOffset(instance, onOffset);
            return () => {
                reportScrollOffset.current = undefined;
                unsubscribe?.();
            };
        },
        scrollToFn(offset, options, instance) {
            const previousOffset = instance.scrollElement?.scrollTop;
            elementScroll(offset, options, instance);
            if (
                options.behavior !== "smooth" &&
                instance.scrollElement &&
                instance.scrollElement.scrollTop !== previousOffset
            ) {
                queueMicrotask(() => {
                    if (instance.scrollElement) {
                        reportScrollOffset.current?.(
                            instance.scrollElement.scrollTop,
                            true
                        );
                    }
                });
            }
        },
        // Keep following when a viewport resize reduces its height.
        observeElementRect(instance, onRect) {
            return observeElementRect(instance, rect => {
                const previousHeight = instance.scrollRect?.height;
                // isAtEnd() reads the already-resized DOM clientHeight, so use
                // the cached previous height to check whether we were at the end.
                const wasAtEnd =
                    instance.getTotalSize() -
                        (previousHeight ?? 0) -
                        (instance.scrollOffset ?? 0) <=
                    instance.options.scrollEndThreshold;
                onRect(rect);
                if (
                    previousHeight !== undefined &&
                    previousHeight !== rect.height &&
                    wasAtEnd
                ) {
                    instance.scrollToEnd();
                }
            });
        },
    });
    return {virtualizer, scrollRef};
}
