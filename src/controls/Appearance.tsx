import {createContext, type PropsWithChildren, useContext} from "react";
import "@/controls/Appearance.css";

export type Appearance = "Classic" | "Platinum" | "Aqua" | "NeXT";

export type AppearanceVariant = "System7";

const AppearanceContext = createContext<Appearance>("Classic");

const AppearanceVariantContext = createContext<AppearanceVariant | undefined>(
    undefined
);

export function AppearanceProvider({
    appearance,
    variant,
    children,
}: PropsWithChildren<{
    appearance: Appearance;
    variant?: AppearanceVariant;
}>) {
    return (
        <AppearanceContext.Provider value={appearance}>
            <AppearanceVariantContext.Provider value={variant}>
                {children}
            </AppearanceVariantContext.Provider>
        </AppearanceContext.Provider>
    );
}

export function useAppearance(): Appearance {
    return useContext(AppearanceContext);
}

export function useAppearanceVariant(): AppearanceVariant | undefined {
    return useContext(AppearanceVariantContext);
}

export function appearanceSystemFont(appearance: Appearance) {
    return `AppearanceSystemFont-${appearance}`;
}
