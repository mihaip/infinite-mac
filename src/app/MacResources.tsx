import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";
import {useVirtualizer} from "@tanstack/react-virtual";
import {PictPreview} from "@/pict/PictPreview";
import {Drawer, DrawerContents, DrawerHeader} from "@/controls/Drawer";
import {Button} from "@/controls/Button";
import {Checkbox} from "@/controls/Checkbox";
import {Input} from "@/controls/Input";
import {
    appearanceListHeader,
    appearanceSystemFont,
    useAppearance,
} from "@/controls/Appearance";
import {type EmulatorInspector} from "@/emulator/ui/inspector";
import {
    INSPECTOR_PREVIEW_COUNT,
    type ResourceDetail,
    type ResourceFile,
    type ResourceInfo,
    type ResourceType,
    type InspectorState,
    type ResourceSnapshot,
} from "@/emulator/common/inspector";
import {
    hasResourceBitmap,
    resourceBitmap,
    resourcePatternCount,
    type ResourceBitmap,
    resourceStrings,
} from "@/emulator/common/resource-preview";
import resourcesIcon from "@/Images/Resources.png";
import typeIconIndex from "@/Images/ResEdit/types.json";
import "./MacResources.css";
import {
    resourceStructure,
    type ResourceField,
} from "@/emulator/common/resource-structure";

