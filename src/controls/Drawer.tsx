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
    appearance,
    contents,
}: {
    title: string;
    titleIconUrl: string;
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
                className="Drawer-Title"
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

export function DrawerContents({children}: PropsWithChildren) {
    return <div className="Drawer-Contents">{children}</div>;
}

export function DrawerHeader({children}: PropsWithChildren) {
    return <div className="Drawer-Header">{children}</div>;
}

export function DrawerList({children}: PropsWithChildren) {
    return <div className="Drawer-List">{children}</div>;
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
