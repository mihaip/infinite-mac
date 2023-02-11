import React from "react";
import "./ScreenFrame.css";
import {ReactComponent as AppleLogoColor} from "./AppleLogoColor.svg";
import {ReactComponent as AppleLogoGrey} from "./AppleLogoGrey.svg";

export type ScreenFrameProps = {
    className?: string;
    bezelStyle: "Beige" | "Platinum" | "Pinstripes";
    bezelSize?: "Small" | "Medium" | "Large";
    width: number;
    height: number;
    scale?: number;
    fullscreen?: boolean;
    loading?: boolean;
    controls: ScreenControl[];
    screen?: React.ReactElement;
    children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

export type ScreenControl = {
    label: string;
    handler: () => void;
};

export function ScreenFrame(props: ScreenFrameProps) {
    const {
        className,
        bezelStyle,
        bezelSize = "Large",
        width,
        height,
        scale,
        fullscreen,
        loading,
        controls,
        screen,
        children,
        ...divProps
    } = props;

    const classNames = [
        "ScreenFrame",
        `ScreenFrame-Bezel-${bezelStyle}`,
        `ScreenFrame-Bezel-${bezelSize}`,
    ];
    if (fullscreen) {
        classNames.push("ScreenFrame-Fullscreen");
    }
    if (className) {
        classNames.push(className);
    }
    const AppleLogo =
        bezelStyle === "Pinstripes" ? AppleLogoGrey : AppleLogoColor;

    return (
        <div
            className={classNames.join(" ")}
            style={{
                width: `calc(${width}px + 2 * var(--screen-underscan))`,
                height: `calc(${height}px + 2 * var(--screen-underscan))`,
                transform: scale === undefined ? undefined : `scale(${scale})`,
            }}
            {...divProps}>
            <div className="ScreenFrame-Controls-Container">
                <div className="ScreenFrame-Apple-Logo">
                    <AppleLogo className="Background" />
                    <AppleLogo className="Foreground" />
                </div>
                {controls.map(({label, handler}, i) => (
                    <div
                        className="ScreenFrame-Control ScreenFrame-Bezel-Text"
                        onClick={handler}
                        data-text={label}
                        key={label}>
                        {label}
                    </div>
                ))}
            </div>
            <div
                className={
                    "ScreenFrame-Led" +
                    (loading ? " ScreenFrame-Led-Loading" : "")
                }
            />
            <div
                className="ScreenFrame-ScreenContainer"
                style={{
                    width,
                    height,
                }}>
                {screen}
            </div>
            {children}
        </div>
    );
}