export function MacResources({inspector}: {inspector: EmulatorInspector}) {
    const appearance = useAppearance();
    const state = useSyncExternalStore(
        inspector.subscribe,
        inspector.getSnapshot
    );
    const [fileKey, setFileKey] = useState<string>();
    const [retainedFile, setRetainedFile] = useState<ResourceFile>();
    const [retainedDetail, setRetainedDetail] = useState<ResourceDetail>();
    const [type, setType] = useState<string>();
    const [resourceKey, setResourceKey] = useState<string>();
    const [search, setSearch] = useState("");
    const [loadedOnly, setLoadedOnly] = useState(true);
    const [showRecent, setShowRecent] = useState(false);
    const [gridPage, setGridPage] = useState(0);
    const onExpandedChange = useCallback(
        (open: boolean) => inspector.setOpen(open),
        [inspector]
    );
    useEffect(() => () => inspector.setOpen(false), [inspector]);
    useEffect(() => {
        inspector.selectResource(resourceKey);
    }, [inspector, resourceKey]);

    const snapshot = state.snapshot;
    // The sampled resource chain belongs to the process currently executing,
    // which can briefly be a background application. Selection belongs to the
    // user, so keep it even when its map leaves that chain (or the history cache).
    const selectedFile = snapshot?.files.find(f => f.key === fileKey);
    const detachedFile =
        snapshot && retainedFile && retainedFile.key === fileKey
            ? {...retainedFile, recent: true, current: false}
            : undefined;
    const file =
        selectedFile ??
        detachedFile ??
        snapshot?.files.find(
            f => !f.recent && f.name === snapshot.processName.trim()
        ) ??
        snapshot?.files.find(f => f.current) ??
        snapshot?.files[0];
    useEffect(() => {
        if (!snapshot) {
            setFileKey(undefined);
            setRetainedFile(undefined);
            setRetainedDetail(undefined);
        } else if (file && snapshot.files.includes(file)) {
            setFileKey(file.key);
            setRetainedFile(file);
        }
    }, [snapshot, file]);
    const files =
        snapshot?.files.filter(
            f => showRecent || !f.recent || f.key === file?.key
        ) ?? [];
    if (file && !files.some(f => f.key === file.key)) files.push(file);
    const query = search.toLocaleLowerCase();
    const visibleTypes =
        file?.types
            .map(t => ({
                ...t,
                resources: t.resources.filter(
                    r =>
                        (!loadedOnly || r.resident || r.cached === true) &&
                        (!query ||
                            `${t.type} ${r.id} ${r.name ?? ""}`
                                .toLocaleLowerCase()
                                .includes(query))
                ),
            }))
            .filter(t => t.resources.length)
            .sort((a, b) => a.type.localeCompare(b.type)) ?? [];
    const resourceType = visibleTypes.find(t => t.type === type);
    const resource = resourceType?.resources.find(r => r.key === resourceKey);
    const capturedDetail =
        snapshot?.detail?.key === resourceKey ? snapshot?.detail : undefined;
    useEffect(() => {
        if (capturedDetail) setRetainedDetail(capturedDetail);
    }, [capturedDetail]);
    const detail =
        capturedDetail ??
        (snapshot && retainedDetail && retainedDetail.key === resourceKey
            ? {...retainedDetail, cached: true}
            : undefined);
    const gridView = !!type && hasResourceBitmap(type);
    const resources = resourceType?.resources ?? [];
    const lastGridPage = Math.max(
        0,
        Math.ceil(resources.length / INSPECTOR_PREVIEW_COUNT) - 1
    );
    const currentGridPage = Math.min(gridPage, lastGridPage);
    const gridResources = resources.slice(
        currentGridPage * INSPECTOR_PREVIEW_COUNT,
        (currentGridPage + 1) * INSPECTOR_PREVIEW_COUNT
    );
    useEffect(() => {
        inspector.selectPreviews(gridView ? gridResources.map(r => r.key) : []);
    }, [inspector, gridView, gridResources]);
    const previews = new Map(snapshot?.previews?.map(p => [p.key, p]));
    const selectResource = (resource: ResourceInfo) => {
        setResourceKey(resource.key);
    };
    const selectType = (type: string | undefined) => {
        setType(type);
        setResourceKey(undefined);
        setGridPage(0);
    };
    if (!state.supported) return null;

    return (
        <Drawer
            popout
            title="Resources"
            titleIconUrl={resourcesIcon}
            onExpandedChange={onExpandedChange}
            contents={(collapse, {popout, isPopout}) => (
                <DrawerContents tall>
                    <div className={`MacResources MacResources-${appearance}`}>
                        <ResourceHeader
                            state={state}
                            file={file}
                            isPopout={isPopout}
                            onWindowAction={isPopout ? collapse : popout}
                            search={search}
                            loadedOnly={loadedOnly}
                            showRecent={showRecent}
                            onSearch={value => {
                                setSearch(value);
                                setGridPage(0);
                            }}
                            onLoadedOnly={value => {
                                setLoadedOnly(value);
                                setGridPage(0);
                            }}
                            onShowRecent={setShowRecent}
                        />
                        <div
                            className={`MacResources-Body ${resource ? "MacResources-Body-Inspecting" : ""}`}>
                            <ResourceFileList
                                files={files}
                                selectedKey={file?.key}
                                hasSnapshot={!!snapshot}
                                onSelect={key => {
                                    setFileKey(key);
                                    selectType(undefined);
                                }}
                            />
                            <ResourceCatalog
                                file={file}
                                type={type}
                                visibleTypes={visibleTypes}
                                resourceKey={resourceKey}
                                gridResources={gridResources}
                                previews={previews}
                                currentGridPage={currentGridPage}
                                lastGridPage={lastGridPage}
                                hasSnapshot={!!snapshot}
                                onPageChange={setGridPage}
                                onSelectType={selectType}
                                onSelectResource={selectResource}
                            />
                            {resource && type && (
                                <section
                                    className="MacResources-Detail"
                                    aria-label="Resource preview">
                                    <ResourcePreview
                                        key={resource.key}
                                        resource={resource}
                                        type={type}
                                        detail={detail}
                                        recent={!!file?.recent}
                                    />
                                </section>
                            )}
                        </div>
                        <ResourceFooter
                            snapshot={snapshot}
                            state={state}
                            file={file}
                            onTogglePaused={() =>
                                inspector.setPaused(!state.paused)
                            }
                        />
                    </div>
                </DrawerContents>
            )}
        />
    );
}

