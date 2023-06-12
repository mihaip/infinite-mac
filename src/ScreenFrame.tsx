import React from "react";
import "./ScreenFrame.css";
import {ReactComponent as AppleLogoColor} from "./Images/AppleLogoColor.svg";
import {ReactComponent as AppleLogoGrey} from "./Images/AppleLogoGrey.svg";
import classNames from "classnames";

export type ScreenFrameProps = {
    className?: string;
    bezelStyle: "Beige" | "Platinum" | "Pinstripes";
    bezelSize?: "Small" | "Small-ish" | "Medium" | "Large";
    width: number;
    height: number;
    scale?: number;
    fullscreen?: boolean;
    led?: "None" | "On" | "Loading";
    controls?: ScreenControl[];
    screen?: React.ReactElement;
    children?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

export type ScreenControl = {
    label: string;
    handler: () => void;
    alwaysVisible?: boolean;
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
        led = "None",
        controls = [],
        screen,
        children,
        ...divProps
    } = props;

    const screenFrameClassName = classNames(
        "ScreenFrame",
        `ScreenFrame-Bezel-${bezelStyle}`,
        `ScreenFrame-Bezel-${bezelSize}`,
        className,
        {
            "ScreenFrame-Fullscreen": fullscreen,
        }
    );
    const ledClassName = classNames("ScreenFrame-Led", {
        "ScreenFrame-Led-Loading": led === "Loading",
    });
    const AppleLogo =
        bezelStyle === "Pinstripes" ? AppleLogoGrey : AppleLogoColor;

    return (
        <div
            className={screenFrameClassName}
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
                {controls.map(({label, handler, alwaysVisible}, i) => (
                    <div
                        className="ScreenFrame-Control ScreenFrame-Bezel-Text"
                        style={{
                            visibility: alwaysVisible ? "visible" : undefined,
                        }}
                        onClick={handler}
                        key={label}>
                        {label}
                    </div>
                ))}
            </div>
            {led !== "None" && <div className={ledClassName} />}
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
