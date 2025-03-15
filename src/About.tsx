import {useEffect, useRef, useState} from "react";
import {Dialog} from "./controls/Dialog";
import {Donate} from "./Donate";
import * as varz from "./varz";
import {appearanceSystemFont} from "./controls/Appearance";
import {isMacOSXLaunched} from "./flags";

export function About({onDone}: {onDone: () => void}) {
    const [donateVisible, setDonateVisible] = useState(false);
    useEffect(() => {
        varz.increment("about_shown");
    }, []);

    const aboutContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const aboutContainerDom = aboutContainerRef.current;
        if (!aboutContainerDom) {
            return;
        }
        for (const headings of aboutContainerDom.querySelectorAll("h2")) {
            headings.classList.add(appearanceSystemFont("Classic"));
        }

        const email = [
            109, 105, 104, 97, 105, 64, 112, 101, 114, 115, 105, 115, 116, 101,
            110, 116, 46, 105, 110, 102, 111,
        ]
            .map(c => String.fromCharCode(c))
            .join("");

        const emailLink =
            aboutContainerDom.querySelector<HTMLAnchorElement>(".email");
        if (emailLink) {
            emailLink.href = `mailto:${email}`;
        }

        const counterDom = aboutContainerDom.querySelector(".counter");
        if (counterDom) {
            varz.get("emulator_starts").then(
                count => (counterDom.textContent = count.toLocaleString())
            );
        }

        if (isMacOSXLaunched) {
            const macosxQuestion =
                aboutContainerDom.querySelector(".macosx-faq");
            if (macosxQuestion) {
                while (
                    macosxQuestion.nextSibling &&
                    macosxQuestion.nextSibling.nodeName !== "H3"
                ) {
                    macosxQuestion.nextSibling.remove();
                }
                macosxQuestion.remove();
            }
        }

        const donateLink = aboutContainerDom.querySelector(".donate");
        if (donateLink) {
            const showDonate = () => setDonateVisible(true);
            donateLink.addEventListener("click", showDonate);
            return () => donateLink.removeEventListener("click", showDonate);
        }
    }, []);

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
// visible to crawlers that don't run JavaScript.
const aboutHTML = document.getElementById("about")!.innerHTML;
