import React from "react";
import ReactDOM from "react-dom";
import type {ButtonProps} from "./Button";
import {Button} from "./Button";
import "./Dialog.css";

export type DialogProps = {
    title: string;
    children: React.ReactNode;
    onDone: () => void;
    buttonAppearance?: ButtonProps["appearance"];
};

export function Dialog(props: DialogProps) {
    const {title, children, onDone, buttonAppearance = "Classic"} = props;
    const dialog = (
        <div className="Dialog">
            <h1>{title}</h1>

            {children}

            <footer>
                <Button
                    appearance={buttonAppearance}
                    onClick={e => {
                        e.preventDefault();
                        onDone();
                    }}>
                    Done
                </Button>
            </footer>
        </div>
    );
    return ReactDOM.createPortal(dialog, dialogRootNode);
}

const dialogRootNode = document.getElementById("dialog-root")!;