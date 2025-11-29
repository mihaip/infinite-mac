import classNames from "classnames";
import "@/controls/Button.css";
import {appearanceSystemFont, useAppearance} from "@/controls/Appearance";

export function Button({
    className,
    children,
    ...buttonProps
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
    const appearance = useAppearance();
    const buttonClassName = classNames(
        "Button",
        `Button-${appearance}`,
        appearanceSystemFont(appearance),
        className
    );
    return (
        <button className={buttonClassName} {...buttonProps}>
            {children}
        </button>
    );
}
