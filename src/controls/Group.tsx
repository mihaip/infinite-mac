import classNames from "classnames";
import "./Group.css";
import {appearanceSystemFont, type Appearance} from "./Appearance";

export function Group({
    appearance,
    label,
    className,
    children,
}: React.PropsWithChildren<{
    appearance: Appearance;
    className?: string;
    label: string;
}>) {
    return (
        <fieldset
            className={classNames("Group", `Group-${appearance}`, className)}>
            <legend className={appearanceSystemFont(appearance)}>
                {label}
            </legend>
            {children}
        </fieldset>
    );
}
