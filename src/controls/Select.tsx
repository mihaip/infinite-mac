import classNames from "classnames";
import "@/controls/Select.css";
import {appearanceSystemFont, useAppearance} from "@/controls/Appearance";

export function Select({
    className,
    children,
    noLabel,
    ...selectProps
}: React.SelectHTMLAttributes<HTMLSelectElement> & {noLabel?: boolean}) {
    const appearance = useAppearance();
    const selectClassName = classNames(
        "Select",
        `Select-${appearance}`,
        appearanceSystemFont(appearance),
        className,
        {
            "NoLabel": noLabel,
        }
    );
    return (
        <select className={selectClassName} {...selectProps}>
            {children}
        </select>
    );
}
