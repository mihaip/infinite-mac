import {type ReactNode} from "react";
import {type Computer, type ComputerAction} from "@/monkey/Computer";
import {OPENAI_PROVIDER} from "@/monkey/OpenAIProvider";
import {ANTHROPIC_PROVIDER} from "@/monkey/AnthropicProvider";

export type Provider = {
    id: string;
    label: string;
    titleLink: ReactNode;
    apiKeyInstructions?: ReactNode;

    createConversation: (computer: Computer, apiKey?: string) => Conversation;
};

export type Conversation = {
    sendMessage: (
        message: string,
        callbacks: ConversationCallbacks
    ) => Promise<void>;
    stop: () => Promise<void>;
};

export type ConversationCallbacks = {
    setWaitingForResponse: (waiting: boolean) => void;
    onError: (error: unknown) => void;
    onReasoning: (reasoning: string) => void;
    onAssistantMessage: (message: string, isRefusal?: boolean) => void;
    onAction: (action: ComputerAction) => void;
    onLoopIteration?: () => void;
};

export const PROVIDERS = [OPENAI_PROVIDER, ANTHROPIC_PROVIDER];
