import {useEffect, useMemo, useRef, useState} from "react";
import {Dialog} from "@/controls/Dialog";
import {Donate} from "@/app/Donate";
import * as varz from "@/lib/varz";
import {appearanceSystemFont} from "@/controls/Appearance";

export function About({onDone}: {onDone: () => void}) {
    const [donateVisible, setDonateVisible] = useState(false);
    const [emulatorCount, setEmulatorCount] = useState<string | undefined>();

    useEffect(() => {
        varz.increment("about_shown");
        varz.get("emulator_starts").then(count =>
            setEmulatorCount(count.toLocaleString())
        );
    }, []);

    const headingClass = appearanceSystemFont("Classic");
    const emailRef = useRef<HTMLAnchorElement>(null);

    useEffect(() => {
        const node = emailRef.current;
        if (!node) {
            return;
        }
        const email = [
            109, 105, 104, 97, 105, 64, 112, 101, 114, 115, 105, 115, 116, 101,
            110, 116, 46, 105, 110, 102, 111,
        ]
            .map(c => String.fromCharCode(c))
            .join("");
        node.href = `mailto:${email}`;
    }, []);

    if (donateVisible) {
        return <Donate onDone={onDone} />;
    }

    return (
        <Dialog title="About" onDone={onDone}>
            <div>
                <p>
                    Infinite Mac is a project by{" "}
                    <a href="https://persistent.info">Mihai Parparita</a> to
                    make classic Mac and NeXT emulation easily accessible. It
                    uses WebAssembly ports of{" "}
                    <a href="https://www.gryphel.com/c/minivmac/">Mini vMac</a>,{" "}
                    <a href="https://basilisk.cebix.net/">Basilisk II</a>,{" "}
                    <a href="https://sheepshaver.cebix.net/">SheepShaver</a>,{" "}
                    <a href="https://github.com/dingusdev/dingusppc">
                        DingusPPC
                    </a>
                    ,{" "}
                    <a href="https://github.com/sebastianbiallas/pearpc">
                        PearPC
                    </a>
                    , and{" "}
                    <a href="https://sourceforge.net/projects/previous/">
                        Previous
                    </a>{" "}
                    to allow a broad set of OS versions to run on the web.
                </p>
                <p>
                    Shortcuts to the most popular versions are available:{" "}
                    <a href="https://system6.app">system6.app</a>,{" "}
                    <a href="https://system7.app">system7.app</a>,{" "}
                    <a href="https://kanjitalk7.app">kanjitalk7.app</a>,{" "}
                    <a href="https://macos8.app">macos8.app</a>, and{" "}
                    <a href="https://macos9.app">macos9.app</a>.
                </p>

                <h2 className={headingClass}>FAQ</h2>

                <h3>How do I use it?</h3>
                <p>
                    The welcome document or Stickies in each machine has
                    instructions. For a demo of the kinds of capabilities the
                    emulators have, see{" "}
                    <a
                        href="https://www.youtube.com/embed/tljxs9zuaA8"
                        target="_blank"
                        rel="noopener noreferrer">
                        this video
                    </a>
                    .
                </p>

                <h3>How do I get files in and out?</h3>
                <p>
                    Most emulated Macs (System 7 to Mac OS 9.0.4) have a "The
                    Outside World" drive on the desktop. Files dragged into the
                    browser window will appear in the “Downloads” folder, and
                    files placed in the “Uploads” folder will be downloaded to
                    your computer. To preserve resource forks when dragging in
                    files from modern macOS, you'll need to first archive the
                    file or folder into a .zip. See{" "}
                    <a href="https://blog.persistent.info/2025/09/infinite-mac-resource-forks.html">
                        this blog post
                    </a>{" "}
                    for details.
                </p>

                <h3>How does it work?</h3>
                <p>
                    To learn more, including how it was built, see{" "}
                    <a href="https://blog.persistent.info/search/label/Infinite%20Mac">
                        this series of blog posts
                    </a>
                    . Source code is{" "}
                    <a href="https://github.com/mihaip/infinite-mac">
                        available on GitHub
                    </a>
                    .
                </p>

                <h3>Why is it called Infinite Mac?</h3>
                <p>
                    Partly because it evokes{" "}
                    <a href="https://en.wikipedia.org/wiki/Apple_Infinite_Loop_campus">
                        Infinite Loop
                    </a>
                    , partly because porting something to the web means it can
                    be run on an almost infinite number of devices, and partly
                    because it's a{" "}
                    <a href="https://heredragonsabound.blogspot.com/2020/02/the-forever-project.html">
                        forever project
                    </a>
                    .
                </p>

                <h3>Why is NeXTStep included?</h3>
                <p>
                    It's a contemporary of classic Mac OS and an ancestor of Mac
                    OS X.
                </p>

                <h3 className="macosx-faq">Why is Mac OS X so slow?</h3>
                <p>
                    Mac OS X is a much more resource-intensive operating system
                    than classic Mac OS (it also ran rather slowly on real early
                    2000s hardware). It's possible that adding QEMU as an
                    emulator option will improve performance. You can subscribe
                    to{" "}
                    <a href="https://github.com/mihaip/infinite-mac/issues/72">
                        GitHub issue #72
                    </a>{" "}
                    to get updates on any QEMU-related progress.
                </p>

                <h3>What about DOS or Windows? Apple II? ProDOS? BeOS?</h3>

                <p>
                    The project is focused on classic Macintosh and adjacent
                    systems, but if you're interested in other operating
                    systems, you can check out{" "}
                    <a href="https://www.pcjs.org/">PCjs</a> or{" "}
                    <a href="https://copy.sh/v86/">Virtual x86</a> for Windows,
                    and{" "}
                    <a href="https://www.scullinsteel.com/apple2/">
                        Apple ][js
                    </a>{" "}
                    for ProDOS.
                </p>

                <h3>Do you have a web counter?</h3>
                <p>
                    Ah, the staple of mid-90s personal pages. Sort of –{" "}
                    <span className="counter">
                        {emulatorCount ?? "Loading…"}
                    </span>{" "}
                    emulated Mac instances have been started since the site
                    debuted.
                </p>

                <h3>How can I provide feedback?</h3>
                <p>
                    You can reach Mihai{" "}
                    <a className="email" ref={emailRef}>
                        via email
                    </a>{" "}
                    or{" "}
                    <a href="https://hachyderm.io/@mihaip">
                        @mihaip@hachyderm.io
                    </a>
                    . For bug reports or software requests, you can also{" "}
                    <a href="https://github.com/mihaip/infinite-mac/issues/new">
                        file an issue on GitHub
                    </a>
                    .
                </p>

                <h3>How can I support the project?</h3>
                <p>
                    Using it, sharing it, and giving feedback is the best way.
                    If you'd like to support the project financially, you can{" "}
                    <span
                        className="link donate"
                        onClick={e => {
                            e.preventDefault();
                            setDonateVisible(true);
                        }}>
                        donate
                    </span>
                    .
                </p>
            </div>
        </Dialog>
    );
}
