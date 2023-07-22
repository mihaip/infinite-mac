import {useEffect, useRef, useState} from "react";
import {Dialog} from "./controls/Dialog";
import {Donate} from "./Donate";
import * as varz from "./varz";

export function About({onDone}: {onDone: () => void}) {
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

    const aboutContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const emailLink =
            aboutContainerRef.current?.querySelector<HTMLAnchorElement>(
                ".email"
            );
        if (emailLink) {
            emailLink.href = `mailto:${email}`;
        }
        const donateLink = aboutContainerRef.current?.querySelector(".donate");
        if (donateLink) {
            const showDonate = () => setDonateVisible(true);
            donateLink.addEventListener("click", showDonate);
            return () => donateLink.removeEventListener("click", showDonate);
        }
    });

    if (donateVisible) {
        return <Donate onDone={onDone} />;
    }

    return (
        <Dialog title="About" onDone={onDone}>
            <div
                ref={aboutContainerRef}
                dangerouslySetInnerHTML={{__html: aboutHTML}}
            />
        </Dialog>
    );
}

// The HTML of the about screen lives in the index.html page so that it's
// vsible to crawlers that don't run JavaScript.
const aboutHTML = document.getElementById("about")!.innerHTML;
