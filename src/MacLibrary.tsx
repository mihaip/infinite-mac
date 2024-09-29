import React, {Suspense, useState} from "react";
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
import classNames from "classnames";
import {type LibraryIndexItem} from "./library";
import {proxyUrl} from "./library-urls";

export function MacLibrary({
    onRun,
    onLoadProgress,
    appearance,
}: {
    onRun: (file: File) => void;
    onLoadProgress: (name: string, fraction: number) => void;
    appearance: Appearance;
}) {
    const [search, setSearch] = useState("");
    const [detailsItem, setDetailsItem] = useState<
        LibraryIndexItem | undefined
    >();

    return (
        <Drawer
            title="Macintosh Garden"
            titleIconUrl={macintoshGardenIcon}
            titleIconSmoothScale
            appearance={appearance}
            contents={collapse => (
                <Suspense
                    fallback={
                        <MacLibraryContentsFallback appearance={appearance} />
                    }>
                    <MacLibraryContents
                        search={search}
                        setSearch={setSearch}
                        detailsItem={detailsItem}
                        setDetailsItem={setDetailsItem}
                        onRun={async (
                            url,
                            name = "Untitled",
                            fileName,
                            size
                        ) => {
                            collapse();
                            handleLibraryURL(
                                url,
                                onRun,
                                onLoadProgress,
                                name,
                                fileName,
                                size
                            );
                        }}
                        appearance={appearance}
                    />
                </Suspense>
            )}
        />
    );
}

export async function handleLibraryURL(
    url: string,
    onRun: (file: File) => void,
    onLoadProgress: (name: string, fraction: number) => void,
    name?: string,
    fileName?: string,
    size?: number
) {
    if (!fileName) {
        fileName = new URL(url).pathname.split("/").at(-1) ?? "Untitled";
    }
    const progressName = name ? `${name} (${fileName})` : fileName;
    const fetchURL = proxyUrl(url);
    const blob = await fetchWithProgress(fetchURL, (loadedBytes, totalBytes) =>
        onLoadProgress(progressName, loadedBytes / (size ?? totalBytes))
    );
    onRun(new File([blob], fileName));
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
        <div
            className={classNames(
                "Mac-Library-Header",
                `Mac-Library-Header-${appearance}`
            )}>
            <DrawerHeader>
                <div>
                    <a href="https://macintoshgarden.org/">
                        The Macintosh Garden
                    </a>
                    's mission is to preserve software for the Macintosh
                    platform. You can browse its library and directly load files
                    into the “Downloads” folder of “The Outside World”.
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
        </div>
    );
}

const MacLibraryContents = React.lazy(() => import("./MacLibraryContents"));

function MacLibraryContentsFallback({appearance}: {appearance: Appearance}) {
    return (
        <DrawerContents appearance={appearance} tall>
            <MacLibraryHeader appearance={appearance} />
            <DrawerLoading />
        </DrawerContents>
    );
}
