import classNames from "classnames";
import "./BevelButton.css";
import {type Appearance} from "./Appearance";

export function BevelButton({
    appearance,
    className,
    selected,
    children,
    centered = true,
    ...buttonProps
}: {
    appearance: Appearance;
    selected?: boolean;
    centered?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    const buttonClassName = classNames(
        "BevelButton",
        `BevelButton-${appearance}`,
        className,
        {
            "BevelButton-Selected": selected,
            "BevelButton-Centered": centered,
        }
    );
    return (
        <button className={buttonClassName} {...buttonProps}>
            {children}
        </button>
    );
}