function ResourceHeader({
    state,
    file,
    isPopout,
    onWindowAction,
    search,
    loadedOnly,
    showRecent,
    onSearch,
    onLoadedOnly,
    onShowRecent,
}: {
    state: InspectorState;
    file?: ResourceFile;
    isPopout: boolean;
    onWindowAction?: () => void;
    search: string;
    loadedOnly: boolean;
    showRecent: boolean;
    onSearch: (value: string) => void;
    onLoadedOnly: (value: boolean) => void;
    onShowRecent: (value: boolean) => void;
}) {
    const appearance = useAppearance();
    const snapshot = state.snapshot;
    return (
        <>
            <DrawerHeader>
                <div className="MacResources-Heading">
                    Inspect resources that are currently loaded in the emulated
                    Mac.
                </div>
                <Button onClick={onWindowAction}>
                    {isPopout ? "Close" : "Popout"}
                </Button>
            </DrawerHeader>
            <div className="MacResources-Toolbar">
                <Input
                    aria-label="Find resources"
                    placeholder="Find a type, ID, or name"
                    value={search}
                    onChange={e => onSearch(e.target.value)}
                />
                <label title="Show resources currently in guest memory or copies kept by the inspector from an earlier capture. Uncheck to show every entry in the resource catalog.">
                    <Checkbox
                        checked={loadedOnly}
                        onChange={e => onLoadedOnly(e.target.checked)}
                    />{" "}
                    Loaded or saved
                </label>
                <label>
                    <Checkbox
                        checked={showRecent}
                        onChange={e => onShowRecent(e.target.checked)}
                    />{" "}
                    Recently seen files
                </label>
            </div>
            {state.error && (
                <div role="status" className="MacResources-Notice">
                    {state.error}.{" "}
                    {snapshot
                        ? "Showing the last valid capture."
                        : "The inspector will retry automatically."}
                </div>
            )}
        </>
    );
}

function ResourceFileList({
    files,
    selectedKey,
    hasSnapshot,
    onSelect,
}: {
    files: ResourceFile[];
    selectedKey?: string;
    hasSnapshot: boolean;
    onSelect: (key: string) => void;
}) {
    const fileGroups = groupResourceFiles(files);
    return (
        <nav className="MacResources-Files" aria-label="Resource files">
            <div className="MacResources-ColumnTitle">Resource files</div>
            {fileGroups.map(group => (
                <div className="MacResources-FileGroup" key={group.key}>
                    <div
                        className="MacResources-FileGroupTitle"
                        title={group.path}>
                        {group.title}
                    </div>
                    {group.files.map(f => (
                        <button
                            type="button"
                            key={f.key}
                            className={f.key === selectedKey ? "selected" : ""}
                            aria-label={`${f.name}${f.recent ? ", recently seen" : ""}`}
                            aria-pressed={f.key === selectedKey}
                            title={
                                f.recent
                                    ? `${f.path ?? f.name} — Detached: showing the last capture until this file returns to the resource chain.`
                                    : f.path
                            }
                            onClick={() => onSelect(f.key)}>
                            {f.name}
                        </button>
                    ))}
                </div>
            ))}
            {!files.length && (
                <p>
                    {hasSnapshot
                        ? "No resource files in this context."
                        : "Waiting for the first capture…"}
                </p>
            )}
        </nav>
    );
}

