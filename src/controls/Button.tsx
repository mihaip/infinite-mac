import classNames from "classnames";
import "./Button.css";
import {type Appearance} from "./Appearance";

export function Button({
    appearance,
    className,
    children,
    ...buttonProps
}: {
    appearance: Appearance;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    const buttonClassName = classNames(
        "Button",
        `Button-${appearance}`,
        className
    );
    return (
        <button className={buttonClassName} {...buttonProps}>
            {children}
        </button>
    );
}
