import {createContext, type PropsWithChildren, useContext} from "react";
import "./Appearance.css";

export type Appearance = "Classic" | "Platinum" | "NeXT";

const AppearanceContext = createContext<Appearance>("Classic");

export function AppearanceProvider({
    appearance,
    children,
}: PropsWithChildren<{appearance: Appearance}>) {
    return (
        <AppearanceContext.Provider value={appearance}>
            {children}
        </AppearanceContext.Provider>
    );
}

export function useAppearance() {
    return useContext(AppearanceContext);
}

export function appearanceSystemFont(appearance: Appearance) {
    return `AppearanceSystemFont-${appearance}`;
}
