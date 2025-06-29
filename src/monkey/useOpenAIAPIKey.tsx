import {useCallback, useRef, useState} from "react";
import {usePersistentState} from "../usePersistentState";
import {Dialog} from "../controls/Dialog";
import {Input} from "../controls/Input";

export function useOpenAIAPIKey() {
    const [rawValue, setRawValue] = usePersistentState<string>(
        "",
        "monkey-openai-api-key"
    );
    const ref = useRef<string>(rawValue);
    ref.current = rawValue;
    const provider = useCallback(() => {
        return ref.current;
    }, []);
    const setKey = useCallback(
        (value: string) => {
            setRawValue(value);
            ref.current = value;
        },
        [setRawValue]
    );
    return [ref.current, setKey, provider] as const;
}

export function useCollectOpenAIAPIKey(setKey: (key: string) => void) {
    const [dialog, setDialog] = useState<React.ReactNode>(null);
    const collectOpenAIAPIKey = useCallback(async () => {
        return new Promise<void>(resolve => {
            setDialog(
                <CollectDialog
                    onDone={key => {
                        setDialog(null);
                        if (key) {
                            setKey(key);
                        }
                        resolve();
                    }}
                />
            );
        });
    }, [setKey]);
    return {collectOpenAIAPIKey, collectOpenAIAPIKeyDialog: dialog};
}

function CollectDialog({onDone}: {onDone: (key?: string) => void}) {
    const [key, setKey] = useState("");
    const handleDone = useCallback(() => {
        onDone(key);
    }, [key, onDone]);

    return (
        <Dialog
            className="Monkey-CollectOpenAIAPIKeyDialog"
            title="OpenAI API Key"
            onDone={handleDone}
            doneLabel="Save"
            doneEnabled={key.length > 0}
            onCancel={onDone}>
            <div className="Monkey-CollectOpenAIAPIKeyDialog-Note">
                The API key you provide must have access to the{" "}
                <a href="https://platform.openai.com/docs/guides/tools-computer-use">
                    <code>computer-use-preview</code>
                </a>{" "}
                model. It is only stored in your browser and only used for chats
                you initiate.
            </div>
            <Input
                autoFocus
                value={key}
                onChange={e => setKey(e.target.value)}
                onKeyDown={e => {
                    if (e.key === "Enter" && key.length > 0) {
                        e.preventDefault();
                        handleDone();
                    }
                }}
                placeholder="Enter an OpenAI API key"
            />
        </Dialog>
    );
}
