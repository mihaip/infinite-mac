import Anthropic from "@anthropic-ai/sdk";
import {type Computer, type ComputerAction} from "@/monkey/Computer";
import {
    type ConversationCallbacks,
    type Conversation,
    type Provider,
} from "@/monkey/Provider";
import {sleep} from "@/monkey/util";

const ANTHROPIC_MODEL = "claude-sonnet-5-5";

export const ANTHROPIC_PROVIDER: Provider = {
    id: "anthropic",
    label: "Anthropic",
    titleLink: (
        <a href="https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool">
            Anthropic Computer Use
        </a>
    ),
    apiKeyInstructions: (
        <>
            Create a new API key in your{" "}
            <a href="https://console.anthropic.com/settings/keys">
                Anthropic Console API keys page
            </a>
            . The key must have access to <code>{ANTHROPIC_MODEL}</code>.
        </>
    ),
    createConversation(computer, apiKey) {
        return new AnthropicConversation(computer, apiKey);
    },
};

export class AnthropicConversation implements Conversation {
    private api: Anthropic;
    private abortController = new AbortController();
    private messages: Anthropic.MessageParam[] = [];

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

        const abortSignal = this.abortController.signal;
        const tools: Anthropic.ComputerToolset20260801[] = [
            {
                type: "computer_toolset_20260801",
                configs: {
                    zoom: {enabled: false},
                    cursor_position: {enabled: false},
                },
            },
        ];

        this.messages.push({
            role: "user",
            content: message,
        });

        while (true) {
            let response: Anthropic.Message;
            try {
                setWaitingForResponse(true);
                response = await this.api.messages.create(
                    {
                        model: ANTHROPIC_MODEL,
                        messages: this.messages,
                        max_tokens: 6400,
                        system: computer.instructions,
                        tools,
                        thinking: {
                            type: "adaptive",
                            display: "summarized",
                        },
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

            // Preserve the entire assistant turn, including signed thinking
            // and every tool call, before answering the batch in one user turn.
            this.messages.push({role: "assistant", content: response.content});
            const toolCalls: Anthropic.ToolUseBlock[] = [];
            for (const block of response.content) {
                if (block.type === "thinking") {
                    if (block.thinking) {
                        onReasoning(block.thinking);
                    }
                } else if (block.type === "text") {
                    if (block.text.trim()) {
                        onAssistantMessage(block.text);
                    }
                } else if (block.type === "tool_use") {
                    toolCalls.push(block);
                }
            }
            if (!toolCalls.length) {
                break;
            }

            const results: Anthropic.ToolResultBlockParam[] = [];
            let failed = false;
            for (const block of toolCalls) {
                const result: Anthropic.ToolResultBlockParam = {
                    type: "tool_result",
                    tool_use_id: block.id,
                    toolset_name: block.toolset_name,
                    content: "OK",
                };
                results.push(result);
                if (failed) {
                    result.is_error = true;
                    result.content =
                        "Not executed: an earlier computer action in this turn failed.";
                    continue;
                }
                try {
                    if (abortSignal.aborted) {
                        throw new Error("Stopped by user.");
                    }
                    if (block.toolset_name !== "computer") {
                        throw new Error(
                            `Unknown toolset: ${block.toolset_name}`
                        );
                    }
                    const action = convertAnthropicActionToComputerAction(
                        block.name,
                        block.input
                    );
                    onAction(action);
                    await computer.handleAction(action, abortSignal);
                    await sleep(100);
                    if (abortSignal.aborted) {
                        throw new Error("Stopped by user.");
                    }
                    // Attach an observation to screenshots and the last action,
                    // so a batch that omits screenshot still sees its result.
                    if (
                        block.name === "screenshot" ||
                        block === toolCalls.at(-1)
                    ) {
                        const screenContents = computer.currentScreenContents();
                        if (!screenContents) {
                            throw new Error(
                                "No screen contents available, stopping."
                            );
                        }
                        result.content = [
                            {
                                type: "image",
                                source: {
                                    type: "base64",
                                    media_type: "image/png",
                                    data: screenContents.split(",")[1],
                                },
                            },
                        ];
                    }
                } catch (error) {
                    failed = true;
                    result.is_error = true;
                    result.content = String(error);
                    onError(error);
                }
            }
            // Even on Stop, answer every call so the next user message can
            // continue this conversation without unmatched tool_use blocks.
            this.messages.push({role: "user", content: results});
            onLoopIteration?.();
            if (abortSignal.aborted) {
                return;
            }
        }
    }

    async stop() {
        this.abortController.abort();
        this.abortController = new AbortController();
    }
}

function convertAnthropicActionToComputerAction(
    name: string,
    input: any
): ComputerAction {
    const action = convertAnthropicMemberToComputerAction(name, input);
    if (
        [
            "left_click",
            "right_click",
            "middle_click",
            "double_click",
            "triple_click",
            "left_click_drag",
            "mouse_move",
            "scroll",
        ].includes(name) &&
        input.text
    ) {
        action.modifiers = input.text.toUpperCase().split("+");
    }
    return action;
}

function convertAnthropicMemberToComputerAction(
    name: string,
    input: any
): ComputerAction {
    switch (name) {
        // Basic actions (all versions)
        case "screenshot":
            return {type: "screenshot"};
        case "left_click":
            return {
                type: "click",
                x: input.coordinate?.[0],
                y: input.coordinate?.[1],
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
                repeat: input.repeat,
            };
        case "mouse_move":
            return {
                type: "move",
                x: input.coordinate[0],
                y: input.coordinate[1],
            };

        // Additional mouse and keyboard actions
        case "scroll":
            return {
                type: "scroll",
                x: input.coordinate?.[0],
                y: input.coordinate?.[1],
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
                    {
                        x: input.start_coordinate[0],
                        y: input.start_coordinate[1],
                    },
                    {x: input.coordinate[0], y: input.coordinate[1]},
                ],
            };
        case "right_click":
            return {
                type: "click",
                x: input.coordinate?.[0],
                y: input.coordinate?.[1],
                button: "right",
            };
        case "middle_click":
            return {
                type: "click",
                x: input.coordinate?.[0],
                y: input.coordinate?.[1],
                button: "wheel",
            };
        case "double_click":
            return {
                type: "double_click",
                x: input.coordinate?.[0],
                y: input.coordinate?.[1],
            };
        case "triple_click":
            return {
                type: "triple_click",
                x: input.coordinate?.[0],
                y: input.coordinate?.[1],
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
            throw new Error(`Unknown computer member: ${name}`);
    }
}
