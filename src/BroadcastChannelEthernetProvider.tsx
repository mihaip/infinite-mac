import type {
    EmulatorEthernetProvider,
    EmulatorEthernetProviderDelegate,
} from "./BasiliskII/emulator-ui";

export class BroadcastChannelEthernetProvider
    implements EmulatorEthernetProvider
{
    #broadcastChannel = new BroadcastChannel("ethernet");
    #macAddress?: string;
    #delegate?: EmulatorEthernetProviderDelegate;

    constructor() {
        this.#broadcastChannel.addEventListener("message", this.#handleMessage);
    }

    description(): string {
        return `Loopback`;
    }

    macAddress(): string | undefined {
        return this.#macAddress;
    }

    init(macAddress: string): void {
        this.#macAddress = macAddress;
    }

    send(destination: string, packet: Uint8Array): void {
        this.#broadcastChannel.postMessage({
            destination,
            packet,
        });
    }

    setDelegate(delegate: EmulatorEthernetProviderDelegate): void {
        this.#delegate = delegate;
    }

    #handleMessage = (event: MessageEvent): void => {
        const {destination, packet} = event.data;
        if (
            destination === this.#macAddress ||
            destination === "*" ||
            destination === "AT"
        ) {
            this.#delegate?.receive(packet);
        }
    };
}
