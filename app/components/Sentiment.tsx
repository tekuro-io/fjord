'use client';

import React, { useEffect, useState } from 'react';
import SpinnerWithMessage from './SpinnerWithMessage';
import ReactMarkdown from 'react-markdown';

interface SentimentProps {
    ticker: string;
}

export default function Sentiment({ ticker }: SentimentProps) {
    const [loading, setLoading] = useState<boolean>(true);
    const [modelStreaming, setModelStreaming] = useState<boolean>(false);
    const [newsStreaming, setNewsStreaming] = useState<boolean>(false);
    const [ranAtStreaming, setRanAtStreaming] = useState<boolean>(false);
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
                    setModelStreaming(true)
                    setNewsStreaming(false)
                    setRanAtStreaming(false)
                } else if (data === '[TICKNEWS]') {
                    setModelStreaming(false)
                    setNewsStreaming(true)
                    setRanAtStreaming(false)
                } else if (data === '[RANAT]') {
                    setModelStreaming(false)
                    setNewsStreaming(false)
                    setRanAtStreaming(true)
                }

                if (modelStreaming) {
                    setMarkdownBuffer((prev) => prev + data);
                } else if (newsStreaming) {
                    setNewsBuffer((prev) => prev + data);
                } else if (ranAtStreaming) {
                    setRanAtBuffer((prev) => prev + data);
                }
            }
        };

        eventSource.onerror = (err) => {
            setErrorMessage(`SSE error: ${err}`)
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
