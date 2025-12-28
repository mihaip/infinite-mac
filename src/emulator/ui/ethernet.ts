import {
    type EmulatorWorkerEthernetConfig,
    type EmulatorWorkerFallbackEthernetConfig,
    type EmulatorWorkerSharedMemoryEthernetConfig,
    ETHERNET_PING_HEADER,
    ETHERNET_PING_PACKET_LENGTH,
    ETHERNET_PING_PAYLOAD_LENGTH,
    ETHERNET_PONG_PACKET_LENGTH,
    ETHERNET_PONG_HEADER,
    ethernetMacAddressToString,
    ethernetMacAddressFromString,
} from "@/emulator/common/common";
import {
    type EmulatorEthernetProvider,
    type EmulatorFallbackCommandSender,
} from "@/emulator/ui/ui";
import {RingBuffer} from "ringbuf.js";

export interface EmulatorEthernet {
    workerConfig(): EmulatorWorkerEthernetConfig;
    receive(packet: Uint8Array): void;
}

const RECEIVE_BUFFER_SIZE = 1522 * 10;

export class SharedMemoryEmulatorEthernet implements EmulatorEthernet {
    #receiveBuffer = new SharedArrayBuffer(RECEIVE_BUFFER_SIZE);
    #receiveRingBuffer = new RingBuffer(this.#receiveBuffer, Uint8Array);

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

export class FallbackEmulatorEthernet implements EmulatorEthernet {
    #commandSender: EmulatorFallbackCommandSender;

    constructor(commandSender: EmulatorFallbackCommandSender) {
        this.#commandSender = commandSender;
    }

    workerConfig(): EmulatorWorkerFallbackEthernetConfig {
        return {type: "fallback"};
    }

    receive(packet: Uint8Array): void {
        this.#commandSender({
            type: "ethernet_receive",
            packetArray: Array.from(packet),
        });
    }
}

/**
 * Debug flag to enable logging of ethernet packets that correspond to AppleTalk
 * broadcasts.
 */
const LOG_APPLE_TALK_BROADCASTS = false;
let lastBroadcast: string | undefined;

const DATA_PACKET_SNAP_HEADER = [0x08, 0x00, 0x07, 0x80, 0x9b].toString();
const AARP_PACKET_SNAP_HEADER = [0x00, 0x00, 0x00, 0x80, 0xf3].toString();

export function handleEthernetWrite(
    destination: string,
    packet: Uint8Array
): Uint8Array | undefined {
    if (!LOG_APPLE_TALK_BROADCASTS) {
        return undefined;
    }
    if (destination !== "AT") {
        return undefined;
    }
    if (lastBroadcast === packet.toString()) {
        console.log("Repeat AppleTalk Broadcast");
        return;
    }
    console.group("AppleTalk Broadcast");
    const macToString = ethernetMacAddressToString;
    const displayByte = (byte: number) =>
        "0x" + byte.toString(16).padStart(2, "0");
    const displayShort = (short: number) =>
        "0x" + short.toString(16).padStart(4, "0");
    const displayBytes = (bytes: Uint8Array) =>
        Array.from(bytes).map(displayByte);
    const sub = (bytes: Uint8Array, start: number, length: number) =>
        bytes.subarray(start, start + length);

    const packetView = new DataView(packet.buffer);
    console.log("Destination Address", macToString(sub(packet, 0, 6)));
    console.log("Source Address", macToString(sub(packet, 6, 6)));
    console.log("Length", packetView.getUint16(12));
    console.log("Destination SAP", displayByte(packetView.getUint8(14)));
    console.log("Source SAP", displayByte(packetView.getUint8(15)));
    console.log("Control Byte", displayByte(packetView.getUint8(16)));

    const snapHeader = sub(packet, 17, 5);
    if (snapHeader.toString() === DATA_PACKET_SNAP_HEADER) {
        console.log("Data Packet");
    } else if (snapHeader.toString() === AARP_PACKET_SNAP_HEADER) {
        console.log("AARP Packet");
        const aarpPacket = packet.subarray(17 + 5);
        const aarpPacketView = new DataView(packet.buffer, 17 + 5);
        const hardwareType = aarpPacketView.getUint16(0);
        const protocolType = aarpPacketView.getUint16(2);
        const hwAddrLen = aarpPacketView.getUint8(4);
        const protoAddrLen = aarpPacketView.getUint8(5);
        const operation = aarpPacketView.getUint16(6);
        const senderHardwareAddress = sub(aarpPacket, 8, hwAddrLen);
        const senderProtocolAddress = sub(
            aarpPacket,
            8 + hwAddrLen,
            protoAddrLen
        );
        const targetHardwareAddress = sub(
            aarpPacket,
            8 + hwAddrLen + protoAddrLen,
            hwAddrLen
        );
        const targetProtocolAddress = sub(
            aarpPacket,
            8 + hwAddrLen + protoAddrLen + hwAddrLen,
            protoAddrLen
        );
        console.log("Hardware Type", displayShort(hardwareType));
        console.log("Protocol Type", displayShort(protocolType));
        console.log("Function", displayShort(operation));
        console.log(
            "Sender Hardware Address",
            macToString(senderHardwareAddress)
        );
        console.log(
            "Sender Protocol Address",
            macToString(senderProtocolAddress)
        );
        console.log(
            "Target Hardware Address",
            macToString(targetHardwareAddress)
        );
        console.log(
            "Target Protocol Address",
            macToString(targetProtocolAddress)
        );
    } else {
        console.log("SNAP Header", displayBytes(snapHeader));
    }
    lastBroadcast = packet.toString();
    console.groupEnd();
    return undefined;
}

