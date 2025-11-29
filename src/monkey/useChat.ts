import {useCallback, useEffect, useRef, useState} from "react";
import {type Computer, type ComputerAction} from "@/monkey/Computer";
import {type Conversation, type Provider} from "@/monkey/Provider";

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
    provider: Provider,
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

    const conversationRef = useRef<Conversation | undefined>(undefined);
    useEffect(() => {
        setMessages([]);
        conversationRef.current = undefined;
    }, [computer]);

    const resetMessages = useCallback(() => {
        setMessages([]);
        conversationRef.current = undefined;
    }, []);

    const [canSendMessage, setCanSendMessage] = useState(true);
    const [waitingForResponse, setWaitingForResponse] = useState(false);
    const stopMessageSend = useCallback(() => {
        conversationRef.current?.stop();
        setCanSendMessage(true);
    }, []);

    const sendMessage = useCallback(
        async (message: string) => {
            conversationRef.current ??= provider.createConversation(
                computer,
                apiKeyProvider()
            );
            const conversation = conversationRef.current;

            setCanSendMessage(false);
            addMessage({type: "user", content: message});
            await conversation.sendMessage(message, {
                setWaitingForResponse,
                onError(error: unknown) {
                    console.error("Error sending message:", error);
                    addMessage({
                        type: "error",
                        content: String(error),
                    });
                    onError?.();
                    setCanSendMessage(true);
                },
                onReasoning(reasoning) {
                    addMessage({type: "reasoning", content: reasoning});
                },
                onAction(action) {
                    addMessage({type: "action", action});
                },
                onAssistantMessage(message, isRefusal) {
                    addMessage({
                        type: "assistant",
                        content: message,
                        isRefusal,
                    });
                },
                onLoopIteration,
            });

            setCanSendMessage(true);
        },
        [
            provider,
            computer,
            apiKeyProvider,
            addMessage,
            onLoopIteration,
            onError,
        ]
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
