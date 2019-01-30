export function getShortKey(key: string): string {
    if (!key || !key.length) {
        return key;
    }
    return key.match(/([^;]+)$/i)[0].replace(/\/$/g, '').trim();
}