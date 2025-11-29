import classNames from "classnames";
import "@/controls/Input.css";
import {forwardRef} from "react";
import {useAppearance} from "@/controls/Appearance";

export const TextArea = forwardRef<
    HTMLTextAreaElement,
    React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({className, ...inputProps}, ref) {
    const appearance = useAppearance();
    const inputClassName = classNames(
        "Input",
        `Input-${appearance}`,
        className
    );
    return <textarea className={inputClassName} ref={ref} {...inputProps} />;
});
