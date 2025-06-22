import {type Appearance, type AppearanceVariant} from "../controls/Appearance";
import {type ScreenFrameProps} from "../ScreenFrame";

export type Disk = {
    name: string;
    disk: string;
    machine?: string;
    screenSize: [number, number];
    bezelStyle: ScreenFrameProps["bezelStyle"];
    appearance: Appearance;
    appearanceVariant?: AppearanceVariant;
    examples: string[];
    instructions: string;
    infiniteHD?: boolean;
    screenScale?: number;
};

export const DISKS: Disk[] = [
    {
        name: "System 1",
        disk: "System 1.0",
        screenSize: [512, 342],
        bezelStyle: "Beige",
        appearance: "Classic",
        instructions:
            "You are controlling a Macintosh 128K running System 1.0 from 1984. Drop-down menus need to have the mouse button held down to open them, and then you can move the mouse to select an item. Releasing the mouse button will select the item. Some keyboard shortcuts not available: Command-W for closing a window, Command-O for opening.",
        examples: [
            "Launch MacPaint and draw a smiley face.",
            "Get Info on the System Disk and tell me how much free space is available.",
            'Delete the "Welcome!" file.',
            "Open TeachText and type 'Hello World!'",
        ],
        // Infinite HD is loaded after boot and makes things feel slow.
        infiniteHD: false,
        screenScale: 1.5,
    },
    {
        name: "System 6",
        disk: "System 6.0.8",
        screenSize: [512, 342],
        bezelStyle: "Platinum",
        appearance: "Classic",
        instructions:
            "You are controlling a Macintosh SE running System 6.0 from 1989. Drop-down menus need to have the mouse button held down to open them, and then you can move the mouse to select an item. Releasing the mouse button will select the item.",
        examples: [
            "Launch MacPaint and draw a smiley face.",
            "Get Info on Macintosh HD and tell me how much free space is available.",
            'Delete the "Welcome!" file.',
            "Open TeachText and type 'Hello World!'",
        ],
        screenScale: 1.5,
    },
    {
        name: "System 7",
        disk: "System 7.1",
        screenSize: [640, 480],
        bezelStyle: "Platinum",
        appearance: "Classic",
        appearanceVariant: "System7",
        instructions:
            "You are controlling a Macintosh Quadra 650 running System 7.1 from 1992. Drop-down menus need to have the mouse button held down to open them, and then you can move the mouse to select an item. Releasing the mouse button will select the item.",
        examples: [
            'Delete the "Welcome!" file.',
            "Open Adobe Photoshop and draw a smiley face.",
            "Open any text editor and type 'Hello World!'",
            'Eject the disk "Infinite HD"',
        ],
    },
    {
        name: "Mac OS 8",
        disk: "Mac OS 8.0",
        machine: "Power Macintosh 9500",
        screenSize: [832, 624],
        bezelStyle: "Platinum",
        appearance: "Platinum",
        instructions:
            "You are controlling a Power Macintosh 9500 running Mac OS 8.0 from 1997.",
        examples: [
            "Open the Graphing Calculator from the Apple menu and plot an impressive-looking equation.",
            "Open Adobe Photoshop and draw a smiley face.",
            "Open any text editor and type 'Hello World!'",
        ],
    },
    {
        name: "Mac OS 9",
        disk: "Mac OS 9.0.4",
        screenSize: [832, 624],
        bezelStyle: "Pinstripes",
        appearance: "Platinum",
        instructions:
            "You are controlling a Power Macintosh 9500 running Mac OS 9.0 from 1999.",
        examples: [
            "Open the Finder secret about box.",
            "Open Adobe Photoshop and draw a smiley face.",
            "Open any text editor and type 'Hello World!'",
        ],
    },
];
