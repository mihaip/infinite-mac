import type {
    EmulatorWorkerFallbackEthernetConfig,
    EmulatorWorkerSharedMemoryEthernetConfig,
} from "./emulator-common";
import {
    ethernetMacAddressToString,
    ETHERNET_PING_HEADER,
    ETHERNET_PING_PACKET_LENGTH,
    ETHERNET_PONG_HEADER,
    ETHERNET_PONG_PACKET_LENGTH,
    ETHERNET_PONG_PAYLOAD_LENGTH,
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

export function sendEthernetPacket(destination: string, packet: Uint8Array) {
    // No point in using shared memory if we have to use postMessage to
    // notify the UI -- the actual packet is small.
    postMessage(
        {
            type: "emulator_ethernet_write",
            destination,
            packet,
        },
        [packet.buffer]
    );
}

export function handlePingPacket(
    packet: Uint8Array,
    length: number,
    ourMacAddress: Uint8Array
): boolean {
    if (length !== ETHERNET_PING_PACKET_LENGTH) {
        return false;
    }

    for (let i = 0; i < ETHERNET_PING_HEADER.length; i++) {
        if (packet[14 + i] !== ETHERNET_PING_HEADER[i]) {
            return false;
        }
    }

    const packetView = new DataView(packet.buffer, packet.byteOffset);
    const senderMacAddress = packet.subarray(6, 12);
    const sendTime = packetView.getUint32(14 + ETHERNET_PING_HEADER.length);

    const pongPacket = new Uint8Array(ETHERNET_PONG_PACKET_LENGTH);
    const pongPacketView = new DataView(pongPacket.buffer);
    pongPacket.set(senderMacAddress, 0);
    pongPacket.set(ourMacAddress, 6);
    pongPacketView.setUint16(12, ETHERNET_PONG_PAYLOAD_LENGTH);
    pongPacket.set(ETHERNET_PONG_HEADER, 14);
    pongPacketView.setUint32(14 + ETHERNET_PONG_HEADER.length, sendTime);

    sendEthernetPacket(
        ethernetMacAddressToString(senderMacAddress),
        pongPacket
    );
    return true;
}
