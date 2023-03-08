import {useEffect, useState} from "react";
import {Dialog} from "./Dialog";
import {Donate} from "./Donate";
import * as varz from "./varz";

export function About({
    onDone,
    hideSites,
}: {
    onDone: () => void;
    hideSites?: boolean;
}) {
    const email = [
        109, 105, 104, 97, 105, 64, 112, 101, 114, 115, 105, 115, 116, 101, 110,
        116, 46, 105, 110, 102, 111,
    ]
        .map(c => String.fromCharCode(c))
        .join("");
    const [donateVisible, setDonateVisible] = useState(false);
    useEffect(() => {
        varz.increment("about_shown");
    });
    if (donateVisible) {
        return <Donate onDone={onDone} />;
    }

    return (
        <Dialog title="About" onDone={onDone}>
            <p>
                Infinite Mac is a project by{" "}
                <a href="https://persistent.info">Mihai Parparita</a> to make
                classic Mac emulation easily accessible.
            </p>
            <p>
                It uses WebAssembly ports of{" "}
                <a href="https://www.gryphel.com/c/minivmac/">Mini vMac</a>,{" "}
                <a href="https://basilisk.cebix.net/">Basilisk II</a> and{" "}
                <a href="https://sheepshaver.cebix.net/">SheepShaver</a> to
                allow a broad set of System Software/Mac OS versions to run on
                the web{hideSites ? "." : ":"}
            </p>
            {!hideSites && (
                <ul>
                    <li>
                        System 6.0.8:{" "}
                        <a href="https://system6.app">system6.app</a>
                    </li>
                    <li>
                        System 7.5.3:{" "}
                        <a href="https://system7.app">system7.app</a>
                    </li>
                    <li>
                        KanjiTalk 7.5.3:{" "}
                        <a href="https://kanjitalk7.app">kanjitalk7.app</a>
                    </li>
                    <li>
                        Mac OS 8.1: <a href="https://macos8.app">macos8.app</a>
                    </li>
                    <li>
                        Mac OS 9.0.4:{" "}
                        <a href="https://macos9.app">macos9.app</a>
                    </li>
                </ul>
            )}
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
            <p>
                For feedback, you can reach Mihai at{" "}
                <a href={`mailto:${email}`}>{email}</a> or{" "}
                <a href="https://hachyderm.io/@mihaip">@mihaip@hachyderm.io</a>.
                For bug reports or software requests, you can also{" "}
                <a href="https://github.com/mihaip/infinite-mac/issues/new">
                    file an issue on GitHub
                </a>
                .
            </p>
            <p>
                If you'd like to support the project, you can{" "}
                <span className="link" onClick={() => setDonateVisible(true)}>
                    donate
                </span>
                .
            </p>
        </Dialog>
    );
}
