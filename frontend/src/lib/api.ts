import axios from "axios";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Attach auth token to requests
api.interceptors.request.use((config) => {
    if (typeof window !== "undefined") {
        const token = localStorage.getItem("access_token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

// Handle 401 - attempt refresh
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            // Handle M2M Procedural Challenge
            const challengeSeed = error.response.headers["x-lunel-challenge"];
            if (challengeSeed) {
                const seed = parseInt(challengeSeed, 10);
                const R_EARTH = 6371.0;
                const GM = 398600.0;
                
                const h1 = (seed % 1000) + 300;
                const h2 = ((seed * 7) % 5000) + 1000;
                const r1 = R_EARTH + h1;
                const r2 = R_EARTH + h2;
                
                const v1 = Math.sqrt(GM / r1);
                const v2 = Math.sqrt(GM / r2);
                const a = (r1 + r2) / 2.0;
                
                const vTransfer1 = Math.sqrt(GM * (2.0 / r1 - 1.0 / a));
                const vTransfer2 = Math.sqrt(GM * (2.0 / r2 - 1.0 / a));
                
                const totalDeltaV = Math.abs(vTransfer1 - v1) + Math.abs(v2 - vTransfer2);
                
                originalRequest.headers["X-Lunel-Proof"] = totalDeltaV.toFixed(4);
                
                // Dispatch event for UI Glitch
                if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("lunel-m2m-success"));
                }
                
                return api(originalRequest);
            }

            // Handle standard JWT refresh
            const refreshToken = localStorage.getItem("refresh_token");
            if (refreshToken) {
                try {
                    const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                        refresh_token: refreshToken,
                    });
                    localStorage.setItem("access_token", data.access_token);
                    localStorage.setItem("refresh_token", data.refresh_token);
                    originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
                    return api(originalRequest);
                } catch {
                    localStorage.removeItem("access_token");
                    localStorage.removeItem("refresh_token");
                    window.location.href = "/login";
                }
            }
        }

        return Promise.reject(error);
    }
);
