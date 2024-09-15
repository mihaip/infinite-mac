import React, {Suspense} from "react";
import {type Appearance} from "./controls/Appearance";
import {
    Drawer,
    DrawerContents,
    DrawerHeader,
    DrawerLoading,
} from "./controls/Drawer";
import {fetchWithProgress} from "./fetch";
import macintoshGardenIcon from "./Images/Macintosh-Garden.png";
import {Input} from "./controls/Input";
import {useDebouncedCallback} from "use-debounce";

export function MacLibrary({
    onRun,
    onLoadProgress,
    appearance,
}: {
    onRun: (file: File) => void;
    onLoadProgress: (name: string, fraction: number) => void;
    appearance: Appearance;
}) {
    return (
        <Drawer
            title="Macintosh Garden"
            titleIconUrl={macintoshGardenIcon}
            appearance={appearance}
            contents={collapse => (
                <Suspense
                    fallback={
                        <MacLibraryContentsFallback appearance={appearance} />
                    }>
                    <MacLibraryContents
                        onRun={async (
                            url,
                            name = "Untitled",
                            fileName,
                            size
                        ) => {
                            const progressName = fileName
                                ? `${name} (${fileName}}`
                                : name;
                            collapse();
                            const blob = await fetchWithProgress(
                                url,
                                (loadedBytes, totalBytes) =>
                                    onLoadProgress(
                                        progressName,
                                        loadedBytes / (size ?? totalBytes)
                                    )
                            );
                            onRun(new File([blob], fileName ?? "Untitled"));
                        }}
                        appearance={appearance}
                    />
                </Suspense>
            )}
        />
    );
}

export function MacLibraryHeader({
    search,
    setSearch,
    appearance,
}: {
    search?: string;
    setSearch?: (search: string) => void;
    appearance: Appearance;
}) {
    const setSearchDebounced = useDebouncedCallback(
        setSearch ?? (() => {}),
        100
    );

    return (
        <DrawerHeader>
            <div>
                <a href="https://macintoshgarden.org/">The Macintosh Garden</a>
                's mission is to preserve software for the Macintosh platform.
                You can browse its library and directly load files into the
                “Downloads” folder of “The Outside World”.
            </div>
            <Input
                appearance={appearance}
                type="search"
                placeholder="Filter…"
                defaultValue={search}
                disabled={setSearch === undefined}
                onChange={e => setSearchDebounced(e.target.value)}
            />
        </DrawerHeader>
    );
}

const MacLibraryContents = React.lazy(() => import("./MacLibraryContents"));

function MacLibraryContentsFallback({appearance}: {appearance: Appearance}) {
    return (
        <DrawerContents>
            <MacLibraryHeader appearance={appearance} />
            <DrawerLoading />
        </DrawerContents>
    );
}
