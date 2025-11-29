/**
 * @fileoverview Provides an isomorphic abstraction over global data that has
 * different implementations in browser and server environments.
 */

export type Iso = {
    readonly location: {
        readonly href: string;
        readonly pathname: string;
        readonly searchParams: URLSearchParams;
    };
    readonly cookie: {
        get(): string | undefined;
        set(value: string): void;
    };
    readonly navigator: {
        readonly userAgent: string;
    };
};

export function iso(): Iso {
    return isoProvider();
}

export function setIsoProvider(provider: () => Iso) {
    isoProvider = provider;
}

let isoProvider: () => Iso = () => {
    throw new Error("No ISO provider has been set.");
};
