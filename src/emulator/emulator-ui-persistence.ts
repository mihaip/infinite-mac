import type {EmulatorWorkerDirectorExtraction} from "./emulator-common";
import * as idbKeyVal from "idb-keyval";

export async function persistData(
    extraction: EmulatorWorkerDirectorExtraction
) {
    try {
        await idbKeyVal.set(EXTRACTION_KEY, extraction);
    } catch (err) {
        console.warn("Could not persist data", err);
    }
}

export async function getPersistedData(): Promise<
    EmulatorWorkerDirectorExtraction | undefined
> {
    try {
        const extraction =
            await idbKeyVal.get<EmulatorWorkerDirectorExtraction>(
                EXTRACTION_KEY
            );
        return extraction;
    } catch (err) {
        console.warn("Could not read persisted data", err);
        return undefined;
    }
}
const EXTRACTION_KEY = "extraction";
