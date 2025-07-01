import {type ResponseComputerToolCall} from "openai/resources/responses/responses";

export type ComputerAction =
    // Mouse
    | {
          type: "mouse_down";
          button: ComputerMouseButton;
      }
    | {
          type: "mouse_up";
          button: ComputerMouseButton;
      }
    | {
          type: "click";
          button: ComputerMouseButton;
          x: number;
          y: number;
      }
    | {
          type: "double_click";
          x: number;
          y: number;
      }
    | {
          type: "triple_click";
          x: number;
          y: number;
      }
    | {
          type: "drag";
          path: {x: number; y: number}[];
      }
    | {
          type: "move";
          x: number;
          y: number;
      }
    | {
          type: "scroll";
          scroll_x: number;
          scroll_y: number;
          x: number;
          y: number;
      }
    // Keyboard
    | {
          type: "keypress";
          keys: string[];
          durationMs?: number;
      }
    | {
          type: "type";
          text: string;
      }
    // Other
    | {
          type: "screenshot";
      }
    | {
          type: "wait";
          durationMs?: number;
      };

export type ComputerMouseButton =
    | "left"
    | "right"
    | "wheel"
    | "back"
    | "forward";

export type Computer = {
    instructions: string;
    displayWidth: number;
    displayHeight: number;

    // Returns the current screen contents as data: URL
    currentScreenContents: () => string | null;
    handleAction: (action: ComputerAction) => Promise<void>;
};
