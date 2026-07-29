export async function engineFetch<T>(
    path: string,
    init?: RequestInit
): Promise<T> {
    const response = await fetch(`/api/engine/${path.replace(/^\/+/, "")}`, {
        ...init,
        headers: {
            ...(init?.body ? { "content-type": "application/json" } : {}),
            ...init?.headers,
        },
        cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(payload?.detail || `Engine request failed (${response.status})`);
    }
    return payload as T;
}

export function enginePost<T>(path: string, body: unknown): Promise<T> {
    return engineFetch<T>(path, {
        method: "POST",
        body: JSON.stringify(body),
    });
}

export function enginePatch<T>(path: string, body: unknown): Promise<T> {
    return engineFetch<T>(path, {
        method: "PATCH",
        body: JSON.stringify(body),
    });
}
