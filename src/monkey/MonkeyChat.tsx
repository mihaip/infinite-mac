import "@/monkey/MonkeyChat.css";
import classNames from "classnames";
import {useAppearance} from "@/controls/Appearance";
import {TextArea} from "@/controls/TextArea";
import {Button} from "@/controls/Button";
import {type Message, useChat} from "@/monkey/useChat";
import {
    useCollectProviderAPIKey,
    useProviderAPIKey,
} from "@/monkey/useProviderAPIKey";
import {useCallback, useEffect, useRef, useState} from "react";
import {type Disk} from "@/monkey/disks";
import {useComputer} from "@/monkey/useComputer";
import resetImagePath from "@/monkey/Images/Reset.png";
import stopImagePath from "@/monkey/Images/Stop.png";
import * as varz from "@/lib/varz";
import {type Provider} from "@/monkey/Provider";

export function MonkeyChat({
    provider,
    disk,
    iframeRef,
}: {
    provider: Provider;
    disk: Disk;
    iframeRef: React.RefObject<HTMLIFrameElement>;
}) {
    useEffect(() => {
        varz.increment("monkey_chat:shown");
    }, []);

    const appearance = useAppearance();

    const [apiKey, setAPIKey, apiKeyProvider] = useProviderAPIKey(provider);
    const {collectProviderAPIKey, collectProviderAPIKeyDialog} =
        useCollectProviderAPIKey(provider, setAPIKey);

    const [message, setMessage] = useState("");
    const computer = useComputer(disk, iframeRef);
    const onError = useCallback(
        () => varz.increment(`monkey_chat:${provider.id}:error`),
        [provider.id]
    );
    const onLoopIteration = useCallback(
        () => varz.increment(`monkey_chat:${provider.id}:loop_iteration`),
        [provider.id]
    );

    const {
        messages,
        sendMessage,
        canSendMessage,
        resetMessages,
        stopMessageSend,
        waitingForResponse,
    } = useChat(provider, computer, apiKeyProvider, onLoopIteration, onError);
    const handleMessageSend = async (
        e?: React.MouseEvent,
        text: string = message
    ) => {
        e?.preventDefault();

        if (!apiKey) {
            await collectProviderAPIKey();
            if (!apiKeyProvider()) {
                varz.increment(`monkey_chat:${provider.id}:no_api_key`);
                return;
            }
        }
        varz.increment(`monkey_chat:${provider.id}:send`);
        sendMessage(text);
        setMessage(""); // Clear the input after sending
    };

    const canSend = message.trim().length > 0 && canSendMessage;

    // Reset chat when switching disks
    useEffect(resetMessages, [disk, resetMessages]);

    const scrollableRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (scrollableRef.current) {
            scrollableRef.current.scrollTop = 0;
        }
    }, [messages.length]);

    return (
        <div className="MonkeyChat">
            <div
                className={classNames(
                    // We want an input-like border, but we're not actually an input.
                    "Input",
                    `Input-${appearance}`,
                    "MonkeyChat-Messages"
                )}
                ref={scrollableRef}>
                {waitingForResponse && <MonkeyChatWaitingMessagePlaceholder />}
                {messages.map((_, i) => (
                    <MonkeyChatMessage
                        key={i}
                        message={messages[messages.length - i - 1]}
                    />
                ))}
                {messages.length > 0 && (
                    <div className="MonkeyChat-Separator" />
                )}
                <MonkeyChatHeader
                    disk={disk}
                    handleMessageSend={handleMessageSend}
                    provider={provider}
                    providerAPIKey={apiKey}
                    setProviderAPIKey={setAPIKey}
                    collectProviderAPIKey={collectProviderAPIKey}
                />
            </div>
            <div className="MonkeyChat-Input">
                <TextArea
                    placeholder="Send an instruction to the LLM…"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey && canSend) {
                            e.preventDefault();
                            handleMessageSend();
                        }
                    }}
                    rows={3}
                />
                <div className="MonkeyChat-Input-Controls">
                    <Button onClick={handleMessageSend} disabled={!canSend}>
                        Send
                    </Button>
                    <div className="MonkeyChat-Input-Controls-Secondary">
                        <Button
                            onClick={resetMessages}
                            disabled={!messages.length || !canSendMessage}
                            title="Reset">
                            <img src={resetImagePath} alt="Reset" />
                        </Button>
                        <Button
                            onClick={() => {
                                varz.increment(
                                    `monkey_chat:${provider.id}:stop`
                                );
                                stopMessageSend();
                            }}
                            disabled={canSendMessage}
                            title="Stop">
                            <img src={stopImagePath} alt="Stop" />
                        </Button>
                    </div>
                </div>
            </div>
            {collectProviderAPIKeyDialog}
        </div>
    );
}

