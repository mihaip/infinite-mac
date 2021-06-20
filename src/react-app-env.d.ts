/// <reference types="react-scripts" />

declare module "*.txt" {
    const path: string;
    export default path;
}

declare module "*.gz" {
    const path: string;
    export default path;
}
