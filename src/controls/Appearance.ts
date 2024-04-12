import "./Appearance.css";

export type Appearance = "Classic" | "Platinum" | "NeXT";

export function appearanceSystemFont(appearance: Appearance) {
    return `AppearanceSystemFont-${appearance}`;
}
