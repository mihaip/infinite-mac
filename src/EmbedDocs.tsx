import "./EmbedDocs.css";
import {useCallback, useEffect, useState} from "react";
import {Dialog} from "./controls/Dialog";
import * as varz from "./varz";
import {Embed} from "./Embed";
import {
    type Appearance,
    AppearanceProvider,
    type AppearanceVariant,
} from "./controls/Appearance";

export function EmbedDocs({
    appearance = "Classic",
    appearanceVariant,
    onDone,
}: {
    appearance?: Appearance;
    appearanceVariant?: AppearanceVariant;
    onDone: () => void;
}) {
    const [embedVisible, setEmbedVisible] = useState(false);
    useEffect(() => {
        varz.increment("embed_docs_shown");
    }, []);
    const handleEmbedClick = useCallback((event: React.MouseEvent) => {
        event.preventDefault();
        setEmbedVisible(true);
    }, []);

    if (embedVisible) {
        return <Embed onDone={onDone} />;
    }

    return (
        <AppearanceProvider appearance={appearance} variant={appearanceVariant}>
            <Dialog
                title="Embed Developer Documentation"
                onDone={onDone}
                className="EmbedDocs">
                <p>
                    Infinite Mac can be embedded via an iframe with a URL of the
                    form <code>{location.origin}/embed?...</code>
                    The easiest way to generate an embedded URL is to use the{" "}
                    <a href="/embed" onClick={handleEmbedClick}>
                        embed HTML generator page
                    </a>
                    . For the full details of the supported iframe query
                    parameters, see the{" "}
                    <a href="https://github.com/mihaip/infinite-mac/blob/main/src/run-def.ts#L59">
                        <code>runDefFromUrl</code> function
                    </a>{" "}
                    in the Infinite Mac source code. There is also a{" "}
                    <a href="https://infinitemac.org/embed-testbed.html">
                        testbed
                    </a>{" "}
                    (
                    <a href="https://github.com/mihaip/infinite-mac/blob/main/public/embed-testbed.html">
                        code
                    </a>
                    ) that lets you try out some common options.
                </p>

                <h2>Iframe and Screen Sizing</h2>
                <p>
                    The size of the iframe normally determines the resolution of
                    the emulated machine's screen. That is{" "}
                    <code>
                        &lt;iframe src="..." width="640" height="480"&gt;
                    </code>{" "}
                    will result in a machine with a 640x480 screen. You can do
                    integer scaling by changing the dimensions of the iframe and
                    adding a <code>screen_scale</code> query parameter. For
                    example,
                    <code>
                        &lt;iframe src="...?screen_scale=2" width="1280"
                        height="960"&gt;
                    </code>{" "}
                    will result in a 640x480 screen scaled by a factor of 2 that
                    is rendered crisply.
                </p>

                <h2>Performance</h2>
                <p>
                    Infinite Mac relies on <code>SharedArrayBuffer</code> for
                    maximum performance. You may need to set the{" "}
                    <code>Cross-Origin-Embedder-Policy</code> header in your
                    page to <code>require-corp</code> and/or add the{" "}
                    <code>allow="cross-origin-isolated"</code> attribute to the
                    iframe to enable this. The emulator will still run without
                    <code>SharedArrayBuffer</code>, but it will be be{" "}
                    <a href="https://blog.persistent.info/2021/08/worker-loop.html">
                        hackier
                    </a>{" "}
                    and slower. You can look for a "SharedArrayBuffer is not
                    available, fallback more will be used. Performance may be
                    degraded." message in the console to determine if this is
                    the case.
                </p>

                <h2>Sending Messages To The Iframe</h2>
                <p>
                    You can send messages to the iframe using the{" "}
                    <code>postMessage</code> API, allowing you to control it
                    from within the parent page.
                </p>
                <pre>
                    const iframe = document.getElementById("my-iframe");{"\n"}
                    iframe.contentWindow.postMessage({"{"}type: "emulator_
                    <i>command</i>"{"}"}, "*");
                </pre>
                <p>
                    Currently supported message payloads (see also the{" "}
                    <a href="https://github.com/mihaip/infinite-mac/blob/main/src/embed-types.ts">
                        <code>EmbedControlEvent</code>
                    </a>{" "}
                    type):
                </p>
                <ul className="EmbedDocs-MessageList">
                    <li>
                        {message({type: "emulator_pause"})}: Pause the emulator.
                        May be useful if you do not want it to use resources
                        while the user is not interacting with it. See also the{" "}
                        <code>pause=true</code> (start with the emulator
                        initially paused) and <code>auto_pause=true</code>{" "}
                        (automatically pause and unpause the emulator when it
                        out of and into view) query parameters.
                    </li>
                    <li>
                        {message({type: "emulator_unpause"})}: Unpause the
                        emulator.
                    </li>
                    <li>
                        {message({
                            type: "emulator_mouse_move",
                            x: 11,
                            y: 15,
                            deltaX: 2,
                            deltaY: 4,
                        })}
                        : Send a mouse movement to the emulator. Some emulators
                        (Mini vMac, Basilisk II, SheepShaver) support absolute
                        coordinates, while others (Previous, DingusPPC, PearPC)
                        only support relative coordinates.
                    </li>
                    <li>
                        {message({type: "emulator_mouse_down", button: 0})} and{" "}
                        {message({type: "emulator_mouse_up", button: 0})}: Send
                        mouse button up and down events. Some emulator and
                        operating system combinations (Previous, DingusPPC with
                        Mac OS X) support right-clicking, in which case the{" "}
                        <code>button</code> parameter can also be set to{" "}
                        <code>2</code> to control the right mouse button.
                    </li>
                    <li>
                        {message({type: "emulator_key_down", code: "KeyA"})} and{" "}
                        {message({type: "emulator_key_up", code: "KeyA"})}: Send
                        key up and down events. The <code>code</code> property
                        is a physical key code, based on the{" "}
                        <a href="https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code">
                            <code>code</code> value of a JavaScript keyboard
                            event
                        </a>
                        . See{" "}
                        <a href="https://github.com/mihaip/infinite-mac/blob/main/src/emulator/emulator-key-codes.ts">
                            the source code
                        </a>{" "}
                        for the full list of supported key codes.
                    </li>
                    <li>
                        {message({type: "emulator_load_disk", url: "..."})}:
                        Load a disk image into the emulator. Only supported by
                        the Mini vMac, Basilisk II, SheepShaver and Previous
                        emulators. The <code>url</code> property should be a URL
                        to an uncompressed disk image file (e.g. a .dsk, .img,
                        .iso, .toast, etc.).
                    </li>
                </ul>

                <h2>Receiving Messages From The Iframe</h2>

                <p>
                    The iframe will send messages to the parent page using the{" "}
                    <code>postMessage</code> API, allowing you to monitor its
                    status and respond to changes within it.
                </p>

                <pre>
                    window.addEventListener("message", e ={"> {\n  "}
                    switch (e.data.type) {"{\n    "}
                    case "emulator_<i>message</i>: ...{"\n  "}
                    {"}\n"}
                    {"}"});
                </pre>

                <p>
                    Currently supported message payloads (see also the{" "}
                    <a href="https://github.com/mihaip/infinite-mac/blob/main/src/embed-types.ts">
                        <code>EmbedNotificationEvent</code>
                    </a>{" "}
                    type):
                </p>
                <ul className="EmbedDocs-MessageList">
                    <li>
                        {message({type: "emulator_loaded"})}: Sent when the
                        emulator has finished loading all of its data files and
                        has begun running the emulated machine.
                    </li>
                    <li>
                        {message({
                            type: "emulator_screen",
                            data: Uint8Array,
                            width: 640,
                            height: 480,
                        })}
                        : Sent when the contents of the screen change. Requires{" "}
                        <code>screen_update_messages=true</code> query parameter
                        to be set. The data is a <code>Uint8Array</code>{" "}
                        containing the raw pixel data of the screen, in RGBA
                        format (4 bytes per pixel).
                    </li>
                </ul>

                <h2>Reporting Bugs</h2>
                <p>
                    If you have run into a bug, you can{" "}
                    <a href="https://github.com/mihaip/infinite-mac/issues/new">
                        file an issue on GitHub
                    </a>
                    . Please include as much detail as possible (ideally a link
                    to a page with a reproduction).
                </p>
            </Dialog>
        </AppearanceProvider>
    );
}

function message(payload: Record<string, unknown>) {
    return (
        <code>
            {JSON.stringify(payload).replace(",", ", ").replace(":", ": ")}
        </code>
    );
}
