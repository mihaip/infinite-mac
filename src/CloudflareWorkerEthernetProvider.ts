import {
    type EmulatorEthernetProvider,
    type EmulatorEthernetProviderDelegate,
} from "./emulator/emulator-ui";

/**
 * Works in conjunction with the Cloudflare worker defined in
 * workers-ethernet/src/index.mjs to broadcast Ethernet packets to all emulator
 * instances in the same named zone.
 */
export class CloudflareWorkerEthernetProvider
    implements EmulatorEthernetProvider
{
    #zoneName: string;
    #macAddress?: string;
    #webSocket: WebSocket;
    #delegate?: EmulatorEthernetProviderDelegate;
    #state: "opening" | "closed" | "opened" = "opening";
    #bufferedMessages: string[] = [];
    #reconnectTimeout?: number;

    constructor(zoneName: string) {
        this.#zoneName = zoneName;
        this.#webSocket = this.#connect();
    }

    description(): string {
        return `Zone ${this.#zoneName}`;
    }

    zoneName(): string {
        return this.#zoneName;
    }

    macAddress(): string | undefined {
        return this.#macAddress;
    }

    #connect(): WebSocket {
        const protocol = location.protocol === "https:" ? "wss:" : "ws:";
        const origin = `${protocol}//${location.host}`;
        const webSocket = new WebSocket(
            `${origin}/zone/${this.#zoneName}/websocket`
        );
        webSocket.addEventListener("open", this.#handleOpen);
        webSocket.addEventListener("close", this.#handleClose);
        webSocket.addEventListener("error", this.#handleError);
        webSocket.addEventListener("message", this.#handleMessage);
        return webSocket;
    }

    #reconnect(): void {
        const webSocket = this.#webSocket;
        webSocket.removeEventListener("open", this.#handleOpen);
        webSocket.removeEventListener("close", this.#handleClose);
        webSocket.removeEventListener("error", this.#handleError);
        webSocket.removeEventListener("message", this.#handleMessage);

        this.#state = "opening";
        if (this.#reconnectTimeout) {
            window.clearTimeout(this.#reconnectTimeout);
        }
        this.#reconnectTimeout = window.setTimeout(() => {
            this.#webSocket = this.#connect();
        }, 1000);
    }

    init(macAddress: string): void {
        this.#macAddress = macAddress;
        this.#send({type: "init", macAddress});
    }

    close() {
        this.#state = "closed";
        this.#send({type: "close"});
        this.#webSocket.close();
    }

    send(destination: string, packet: Uint8Array): void {
        // TODO: send packets directly as Uint8Arrays, to avoid copying overhead.
        this.#send({
            type: "send",
            destination,
            packetArray: Array.from(packet),
        });
    }

    #send(message: any) {
        message = JSON.stringify(message);
        if (this.#state === "opened") {
            this.#webSocket.send(message);
        } else {
            this.#bufferedMessages.push(message);
        }
    }

    setDelegate(delegate: EmulatorEthernetProviderDelegate): void {
        this.#delegate = delegate;
    }

    #handleOpen = (event: Event): void => {
        this.#state = "opened";
        const bufferedMessages = this.#bufferedMessages;
        this.#bufferedMessages = [];
        for (const message of bufferedMessages) {
            this.#webSocket.send(message);
        }
        if (this.#macAddress) {
            this.init(this.#macAddress);
        }
    };

    #handleClose = (event: CloseEvent): void => {
        if (this.#state === "closed") {
            // Intentionally closed
            return;
        }
        this.#reconnect();
    };

    #handleError = (event: Event): void => {
        console.error("WebSocket error", event);
        this.#reconnect();
    };

    #handleMessage = (event: MessageEvent): void => {
        const data = JSON.parse(event.data);
        const {type} = data;
        switch (type) {
            case "receive": {
                const {packetArray} = data;
                const packet = new Uint8Array(packetArray);
                this.#delegate?.receive(packet);
                break;
            }
        }
    };
}
