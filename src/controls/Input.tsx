import classNames from "classnames";
import "./Input.css";
import {forwardRef} from "react";
import {type Appearance} from "./Appearance";

export const Input = forwardRef<
    HTMLInputElement,
    {
        appearance: Appearance;
    } & React.InputHTMLAttributes<HTMLInputElement>
>(function Input({appearance, className, ...inputProps}, ref) {
    const inputClassName = classNames(
        "Input",
        `Input-${appearance}`,
        className
    );
    return <input className={inputClassName} ref={ref} {...inputProps} />;
});
