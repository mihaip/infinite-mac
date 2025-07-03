import {useEffect, useState} from "react";
import {type EmulatorCDROM} from "./emulator/emulator-common";
import {type RunDef} from "./run-def";
import Mac from "./Mac";
import {getCDROMInfo} from "./cdroms";

export type RunDefMacProps = {
    runDef: RunDef;
    onDone: () => void;
};

export default function RunDefMac({runDef, onDone}: RunDefMacProps) {
    const [cdroms, setCDROMs] = useState<EmulatorCDROM[] | undefined>(
        runDef.cdromURLs.length || runDef.diskURLs?.length ? undefined : []
    );
    const [cdromErrorText, setCDROMErrorText] = useState<string | undefined>(
        undefined
    );
    useEffect(() => {
        const allURLs = [...runDef.cdromURLs, ...(runDef.diskURLs ?? [])];
        const allPrefetchChunks = [
            ...runDef.cdromPrefetchChunks,
            ...(runDef.diskPrefetchChunks ?? []),
        ];
        if (allURLs.length) {
            Promise.all(
                allURLs.map(async (url, i) => {
                    const info: EmulatorCDROM = await getCDROMInfo(url);
                    if (allPrefetchChunks[i]?.length > 0) {
                        info.prefetchChunks = allPrefetchChunks[i];
                    }
                    if (runDef.diskURLs?.includes(url)) {
                        info.mountReadWrite = true;
                    }
                    return info;
                })
            )
                .then(setCDROMs)
                .catch(error => {
                    setCDROMErrorText(`Could not load the CD-ROM: ${error}`);
                    setCDROMs([]);
                });
        }
    }, [
        runDef.cdromURLs,
        runDef.cdromPrefetchChunks,
        runDef.diskURLs,
        runDef.diskPrefetchChunks,
    ]);
    const disks = Array.from(new Set(runDef.disks));
    disks.forEach(disk => disk.generatedSpec()); // Prefetch the disk definition
    return cdroms ? (
        <Mac
            disks={disks}
            includeInfiniteHD={runDef.includeInfiniteHD}
            includeSavedHD={runDef.includeSavedHD}
            includeLibrary={runDef.includeLibrary}
            libraryDownloadURLs={runDef.libraryDownloadURLs}
            diskFiles={runDef.diskFiles}
            cdroms={cdroms}
            initialErrorText={cdromErrorText}
            machine={runDef.machine}
            ramSize={runDef.ramSize}
            screenSize={runDef.screenSize}
            screenScale={runDef.screenScale}
            screenUpdateMessages={runDef.screenUpdateMessages}
            startPaused={runDef.startPaused}
            autoPause={runDef.autoPause}
            listenForControlMessages={runDef.isEmbed}
            ethernetProvider={runDef.ethernetProvider}
            customDate={runDef.customDate ?? runDef.disks[0]?.customDate}
            debugFallback={runDef.debugFallback}
            debugAudio={runDef.debugAudio}
            debugPaused={runDef.debugPaused}
            debugLog={runDef.debugLog}
            debugTrackpad={runDef.debugTrackpad}
            emulatorSettings={runDef.settings}
            onDone={onDone}
        />
    ) : (
        <div style={{color: "#aaa"}}>Loading CD-ROM Metadata…</div>
    );
}
