import classNames from "classnames";
import "./Checkbox.css";
import {type Appearance} from "./Appearance";

export function Checkbox({
    appearance,
    className,
    children,
    ...inputProps
}: {
    appearance: Appearance;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
    const selectClassName = classNames(
        "Checkbox",
        `Checkbox-${appearance}`,
        className
    );
    return (
        <input type="checkbox" className={selectClassName} {...inputProps} />
    );
}
