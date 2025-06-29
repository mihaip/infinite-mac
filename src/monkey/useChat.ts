import OpenAI, {APIUserAbortError} from "openai";
import {
    type Tool,
    type ResponseComputerToolCall,
} from "openai/resources/responses/responses";
import {useCallback, useEffect, useRef, useState} from "react";
import {sleep} from "./util";

export type ComputerAction = ResponseComputerToolCall["action"];

export type Computer = {
    instructions: string;
    displayWidth: number;
    displayHeight: number;

    // Returns the current screen contents as data: URL
    currentScreenContents: () => string | null;
    handleAction: (action: ComputerAction) => Promise<void>;
};

export type Message =
    | {
          type: "user" | "reasoning" | "error";
          content: string;
      }
    | {
          type: "assistant";
          content: string;
          isRefusal?: boolean;
      }
    | {
          type: "action";
          action: ComputerAction;
      };

export function useChat(
    computer: Computer,
    apiKeyProvider: () => string | undefined,
    onLoopIteration?: () => void,
    onError?: () => void
) {
    const [messages, setMessages] = useState<Message[]>([]);
    const addMessage = useCallback(
        (message: Message) => {
            setMessages(prevMessages => [...prevMessages, message]);
        },
        [setMessages]
    );

    const interruptedCallIdRef = useRef<string | undefined>(undefined);
    const previousResponseIdRef = useRef<string | undefined>(undefined);
    useEffect(() => {
        previousResponseIdRef.current = undefined;
        interruptedCallIdRef.current = undefined;
    }, [computer]);

    const resetMessages = useCallback(() => {
        setMessages([]);
        previousResponseIdRef.current = undefined;
        interruptedCallIdRef.current = undefined;
    }, []);

    const [canSendMessage, setCanSendMessage] = useState(true);
    const [waitingForResponse, setWaitingForResponse] = useState(false);

    const abortControllerRef = useRef<AbortController>(new AbortController());

    const stopMessageSend = useCallback(() => {
        abortControllerRef.current?.abort();
        setCanSendMessage(true);
        abortControllerRef.current = new AbortController();
    }, []);

    const sendMessage = useCallback(
        async (message: string) => {
            const openai = new OpenAI({
                apiKey: apiKeyProvider(),
                dangerouslyAllowBrowser: true,
            });

            setCanSendMessage(false);
            addMessage({type: "user", content: message});

            let screenContents = computer.currentScreenContents();

            const tools: Tool[] = [
                {
                    type: "computer_use_preview",
                    display_width: computer.displayWidth,
                    display_height: computer.displayHeight,
                    environment: "mac",
                },
            ];

            let response: OpenAI.Responses.Response;
            try {
                setWaitingForResponse(true);
                const input: OpenAI.Responses.ResponseInput = [];
                if (
                    interruptedCallIdRef.current &&
                    previousResponseIdRef.current &&
                    screenContents
                ) {
                    console.log("Adding output for interrupted call");
                    input.push({
                        call_id: interruptedCallIdRef.current,
                        type: "computer_call_output",
                        output: {
                            type: "computer_screenshot",
                            image_url: screenContents,
                        },
                        status: "completed",
                    });
                    screenContents = null; // Don't send the screenshot again
                    interruptedCallIdRef.current = undefined;
                }
                input.push({
                    role: "user",
                    content: [
                        {
                            type: "input_text",
                            text: message,
                        },
                        ...(screenContents && !previousResponseIdRef.current
                            ? [
                                  {
                                      type: "input_image" as const,
                                      detail: "high" as const,
                                      image_url: screenContents,
                                  },
                              ]
                            : []),
                    ],
                });

                response = await openai.responses.create(
                    {
                        model: "computer-use-preview",
                        instructions: computer.instructions,
                        previous_response_id: previousResponseIdRef.current,
                        tools,
                        input,
                        reasoning: {
                            summary: "concise",
                        },
                        truncation: "auto",
                        temperature: 0,
                    },
                    {
                        signal: abortControllerRef.current?.signal,
                    }
                );
            } catch (error) {
                console.error("Error sending message:", error);
                addMessage({
                    type: "error",
                    content: String(error),
                });
                onError?.();
                setCanSendMessage(true);
                return;
            } finally {
                setWaitingForResponse(false);
            }
            console.log(
                "Initial response",
                JSON.stringify(response.output, null, 2)
            );

            while (true) {
                previousResponseIdRef.current = response.id;
                const computerCalls = [];
                for (const item of response.output) {
                    if (item.type === "computer_call") {
                        computerCalls.push(item);
                    } else if (item.type === "reasoning") {
                        addMessage({
                            type: "reasoning",
                            content: item.summary
                                .map(line => line.text)
                                .join("\n"),
                        });
                    } else if (item.type === "message") {
                        const refusalLines = [];
                        const textLines = [];
                        for (const line of item.content) {
                            if (line.type === "refusal") {
                                refusalLines.push(line.refusal);
                            } else if (line.type === "output_text") {
                                textLines.push(line.text);
                            } else {
                                console.log(
                                    "Unexpected message content line:",
                                    line
                                );
                            }
                        }
                        if (refusalLines.length > 0) {
                            addMessage({
                                type: "assistant",
                                content: refusalLines.join("\n"),
                                isRefusal: true,
                            });
                        }
                        if (textLines.length > 0) {
                            addMessage({
                                type: "assistant",
                                content: textLines.join("\n"),
                            });
                        }
                    } else {
                        console.log("Unexpected output item:", item);
                    }
                }

                if (computerCalls.length === 0) {
                    break;
                }

                // We expect at most one computer call per response.
                const computerCall = computerCalls[0];
                const {action, call_id: computerCallId} = computerCall;
                addMessage({type: "action", action});
                await computer.handleAction(action);
                await sleep(100);

                // Check if we were aborted while handling the action.
                if (abortControllerRef.current?.signal.aborted) {
                    break;
                }

                const screenContents = computer.currentScreenContents();
                if (!screenContents) {
                    addMessage({
                        type: "error",
                        content: "No screen contents available, stopping.",
                    });
                    break;
                }

                try {
                    setWaitingForResponse(true);
                    response = await openai.responses.create(
                        {
                            model: "computer-use-preview",
                            previous_response_id: response.id,
                            tools,
                            input: [
                                {
                                    call_id: computerCallId,
                                    type: "computer_call_output",
                                    output: {
                                        type: "computer_screenshot",
                                        image_url: screenContents,
                                    },
                                },
                            ],
                            reasoning: {
                                summary: "concise",
                            },
                            truncation: "auto",
                            temperature: 0,
                        },
                        {
                            signal: abortControllerRef.current?.signal,
                        }
                    );
                    console.log(
                        "Action response",
                        JSON.stringify(response.output, null, 2)
                    );
                } catch (error) {
                    if (error instanceof APIUserAbortError) {
                        console.log("Action response aborted:", error);
                        interruptedCallIdRef.current = computerCallId;
                        addMessage({
                            type: "error",
                            content: "Stopped by user.",
                        });
                    } else {
                        console.error(
                            "Error sending computer call output:",
                            error
                        );
                        addMessage({
                            type: "error",
                            content: String(error),
                        });
                        onError?.();
                    }
                    break;
                } finally {
                    setWaitingForResponse(false);
                    onLoopIteration?.();
                }
            }

            setCanSendMessage(true);
        },
        [apiKeyProvider, computer, addMessage, onLoopIteration, onError]
    );

    return {
        messages,
        sendMessage,
        canSendMessage,
        resetMessages,
        stopMessageSend,
        waitingForResponse,
    };
}
