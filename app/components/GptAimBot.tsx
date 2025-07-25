'use client'

import { useEffect, useRef, useState } from "react"

export default function GptAimBot() {
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const [isSharing, setIsSharing] = useState(false);
    const streamRef = useRef<MediaStream | null>(null);
    const [socket, setSocket] = useState<WebSocket | null>(null);

    useEffect(() => {
      const ws = new WebSocket('wss://yourserver.com/ws'); // Replace with your server
      ws.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        const pc = pcRef.current;
        if (!pc) return;

        if (message.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(message.answer));
        } else if (message.type === 'candidate') {
          await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
        }
      };

      setSocket(ws);
      return () => ws.close();
    }, []);

    const startSharing = async () => {
        const stream = await navigator.mediaDevices.getDisplayMedia( {video: true});
        streamRef.current = stream;
        setIsSharing(true);

        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'todo amazur'}]
        });

        pcRef.current = pc

        stream.getTracks().forEach(track => pc.addTrack(track, stream))
        pc.onicecandidate = (event) => {
          if (event.candidate && socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket?.send(JSON.stringify({ type: 'offer', offer }));
    };

    const stopSharing = () => {
      setIsSharing(false);
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      pcRef.current?.close();
      pcRef.current = null;
    };

    return (
    <div className="p-4">
      <button
        onClick={isSharing ? stopSharing : startSharing}
        className="px-4 py-2 rounded bg-blue-600 text-white"
      >
        {isSharing ? 'Stop Sharing' : 'Start Screen Share'}
      </button>
    </div>
  );
}