import {Drawer, DrawerContents} from "@/controls/Drawer";
import resourcesIcon from "@/Images/Resources.png";

export function MacResources() {
    return (
        <Drawer
            title="Resources"
            titleIconUrl={resourcesIcon}
            contents={() => <DrawerContents>TODO</DrawerContents>}
        />
    );
}
