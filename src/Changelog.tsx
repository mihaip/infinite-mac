import {useEffect} from "react";
import {Dialog} from "./Dialog";
import * as varz from "./varz";
import changelogText from "../CHANGELOG.md?raw";
import "./Changelog.css";

const changelogLines = changelogText
    .split("\n")
    // Ignore the Markdown heading
    .filter(l => l && !l.startsWith("#"));

export function Changelog({onDone}: {onDone: () => void}) {
    useEffect(() => {
        varz.increment("changelog_shown");
    });

    return (
        <Dialog title="Changelog" onDone={onDone}>
            <div className="Changelog-Text">
                {changelogLines.map(l => (
                    <p key={l}>{l}</p>
                ))}
            </div>
        </Dialog>
    );
}
