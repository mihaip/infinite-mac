import React from "react";
import "@/controls/ScreenFrame.css";
import AppleLogoColor from "@/Images/AppleLogoColor.svg?react";
import AppleLogoGrey from "@/Images/AppleLogoGrey.svg?react";
import NeXTLogo from "@/Images/NeXTLogo.svg?react";
import classNames from "classnames";

export type ScreenFrameProps = {
    className?: string;
    bezelStyle: "Beige" | "Platinum" | "Pinstripes" | "NeXT";
    bezelSize?: "Small" | "Small-ish" | "Medium" | "Large";
    width: number;
    height: number;
    scale?: number;
    fullscreen?: boolean;
    led?: "None" | "On" | "Loading";
    onLedClick?: () => void;
    controls?: ScreenControl[];
    screen?: React.ReactElement;
    children?: React.ReactNode;
    viewTransitionName?: string;
} & React.HTMLAttributes<HTMLDivElement>;

export type ScreenControl = {
    label: string;
    handler: () => void;
    alwaysVisible?: boolean;
    selected?: boolean;
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
        onLedClick,
        controls = [],
        screen,
        children,
        viewTransitionName,
        ...divProps
    } = props;

    const screenFrameClassName = classNames(
        "ScreenFrame",
        `ScreenFrame-Bezel-${bezelStyle}`,
        `ScreenFrame-Bezel-${bezelSize}`,
        className,
        {
            "ScreenFrame-CenterLogo":
                bezelStyle === "NeXT" || bezelStyle === "Pinstripes",
            "ScreenFrame-Fullscreen": fullscreen,
        }
    );
    const ledClassName = classNames("ScreenFrame-Led", {
        "ScreenFrame-Led-Loading": led === "Loading",
        "ScreenFrame-Led-Clickable": onLedClick,
    });
    const Logo =
        bezelStyle === "NeXT"
            ? NeXTLogo
            : bezelStyle === "Pinstripes"
              ? AppleLogoGrey
              : AppleLogoColor;

    return (
        <div
            className={screenFrameClassName}
            style={{
                width: `calc(${width}px + 2 * var(--screen-underscan))`,
                height: `calc(${height}px + 2 * var(--screen-underscan))`,
                transform: scale === undefined ? undefined : `scale(${scale})`,
                viewTransitionName,
            }}
            {...divProps}>
            <div className="ScreenFrame-Controls-Container">
                <div className="ScreenFrame-Logo">
                    <Logo className="Background" />
                    <Logo className="Foreground" />
                </div>
                {controls.map(
                    ({label, handler, alwaysVisible, selected}, i) => (
                        <div
                            className={classNames(
                                "ScreenFrame-Control ScreenFrame-Bezel-Text",
                                {
                                    "ScreenFrame-Control-Selected": selected,
                                }
                            )}
                            style={{
                                visibility: alwaysVisible
                                    ? "visible"
                                    : undefined,
                            }}
                            onClick={handler}
                            key={label}>
                            {label}
                        </div>
                    )
                )}
            </div>
            {led !== "None" && <div className={ledClassName} onClick={onLedClick} />}
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
