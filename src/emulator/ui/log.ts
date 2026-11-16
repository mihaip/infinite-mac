import {type EmulatorType} from "@/emulator/common/emulators";
import {parseSearchQuery} from "@/lib/search";

export class EmulatorLog {
    #emulatorType: EmulatorType;

    constructor(emulatorType: EmulatorType) {
        this.#emulatorType = emulatorType;
    }

    append(message: string) {
        this.#messages = [
            ...this.#messages,
            {
                id: this.#nextMessageId++,
                emulatorType: this.#emulatorType,
                timestamp: Date.now(),
                message,
            },
        ];
        this.#notifyListeners();
    }

    clear() {
        if (!this.#messages.length) {
            return;
        }
        this.#messages = [];
        this.#notifyListeners();
    }

    getSnapshot = (): readonly EmulatorLogMessage[] => this.#messages;

    subscribe = (listener: () => void) => {
        this.#listeners.add(listener);
        return () => {
            this.#listeners.delete(listener);
        };
    };

    #messages: readonly EmulatorLogMessage[] = [];
    #nextMessageId = 0;
    #listeners = new Set<() => void>();

    #notifyListeners() {
        for (const listener of this.#listeners) {
            listener();
        }
    }
}

export function parseEmulatorLogMessage(
    logMessage: EmulatorLogMessage
): EmulatorParsedLogMessage {
    switch (logMessage.emulatorType) {
        case "Snow":
            return parseSnowLogMessage(logMessage);
        case "DingusPPC":
            return parseDingusPPCLogMessage(logMessage);
        default:
            return logMessage;
    }
}

export function createEmulatorLogSearchPredicate(
    query: string
): (message: EmulatorLogMessage) => boolean {
    const terms = parseSearchQuery(query);
    // Messages are immutable. Only evaluate newly appended messages while the
    // query stays the same, rather than reparsing the whole buffer each frame.
    const results = new WeakMap<EmulatorLogMessage, boolean>();
    return message => {
        const cached = results.get(message);
        if (cached !== undefined) {
            return cached;
        }
        let text: string | undefined;
        let parsed: EmulatorParsedLogMessage | undefined;
        const matches = terms.every(term => {
            switch (term.operator) {
                case undefined:
                    text ??= message.message.toLowerCase();
                    return text.includes(term.value);
                case "level":
                    parsed ??= parseEmulatorLogMessage(message);
                    return parsed.level?.toLowerCase() === term.value;
                case "file":
                    parsed ??= parseEmulatorLogMessage(message);
                    return (
                        parsed.source?.toLowerCase().includes(term.value) ??
                        false
                    );
                default:
                    return false;
            }
        });
        results.set(message, matches);
        return matches;
    };
}

export type EmulatorLogMessage = {
    readonly id: number;
    readonly emulatorType: EmulatorType;
    readonly timestamp: number;
    readonly message: string;
};

export type EmulatorParsedLogMessage = EmulatorLogMessage & {
    readonly level?: EmulatorLogLevel;
    readonly source?: string;
    readonly sourceLine?: number;
};

export type EmulatorLogLevel =
    | "TRACE"
    | "DEBUG"
    | "INFO"
    | "WARN"
    | "ERROR"
    | "FATAL";

function parseSnowLogMessage(
    logMessage: EmulatorLogMessage
): EmulatorParsedLogMessage {
    const snow =
        /^\[(\S+)\s+(TRACE|DEBUG|INFO|WARN|ERROR)\s+([^\]\r\n]+)\] ?([\s\S]*)$/.exec(
            logMessage.message
        );
    if (!snow) {
        return logMessage;
    }
    const timestamp = Date.parse(snow[1]);
    if (!Number.isFinite(timestamp)) {
        return logMessage;
    }
    return {
        ...logMessage,
        timestamp,
        level: snow[2] as EmulatorLogLevel,
        source: snow[3].trim(),
        message: snow[4],
    };
}

function parseDingusPPCLogMessage(
    logMessage: EmulatorLogMessage
): EmulatorParsedLogMessage {
    const dingus =
        /^[ \t]*(\S[^\r\n]*?):(\d+)\s+(TRACE|DEBUG|INFO|WARN|ERR|FATL)\| ?([\s\S]*)$/.exec(
            logMessage.message
        );
    if (!dingus) {
        return logMessage;
    }
    let level = dingus[3] as EmulatorLogLevel | "ERR" | "FATL";
    if (level === "ERR") {
        level = "ERROR";
    } else if (level === "FATL") {
        level = "FATAL";
    }
    return {
        ...logMessage,
        level,
        source: dingus[1].trim(),
        sourceLine: Number(dingus[2]),
        message: dingus[4],
    };
}