function ResourceCatalog({
    file,
    type,
    visibleTypes,
    resourceKey,
    gridResources,
    previews,
    currentGridPage,
    lastGridPage,
    hasSnapshot,
    onPageChange,
    onSelectType,
    onSelectResource,
}: {
    file?: ResourceFile;
    type?: string;
    visibleTypes: ResourceType[];
    resourceKey?: string;
    gridResources: ResourceInfo[];
    previews: Map<string, ResourceDetail>;
    currentGridPage: number;
    lastGridPage: number;
    hasSnapshot: boolean;
    onPageChange: (page: number) => void;
    onSelectType: (type: string | undefined) => void;
    onSelectResource: (resource: ResourceInfo) => void;
}) {
    const appearance = useAppearance();
    const resources = visibleTypes.find(t => t.type === type)?.resources ?? [];
    const gridView = !!type && hasResourceBitmap(type);
    return (
        <section className="MacResources-Catalog" aria-label="Resource catalog">
            <div className="MacResources-ColumnTitle">
                {type && (
                    <button
                        type="button"
                        onClick={() => onSelectType(undefined)}>
                        ‹ Types
                    </button>
                )}
                <span className={appearanceSystemFont(appearance)}>
                    {type
                        ? `${type} from ${file?.name ?? "Resources"}`
                        : (file?.name ?? "Resources")}
                    {file?.recent ? " (detached)" : ""}
                </span>
                {file && (
                    <small title={file.path}>
                        {file.path ??
                            (file.system
                                ? "System resource map"
                                : "Location unavailable")}
                    </small>
                )}
            </div>
            {!type ? (
                <div className="MacResources-TypeGrid">
                    {visibleTypes.map(t => (
                        <button
                            type="button"
                            key={t.type}
                            aria-label={`${t.type} (${t.resources.length} ${t.resources.length === 1 ? "resource" : "resources"})`}
                            onClick={() => onSelectType(t.type)}>
                            <ResourceTypeIcon type={t.type} />
                            <span className="MacResources-IconLabel">
                                {t.type}{" "}
                                <span className="MacResources-TypeCount">
                                    ({t.resources.length})
                                </span>
                            </span>
                        </button>
                    ))}
                </div>
            ) : gridView ? (
                <ResourceGrid
                    type={type}
                    gridResources={gridResources}
                    resourceKey={resourceKey}
                    previews={previews}
                    currentGridPage={currentGridPage}
                    lastGridPage={lastGridPage}
                    onPageChange={onPageChange}
                    onSelect={onSelectResource}
                />
            ) : (
                <ResourceList
                    resources={resources}
                    resourceKey={resourceKey}
                    onSelect={onSelectResource}
                />
            )}
            {!(type ? resources.length : visibleTypes.length) &&
                hasSnapshot && (
                    <p className="MacResources-Empty">
                        No resources match this view.
                    </p>
                )}
        </section>
    );
}

function ResourceGrid({
    type,
    gridResources,
    resourceKey,
    previews,
    currentGridPage,
    lastGridPage,
    onPageChange,
    onSelect,
}: {
    type: string;
    gridResources: ResourceInfo[];
    resourceKey?: string;
    previews: Map<string, ResourceDetail>;
    currentGridPage: number;
    lastGridPage: number;
    onPageChange: (page: number) => void;
    onSelect: (resource: ResourceInfo) => void;
}) {
    return (
        <>
            {lastGridPage > 0 && (
                <div className="MacResources-GridPaging">
                    <Button
                        disabled={currentGridPage === 0}
                        onClick={() => onPageChange(currentGridPage - 1)}>
                        Previous
                    </Button>
                    <span>
                        {currentGridPage + 1} / {lastGridPage + 1}
                    </span>
                    <Button
                        disabled={currentGridPage === lastGridPage}
                        onClick={() => onPageChange(currentGridPage + 1)}>
                        Next
                    </Button>
                </div>
            )}
            <div className="MacResources-ResourceGrid">
                {gridResources.map(r => (
                    <button
                        type="button"
                        key={r.key}
                        className={r.key === resourceKey ? "selected" : ""}
                        aria-pressed={r.key === resourceKey}
                        aria-label={`${type} ${r.id}${r.name ? ` ${r.name}` : ""} · ${resourceStatus(r)}`}
                        title={`${r.id}${r.name ? `: ${r.name}` : ""} · ${resourceStatus(r)}${r.size === undefined ? "" : ` · ${r.size.toLocaleString()} bytes`}`}
                        onClick={() => onSelect(r)}>
                        <ResourceThumbnail
                            type={type}
                            detail={previews.get(r.key)}
                        />
                        <span className="MacResources-IconLabel">{r.id}</span>
                        {!r.resident && (
                            <small>
                                {r.cached ? "Saved copy" : "Not loaded"}
                            </small>
                        )}
                    </button>
                ))}
            </div>
        </>
    );
}

function ResourceList({
    resources,
    resourceKey,
    onSelect,
}: {
    resources: ResourceInfo[];
    resourceKey?: string;
    onSelect: (resource: ResourceInfo) => void;
}) {
    const appearance = useAppearance();
    return (
        <div className="MacResources-ResourceList">
            <div
                className={`MacResources-ListHeading ${appearanceListHeader(appearance)}`}>
                <span>ID</span>
                <span className="MacResources-ResourceSize">Size</span>
                <span>Name</span>
                <span className="MacResources-ResourceStatus">Status</span>
            </div>
            {resources.map(r => (
                <button
                    key={r.key}
                    type="button"
                    className={r.key === resourceKey ? "selected" : ""}
                    aria-pressed={r.key === resourceKey}
                    onClick={() => onSelect(r)}>
                    <span className="MacResources-ResourceId">{r.id}</span>
                    <span className="MacResources-ResourceSize">
                        {r.size === undefined ? "—" : r.size.toLocaleString()}
                    </span>
                    <span className="MacResources-ResourceName" title={r.name}>
                        {r.name}
                    </span>
                    <span className="MacResources-ResourceStatus">
                        {resourceStatus(r)}
                    </span>
                </button>
            ))}
        </div>
    );
}

