import classNames from "classnames";
import "./Select.css";
import {appearanceSystemFont, useAppearance} from "./Appearance";

export function Select({
    className,
    children,
    ...selectProps
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
    const appearance = useAppearance();
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
