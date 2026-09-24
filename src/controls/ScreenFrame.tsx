import React, {useLayoutEffect, useState} from "react";
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

type ScreenControlDisplay = {
    label: string;
    alwaysVisible?: boolean;
    selected?: boolean;
};

type ScreenButtonControl = ScreenControlDisplay & {
    handler: () => void;
    items?: never;
};

type ScreenMenuControl = ScreenControlDisplay & {
    handler?: never;
    items: {
        label: string;
        handler: () => void;
    }[];
};

export type ScreenControl = ScreenButtonControl | ScreenMenuControl;

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

    const [expandedMenuControl, setExpandedMenuControl] =
        useState<ScreenMenuControl | null>(null);

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
                {controls.map(control =>
                    control.items ? (
                        <ScreenFrameMenuControl
                            key={control.label}
                            control={control}
                            expandedControl={expandedMenuControl}
                            setExpandedControl={setExpandedMenuControl}
                        />
                    ) : (
                        <ScreenFrameButtonControl
                            key={control.label}
                            control={control}
                            expandedControl={expandedMenuControl}
                        />
                    )
                )}
            </div>
            {led !== "None" && (
                <div className={ledClassName} onClick={onLedClick} />
            )}
            <ScreenFrameMenuContent
                control={expandedMenuControl}
                bezelSize={bezelSize}
                onClose={() => setExpandedMenuControl(null)}
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

function ScreenFrameButtonControl({
    control,
    expandedControl,
}: {
    control: ScreenButtonControl;
    expandedControl?: ScreenMenuControl | null;
}) {
    const {label, handler, alwaysVisible, selected} = control;
    return (
        <button
            type="button"
            className={classNames(
                "ScreenFrame-Control ScreenFrame-Bezel-Text",
                {"ScreenFrame-Control-Selected": selected}
            )}
            style={{
                visibility:
                    alwaysVisible || !!expandedControl ? "visible" : undefined,
            }}
            onClick={handler}>
            {label}
        </button>
    );
}

function ScreenFrameMenuControl({
    control,
    expandedControl,
    setExpandedControl,
}: {
    control: ScreenMenuControl;
    expandedControl: ScreenMenuControl | null;
    setExpandedControl: (control: ScreenMenuControl | null) => void;
}) {
    const isSelected = expandedControl?.label === control.label;

    return (
        <ScreenFrameButtonControl
            control={{
                label: control.label,
                handler: () => setExpandedControl(isSelected ? null : control),
                selected: isSelected,
                alwaysVisible: expandedControl !== null,
            }}
        />
    );
}

function ScreenFrameMenuContent({
    control,
    bezelSize,
    onClose,
}: {
    control?: ScreenMenuControl | null;
    bezelSize: ScreenFrameProps["bezelSize"];
    onClose: () => void;
}) {
    const [displayItems, setDisplayItems] = useState<
        ScreenMenuControl["items"] | null
    >(null);
    // Keep showing the last selected menu items, so that we can still transition
    // away from them.
    useLayoutEffect(() => {
        if (control?.items) {
            setDisplayItems(control.items);
        }
    }, [control?.items]);
    return (
        <div className="ScreenFrame-Control-MenuContent">
            <div className="ScreenFrame-Control-MenuContent-Shadow" />
            <div
                className={classNames("ScreenFrame-Control-MenuContent-Items", {
                    "Visible": !!control,
                })}>
                {bezelSize === "Small" && (
                    <ScreenFrameButtonControl
                        control={{
                            label: "‹ Back",
                            handler: onClose,
                            alwaysVisible: true,
                        }}
                    />
                )}
                {displayItems?.map(item => (
                    <ScreenFrameButtonControl
                        control={{
                            label: item.label,
                            handler: item.handler,
                            alwaysVisible: true,
                        }}
                        key={item.label}
                    />
                ))}
            </div>
        </div>
    );
}
