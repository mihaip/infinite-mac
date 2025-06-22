import "./MonkeyChat.css";
import classNames from "classnames";
import {useAppearance} from "../controls/Appearance";
import {TextArea} from "../controls/TextArea";
import {Button} from "../controls/Button";
import {type Message, useChat} from "./useChat";
import {useCollectOpenAIAPIKey, useOpenAIAPIKey} from "./useOpenAIAPIKey";
import {useEffect, useRef, useState} from "react";
import {type Disk} from "./disks";
import {useComputer} from "./useComputer";
import resetImagePath from "./Images/Reset.png";
import stopImagePath from "./Images/Stop.png";

export function MonkeyChat({
    disk,
    iframeRef,
}: {
    disk: Disk;
    iframeRef: React.RefObject<HTMLIFrameElement>;
}) {
    const appearance = useAppearance();

    const [apiKey, setAPIKey, apiKeyProvider] = useOpenAIAPIKey();
    const {collectOpenAIAPIKey, collectOpenAIAPIKeyDialog} =
        useCollectOpenAIAPIKey(setAPIKey);

    const [message, setMessage] = useState("");
    const computer = useComputer(disk, iframeRef);
    const {
        messages,
        sendMessage,
        canSendMessage,
        resetMessages,
        stopMessageSend,
        waitingForResponse,
    } = useChat(computer, apiKeyProvider);
    const handleMessageSend = async (
        e?: React.MouseEvent,
        text: string = message
    ) => {
        e?.preventDefault();

        if (!apiKey) {
            await collectOpenAIAPIKey();
        }
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
                    apiKey={apiKey}
                    setAPIKey={setAPIKey}
                    collectOpenAIAPIKey={collectOpenAIAPIKey}
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
                            onClick={stopMessageSend}
                            disabled={canSendMessage}
                            title="Stop">
                            <img src={stopImagePath} alt="Stop" />
                        </Button>
                    </div>
                </div>
            </div>
            {collectOpenAIAPIKeyDialog}
        </div>
    );
}

function MonkeyChatHeader({
    disk,
    handleMessageSend,
    apiKey,
    setAPIKey,
    collectOpenAIAPIKey,
}: {
    disk: Disk;
    handleMessageSend: (e?: React.MouseEvent, text?: string) => Promise<void>;
    apiKey: string;
    setAPIKey: (key: string) => void;
    collectOpenAIAPIKey: () => Promise<void>;
}) {
    const displayAPIKey = apiKey
        ? apiKey.slice(0, 4) + "..." + apiKey.slice(-4)
        : "";
    return (
        <div className="MonkeyChat-Header">
            <p>
                Chat with an LLM to control an emulated classic Mac. Think of it
                as a 2025 take on the{" "}
                <a href="https://folklore.org/Monkey_Lives.html">Monkey</a> desk
                accessory used during the original Mac's development.
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
                {apiKey ? (
                    <>
                        OpenAI API key: <code>{displayAPIKey}</code> (
                        <span
                            onClick={() => setAPIKey("")}
                            className="MonkeyChat-Link">
                            clear
                        </span>
                        ).
                    </>
                ) : (
                    <>
                        Note: a valid OpenAI API key is required. It is stored
                        in your browser, and only used for chats you initiate.{" "}
                        <span
                            onClick={collectOpenAIAPIKey}
                            className="MonkeyChat-Link">
                            Enter your OpenAI API key
                        </span>
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
