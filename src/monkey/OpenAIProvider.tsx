import OpenAI, {APIUserAbortError} from "openai";
import {type Tool} from "openai/resources/responses/responses";
import {type Computer} from "./Computer";
import {
    type ConversationCallbacks,
    type Conversation,
    type Provider,
} from "./Provider";
import {sleep} from "./util";

export const OPENAI_PROVIDER: Provider = {
    id: "openai",
    label: "OpenAI",
    titleLink: (
        <a href="https://platform.openai.com/docs/guides/tools-computer-use">
            OpenAI Computer Use
        </a>
    ),
    apiKeyInstructions: (
        <>
            Create a new API key in your{" "}
            <a href="https://platform.openai.com/settings/api-keys">
                OpenAI API keys settings page
            </a>
            . The key you provide must have access to the{" "}
            <a href="https://platform.openai.com/docs/guides/tools-computer-use">
                <code>computer-use-preview</code>
            </a>{" "}
            model.
        </>
    ),
    createConversation(computer, apiKey) {
        return new OpenAIConversation(computer, apiKey);
    },
};

export class OpenAIConversation implements Conversation {
    private api: OpenAI;
    private abortController = new AbortController();
    private interruptedCallId?: string;
    private previousResponseId?: string;

    constructor(
        private computer: Computer,
        apiKey?: string
    ) {
        this.api = new OpenAI({
            apiKey,
            dangerouslyAllowBrowser: true,
        });
    }

    async sendMessage(message: string, callbacks: ConversationCallbacks) {
        const {
            setWaitingForResponse,
            onError,
            onReasoning,
            onAction,
            onAssistantMessage,
            onLoopIteration,
        } = callbacks;
        const {computer} = this;
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
                this.interruptedCallId &&
                this.previousResponseId &&
                screenContents
            ) {
                console.log("Adding output for interrupted call");
                input.push({
                    call_id: this.interruptedCallId,
                    type: "computer_call_output",
                    output: {
                        type: "computer_screenshot",
                        image_url: screenContents,
                    },
                    status: "completed",
                });
                screenContents = null; // Don't send the screenshot again
                this.interruptedCallId = undefined;
            }
            input.push({
                role: "user",
                content: [
                    {
                        type: "input_text",
                        text: message,
                    },
                    ...(screenContents && !this.previousResponseId
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

            response = await this.api.responses.create(
                {
                    model: "computer-use-preview",
                    instructions: computer.instructions,
                    previous_response_id: this.previousResponseId,
                    tools,
                    input,
                    reasoning: {
                        summary: "concise",
                    },
                    truncation: "auto",
                    temperature: 0,
                },
                {
                    signal: this.abortController.signal,
                }
            );
        } catch (error) {
            onError(error);
            return;
        } finally {
            setWaitingForResponse(false);
        }
        console.log(
            "Initial response",
            JSON.stringify(response.output, null, 2)
        );

        while (true) {
            this.previousResponseId = response.id;
            const computerCalls = [];
            for (const item of response.output) {
                if (item.type === "computer_call") {
                    computerCalls.push(item);
                } else if (item.type === "reasoning") {
                    onReasoning(item.summary.map(line => line.text).join("\n"));
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
                        onAssistantMessage(refusalLines.join("\n"), true);
                    }
                    if (textLines.length > 0) {
                        onAssistantMessage(textLines.join("\n"));
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
            onAction(action);

            // Check if we were aborted while handling the action (save a
            // reference to the signal since stop() resets it).
            const abortSignal = this.abortController.signal;
            await computer.handleAction(action);
            await sleep(100);
            if (abortSignal.aborted) {
                break;
            }

            const screenContents = computer.currentScreenContents();
            if (!screenContents) {
                onError("No screen contents available, stopping.");
                break;
            }

            try {
                setWaitingForResponse(true);
                response = await this.api.responses.create(
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
                        signal: this.abortController.signal,
                    }
                );
                console.log(
                    "Action response",
                    JSON.stringify(response.output, null, 2)
                );
            } catch (error) {
                if (error instanceof APIUserAbortError) {
                    console.log("Action response aborted:", error);
                    this.interruptedCallId = computerCallId;
                    onError("Stopped by user.");
                } else {
                    console.error("Error sending computer call output:", error);
                    onError(error);
                }
                break;
            } finally {
                setWaitingForResponse(false);
                onLoopIteration?.();
            }
        }
    }

    async stop() {
        this.abortController.abort();
        this.abortController = new AbortController();
    }
}