export type EthernetPingerPeer = {
    readonly macAddress: string;
    rttMs: number;
    lastPingTimeMs: number;
};

export interface EthernetPingerDelegate {
    ethernetPingerDidUpdatePeers(pinger: EthernetPinger): void;
}

export class EthernetPinger {
    #delegate: EthernetPingerDelegate;
    #macAddress?: Uint8Array;
    #ethernetProvider?: EmulatorEthernetProvider;
    #interval?: number;
    #peersByMacAddress = new Map<string, EthernetPingerPeer>();

    constructor(delegate: EthernetPingerDelegate) {
        this.#delegate = delegate;
    }

    start(macAddress: string, ethernetProvider: EmulatorEthernetProvider) {
        this.#macAddress = ethernetMacAddressFromString(macAddress);
        this.#ethernetProvider = ethernetProvider;
        this.#interval = window.setInterval(
            this.#ping,
            // Wait 30 seconds between pings in production so that the worker
            // can hibernate (per https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/
            // the worker needs to be quiet for at least 10 seconds to be eligible for
            // hibernation).
            location.host.startsWith("localhost") ? 500 : 30_000
        );
        this.#ping();
    }

    stop() {
        if (this.#interval !== undefined) {
            window.clearInterval(this.#interval);
            this.#interval = undefined;
        }
    }

    peers(): readonly EthernetPingerPeer[] {
        return Array.from(this.#peersByMacAddress.values());
    }

    handlePongPacket(packet: Uint8Array): boolean {
        if (packet.byteLength !== ETHERNET_PONG_PACKET_LENGTH) {
            return false;
        }

        for (let i = 0; i < ETHERNET_PONG_HEADER.length; i++) {
            if (packet[14 + i] !== ETHERNET_PONG_HEADER[i]) {
                return false;
            }
        }

        const peerMacAddress = ethernetMacAddressToString(
            packet.subarray(6, 12)
        );
        const packetView = new DataView(packet.buffer, packet.byteOffset);
        const sendTime = packetView.getUint32(14 + ETHERNET_PONG_HEADER.length);
        const rtt = performance.now() - sendTime;

        this.#peersByMacAddress.set(peerMacAddress, {
            macAddress: peerMacAddress,
            rttMs: rtt,
            lastPingTimeMs: Date.now(),
        });

        this.#delegate.ethernetPingerDidUpdatePeers(this);

        return true;
    }

    #ping = () => {
        if (!this.#macAddress || !this.#ethernetProvider) {
            return;
        }
        const packet = new Uint8Array(ETHERNET_PING_PACKET_LENGTH);
        const packetView = new DataView(packet.buffer, packet.byteOffset);

        packet.set(PING_DESTINATION_ADDRESS, 0);
        packet.set(this.#macAddress, 6);
        packetView.setUint16(12, ETHERNET_PING_PAYLOAD_LENGTH);
        packet.set(ETHERNET_PING_HEADER, 14);
        packetView.setUint32(
            14 + ETHERNET_PING_HEADER.length,
            performance.now()
        );

        this.#ethernetProvider.send("*", packet);
    };
}

const PING_DESTINATION_ADDRESS = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
