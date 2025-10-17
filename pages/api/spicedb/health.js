import { app_token, spicedbUrl, token } from "./env";

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }


    try {
        const startTime = Date.now();

        // Test basic connectivity with schema read
        const response = await fetch(`${spicedbUrl}/healthz`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-App-Token': app_token
            }
        });

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        if (response.ok) {
            res.status(200).json({
                status: 'healthy',
                connected: true,
                responseTime: `${responseTime}ms`,
                spicedbUrl: spicedbUrl,
                timestamp: new Date().toISOString()
            });
        } else {
            const errorText = await response.text();
            res.status(200).json({
                status: 'unhealthy',
                connected: false,
                error: `HTTP ${response.status}: ${errorText}`,
                responseTime: `${responseTime}ms`,
                spicedbUrl: spicedbUrl,
                timestamp: new Date().toISOString()
            });
        }

    } catch (error) {
        res.status(200).json({
            status: 'unhealthy',
            connected: false,
            error: error.message,
            spicedbUrl: spicedbUrl,
            timestamp: new Date().toISOString()
        });
    }
}
