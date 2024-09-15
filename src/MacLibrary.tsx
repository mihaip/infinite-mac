import React, {Suspense} from "react";
import {type Appearance} from "./controls/Appearance";
import {Drawer, DrawerContents, DrawerHeader} from "./controls/Drawer";
import {fetchWithProgress} from "./fetch";
import macintoshGardenIcon from "./Images/Macintosh-Garden.png";

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
                <Suspense fallback={<MacLibraryContentsFallback />}>
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

const MacLibraryContents = React.lazy(() => import("./MacLibraryContents"));

function MacLibraryContentsFallback() {
    return (
        <DrawerContents>
            <DrawerHeader>Loading…</DrawerHeader>
        </DrawerContents>
    );
}
