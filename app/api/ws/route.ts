// app/api/ws/route.ts
import { NextResponse } from 'next/server';

/**
 * GET handler for /api/ws
 * This API route provides the WebSocket server URL to the frontend.
 *
 * IMPORTANT: In a Kubernetes deployment, the `NEXT_PUBLIC_WS_SERVER_URL`
 * environment variable should be set to the *publicly accessible* URL
 * of your Python WebSocket server (e.g., 'ws://your-k8s-service-ip:8080' or 'wss://your-ingress-domain.com/ws').
 *
 * For local development, it defaults to 'ws://localhost:8080'.
 */
export async function GET() {
  try {
    // This environment variable will be picked up during your Next.js build/deployment.
    // In Kubernetes, you'd set this in your Deployment manifest or via a ConfigMap/Secret.
    const websocketUrl = process.env.WS_PUBLIC_URL || 'ws://localhost:8080';

    return NextResponse.json({
      websocketUrl: websocketUrl,
      message: 'WebSocket server info retrieved successfully.',
    });
  } catch (error) {
    console.error('Error fetching WebSocket info:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve WebSocket information.' },
      { status: 500 }
    );
  }
}

