import type {
    EmulatorWorkerEthernetConfig,
    EmulatorWorkerFallbackEthernetConfig,
    EmulatorWorkerSharedMemoryEthernetConfig,
} from "./emulator-common";
import type {
    EmulatorConfig,
    EmulatorEthernetProvider,
    EmulatorEthernetProviderDelegate,
    EmulatorFallbackCommandSender,
} from "./emulator-ui";
import {RingBuffer} from "ringbuf.js";

export interface EmulatorEthernet {
    workerConfig(): EmulatorWorkerEthernetConfig;
}

const RECEIVE_BUFFER_SIZE = 1522 * 10;

export class SharedMemoryEmulatorEthernet
    implements EmulatorEthernet, EmulatorEthernetProviderDelegate
{
    #provider: EmulatorEthernetProvider;
    #receiveBuffer = new SharedArrayBuffer(RECEIVE_BUFFER_SIZE);
    #receiveRingBuffer = new RingBuffer(this.#receiveBuffer, Uint8Array);

    constructor(config: EmulatorConfig) {
        this.#provider = config.ethernetProvider;
        this.#provider.setDelegate(this);
    }

    workerConfig(): EmulatorWorkerSharedMemoryEthernetConfig {
        return {
            type: "shared-memory",
            receiveBuffer: this.#receiveBuffer,
        };
    }

    receive(packet: Uint8Array): void {
        const packetHeader = new Uint8Array(2);
        new DataView(packetHeader.buffer).setUint16(0, packet.byteLength);
        this.#receiveRingBuffer.push(packetHeader);
        this.#receiveRingBuffer.push(packet);
    }
}

export class FallbackEmulatorEthernet
    implements EmulatorEthernet, EmulatorEthernetProviderDelegate
{
    #provider: EmulatorEthernetProvider;
    #commandSender: EmulatorFallbackCommandSender;

    constructor(
        config: EmulatorConfig,
        commandSender: EmulatorFallbackCommandSender
    ) {
        this.#provider = config.ethernetProvider;
        this.#commandSender = commandSender;
        this.#provider.setDelegate(this);
    }

    workerConfig(): EmulatorWorkerFallbackEthernetConfig {
        return {type: "fallback"};
    }

    receive(packet: Uint8Array): void {
        const reader = new FileReader();
        reader.onload = () => {
            this.#commandSender({
                type: "ethernet_receive",
                packetDataUrl: reader.result as string,
            });
        };
        reader.readAsDataURL(new Blob([packet]));
    }
}
