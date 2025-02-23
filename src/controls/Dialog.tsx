import React from "react";
import ReactDOM from "react-dom";
import {Button} from "./Button";
import "./Dialog.css";
import classNames from "classnames";
import {
    appearanceSystemFont,
    useAppearance,
    useAppearanceVariant,
} from "./Appearance";

export function Dialog({
    title,
    children,
    onDone,
    doneLabel = "Done",
    doneEnabled = true,
    onOther,
    otherLabel,
    onCancel,
    className,
}: {
    title: string;
    children: React.ReactNode;
    onDone: (e: React.MouseEvent) => void;
    doneLabel?: string;
    doneEnabled?: boolean;
    onOther?: (e: React.MouseEvent) => void;
    otherLabel?: string;
    onCancel?: () => void;
    className?: string;
}) {
    const appearance = useAppearance();
    const appearanceVariant = useAppearanceVariant();
    const dialog = (
        <div className="Dialog-Backdrop">
            <div
                className={classNames(
                    "Dialog",
                    `Dialog-${appearance}`,
                    {
                        "Dialog-System7": appearanceVariant === "System7",
                    },
                    className
                )}>
                <h1 className={appearanceSystemFont(appearance)}>{title}</h1>

                <div className="Dialog-Content">{children}</div>

                <footer>
                    {onCancel && (
                        <Button
                            className="Dialog-Normal-Button"
                            onClick={e => {
                                e.preventDefault();
                                onCancel();
                            }}>
                            Cancel
                        </Button>
                    )}
                    {onOther && (
                        <Button
                            className="Dialog-Normal-Button"
                            onClick={e => {
                                e.preventDefault();
                                onOther(e);
                            }}>
                            {otherLabel}
                        </Button>
                    )}
                    <Button
                        disabled={!doneEnabled}
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
