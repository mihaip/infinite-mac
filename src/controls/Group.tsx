import classNames from "classnames";
import "@/controls/Group.css";
import {appearanceSystemFont, useAppearance} from "@/controls/Appearance";

export function Group({
    label,
    className,
    children,
}: React.PropsWithChildren<{
    className?: string;
    label: string;
}>) {
    const appearance = useAppearance();
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