function ResourceFooter({
    snapshot,
    state,
    file,
    onTogglePaused,
}: {
    snapshot?: ResourceSnapshot;
    state: InspectorState;
    file?: ResourceFile;
    onTogglePaused: () => void;
}) {
    const {capturedAt} = snapshot ?? {};
    return (
        <div className="MacResources-Footer">
            {state.error
                ? "Waiting for a valid snapshot"
                : snapshot
                  ? `${file?.name ?? "Macintosh"} · ${snapshot.pointerBits}-bit`
                  : "Capturing resources…"}
            <div style={{display: "flex", alignItems: "center", gap: "0.5em"}}>
                <CaptureStatus capturedAt={capturedAt} paused={state.paused} />
                <Button
                    disabled={capturedAt === undefined}
                    onClick={onTogglePaused}>
                    {state.paused ? "Resume capture" : "Pause capture"}
                </Button>
            </div>
        </div>
    );
}

function CaptureStatus({
    capturedAt,
    paused,
}: {
    capturedAt?: number;
    paused: boolean;
}) {
    const [, refresh] = useState(0);
    useEffect(() => {
        if (capturedAt === undefined) return;
        // Live snapshots keep postponing this timer. Only an aging capture
        // needs a clock of its own, including while capture is paused.
        let timer: ReturnType<typeof setTimeout>;
        const update = () => {
            refresh(value => value + 1);
            timer = setTimeout(update, 1000);
        };
        timer = setTimeout(
            update,
            Math.max(0, capturedAt + 30_000 - Date.now())
        );
        return () => clearTimeout(timer);
    }, [capturedAt]);
    if (capturedAt === undefined)
        return <span>Live Resource Manager inspection</span>;
    const seconds = Math.max(0, Math.floor((Date.now() - capturedAt) / 1000));
    const count = seconds < 60 ? seconds : Math.floor(seconds / 60);
    const unit = seconds < 60 ? "second" : "minute";
    return (
        <span>
            {paused ? "Paused" : "Live"}
            {seconds >= 30 &&
                ` · ${new Date(capturedAt).toLocaleTimeString()} (${count} ${unit}${count === 1 ? "" : "s"} ago)`}
        </span>
    );
}

function groupResourceFiles(files: ResourceFile[]) {
    const result: {
        key: string;
        title: string;
        path?: string;
        files: ResourceFile[];
    }[] = [];
    const current = files.filter(file => file.current);
    if (current.length)
        result.push({key: "current", title: "Current file", files: current});
    const byDirectory = new Map<string, ResourceFile[]>();
    for (const file of files) {
        if (file.current) continue;
        const directory =
            file.directory ??
            (file.system ? "System resources" : "Location unavailable");
        const entries = byDirectory.get(directory) ?? [];
        entries.push(file);
        byDirectory.set(directory, entries);
    }
    for (const [directory, entries] of [...byDirectory].sort(([a], [b]) =>
        a.localeCompare(b)
    )) {
        result.push({
            key: directory,
            title: fileGroupTitle(directory),
            path: entries[0].directory,
            files: entries.sort((a, b) => a.name.localeCompare(b.name)),
        });
    }
    return result;
}

function fileGroupTitle(directory: string) {
    if (
        directory === "System resources" ||
        directory === "Location unavailable"
    )
        return directory;
    return directory.slice(directory.lastIndexOf(":") + 1);
}

function resourceStatus(resource: ResourceInfo) {
    return resource.resident
        ? "Loaded"
        : resource.cached
          ? "Saved copy"
          : "Not loaded";
}

