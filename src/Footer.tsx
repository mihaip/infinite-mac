import {useState} from "react";
import {About} from "./About";
import {Donate} from "./Donate";
import "./Footer.css";

export function Footer({onLogoClick}: {onLogoClick?: () => void}) {
    const [aboutVisible, setAboutVisible] = useState(false);
    const [donateVisible, setDonateVisible] = useState(false);

    return (
        <div className="Footer">
            {aboutVisible && <About onDone={() => setAboutVisible(false)} />}
            {donateVisible && <Donate onDone={() => setDonateVisible(false)} />}
            <span onClick={onLogoClick} className="Footer-Logo">
                Infinite Mac
            </span>
            <span
                onClick={() => setAboutVisible(true)}
                className="Footer-About">
                About
            </span>
            <span
                onClick={() => setDonateVisible(true)}
                className="Footer-Donate">
                Donate
            </span>
        </div>
    );
}
