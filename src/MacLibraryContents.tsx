import classNames from "classnames";
import {appearanceSystemFont, type Appearance} from "./controls/Appearance";
import {
    DrawerContents,
    DrawerHeader,
    DrawerList,
    DrawerListCategory,
    DrawerLoading,
} from "./controls/Drawer";
import {
    APPS_INDEX,
    ARCHITECTURE_INDEX,
    CATEGORIES_INDEX,
    createSearchPredicate,
    downloadUrl,
    GAMES_INDEX,
    PERSPECTIVE_INDEX,
    SYSTEM_INDEX,
    useLibraryItemDetails,
    type LibraryIndexItem,
} from "./library";
import "./MacLibraryContents.css";
import {memo, type ReactNode, useCallback, useMemo, useState} from "react";
import {Button} from "./controls/Button";
import {MacLibraryHeader} from "./MacLibrary";
import {MacLibraryScreenshots} from "./MacLibraryScreenshots";

export default function MacLibraryContents({
    onRun,
    appearance,
}: {
    onRun: OnRunFn;
    appearance: Appearance;
}) {
    const [search, setSearch] = useState("");
    const [detailsItem, setDetailsItem] = useState<
        LibraryIndexItem | undefined
    >();

    return (
        <DrawerContents>
            {detailsItem ? (
                <MacLibraryItemDetails
                    item={detailsItem}
                    onRun={onRun}
                    onBack={() => setDetailsItem(undefined)}
                    appearance={appearance}
                />
            ) : (
                <MacLibraryBrowser
                    search={search}
                    setSearch={setSearch}
                    onSelectItem={setDetailsItem}
                    appearance={appearance}
                />
            )}
        </DrawerContents>
    );
}

function MacLibraryBrowser({
    search,
    setSearch,
    onSelectItem,
    appearance,
}: {
    search: string;
    setSearch: (search: string) => void;
    onSelectItem: OnSelectItemFn;
    appearance: Appearance;
}) {
    const [games, apps] = useMemo(() => {
        if (!search) {
            return [GAMES_INDEX, APPS_INDEX];
        }
        const searchPredicate = createSearchPredicate(search);
        return [
            GAMES_INDEX.filter(searchPredicate),
            APPS_INDEX.filter(searchPredicate),
        ];
    }, [search]);

    return (
        <>
            <MacLibraryHeader
                search={search}
                setSearch={setSearch}
                appearance={appearance}
            />
            <DrawerList>
                {games.length > 0 && (
                    <DrawerListCategory title="Games">
                        <MacLibraryTable
                            items={games}
                            onSelectItem={onSelectItem}
                            appearance={appearance}
                        />
                    </DrawerListCategory>
                )}
                {apps.length > 0 && (
                    <DrawerListCategory title="Applications">
                        <MacLibraryTable
                            items={apps}
                            onSelectItem={onSelectItem}
                            appearance={appearance}
                        />
                    </DrawerListCategory>
                )}
                {apps.length === 0 && games.length === 0 && (
                    <div className="Drawer-Loading">No items match!</div>
                )}
            </DrawerList>
        </>
    );
}