function ResourceTypeIcon({type}: {type: string}) {
    const index =
        (typeIconIndex as Record<string, number>)[type] ??
        typeIconIndex["????"];
    return (
        <span
            className="MacResources-TypeIcon"
            aria-hidden="true"
            style={{
                backgroundPosition: `${-(index % 16) * 32}px ${-Math.floor(index / 16) * 32}px`,
            }}
        />
    );
}

function ResourceThumbnail({
    type,
    detail,
}: {
    type: string;
    detail?: ResourceDetail;
}) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const bitmap = detail
        ? resourceBitmap(type, detail.data, detail.mask)
        : undefined;
    useEffect(() => {
        if (!bitmap || !canvas.current) return;
        canvas.current
            .getContext("2d")
            ?.putImageData(
                new ImageData(bitmap.rgba, bitmap.width, bitmap.height),
                0,
                0
            );
    }, [bitmap]);
    return (
        <span className="MacResources-Thumbnail">
            {bitmap && type === "ppat" ? (
                <PatternSwatch bitmap={bitmap} />
            ) : bitmap ? (
                <canvas
                    ref={canvas}
                    width={bitmap.width}
                    height={bitmap.height}
                />
            ) : (
                <ResourceTypeIcon type={type} />
            )}
        </span>
    );
}

function ResourcePreview({
    resource,
    type,
    detail,
    recent,
}: {
    resource: ResourceInfo;
    type: string;
    detail?: ResourceDetail;
    recent: boolean;
}) {
    const [view, setView] = useState<"fields" | "json" | "hex">("fields");
    const structure = useMemo(
        () => (detail ? resourceStructure(type, detail.data) : undefined),
        [type, detail]
    );
    const canvas = useRef<HTMLCanvasElement>(null);
    const bitmap = detail
        ? resourceBitmap(type, detail.data, detail.mask)
        : undefined;
    const strings = detail ? resourceStrings(type, detail.data) : undefined;
    useEffect(() => {
        if (!bitmap || !canvas.current) return;
        const context = canvas.current.getContext("2d");
        if (context)
            context.putImageData(
                new ImageData(bitmap.rgba, bitmap.width, bitmap.height),
                0,
                0
            );
    }, [bitmap]);
    const bytes = detail?.data;
    const attributes = [
        [0x40, "System heap"],
        [0x20, "Purgeable"],
        [0x10, "Locked"],
        [0x08, "Protected"],
        [0x04, "Preload"],
        [0x02, "Changed"],
        [0x01, "Compressed on disk"],
    ] as const;
    return (
        <>
            <div className="MacResources-ColumnTitle">
                <strong>
                    {type} {resource.id}
                </strong>
            </div>
            <div className="MacResources-DetailContents">
                <h3>{resource.name ?? "Untitled resource"}</h3>
                <p>
                    {detail?.size ?? resource.size ?? "Unknown size"}
                    {detail || resource.size !== undefined
                        ? " bytes"
                        : ""} ·{" "}
                    {detail?.cached || recent
                        ? "Saved from an earlier capture"
                        : resource.resident
                          ? "Loaded in memory"
                          : "Not loaded"}
                </p>
                <p className="MacResources-Attributes">
                    Attributes $
                    {resource.attributes.toString(16).padStart(2, "0")}
                    {attributes
                        .filter(([bit]) => resource.attributes & bit)
                        .map(([, label]) => ` · ${label}`)
                        .join("")}
                </p>
                {detail?.cached && (
                    <p className="MacResources-Notice">
                        Captured at{" "}
                        {new Date(detail.capturedAt).toLocaleTimeString()}.
                        These bytes are no longer confirmed resident.
                    </p>
                )}
                {type === "PAT#" && bytes && <PatternList data={bytes} />}
                {type === "PICT" && detail && (
                    <PictPreview data={detail.data} size={detail.size} />
                )}
                {bitmap && type !== "PAT#" && (
                    <figure className="MacResources-Bitmap">
                        <canvas
                            ref={canvas}
                            width={bitmap.width}
                            height={bitmap.height}
                            style={{
                                width: bitmap.width * 4,
                                height: bitmap.height * 4,
                            }}
                        />
                        <figcaption>
                            {bitmap.width} × {bitmap.height}
                            {bitmap.hotspot
                                ? ` · Hotspot (${bitmap.hotspot.x}, ${bitmap.hotspot.y})`
                                : ""}
                            {type === "SICN" && (bytes?.length ?? 0) > 32
                                ? " · First icon"
                                : ""}
                        </figcaption>
                    </figure>
                )}
                {bitmap && (type === "ppat" || type === "PAT ") && (
                    <figure className="MacResources-Bitmap">
                        <PatternSwatch bitmap={bitmap} size={96} />
                        <figcaption>Repeated pattern</figcaption>
                    </figure>
                )}
                {detail && hasResourceBitmap(type) && !bitmap && (
                    <p className="MacResources-Notice">
                        Preview unavailable for this resource’s format or
                        incomplete data.
                    </p>
                )}
                {strings && (
                    <div className="MacResources-Strings">
                        {strings.map((s, i) => (
                            <div key={i}>
                                {strings.length > 1 && <small>{i + 1}. </small>}
                                {s || <em>Empty string</em>}
                            </div>
                        ))}
                    </div>
                )}
                {bytes ? (
                    <>
                        <div className="MacResources-HexHeading">
                            {structure ? (
                                <div
                                    className="MacResources-ViewChoices"
                                    role="group"
                                    aria-label="Resource display">
                                    <Button
                                        aria-pressed={view === "fields"}
                                        onClick={() => setView("fields")}>
                                        Fields
                                    </Button>
                                    <Button
                                        aria-pressed={view === "json"}
                                        onClick={() => setView("json")}>
                                        JSON
                                    </Button>
                                    <Button
                                        aria-pressed={view === "hex"}
                                        onClick={() => setView("hex")}>
                                        Hex & ASCII
                                    </Button>
                                </div>
                            ) : (
                                <strong>Hex & ASCII</strong>
                            )}
                        </div>
                        {structure && view !== "hex" ? (
                            <div
                                className="MacResources-Structure"
                                role="region"
                                aria-label="Structured resource"
                                tabIndex={0}>
                                {structure.warning && (
                                    <p className="MacResources-Notice">
                                        {structure.warning}
                                    </p>
                                )}
                                {view === "json" ? (
                                    <pre>
                                        {JSON.stringify(structure, null, 2)}
                                    </pre>
                                ) : (
                                    <ResourceFields fields={structure.fields} />
                                )}
                            </div>
                        ) : (
                            <HexDump key={detail.key} bytes={bytes} />
                        )}
                        {bytes.length < detail!.size && (
                            <p>
                                Showing the first{" "}
                                {bytes.length.toLocaleString()} bytes of{" "}
                                {detail!.size.toLocaleString()}.
                            </p>
                        )}
                    </>
                ) : (
                    <p className="MacResources-Empty">
                        {resource.unavailable ??
                            (resource.resident
                                ? "Waiting for resource data…"
                                : "This resource has no captured data. Open it in the emulated application to load it.")}
                    </p>
                )}
            </div>
        </>
    );
}

