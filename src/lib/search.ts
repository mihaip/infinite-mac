import {useMemo} from "react";

export function parseSearchQuery(query: string): SearchTerm[] {
    const terms: SearchTerm[] = [];
    const regex = /(\w+):"([^"]+)"|(\w+):(\S+)|"([^"]+)"|(\S+)/g;
    let match;

    query = query.toLowerCase();

    // Ensure we close any unclosed quotes, to be more resilient when we have a
    // partial query that the user is in the middle of typing.
    const quoteCount = (query.match(/"/g) ?? []).length;
    if (quoteCount % 2 !== 0) {
        query += '"';
    }

    while ((match = regex.exec(query)) !== null) {
        if (match[1] && match[2]) {
            terms.push({operator: match[1], value: match[2]}); // operator with quoted value
        } else if (match[3] && match[4]) {
            terms.push({operator: match[3], value: match[4]}); // operator with unquoted value
        } else if (match[5]) {
            terms.push({value: match[5]}); //quoted value without operator
        } else if (match[6]) {
            terms.push({value: match[6]}); //bare word without operator
        }
    }

    return terms;
}

export function useSearchFilter<T>(
    items: readonly T[],
    search: string,
    createPredicate: (query: string) => (item: T) => boolean
): readonly T[] {
    const searchPredicate = useMemo(
        () => (search.trim() ? createPredicate(search) : undefined),
        [search, createPredicate]
    );
    return useMemo(
        () => (searchPredicate ? items.filter(searchPredicate) : items),
        [items, searchPredicate]
    );
}

export type SearchTerm = {
    operator?: string; // missing if there's no operator
    value: string;
};
