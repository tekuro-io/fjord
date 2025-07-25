'use client';

import React, { useEffect, useRef, useState } from 'react';
import SpinnerWithMessage from './SpinnerWithMessage';
import ReactMarkdown from 'react-markdown';
import NewsList, { NewsItem } from './NewsList';
import TimeAgo from './TimeAgo';

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
    const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
    const [ranAtBuffer, setRanAtBuffer] = useState<string>('');
    const [newsDone, setNewsDone] = useState<boolean>(false);
    const [isDone, setIsDone] = useState<boolean>(false);

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
                setIsDone(true)
                eventSource.close();
            } else if (data.startsWith('[ERROR]')) {
            setErrorMessage(data)
                setLoading(false)
                setError(true)
                eventSource.close();
            } else {
                setLoading(false)
                if (data === '[MODELBEGIN]') {
                    setNewsDone(true)
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
                        try {
                          const item: NewsItem = JSON.parse(event.data);
                          setNewsItems(prev => [...prev, item]);
                        } catch (err) {
                          console.error('Failed to parse SSE news item:', err);
                        }
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
        <div className="relative">
            {/* TimeAgo in top-right */}
            {isDone && (
              <div className="absolute top-0 right-0 text-gray-400 text-xs">
                <TimeAgo timestamp={Number(ranAtBuffer)} />
              </div>
            )}

            {/* Centered content */}
            <div className="flex flex-col items-center text-center">
              <ReactMarkdown>{markdownBuffer}</ReactMarkdown>
              {newsDone && <NewsList news={newsItems} />}
            </div>
        </div>
    );
}
