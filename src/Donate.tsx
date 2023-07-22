import {useEffect} from "react";
import {Dialog} from "./controls/Dialog";
import * as varz from "./varz";

export function Donate({onDone}: {onDone: () => void}) {
    useEffect(() => {
        varz.increment("donate_shown");
    });

    return (
        <Dialog title="Donate" onDone={onDone}>
            <p>
                While working on the project is its own reward (and I have a
                full-time job), there are hosting costs associated with the
                infrastructure that it needs (mostly domain name registrations
                and web hosting). I'm hoping that sponsorship can cover them.
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
            <p>Thanks!</p>
        </Dialog>
    );
}
