import "./Button.css";

export type ButtonProps = {
    appearance: "Classic" | "Platinum";
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button(props: ButtonProps) {
    const {appearance, className, children, ...buttonProps} = props;
    const classNames = ["Button", `Button-${appearance}`];
    if (className) {
        classNames.push(className);
    }
    return (
        <button className={classNames.join(" ")} {...buttonProps}>
            {children}
        </button>
    );
}
