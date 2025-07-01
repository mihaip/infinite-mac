import Anthropic from "@anthropic-ai/sdk";
import {type Computer, type ComputerAction} from "./Computer";
import {
    type ConversationCallbacks,
    type Conversation,
    type Provider,
} from "./Provider";
import {sleep} from "./util";

export const ANTHROPIC_PROVIDER: Provider = {
    id: "anthropic",
    label: "Anthropic",
    titleLink: (
        <a href="https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/computer-use-tool">
            Anthropic Computer Use
        </a>
    ),
    apiKeyInstructions: (
        <>
            Create a new API key in your{" "}
            <a href="https://console.anthropic.com/settings/keys">
                Anthropic Console API keys page
            </a>
            .
        </>
    ),
    createConversation(computer, apiKey) {
        return new AnthropicConversation(computer, apiKey);
    },
};

export class AnthropicConversation implements Conversation {
    private api: Anthropic;
    private abortController = new AbortController();
    private messages: Anthropic.Beta.Messages.BetaMessageParam[] = [];

    constructor(
        private computer: Computer,
        apiKey?: string
    ) {
        this.api = new Anthropic({
            apiKey,
            dangerouslyAllowBrowser: true,
        });
    }

    async sendMessage(message: string, callbacks: ConversationCallbacks) {
        const {
            setWaitingForResponse,
            onError,
            onAction,
            onReasoning,
            onAssistantMessage,
            onLoopIteration,
        } = callbacks;
        const {computer} = this;

        const tools: Anthropic.Beta.Messages.BetaToolComputerUse20250124[] = [
            {
                type: "computer_20250124",
                name: "computer",
                display_width_px: computer.displayWidth,
                display_height_px: computer.displayHeight,
                display_number: 1,
            },
        ];

        this.messages.push({
            role: "user",
            content: message,
        });

        while (true) {
            let response: Anthropic.Beta.Messages.BetaMessage;
            try {
                setWaitingForResponse(true);
                response = await this.api.beta.messages.create(
                    {
                        model: "claude-sonnet-4-20250514",
                        messages: this.messages,
                        max_tokens: 6400,
                        system: computer.instructions,
                        tools,
                        betas: ["computer-use-2025-01-24"],
                        thinking: {
                            type: "enabled",
                            budget_tokens: 2014,
                        },
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

            let hasToolCalls = false;
            const assistantContent: Anthropic.Beta.Messages.BetaMessageParam["content"] =
                [];

            for (const block of response.content) {
                if (block.type === "thinking") {
                    onReasoning(block.thinking);
                    assistantContent.push(block);
                } else if (block.type === "text") {
                    if (block.text.trim()) {
                        onAssistantMessage(block.text);
                        assistantContent.push(block);
                    }
                } else if (block.type === "tool_use") {
                    hasToolCalls = true;
                    assistantContent.push(block);

                    if (block.name === "computer") {
                        let action;
                        try {
                            action = convertAnthropicActionToComputerAction(
                                block.input
                            );
                        } catch (error) {
                            onError(error);
                            return;
                        }
                        onAction(action);

                        const abortSignal = this.abortController.signal;
                        await computer.handleAction(action);
                        await sleep(100);
                        if (abortSignal.aborted) {
                            return;
                        }

                        const newScreenContents =
                            computer.currentScreenContents();
                        if (!newScreenContents) {
                            onError("No screen contents available, stopping.");
                            return;
                        }

                        this.messages.push({
                            role: "assistant",
                            content: assistantContent,
                        });

                        this.messages.push({
                            role: "user",
                            content: [
                                {
                                    type: "tool_result",
                                    tool_use_id: block.id,
                                    content: [
                                        {
                                            type: "image",
                                            source: {
                                                type: "base64",
                                                media_type: "image/png",
                                                data: newScreenContents.split(
                                                    ","
                                                )[1],
                                            },
                                        },
                                    ],
                                },
                            ],
                        });

                        onLoopIteration?.();
                        break;
                    } else {
                        onError(
                            new Error(`Unknown tool use type: ${block.name}`)
                        );
                    }
                } else {
                    onError(new Error(`Unknown block type: ${block.type}`));
                    return;
                }
            }

            if (!hasToolCalls) {
                if (assistantContent.length > 0) {
                    this.messages.push({
                        role: "assistant",
                        content: assistantContent,
                    });
                }
                break;
            }
        }
    }

    async stop() {
        this.abortController.abort();
        this.abortController = new AbortController();
    }
}

function convertAnthropicActionToComputerAction(input: any): ComputerAction {
    switch (input.action) {
        // Basic actions (all versions)
        case "screenshot":
            return {type: "screenshot"};
        case "left_click":
            return {
                type: "click",
                x: input.coordinate[0],
                y: input.coordinate[1],
                button: "left",
            };
        case "type":
            return {
                type: "type",
                text: input.text,
            };
        case "key":
            return {
                type: "keypress",
                keys: input.text.toUpperCase().split("+"),
            };
        case "mouse_move":
            return {
                type: "move",
                x: input.coordinate[0],
                y: input.coordinate[1],
            };

        // Enhanced actions (computer_20250124)
        case "scroll":
            return {
                type: "scroll",
                x: input.coordinate[0],
                y: input.coordinate[1],
                scroll_x:
                    input.scroll_direction === "left"
                        ? -(input.scroll_amount ?? 3)
                        : input.scroll_direction === "right"
                          ? (input.scroll_amount ?? 3)
                          : 0,
                scroll_y:
                    input.scroll_direction === "up"
                        ? -(input.scroll_amount ?? 3)
                        : input.scroll_direction === "down"
                          ? (input.scroll_amount ?? 3)
                          : 0,
            };
        case "left_click_drag":
            return {
                type: "drag",
                path: [
                    {x: input.startCoordinate[0], y: input.startCoordinate[1]},
                    {x: input.endCoordinate[0], y: input.endCoordinate[1]},
                ],
            };
        case "right_click":
            return {
                type: "click",
                x: input.coordinate[0],
                y: input.coordinate[1],
                button: "right",
            };
        case "middle_click":
            return {
                type: "click",
                x: input.coordinate[0],
                y: input.coordinate[1],
                button: "wheel",
            };
        case "double_click":
            return {
                type: "double_click",
                x: input.coordinate[0],
                y: input.coordinate[1],
            };
        case "triple_click":
            return {
                type: "triple_click",
                x: input.coordinate[0],
                y: input.coordinate[1],
            };
        case "left_mouse_down":
            return {
                type: "mouse_down",
                button: "left",
            };
        case "left_mouse_up":
            return {
                type: "mouse_up",
                button: "left",
            };
        case "hold_key":
            return {
                type: "keypress",
                keys: input.text.toUpperCase().split("+"),
                durationMs: input.duration * 1000,
            };
        case "wait":
            return {type: "wait", durationMs: input.duration * 1000};

        default:
            throw new Error(`Unknown action type: ${input.action}`);
    }
}
