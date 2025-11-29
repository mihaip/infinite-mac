import {useEffect} from "react";
import {Dialog} from "@/controls/Dialog";
import * as varz from "@/lib/varz";
import changelogText from "../../CHANGELOG.md?raw";
import Linkify from "linkify-react";

const changelogLines = changelogText
    .split("\n")
    // Ignore the Markdown heading
    .filter(l => l && !l.startsWith("#"));

export function Changelog({onDone}: {onDone: () => void}) {
    useEffect(() => {
        varz.increment("changelog_shown");
    }, []);

    return (
        <Dialog title="Changelog" onDone={onDone}>
            {changelogLines.map(l => (
                <p key={l}>
                    <Linkify>{l}</Linkify>
                </p>
            ))}
        </Dialog>
    );
}