function MacLibraryItemDetails({
    item,
    onRun,
    onBack,
    appearance,
}: {
    item: LibraryIndexItem;
    onRun: OnRunFn;
    onBack: () => void;
    appearance: Appearance;
}) {
    const details = useLibraryItemDetails(item);
    const setDescription = useCallback(
        (node: HTMLDivElement | null) => {
            if (!node) {
                return;
            }

            while (node.firstChild) {
                node.firstChild.remove();
            }

            if (!details?.description) {
                return;
            }
            // Minimal attempt at avoiding XSS
            const descriptionNode = new DOMParser().parseFromString(
                details.description,
                "text/html"
            ).body;

            // Make sure relative URLs in the description are pointed at the Garden
            for (const linkNode of descriptionNode.querySelectorAll("a")) {
                const href = linkNode.getAttribute("href");
                if (href) {
                    try {
                        linkNode.href = new URL(
                            href,
                            "https://macintoshgarden.org"
                        ).href;
                    } catch (err) {
                        // Ignore
                    }
                }
            }
            while (descriptionNode.firstChild) {
                node.appendChild(descriptionNode.firstChild);
            }
        },
        [details?.description]
    );

    let contents;
    if (details) {
        const detailRows: ReactNode[] = [];
        const addDetailRow = (label: string, value: ReactNode) => {
            detailRows.push(
                <tr key={detailRows.length}>
                    <th>{label}:</th>
                    <td>{value}</td>
                </tr>
            );
        };

        if (item.year) {
            addDetailRow("Year", item.year);
        }
        addDetailRow(
            "Category",
            item.categories.map(c => CATEGORIES_INDEX[c]).join(" ")
        );
        if (item.perspectives.length) {
            addDetailRow(
                "Perspective",
                item.perspectives.map(c => PERSPECTIVE_INDEX[c]).join(" ")
            );
        }
        if (item.authors.length) {
            addDetailRow("Author", item.authors.join(" "));
        }
        if (item.publishers.length) {
            addDetailRow("Publisher", item.publishers.join(" "));
        }
        if (details.composers.length) {
            addDetailRow("Composers", details.composers.join(" "));
        }
        if (item.systems.length) {
            addDetailRow(
                "Systems",
                item.systems.map(s => SYSTEM_INDEX[s]).join(" ")
            );
        }
        if (item.architectures.length) {
            addDetailRow(
                "Architectures",
                item.architectures.map(a => ARCHITECTURE_INDEX[a]).join(" ")
            );
        }
        addDetailRow(
            "Links",
            <>
                <a
                    href={`https://macintoshgarden.org/${details.url}`}
                    target="_blank">
                    Macintosh Garden
                </a>
                {details.externalDownloadUrl && (
                    <>
                        {" "}
                        <a href={details.externalDownloadUrl} target="_blank">
                            External Download
                        </a>
                    </>
                )}
            </>
        );

        contents = (
            <div className="Mac-Library-Item-Details">
                <div className="Mac-Library-Item-Details-Columns">
                    {details.screenshots.length > 0 && (
                        <MacLibraryScreenshots
                            item={item}
                            details={details}
                            appearance={appearance}
                        />
                    )}
                    <table className="Mac-Library-Item-Details-Table">
                        <tbody>{detailRows}</tbody>
                    </table>
                    <fieldset className="Mac-Library-Item-Details-Downloads">
                        <legend>Downloads</legend>
                        <ol>
                            {Object.entries(details.files).map(
                                ([file, size]) => {
                                    const url = downloadUrl(file, item.type);
                                    return (
                                        <li key={file}>
                                            <a
                                                href={url}
                                                onClick={e => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    onRun(
                                                        url,
                                                        item.title,
                                                        file,
                                                        size
                                                    );
                                                }}
                                                target="_blank">
                                                {file}
                                            </a>
                                            ({formatSize(size)})
                                        </li>
                                    );
                                }
                            )}
                        </ol>
                    </fieldset>
                </div>
                {details.description && (
                    <div
                        className="Mac-Library-Item-Details-Description"
                        ref={setDescription}
                    />
                )}
            </div>
        );
    } else {
        contents = <DrawerLoading />;
    }

    return (
        <>
            <DrawerHeader>
                <Button onClick={onBack} appearance={appearance}>
                    ‹ Back
                </Button>
                <div
                    className={classNames(
                        appearanceSystemFont(appearance),
                        "Mac-Library-Item-Details-Title"
                    )}>
                    {item.title}
                </div>
            </DrawerHeader>
            {contents}
        </>
    );
}

type OnRunFn = (
    url: string,
    name?: string,
    fileName?: string,
    size?: number
) => void;
type OnSelectItemFn = (item: LibraryIndexItem) => void;

const MacLibraryTable = memo(function ({
    items,
    onSelectItem,
    appearance,
}: {
    items: LibraryIndexItem[];
    onSelectItem: OnSelectItemFn;
    appearance: Appearance;
}) {
    let truncationCount = 0;
    if (items.length > 1000) {
        truncationCount = items.length - 1000;
        items = items.slice(0, 1000);
    }
    return (
        <table
            className={classNames(
                "Mac-Library-Table",
                `Mac-Library-Table-${appearance}`
            )}>
            <thead>
                <tr>
                    <th>Title</th>
                    <th className="narrow">Year</th>
                    <th>Category</th>
                    <th>Author</th>
                </tr>
            </thead>
            <tbody>
                {items.map(item => (
                    <MacLibraryTableRow
                        key={item.id}
                        item={item}
                        onSelectItem={onSelectItem}
                    />
                ))}
            </tbody>
            {truncationCount > 0 && (
                <tfoot>
                    <tr>
                        <td colSpan={4} className="Mac-Library-Table-Footer">
                            (...and {truncationCount} more)
                        </td>
                    </tr>
                </tfoot>
            )}
        </table>
    );
});

const MacLibraryTableRow = memo(function ({
    item,
    onSelectItem,
}: {
    item: LibraryIndexItem;
    onSelectItem: OnSelectItemFn;
}) {
    return (
        <tr onClick={() => onSelectItem(item)}>
            <td>{item.title}</td>
            <td>{item.year ?? "-"}</td>
            <td>{item.categories.map(c => CATEGORIES_INDEX[c])}</td>
            <td>{item.authors.join(" ")}</td>
        </tr>
    );
});

function formatSize(size: number): string {
    if (size < 1024) {
        return `${size.toLocaleString()}B`;
    }
    if (size < 1024 * 1024) {
        return `${Math.round(size / 1024).toLocaleString()}KB`;
    }
    if (size < 1024 * 1024 * 1024) {
        return `${(size / 1024 / 1024).toLocaleString(undefined, {
            maximumFractionDigits: 1,
        })}MB`;
    }
    return `${(size / 1024 / 1024 / 1024).toLocaleString(undefined, {
        maximumFractionDigits: 2,
    })}GB`;
}
