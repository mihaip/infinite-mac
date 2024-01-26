export function toDateString(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate()
    )}`;
}

export function fromDateString(dateString: string): Date | undefined {
    const dateValue = Date.parse(dateString);
    if (isNaN(dateValue)) {
        return undefined;
    }
    const now = new Date();
    // Date.parse assumes the date is in UTC, but we want to use the
    // local time zone.
    const timeZoneOffset = now.getTimezoneOffset() * 60 * 1000;
    // Use the current time of day, so that any clocks shown in the UI
    // are correct.
    const timeOffset =
        now.getTime() -
        new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return new Date(dateValue + timeZoneOffset + timeOffset);
}
