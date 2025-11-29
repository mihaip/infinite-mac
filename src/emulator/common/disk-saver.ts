import {type EmulatorChunkedFileSpec} from "@/emulator/common/common";

type Spec = Pick<EmulatorChunkedFileSpec, "name">;

export function dataFileName(spec: Spec) {
    return spec.name + ".data";
}

export function dirtyChunksFileName(spec: Spec) {
    return spec.name + ".dirtychunks";
}
