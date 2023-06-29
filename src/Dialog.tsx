import React from "react";
import ReactDOM from "react-dom";
import {type ButtonProps, Button} from "./Button";
import "./Dialog.css";

export type DialogProps = {
    title: string;
    children: React.ReactNode;
    onDone: () => void;
    doneLabel?: string;
    doneEnabled?: boolean;
    onCancel?: () => void;
    buttonAppearance?: ButtonProps["appearance"];
};

export function Dialog(props: DialogProps) {
    const {
        title,
        children,
        onDone,
        doneLabel = "Done",
        doneEnabled = true,
        onCancel,
        buttonAppearance = "Classic",
    } = props;
    const dialog = (
        <div className="Dialog">
            <h1>{title}</h1>

            {children}

            <footer>
                {onCancel && (
                    <Button
                        className="Dialog-Cancel"
                        appearance={buttonAppearance}
                        onClick={e => {
                            e.preventDefault();
                            onCancel();
                        }}>
                        Cancel
                    </Button>
                )}
                <Button
                    disabled={!doneEnabled}
                    appearance={buttonAppearance}
                    onClick={e => {
                        e.preventDefault();
                        onDone();
                    }}>
                    {doneLabel}
                </Button>
            </footer>
        </div>
    );
    return ReactDOM.createPortal(dialog, dialogRootNode);
}

const dialogRootNode = document.getElementById("dialog-root")!;
