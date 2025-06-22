/** Events that can be sent to an embedded emulator instance to control it. */
export type EmbedControlEvent =
    | {
          type: "emulator_pause";
      }
    | {
          type: "emulator_unpause";
      }
    | {
          type: "emulator_mouse_move";
          /**
           * Some emulators (Mini vMac, Basilisk II, SheepShaver) support
           * absolute coordinates.
           */
          x: number;
          y: number;
          /**
           * Others (Previous, DingusPPC, PearPC) only support relative
           * coordinates.
           */
          deltaX: number;
          deltaY: number;
      }
    | {
          type: "emulator_mouse_down";
          /** Button 0 is left, 1 is middle, 2 is right. */
          button: number;
      }
    | {
          type: "emulator_mouse_up";
          /** Button 0 is left, 1 is middle, 2 is right. */
          button: number;
      }
    | {
          type: "emulator_key_down";
          /** Physical key code, as reported to JavaScript */
          code: string;
      }
    | {
          type: "emulator_key_up";
          /** Physical key code, as reported to JavaScript */
          code: string;
      }
    | {
          type: "emulator_load_disk";
          url: string;
      };

/** Events that are sent from the embedded emulator instance to the parent page */
export type EmbedNotificationEvent =
    | {
          type: "emulator_loaded";
      }
    | {
          type: "emulator_screen";
          data: Uint8ClampedArray;
          width: number;
          height: number;
      };
