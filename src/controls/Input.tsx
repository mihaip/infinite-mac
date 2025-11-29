import classNames from "classnames";
import "@/controls/Input.css";
import {forwardRef} from "react";
import {useAppearance} from "@/controls/Appearance";

export const Input = forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement>
>(function Input({className, ...inputProps}, ref) {
    const appearance = useAppearance();
    const inputClassName = classNames(
        "Input",
        `Input-${appearance}`,
        className
    );
    return <input className={inputClassName} ref={ref} {...inputProps} />;
});
