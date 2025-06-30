import "./Monkey.css";
import {useRef, useState} from "react";
import {ScreenFrame} from "../ScreenFrame";
import {Select} from "../controls/Select";
import {
    AppearanceProvider,
    appearanceSystemFont,
    useAppearance,
} from "../controls/Appearance";
import {DialogFrame} from "../controls/Dialog";
import {MonkeyChat} from "./MonkeyChat";
import classNames from "classnames";
import {type Disk, DISKS} from "./disks";
import iconPath from "./Images/Icon.png";
import {type Provider, PROVIDERS} from "./Provider";

export default function Monkey() {
    const [disk, setDisk] = useState<Disk>(DISKS[0]);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [pointerEventsEnabled, setPointerEventsEnabled] = useState(false);
    const {width, height} = diskScreenSize(disk);

    return (
        <AppearanceProvider
            appearance={disk.appearance}
            variant={disk.appearanceVariant}>
            <div
                className="Monkey"
                style={
                    {
                        "--monkey-screen-height": `${height + (40 + 10) * 2}px`,
                    } as React.CSSProperties
                }>
                <ScreenFrame
                    className={classNames("Monkey-ScreenFrame", {
                        "Monkey-ScreenFrame-PointerEventsEnabled":
                            pointerEventsEnabled,
                    })}
                    bezelStyle={disk.bezelStyle}
                    width={width}
                    height={height}
                    bezelSize="Medium"
                    controls={[
                        {
                            label: "Manual Override",
                            handler: () => setPointerEventsEnabled(v => !v),
                            alwaysVisible: pointerEventsEnabled,
                            selected: pointerEventsEnabled,
                        },
                    ]}
                    screen={<Embed disk={disk} iframeRef={iframeRef} />}
                />
                <MonkeySidebar
                    disk={disk}
                    setDisk={setDisk}
                    iframeRef={iframeRef}
                />
            </div>
        </AppearanceProvider>
    );
}

function MonkeySidebar({
    disk,
    setDisk,
    iframeRef,
}: {
    disk: Disk;
    setDisk: (disk: Disk) => void;
    iframeRef: React.RefObject<HTMLIFrameElement>;
}) {
    const appearance = useAppearance();
    const [provider, setProvider] = useState(PROVIDERS[0]);

    return (
        <DialogFrame className="Monkey-Sidebar">
            <div className="Monkey-Title">
                <img
                    src={iconPath}
                    alt="Colorized Monkey DA Icon"
                    width="32"
                    height="32"
                />
                <div className="Monkey-Title-Text">
                    <h1 className={appearanceSystemFont(appearance)}>
                        Infinite Monkey
                    </h1>
                    <a href="https://infinitemac.org/">Infinite Mac</a> +{" "}
                    {provider.titleLink}
                </div>
            </div>
            <MonkeyControls
                disk={disk}
                setDisk={setDisk}
                provider={provider}
                setProvider={setProvider}
            />
            <MonkeyChat disk={disk} iframeRef={iframeRef} provider={provider} />
        </DialogFrame>
    );
}

function MonkeyControls({
    disk,
    setDisk,
    provider,
    setProvider,
}: {
    disk: Disk;
    setDisk: (disk: Disk) => void;
    provider: Provider;
    setProvider: (provider: Provider) => void;
}) {
    return (
        <div className="Monkey-Controls">
            <label>
                Disk:{" "}
                <Select
                    value={disk.name}
                    onChange={e =>
                        setDisk(
                            DISKS.find(m => m.name === e.target.value) ??
                                DISKS[0]
                        )
                    }>
                    {DISKS.map(m => (
                        <option key={m.name} value={m.name}>
                            {m.name}
                        </option>
                    ))}
                </Select>
            </label>
            <label>
                Provider:{" "}
                <Select
                    value={provider.id}
                    onChange={e =>
                        setProvider(
                            PROVIDERS.find(p => p.id === e.target.value)!
                        )
                    }>
                    {PROVIDERS.map(p => (
                        <option key={p.id} value={p.id}>
                            {p.label}
                        </option>
                    ))}
                </Select>
            </label>
        </div>
    );
}

function diskScreenSize(disk: Disk): {
    width: number;
    height: number;
    screenScale: number;
} {
    let [width, height] = disk.screenSize;
    let {screenScale = 1} = disk;
    if (
        window.innerWidth < width * screenScale + 320 ||
        window.innerHeight < height * screenScale
    ) {
        // Ignore screen scale if we can't fit the screen.
        screenScale = 1;
    }
    if (screenScale !== 1) {
        width = Math.round(width * screenScale);
        height = Math.round(height * screenScale);
    }
    return {width, height, screenScale};
}

function Embed({
    disk,
    iframeRef,
}: {
    disk: Disk;
    iframeRef: React.RefObject<HTMLIFrameElement>;
}) {
    const embedUrl = new URL("/embed", window.location.origin);
    embedUrl.searchParams.set("disk", disk.disk);
    if (disk.machine) {
        embedUrl.searchParams.set("machine", disk.machine);
    }
    embedUrl.searchParams.set("screen_update_messages", "true");
    embedUrl.searchParams.set("auto_pause", "true");
    if (disk.infiniteHD !== false) {
        embedUrl.searchParams.set("infinite_hd", "true");
    }
    const {width, height, screenScale} = diskScreenSize(disk);
    if (screenScale !== 1) {
        embedUrl.searchParams.set("screen_scale", screenScale.toString());
    }
    return (
        <iframe
            allow="cross-origin-isolated"
            src={embedUrl.toString()}
            title={disk.name}
            width={width}
            height={height}
            frameBorder="0"
            ref={iframeRef}
        />
    );
}