function ResourceFields({fields}: {fields: ResourceField[]}) {
    return (
        <div className="MacResources-Fields">
            {fields.map((field, index) =>
                field.children ? (
                    <details key={index} open>
                        <summary>{field.name}</summary>
                        <ResourceFields fields={field.children} />
                    </details>
                ) : (
                    <div
                        className="MacResources-Field"
                        key={index}
                        title={`${field.kind} · byte ${field.offset} · ${field.length} bytes`}>
                        <span>{field.name}</span>
                        <span>
                            {field.referenceType
                                ? `${field.referenceType} `
                                : ""}
                            {typeof field.value === "boolean"
                                ? field.value
                                    ? "Yes"
                                    : "No"
                                : field.value === ""
                                  ? "(empty)"
                                  : String(field.value)}
                        </span>
                    </div>
                )
            )}
        </div>
    );
}

const HEX_ROW_BYTES = 16;
const HEX_ROW_HEIGHT = 17;

function HexDump({bytes}: {bytes: Uint8Array}) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [bytesPerRow, setBytesPerRow] = useState(HEX_ROW_BYTES);
    useEffect(() => {
        const element = scrollRef.current;
        if (!element) return;
        const context = document.createElement("canvas").getContext("2d");
        const update = () => {
            // Moving a drawer between windows can briefly detach this element.
            if (!element.isConnected) return;
            const style = getComputedStyle(element);
            if (context) context.font = style.font;
            const characterWidth = context?.measureText("0").width ?? 6;
            const horizontalPadding =
                (parseFloat(style.paddingLeft) || 0) +
                (parseFloat(style.paddingRight) || 0);
            const characters = Math.floor(
                (element.clientWidth - horizontalPadding) / characterWidth
            );
            const fittingBytes = Math.floor((characters - 9) / 4);
            setBytesPerRow(
                Math.max(4, Math.min(16, Math.floor(fittingBytes / 2) * 2))
            );
        };
        update();
        const observer = new ResizeObserver(update);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    const count = Math.ceil(bytes.length / bytesPerRow);
    const virtualizer = useVirtualizer({
        count,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => HEX_ROW_HEIGHT,
        overscan: 8,
    });
    if (!count)
        return <pre className="MacResources-HexEmpty">Empty resource</pre>;
    return (
        <div
            ref={scrollRef}
            className="MacResources-Hex"
            role="region"
            aria-label="Hex and ASCII data"
            tabIndex={0}>
            <div
                className="MacResources-HexContents"
                style={{height: virtualizer.getTotalSize()}}>
                {virtualizer.getVirtualItems().map(item => (
                    <div
                        className="MacResources-HexRow"
                        key={item.key}
                        style={{transform: `translateY(${item.start}px)`}}>
                        {hexRow(bytes, item.index, bytesPerRow)}
                    </div>
                ))}
            </div>
        </div>
    );
}

function hexRow(bytes: Uint8Array, index: number, bytesPerRow: number) {
    const offset = index * bytesPerRow;
    const row = bytes.subarray(offset, offset + bytesPerRow);
    const hex = Array.from(row, value => value.toString(16).padStart(2, "0"))
        .join(" ")
        .padEnd(bytesPerRow * 3 - 1);
    const ascii = Array.from(row, value =>
        value >= 32 && value < 127 ? String.fromCharCode(value) : "."
    ).join("");
    return `${offset.toString(16).padStart(6, "0")}  ${hex}  ${ascii}`;
}

function PatternSwatch({
    bitmap,
    size = 32,
}: {
    bitmap: ResourceBitmap;
    size?: number;
}) {
    const canvas = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const context = canvas.current?.getContext("2d");
        if (!context) return;
        const image = new ImageData(bitmap.rgba, bitmap.width, bitmap.height);
        for (let y = 0; y < size; y += bitmap.height)
            for (let x = 0; x < size; x += bitmap.width)
                context.putImageData(image, x, y);
    }, [bitmap, size]);
    return (
        <canvas
            className="MacResources-PatternSwatch"
            ref={canvas}
            width={size}
            height={size}
        />
    );
}

