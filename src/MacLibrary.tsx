import React, {Suspense, useState} from "react";
import {useAppearance} from "./controls/Appearance";
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
import {isDiskImageFile, type EmulatorCDROM} from "./emulator/emulator-common";
import {getCDROMInfo} from "./cdroms";

export function MacLibrary({
    onRun,
    onRunCDROM,
    onLoadProgress,
}: {
    onRun: (file: File) => void;
    onRunCDROM: (cdrom: EmulatorCDROM) => void;
    onLoadProgress: (name: string, fraction: number) => void;
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
            contents={collapse => (
                <Suspense fallback={<MacLibraryContentsFallback />}>
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
                            if (
                                fileName &&
                                isDiskImageFile({
                                    name: fileName,
                                    size: size ?? 0,
                                }) &&
                                size &&
                                size > 10000000
                            ) {
                                try {
                                    const cdrom = await getCDROMInfo(url);
                                    onRunCDROM(cdrom);
                                    return;
                                } catch (err) {
                                    // Fallthrough, try loading it as a regular file
                                }
                            }
                            handleLibraryURL(
                                url,
                                onRun,
                                onLoadProgress,
                                name,
                                fileName,
                                size
                            );
                        }}
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
}: {
    search?: string;
    setSearch?: (search: string) => void;
}) {
    const appearance = useAppearance();
    const setSearchDebounced = useDebouncedCallback(
        setSearch ?? (() => {}),
        100
    );
    const [searchFocused, setSearchFocused] = useState(false);

    return (
        <div
            className={classNames(
                "Mac-Library-Header",
                `Mac-Library-Header-${appearance}`
            )}>
            <DrawerHeader>
                {searchFocused ? (
                    <div>
                        Supported search operators include <code>year:</code>,{" "}
                        <code>title:</code>, <code>author:</code>,{" "}
                        <code>category:</code>, <code>system:</code>, and{" "}
                        <code>architecture:</code>.
                    </div>
                ) : (
                    <div>
                        <a href="https://macintoshgarden.org/">
                            The Macintosh Garden
                        </a>
                        's mission is to preserve software for the Macintosh
                        platform. You can browse its library and directly load
                        files into the “Downloads” folder of “The Outside
                        World”.
                    </div>
                )}
                <Input
                    type="search"
                    placeholder="Filter…"
                    defaultValue={search}
                    disabled={setSearch === undefined}
                    onChange={e => setSearchDebounced(e.target.value)}
                    size={searchFocused ? 40 : 20}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                />
            </DrawerHeader>
        </div>
    );
}

// Lazy-load to avoid the bundle size hit, but allow preloading so that it's
// usually ready by the time the drawer is opened.
const contentsLoader = () => import("./MacLibraryContents");
const MacLibraryContents = React.lazy(contentsLoader);
export function preloadMacLibraryContents() {
    contentsLoader();
}

function MacLibraryContentsFallback() {
    return (
        <DrawerContents tall>
            <MacLibraryHeader />
            <DrawerLoading />
        </DrawerContents>
    );
}
