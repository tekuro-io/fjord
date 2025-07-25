'use client';

import React, { useEffect, useRef, useState } from 'react';
import SpinnerWithMessage from './SpinnerWithMessage';
import ReactMarkdown from 'react-markdown';

interface SentimentProps {
    ticker: string;
}

export default function Sentiment({ ticker }: SentimentProps) {
    const [loading, setLoading] = useState<boolean>(true);
    const streamingRef = useRef<"model" | "news" | "ranat" | null>(null);
    const [loadingMessage, setLoadingMessage] = useState<string>("Connecting...");
    const [error, setError] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [markdownBuffer, setMarkdownBuffer] = useState<string>('');
    const [newsBuffer, setNewsBuffer] = useState<string>('');
    const [ranAtBuffer, setRanAtBuffer] = useState<string>('');

    useEffect(() => {
        const upperTicker = ticker.toUpperCase();
        const eventSource = new EventSource(`/api/sentiment/sse/${upperTicker}`);

        eventSource.onmessage = (event) => {
            const data = event.data;
            if (data === '[OVERVIEW]') {
                setLoadingMessage("Gathering overview...")
            } else if (data === '[PNEWS]') {
                setLoadingMessage("Gathering polygon news...")
            } else if (data === '[GNEWS]') {
                setLoadingMessage("Gathering google news...")
            } else if (data === '[MODEL]') {
                setLoadingMessage("Determining sentiment...")
            } else if (data === '[DONE]') {
                eventSource.close();
            } else if (data.startsWith('[ERROR]')) {
            setErrorMessage(data)
                setLoading(false)
                setError(true)
                eventSource.close();
            } else {
                setLoading(false)
                if (data === '[MODELBEGIN]') {
                    streamingRef.current = "model";
                } else if (data === '[TICKNEWS]') {
                    streamingRef.current = "news";
                } else if (data === '[RANAT]') {
                    streamingRef.current = "ranat";
                } else {
                    const mode = streamingRef.current;
                    if (mode === "model") {
                        setMarkdownBuffer((prev) => prev + data);
                    } else if (mode === "news") {
                        setNewsBuffer((prev) => prev + data);
                    } else if (mode === "ranat") {
                        setRanAtBuffer((prev) => prev + data);
                    }
                }
            }
        };

        eventSource.onerror = (err) => {
            setErrorMessage(`SSE error: ${JSON.stringify(err)}`)
            setLoading(false)
            setError(true)
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, [ticker]);

    if (error) return <div>{errorMessage}</div>;
    if (loading) return <SpinnerWithMessage status={loadingMessage} />

    return (
        <div>
            <ReactMarkdown>
                {markdownBuffer}
            </ReactMarkdown>
            {newsBuffer}
            {ranAtBuffer}
        </div>
    );
}
