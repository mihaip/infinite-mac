import {useState} from "react";
import {About} from "./About";
import {Donate} from "./Donate";
import "./Footer.css";

export function Footer() {
    const [aboutVisible, setAboutVisible] = useState(false);
    const [donateVisible, setDonateVisible] = useState(false);

    return (
        <div className="Footer">
            {aboutVisible && <About onDone={() => setAboutVisible(false)} />}
            {donateVisible && <Donate onDone={() => setDonateVisible(false)} />}
            Infinite Mac -{" "}
            <span onClick={() => setAboutVisible(true)}>About</span> -{" "}
            <span onClick={() => setDonateVisible(true)}>Donate</span>
        </div>
    );
}
