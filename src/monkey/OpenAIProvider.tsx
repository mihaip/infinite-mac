import OpenAI, {APIUserAbortError} from "openai";
import {type Tool} from "openai/resources/responses/responses";
import {type ComputerAction, type Computer} from "@/monkey/Computer";
import {
    type ConversationCallbacks,
    type Conversation,
    type Provider,
} from "@/monkey/Provider";
import {sleep} from "@/monkey/util";

const OPENAI_MODEL = "gpt-6.1-sol";

export const OPENAI_PROVIDER: Provider = {
    id: "openai",
    label: "OpenAI",
    titleLink: (
        <a href="https://developers.openai.com/api/docs/guides/tools-computer-use">
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
            <a href="https://developers.openai.com/api/docs/guides/tools-computer-use">
                <code>{OPENAI_MODEL}</code>
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
    private interruptedCallIds: string[] = [];
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
        const abortSignal = this.abortController.signal;

        const tools: Tool[] = [{type: "computer"}];

        let response: OpenAI.Responses.Response;
        try {
            setWaitingForResponse(true);
            const input: OpenAI.Responses.ResponseInput = [];
            if (this.interruptedCallIds.length && this.previousResponseId) {
                if (!screenContents) {
                    onError("No screen contents available, stopping.");
                    return;
                }
                for (const callId of this.interruptedCallIds) {
                    input.push({
                        call_id: callId,
                        type: "computer_call_output",
                        output: computerScreenshot(screenContents),
                    });
                }
                screenContents = null; // Don't send the screenshot again
            }
            input.push({
                role: "user",
                content: [
                    {
                        type: "input_text",
                        text: message,
                    },
                    // The computer tool only accepts input images on the
                    // first turn. Later screenshots belong in call outputs.
                    ...(screenContents && !this.previousResponseId
                        ? [
                              {
                                  type: "input_image" as const,
                                  detail: "original" as const,
                                  image_url: screenContents,
                              },
                          ]
                        : []),
                ],
            });

            response = await this.api.responses.create(
                {
                    model: OPENAI_MODEL,
                    instructions: computer.instructions,
                    previous_response_id: this.previousResponseId,
                    tools,
                    input,
                    reasoning: {
                        effort: "low",
                        summary: "auto",
                    },
                    truncation: "auto",
                },
                {
                    signal: abortSignal,
                }
            );
        } catch (error) {
            onError(error);
            return;
        } finally {
            setWaitingForResponse(false);
        }
        this.interruptedCallIds = [];
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

            // Keep all outstanding calls so Stop can resume with the current
            // screen without replaying the rest of an interrupted batch.
            this.interruptedCallIds = computerCalls.map(call => call.call_id);
            const input: OpenAI.Responses.ResponseInput = [];
            for (const computerCall of computerCalls) {
                if (computerCall.pending_safety_checks?.length) {
                    onError(
                        "Computer use requires a safety check. Please reset the conversation and review the task."
                    );
                    return;
                }
                const actions =
                    computerCall.actions ??
                    (computerCall.action ? [computerCall.action] : []);
                for (const action of actions) {
                    if (abortSignal.aborted) {
                        return;
                    }
                    const computerAction: ComputerAction = {
                        ...action,
                        modifiers:
                            action.type !== "keypress" && "keys" in action
                                ? (action.keys ?? undefined)
                                : undefined,
                    };
                    onAction(computerAction);
                    try {
                        await computer.handleAction(
                            computerAction,
                            abortSignal
                        );
                    } catch (error) {
                        onError(error);
                        return;
                    }
                }
                await sleep(100);
                if (abortSignal.aborted) {
                    return;
                }
                const screenContents = computer.currentScreenContents();
                if (!screenContents) {
                    onError("No screen contents available, stopping.");
                    return;
                }
                input.push({
                    call_id: computerCall.call_id,
                    type: "computer_call_output",
                    output: computerScreenshot(screenContents),
                });
            }

            try {
                setWaitingForResponse(true);
                response = await this.api.responses.create(
                    {
                        model: OPENAI_MODEL,
                        previous_response_id: response.id,
                        tools,
                        input,
                        instructions: computer.instructions,
                        reasoning: {
                            effort: "low",
                            summary: "auto",
                        },
                        truncation: "auto",
                    },
                    {
                        signal: abortSignal,
                    }
                );
                this.interruptedCallIds = [];
                console.log(
                    "Action response",
                    JSON.stringify(response.output, null, 2)
                );
            } catch (error) {
                if (error instanceof APIUserAbortError) {
                    console.log("Action response aborted:", error);
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

// Keep original-resolution coordinates. The API accepts detail here, although
// the SDK's screenshot-output interface does not yet declare it.
function computerScreenshot(image_url: string) {
    return {
        type: "computer_screenshot" as const,
        image_url,
        detail: "original" as const,
    };
}