function MonkeyChatHeader({
    provider,
    disk,
    handleMessageSend,
    providerAPIKey,
    setProviderAPIKey,
    collectProviderAPIKey,
}: {
    provider: Provider;
    disk: Disk;
    handleMessageSend: (e?: React.MouseEvent, text?: string) => Promise<void>;
    providerAPIKey: string;
    setProviderAPIKey: (key: string) => void;
    collectProviderAPIKey: () => Promise<void>;
}) {
    const displayAPIKey = providerAPIKey
        ? providerAPIKey.slice(0, 4) + "..." + providerAPIKey.slice(-4)
        : "";
    return (
        <div className="MonkeyChat-Header">
            <p>
                Chat with an LLM to control an emulated classic Mac. Think of it
                as a 2025 take on the{" "}
                <a
                    className="MonkeyChat-Link"
                    href="https://folklore.org/Monkey_Lives.html"
                    target="_blank">
                    Monkey
                </a>{" "}
                desk accessory used during the original Mac's development.
            </p>
            <p>
                <a
                    className="MonkeyChat-Link"
                    href="https://www.youtube.com/watch?v=td2-GKPxgJE"
                    target="_blank">
                    Demo video
                </a>{" "}
                of what it can (and can’t) do, and{" "}
                <a
                    className="MonkeyChat-Link"
                    href="https://blog.persistent.info/2025/07/infinite-mac-embedding.html"
                    target="_blank">
                    a blog post with more details
                </a>
                .
            </p>
            <p>Some things you can try:</p>
            <ul>
                {disk.examples.map((example, index) => (
                    <li key={index}>
                        <span
                            className="MonkeyChat-Link"
                            onClick={() =>
                                handleMessageSend(undefined, example)
                            }>
                            {example}
                        </span>
                    </li>
                ))}
            </ul>

            <p className="MonkeyChat-APIKey-Message">
                {providerAPIKey ? (
                    <>
                        {provider.label} API key: <code>{displayAPIKey}</code> (
                        <span
                            onClick={() => setProviderAPIKey("")}
                            className="MonkeyChat-Link">
                            clear
                        </span>
                        ).
                    </>
                ) : (
                    <>
                        <span
                            onClick={collectProviderAPIKey}
                            className="MonkeyChat-Link">
                            Enter an {provider.label} API key
                        </span>{" "}
                        to get started.
                    </>
                )}
            </p>
        </div>
    );
}

function MonkeyChatWaitingMessagePlaceholder() {
    return (
        <div className="MonkeyChat-Waiting">
            <span className="MonkeyChat-Badge">• • •</span>
        </div>
    );
}

function MonkeyChatMessage({message}: {message: Message}) {
    if (message.type === "user") {
        return (
            <MonkeyChatMessageBubble
                content={message.content}
                label="You"
                isUser
            />
        );
    }
    if (message.type === "assistant") {
        return (
            <MonkeyChatMessageBubble
                content={message.content}
                label={message.isRefusal ? "LLM Refusal" : "LLM"}
                isError={message.isRefusal}
            />
        );
    }
    if (message.type === "reasoning") {
        return (
            <div className="MonkeyChat-Reasoning">
                <span className="MonkeyChat-Badge">Reasoning</span>{" "}
                {message.content}
            </div>
        );
    }
    if (message.type === "error") {
        return (
            <MonkeyChatMessageBubble
                content={message.content}
                label="Error"
                isError
            />
        );
    }
    if (message.type === "action") {
        const {action} = message;
        let displayAction;
        switch (action.type) {
            case "click": {
                const buttonSuffix =
                    action.button !== "left"
                        ? ` with ${action.button} button`
                        : "";
                displayAction = `Click at (${action.x}, ${action.y})${buttonSuffix}`;
                break;
            }
            case "double_click":
                displayAction = `Double click at (${action.x}, ${action.y})`;
                break;
            case "triple_click":
                displayAction = `Triple click at (${action.x}, ${action.y})`;
                break;
            case "mouse_down":
                displayAction = `Mouse down`;
                break;
            case "mouse_up":
                displayAction = `Mouse up`;
                break;
            case "drag":
                displayAction = `Dragging along path: ${action.path
                    .map(p => `(${p.x}, ${p.y})`)
                    .join(" -> ")}`;
                break;
            case "move":
                displayAction = `Moving mouse to (${action.x}, ${action.y})`;
                break;
            case "scroll":
                displayAction = `Scrolling by (${action.scroll_x}, ${action.scroll_y})`;
                break;
            case "type":
                displayAction = `Typing "${action.text}"`;
                break;
            case "keypress":
                displayAction = `Pressing keys ${action.keys.join("+")}`;
                if (action.durationMs) {
                    displayAction += ` for ${action.durationMs}ms`;
                }
                break;
            case "wait":
                displayAction = `Waiting for computer to respond…`;
                break;
            case "screenshot":
                displayAction = `Taking a screenshot`;
                break;
        }
        return (
            <div className="MonkeyChat-Action">
                <span className="MonkeyChat-Badge">Action</span>{" "}
                {displayAction ?? (
                    <pre>
                        Unknown action:{" "}
                        {JSON.stringify(message.action, undefined, 4)}
                    </pre>
                )}
            </div>
        );
    }

    return <pre>{JSON.stringify(message, undefined, 4)}</pre>;
}

function MonkeyChatMessageBubble({
    content,
    label,
    isUser,
    isError,
}: {
    content: string;
    label?: string;
    isUser?: boolean;
    isError?: boolean;
    isReasoning?: boolean;
}) {
    return (
        <div
            className={classNames("MonkeyChat-MessageBubble", {
                "MonkeyChat-MessageBubble-User": isUser,
                "MonkeyChat-MessageBubble-Error": isError,
            })}>
            {label && (
                <div className="MonkeyChat-MessageBubble-Label">{label}</div>
            )}
            <div className="MonkeyChat-MessageBubble-Content">{content}</div>
        </div>
    );
}
