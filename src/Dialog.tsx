import React from "react";
import ReactDOM from "react-dom";
import "./Dialog.css";

export type DialogProps = {
    title: string;
    children: React.ReactNode;
    onDone: () => void;
};

export function Dialog(props: DialogProps) {
    const {title, children, onDone} = props;
    const dialog = (
        <div className="Dialog">
            <h1>{title}</h1>

            {children}

            <footer>
                <button
                    onClick={e => {
                        e.preventDefault();
                        onDone();
                    }}>
                    Done
                </button>
            </footer>
        </div>
    );
    return ReactDOM.createPortal(dialog, dialogRootNode);
}

const dialogRootNode = document.getElementById("dialog-root")!;
