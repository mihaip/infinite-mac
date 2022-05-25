import type {
    EmulatorWorkerFallbackEthernetConfig,
    EmulatorWorkerSharedMemoryEthernetConfig,
} from "./emulator-common";
import type {EmulatorFallbackEndpoint} from "./emulator-worker";
import {RingBuffer} from "ringbuf.js";

export interface EmulatorWorkerEthernet {
    read(packet: Uint8Array): number;
}

export class SharedMemoryEmulatorWorkerEthernet
    implements EmulatorWorkerEthernet
{
    #receiveRingBuffer: RingBuffer<Uint8Array>;

    constructor(config: EmulatorWorkerSharedMemoryEthernetConfig) {
        this.#receiveRingBuffer = new RingBuffer(
            config.receiveBuffer,
            Uint8Array
        );
    }

    read(packet: Uint8Array): number {
        if (this.#receiveRingBuffer.empty()) {
            return 0;
        }
        const packetHeader = new Uint8Array(2);
        this.#receiveRingBuffer.pop(packetHeader);
        const packetLength = new DataView(packetHeader.buffer).getUint16(0);
        const readPacket = new Uint8Array(packetLength);
        this.#receiveRingBuffer.pop(readPacket);
        packet.set(readPacket);
        return packetLength;
    }
}

export class FallbackEmulatorWorkerEthernet implements EmulatorWorkerEthernet {
    #fallbackEndpoint: EmulatorFallbackEndpoint;
    #packets: Uint8Array[] = [];

    constructor(
        config: EmulatorWorkerFallbackEthernetConfig,
        fallbackEndpoint: EmulatorFallbackEndpoint
    ) {
        this.#fallbackEndpoint = fallbackEndpoint;
    }

    read(packet: Uint8Array): number {
        for (const packet of this.#fallbackEndpoint.consumeEthernetReceives()) {
            this.#packets.push(packet);
        }
        if (!this.#packets.length) {
            return 0;
        }
        const readPacket = this.#packets.shift()!;
        packet.set(readPacket);
        return readPacket?.byteLength;
    }
}
