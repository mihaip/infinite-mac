import {useEffect, useMemo, useState} from "react";
import {type EmulatorCDROM} from "@/emulator/common/common";
import {type RunDef} from "@/defs/run-def";
import Mac from "@/app/Mac";
import {getCDROMInfo} from "@/defs/cdroms";

export type MacLoaderProps = {
    runDef: RunDef;
    onDone: () => void;
};

export default function MacLoader({runDef, onDone}: MacLoaderProps) {
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
    const disks = useMemo(() => {
        const uniqueDisks = Array.from(new Set(runDef.disks));
        uniqueDisks.forEach(disk => disk.generatedSpec()); // Prefetch the disk definition
        return uniqueDisks;
    }, [runDef.disks]);
    const dedupedRunDef = useMemo(() => ({...runDef, disks}), [runDef, disks]);
    return cdroms ? (
        <Mac
            runDef={dedupedRunDef}
            cdroms={cdroms}
            initialErrorText={cdromErrorText}
            onDone={onDone}
        />
    ) : (
        <div style={{color: "#aaa"}}>Loading CD-ROM Metadata…</div>
    );
}
