import {type ResponseComputerToolCall} from "openai/resources/responses/responses";

export type ComputerAction = ResponseComputerToolCall["action"];

export type ComputerMouseButton = ResponseComputerToolCall.Click["button"];

export type Computer = {
    instructions: string;
    displayWidth: number;
    displayHeight: number;

    // Returns the current screen contents as data: URL
    currentScreenContents: () => string | null;
    handleAction: (action: ComputerAction) => Promise<void>;
};
