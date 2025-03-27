/** @type {import('next').NextConfig} */
const nextConfig = {
    async headers() {
        return [
            {
                source: "/embed",
                headers: [
                    {
                        key: "Content-Security-Policy",
                        value: "frame-src 'self' https://vehiql1234.created.app"
                    }
                ]
            }
        ]
    }
};

export default nextConfig;
