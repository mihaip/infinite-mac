import classNames from "classnames";
import "./Input.css";
import {forwardRef} from "react";

export type InputProps = {
    appearance: "Classic" | "Platinum";
} & React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
    props,
    ref
) {
    const {appearance, className, ...inputProps} = props;
    const inputClassName = classNames(
        "Input",
        `Input-${appearance}`,
        className
    );
    return <input className={inputClassName} ref={ref} {...inputProps} />;
});
