import "@/monkey/useProviderAPIKey.css";
import {useCallback, useRef, useState} from "react";
import {usePersistentState} from "@/lib/usePersistentState";
import {Dialog} from "@/controls/Dialog";
import {Input} from "@/controls/Input";
import {type Provider} from "@/monkey/Provider";

export function useProviderAPIKey(provider: Provider) {
    const [rawValue, setRawValue] = usePersistentState<string>(
        "",
        `monkey-${provider.id}-api-key`
    );
    const ref = useRef<string>(rawValue);
    ref.current = rawValue;
    const keyProvider = useCallback(() => {
        return ref.current;
    }, []);
    const setKey = useCallback(
        (value: string) => {
            setRawValue(value);
            ref.current = value;
        },
        [setRawValue]
    );
    return [ref.current, setKey, keyProvider] as const;
}

export function useCollectProviderAPIKey(
    provider: Provider,
    setKey: (key: string) => void
) {
    const [dialog, setDialog] = useState<React.ReactNode>(null);
    const collectProviderAPIKey = useCallback(async () => {
        return new Promise<void>(resolve => {
            setDialog(
                <CollectDialog
                    provider={provider}
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
    }, [setKey, provider]);
    return {
        collectProviderAPIKey,
        collectProviderAPIKeyDialog: dialog,
    };
}

function CollectDialog({
    provider,
    onDone,
}: {
    provider: Provider;
    onDone: (key?: string) => void;
}) {
    const [key, setKey] = useState("");
    const handleDone = useCallback(() => {
        onDone(key);
    }, [key, onDone]);

    return (
        <Dialog
            className="Monkey-CollectProviderAPIKeyDialog"
            title={`${provider.label} API Key`}
            onDone={handleDone}
            doneLabel="Save"
            doneEnabled={key.length > 0}
            onCancel={onDone}>
            <div className="Monkey-CollectProviderAPIKeyDialog-Note">
                {provider.apiKeyInstructions} It is only stored in your browser
                and only used for chats you initiate.
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
                placeholder={`Enter a ${provider.label} API key`}
            />
        </Dialog>
    );
}
