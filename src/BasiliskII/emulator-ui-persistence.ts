import type {EmulatorWorkerDirectorExtraction} from "./emulator-common";
import * as idbKeyVal from "idb-keyval";

export async function persistData(
    extraction: EmulatorWorkerDirectorExtraction
) {
    await idbKeyVal.set(EXTRACTION_KEY, extraction);
}

export async function getPersistedData(): Promise<
    EmulatorWorkerDirectorExtraction | undefined
> {
    const extraction = await idbKeyVal.get<EmulatorWorkerDirectorExtraction>(
        EXTRACTION_KEY
    );
    return extraction;
}
const EXTRACTION_KEY = "extraction";
