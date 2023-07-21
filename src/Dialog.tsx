import React from "react";
import ReactDOM from "react-dom";
import {type ButtonProps, Button} from "./Button";
import "./Dialog.css";
import classNames from "classnames";

export type DialogProps = {
    title: string;
    children: React.ReactNode;
    onDone: (e: React.MouseEvent) => void;
    doneLabel?: string;
    doneEnabled?: boolean;
    onCancel?: () => void;
    buttonAppearance?: ButtonProps["appearance"];
    className?: string;
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
        className,
    } = props;
    const dialog = (
        <div className="Dialog-Backdrop">
            <div
                className={classNames(
                    "Dialog",
                    `Dialog-${buttonAppearance}`,
                    className
                )}>
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
                            onDone(e);
                        }}>
                        {doneLabel}
                    </Button>
                </footer>
            </div>
        </div>
    );
    return ReactDOM.createPortal(dialog, dialogRootNode);
}

const dialogRootNode = document.getElementById("dialog-root")!;
