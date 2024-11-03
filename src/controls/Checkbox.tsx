import classNames from "classnames";
import "./Checkbox.css";
import {useAppearance} from "./Appearance";

export function Checkbox({
    className,
    children,
    ...inputProps
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
    const appearance = useAppearance();
    const selectClassName = classNames(
        "Checkbox",
        `Checkbox-${appearance}`,
        className
    );
    return (
        <input type="checkbox" className={selectClassName} {...inputProps} />
    );
}
