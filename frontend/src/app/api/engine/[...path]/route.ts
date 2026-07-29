import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function proxy(
    request: NextRequest,
    context: { params: { path: string[] } }
) {
    const base = (process.env.LUNEL_ENGINE_URL || "http://127.0.0.1:8100").replace(
        /\/$/,
        ""
    );
    const path = context.params.path.map(encodeURIComponent).join("/");
    const target = `${base}/${path}${request.nextUrl.search}`;
    const headers = new Headers();
    const contentType = request.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    headers.set(
        "x-lunel-token",
        process.env.LUNEL_ENGINE_TOKEN || "local-lunel-engine"
    );

    try {
        const upstream = await fetch(target, {
            method: request.method,
            headers,
            body:
                request.method === "GET" || request.method === "HEAD"
                    ? undefined
                    : await request.arrayBuffer(),
            cache: "no-store",
        });
        const responseHeaders = new Headers();
        const upstreamContentType = upstream.headers.get("content-type");
        if (upstreamContentType) {
            responseHeaders.set("content-type", upstreamContentType);
        }
        return new NextResponse(upstream.body, {
            status: upstream.status,
            headers: responseHeaders,
        });
    } catch {
        return NextResponse.json(
            {
                detail:
                    "LUNEL Engine에 연결할 수 없습니다. 로컬 엔진이 실행 중인지 확인하세요.",
            },
            { status: 503 }
        );
    }
}

export {
    proxy as GET,
    proxy as POST,
    proxy as PATCH,
    proxy as PUT,
    proxy as DELETE,
    proxy as OPTIONS,
};
