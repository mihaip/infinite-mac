/**
 * R2 get wrapper that retries internal errors (10001), unavailable service
 * (10043), and throttling (10058), see https://developers.cloudflare.com/r2/api/error-codes/
 * for more details. We do up to 3 attempts with increasing backoff.
 */
export async function getR2Object(
    bucket: R2Bucket,
    key: string,
    options?: Pick<R2GetOptions, "range">
): Promise<R2ObjectBody | null> {
    for (let attempt = 1; ; attempt++) {
        try {
            return await bucket.get(key, options);
        } catch (error) {
            if (attempt >= 3 || !isTransientReadError(error)) {
                throw error;
            }
            const minimumDelay = 100 * 2 ** (attempt - 1);
            const delay = minimumDelay * (1 + Math.random());
            await new Promise<void>(resolve => {
                setTimeout(resolve, delay);
            });
        }
    }
}

function isTransientReadError(error: unknown): boolean {
    return (
        error instanceof Error &&
        /^get: .*\((10001|10043|10058)\)$/.test(error.message)
    );
}
