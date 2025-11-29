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
    doneClassName,
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
    doneClassName?: string;
    onOther?: (e: React.MouseEvent) => void;
    otherLabel?: string;
    onCancel?: () => void;
    className?: string;
}) {
    const appearance = useAppearance();
    const dialog = (
        <div
            className={classNames(
                "Dialog-Backdrop",
                `Dialog-Backdrop-${appearance}`
            )}>
            <DialogFrame className={className}>
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
                        className={doneClassName}
                        disabled={!doneEnabled}
                        onClick={e => {
                            e.preventDefault();
                            onDone(e);
                        }}>
                        {doneLabel}
                    </Button>
                </footer>
            </DialogFrame>
        </div>
    );
    return ReactDOM.createPortal(
        dialog,
        document.getElementById("dialog-root")!
    );
}

export function DialogFrame({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    const appearance = useAppearance();
    const appearanceVariant = useAppearanceVariant();
    return (
        <div
            className={classNames(
                "Dialog",
                `Dialog-${appearance}`,
                {
                    "Dialog-System7": appearanceVariant === "System7",
                },
                className
            )}>
            {children}
        </div>
    );
}
