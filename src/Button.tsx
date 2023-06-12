import classNames from "classnames";
import "./Button.css";

export type ButtonProps = {
    appearance: "Classic" | "Platinum";
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button(props: ButtonProps) {
    const {appearance, className, children, ...buttonProps} = props;
    const buttonClassName = classNames(
        "Button",
        `Button-${appearance}`,
        className
    );
    return (
        <button className={buttonClassName} {...buttonProps}>
            {children}
        </button>
    );
}
