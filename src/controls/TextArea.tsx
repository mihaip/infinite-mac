import classNames from "classnames";
import "./Input.css";
import {forwardRef} from "react";
import {useAppearance} from "./Appearance";

export const TextArea = forwardRef<
    HTMLTextAreaElement,
    React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({className, ...inputProps}, ref) {
    const appearance = useAppearance();
    const inputClassName = classNames(
        "TextArea",
        `TextArea-${appearance}`,
        className
    );
    return <textarea className={inputClassName} ref={ref} {...inputProps} />;
});
