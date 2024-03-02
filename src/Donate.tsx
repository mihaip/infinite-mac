import {useEffect} from "react";
import {Dialog} from "./controls/Dialog";
import * as varz from "./varz";

export function Donate({onDone}: {onDone: () => void}) {
    useEffect(() => {
        varz.increment("donate_shown");
    }, []);

    return (
        <Dialog title="Donate" onDone={onDone}>
            <p>
                While working on the project is its own reward (and I have a
                full-time job), there are hosting costs associated with the
                infrastructure that it needs (mostly domain name registrations
                and web hosting).
            </p>
            <p>
                Donations to support the project can be done via{" "}
                <a href="https://github.com/sponsors/mihaip">GitHub Sponsors</a>{" "}
                or{" "}
                <a href="https://www.paypal.com/donate/?hosted_button_id=394METCPT6PYN">
                    PayPal
                </a>
                .
            </p>
            <p>
                Thanks!
                <br />
                <a href="https://blog.persistent.info/#about-me">Mihai</a>
            </p>
            <p></p>
            <p>
                P.S. Infinite Mac owes a big debt to the archiving work done by
                the <a href="https://macintoshgarden.org/">Macintosh Garden</a>{" "}
                and the <a href="https://archive.org">Internet Archive</a>. You
                may also want to consider supporting those sites too via{" "}
                <a href="https://www.patreon.com/macintoshgarden">
                    Macintosh Garden's Patreon
                </a>{" "}
                and{" "}
                <a href="https://archive.org/donate">
                    donating to the Internet Archive
                </a>
                .
            </p>
        </Dialog>
    );
}
