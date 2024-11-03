import classNames from "classnames";
import "./BevelButton.css";
import {useAppearance} from "./Appearance";

export function BevelButton({
    className,
    selected,
    children,
    centered = true,
    ...buttonProps
}: {
    selected?: boolean;
    centered?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    const appearance = useAppearance();
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