function PatternList({data}: {data: Uint8Array}) {
    const [page, setPage] = useState(0);
    const count = resourcePatternCount(data);
    if (count === undefined) return null;
    const maxPage = Math.max(0, Math.ceil(count / 64) - 1);
    const currentPage = Math.min(page, maxPage);
    const start = currentPage * 64;
    return (
        <>
            <p>{count} patterns</p>
            {maxPage > 0 && (
                <div className="MacResources-GridPaging">
                    <Button
                        disabled={!currentPage}
                        onClick={() => setPage(currentPage - 1)}>
                        Previous patterns
                    </Button>
                    <span>
                        {currentPage + 1} / {maxPage + 1}
                    </span>
                    <Button
                        disabled={currentPage === maxPage}
                        onClick={() => setPage(currentPage + 1)}>
                        Next patterns
                    </Button>
                </div>
            )}
            <div className="MacResources-Patterns">
                {Array.from({length: Math.min(64, count - start)}, (_, i) => {
                    const index = start + i;
                    const bitmap = resourceBitmap(
                        "PAT ",
                        data.subarray(2 + index * 8)
                    )!;
                    return (
                        <figure key={index}>
                            <PatternSwatch bitmap={bitmap} />
                            <figcaption>{index + 1}</figcaption>
                        </figure>
                    );
                })}
            </div>
        </>
    );
}
