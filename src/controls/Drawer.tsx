import {
    createContext,
    type PropsWithChildren,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import {createPortal} from "react-dom";
import {styleDrawerPopup} from "./drawer-popup";
import {appearanceSystemFont, useAppearance} from "@/controls/Appearance";
import classNames from "classnames";
import "@/controls/Drawer.css";

const DrawerContainerContext = createContext({
    anyDrawerExpanded: false,
    setAnyDrawerExpanded: (expanded: boolean) => {},
});

export function DrawersContainer({
    children,
    placement = "bottom",
}: PropsWithChildren<{placement?: "bottom" | "right"}>) {
    const [anyDrawerExpanded, setAnyDrawerExpanded] = useState(false);
    useEffect(() => {
        // TODO: cleanup
        document
            .querySelector(".App")
            ?.classList.toggle(
                "start-align",
                anyDrawerExpanded && placement === "right"
            );
    }, [anyDrawerExpanded, placement]);
    return (
        <DrawerContainerContext.Provider
            value={{anyDrawerExpanded, setAnyDrawerExpanded}}>
            <div
                className={classNames("Drawers-Container", {
                    "Drawers-Container-Right": placement === "right",
                })}
                onKeyDown={e => e.stopPropagation()}
                onKeyUp={e => e.stopPropagation()}>
                {children}
            </div>
        </DrawerContainerContext.Provider>
    );
}

export function Drawer({
    title,
    titleIconUrl,
    titleIconSmoothScale,
    contents,
    onExpandedChange,
    popout = false,
}: {
    title: string;
    titleIconUrl: string;
    titleIconSmoothScale?: boolean;
    contents: (
        collapse: () => void,
        controls: {popout?: () => void; isPopout: boolean}
    ) => ReactNode;
    onExpandedChange?: (expanded: boolean) => void;
    popout?: boolean;
}) {
    const {anyDrawerExpanded, setAnyDrawerExpanded} = useContext(
        DrawerContainerContext
    );
    const [expanded, setExpanded] = useState(false);
    const [popup, setPopup] = useState<Window>();
    const [popupBlocked, setPopupBlocked] = useState(false);
    const [portalHost, setPortalHost] = useState<HTMLDivElement>();
    const inlineHost = useRef<HTMLDivElement>(null);
    const expandedChange = useRef(onExpandedChange);
    useEffect(() => {
        expandedChange.current = onExpandedChange;
    }, [onExpandedChange]);
    useEffect(() => {
        if (popout) setPortalHost(document.createElement("div"));
    }, [popout]);
    useLayoutEffect(() => {
        if (!portalHost) return;
        portalHost.className = popup
            ? "Drawer-PopoutHost"
            : "Drawer-InlineHost";
        (popup?.document.body ?? inlineHost.current)?.append(portalHost);
    }, [portalHost, popup, expanded]);
    useEffect(() => {
        if (!popup) return;
        const stopStyles = styleDrawerPopup(popup, title);
        const close = () => {
            // Move the live portal out before the popup document is discarded.
            if (portalHost) inlineHost.current?.append(portalHost);
            setPopup(undefined);
            setExpanded(false);
            setAnyDrawerExpanded(false);
            expandedChange.current?.(false);
        };
        const closeWithParent = () => popup.close();
        popup.addEventListener("pagehide", close);
        window.addEventListener("pagehide", closeWithParent);
        return () => {
            popup.removeEventListener("pagehide", close);
            window.removeEventListener("pagehide", closeWithParent);
            stopStyles();
            popup.close();
        };
    }, [popup, title, portalHost, setAnyDrawerExpanded]);
    useEffect(() => {
        return () => {
            // A capability-dependent drawer can disappear on emulator restart.
            if (expanded) setAnyDrawerExpanded(false);
        };
    }, [expanded, setAnyDrawerExpanded]);
    const toggleExpanded = useCallback(() => {
        if (popup) {
            popup.focus();
            return;
        }
        setExpanded(!expanded);
        setAnyDrawerExpanded(!expanded);
        onExpandedChange?.(!expanded);
    }, [expanded, popup, setAnyDrawerExpanded, onExpandedChange]);
    const collapse = useCallback(() => {
        setPopup(undefined);
        setExpanded(false);
        setAnyDrawerExpanded(false);
        onExpandedChange?.(false);
    }, [setAnyDrawerExpanded, onExpandedChange]);
    const openPopout = () => {
        if (popup) {
            popup.focus();
            return;
        }
        const opened = window.open("", "_blank", "popup,width=1000,height=800");
        if (!opened) {
            setPopupBlocked(true);
            return;
        }
        setPopupBlocked(false);
        setPopup(opened);
        setExpanded(true);
        setAnyDrawerExpanded(false);
        onExpandedChange?.(true);
    };

    const appearance = useAppearance();
    const className = classNames("Drawer", `Drawer-${appearance}`, {
        "Drawer-Expanded": expanded && !popup,
    });

    return (
        <div
            className={className}
            hidden={!!popup || (anyDrawerExpanded && !expanded)}>
            <button
                type="button"
                aria-expanded={expanded && !popup}
                className={classNames(
                    "Drawer-Title",
                    appearanceSystemFont(appearance)
                )}
                onClick={toggleExpanded}>
                <div
                    className={classNames("Drawer-Title-Icon", {
                        "Smooth-Scale": titleIconSmoothScale,
                    })}
                    style={{
                        backgroundImage: `url("${titleIconUrl}")`,
                    }}
                />
                <span>{title}</span>
            </button>
            {popupBlocked && (
                <div className="Drawer-PopoutError" role="status">
                    Allow popups for this site to open {title} in a separate
                    window.
                </div>
            )}
            {popout ? (
                <>
                    <div ref={inlineHost} />
                    {expanded &&
                        portalHost &&
                        createPortal(
                            <div
                                className={classNames(
                                    "Drawer-Portal",
                                    `Drawer-${appearance}`
                                )}
                                onKeyDown={e => e.stopPropagation()}
                                onKeyUp={e => e.stopPropagation()}>
                                {contents(collapse, {
                                    popout: openPopout,
                                    isPopout: !!popup,
                                })}
                            </div>,
                            portalHost
                        )}
                </>
            ) : (
                expanded && contents(collapse, {isPopout: false})
            )}
        </div>
    );
}

export function DrawerContents({
    children,
    tall,
}: PropsWithChildren<{tall?: boolean}>) {
    const appearance = useAppearance();
    return (
        <div
            className={classNames(
                "Drawer-Contents",
                `Drawer-Contents-${appearance}`,
                {
                    "Drawer-Contents-Tall": tall,
                }
            )}>
            {children}
        </div>
    );
}

export function DrawerHeader({children}: PropsWithChildren) {
    return <div className="Drawer-Header">{children}</div>;
}

export function DrawerList({
    children,
    tall,
}: PropsWithChildren<{tall?: boolean}>) {
    const appearance = useAppearance();
    return (
        <div
            className={classNames("Drawer-List", `Drawer-List-${appearance}`, {
                "Drawer-List-Tall": tall,
            })}>
            {children}
        </div>
    );
}

export function DrawerListCategory({
    title,
    children,
}: PropsWithChildren<{title: string}>) {
    return (
        <div className="Drawer-List-Category">
            <h3>{title}</h3>
            <div className="Drawer-List-Category-Contents">{children}</div>
        </div>
    );
}

export function DrawerLoading() {
    return <div className="Drawer-Loading">Loading…</div>;
}
