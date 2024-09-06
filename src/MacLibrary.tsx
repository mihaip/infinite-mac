import {type Appearance} from "./controls/Appearance";
import {
    Drawer,
    DrawerContents,
    DrawerHeader,
    DrawerList,
    DrawerListCategory,
} from "./controls/Drawer";
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
                <MacLibraryContents
                    onRun={async (url, size) => {
                        collapse();
                        const name =
                            new URL(url).pathname.split("/").at(-1) ??
                            "Untitled";
                        const blob = await fetchWithProgress(
                            `/Library/proxy?url=${encodeURIComponent(url)}`,
                            loaded => onLoadProgress(name, loaded / size)
                        );
                        onRun(new File([blob], name));
                    }}
                    appearance={appearance}
                />
            )}
        />
    );
}

function MacLibraryContents({
    onRun,
    appearance,
}: {
    onRun: (url: string, size: number) => void;
    appearance: Appearance;
}) {
    return (
        <DrawerContents>
            <DrawerHeader>
                <div>
                    <a href="https://macintoshgarden.org/">
                        The Macintosh Garden
                    </a>
                    's mission is to preserve software for the Macintosh
                    platform. You can browse its library and directly load files
                    into the “Downloads” folder of “The Outside World”.
                </div>
            </DrawerHeader>
            <DrawerList>
                <DrawerListCategory title="Games > Action">
                    <button
                        onClick={() =>
                            onRun(
                                "https://macintoshgarden.org/sites/macintoshgarden.org/files/games/Power_Pete.sit",
                                7_164_745
                            )
                        }>
                        Power Pete
                    </button>
                </DrawerListCategory>
            </DrawerList>
        </DrawerContents>
    );
}
