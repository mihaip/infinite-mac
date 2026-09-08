// Copy stylesheet nodes rather than CSS rules: linked sheets may be cross-origin,
// and keeping their URLs also preserves relative font/image references.
export function styleDrawerPopup(popup: Window, title: string) {
    const target = popup.document;
    target.title = title;
    target.documentElement.lang = document.documentElement.lang;
    target.documentElement.className = document.documentElement.className;
    target.body.className = `${document.body.className} Drawer-PopoutBody`;
    const base = target.createElement("base");
    base.href = document.baseURI;
    target.head.append(base);
    let copies: Node[] = [];
    const sync = () => {
        const next = Array.from(
            document.head.querySelectorAll('style, link[rel="stylesheet"]'),
            node => node.cloneNode(true)
        );
        target.head.append(...next);
        copies.forEach(node => node.parentNode?.removeChild(node));
        copies = next;
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.head, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
    });
    return () => observer.disconnect();
}
