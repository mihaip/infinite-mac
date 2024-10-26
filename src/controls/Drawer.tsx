import {
    createContext,
    type PropsWithChildren,
    type ReactNode,
    useCallback,
    useContext,
    useState,
} from "react";
import {type Appearance} from "./Appearance";
import classNames from "classnames";
import "./Drawer.css";

const DrawerContainerContext = createContext({
    anyDrawerExpanded: false,
    setAnyDrawerExpanded: (expanded: boolean) => {},
});

export function DrawersContainer({children}: PropsWithChildren) {
    const [anyDrawerExpanded, setAnyDrawerExpanded] = useState(false);
    return (
        <DrawerContainerContext.Provider
            value={{anyDrawerExpanded, setAnyDrawerExpanded}}>
            <div className="Drawers-Container">{children}</div>
        </DrawerContainerContext.Provider>
    );
}

export function Drawer({
    title,
    titleIconUrl,
    titleIconSmoothScale,
    appearance,
    contents,
}: {
    title: string;
    titleIconUrl: string;
    titleIconSmoothScale?: boolean;
    appearance: Appearance;
    contents: (collapse: () => void) => ReactNode;
}) {
    const {anyDrawerExpanded, setAnyDrawerExpanded} = useContext(
        DrawerContainerContext
    );
    const [expanded, setExpanded] = useState(false);
    const toggleExpanded = useCallback(() => {
        setExpanded(!expanded);
        setAnyDrawerExpanded(!expanded);
    }, [expanded, setAnyDrawerExpanded]);
    const collapse = useCallback(() => {
        setExpanded(false);
        setAnyDrawerExpanded(false);
    }, [setAnyDrawerExpanded]);

    const className = classNames("Drawer", `Drawer-${appearance}`, {
        "Drawer-Expanded": expanded,
    });

    return (
        <div className={className} hidden={anyDrawerExpanded && !expanded}>
            <div
                className={classNames("Drawer-Title", {
                    "Drawer-Title-Smooth-Scale": titleIconSmoothScale,
                })}
                onClick={toggleExpanded}
                style={{
                    backgroundImage: `url(${titleIconUrl})`,
                }}>
                {title}
            </div>
            {expanded && contents(collapse)}
        </div>
    );
}

export function DrawerContents({
    children,
    appearance,
    tall,
}: PropsWithChildren<{appearance: Appearance; tall?: boolean}>) {
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
    appearance,
    tall,
}: PropsWithChildren<{appearance: Appearance; tall?: boolean}>) {
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
