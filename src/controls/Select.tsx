import classNames from "classnames";
import "./Select.css";
import {appearanceSystemFont, type Appearance} from "./Appearance";

export function Select({
    appearance,
    className,
    children,
    ...selectProps
}: {
    appearance: Appearance;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
    const selectClassName = classNames(
        "Select",
        `Select-${appearance}`,
        appearanceSystemFont(appearance),
        className
    );
    return (
        <select className={selectClassName} {...selectProps}>
            {children}
        </select>
    );
}
