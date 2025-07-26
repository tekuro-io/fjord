'use client';

import React, { useEffect, useRef, useState } from 'react';
import SpinnerWithMessage from './ui/SpinnerWithMessage';
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
      <div className="flex flex-col space-y-3 text-sm">
        {/* AI Analysis Content */}
        <div className="text-gray-200 leading-relaxed prose prose-sm prose-invert max-w-none">
          <ReactMarkdown 
            components={{
              h1: ({children}) => <h1 className="text-lg font-bold text-gray-100 mb-2">{children}</h1>,
              h2: ({children}) => <h2 className="text-base font-semibold text-gray-200 mb-2">{children}</h2>,
              h3: ({children}) => <h3 className="text-sm font-medium text-gray-300 mb-1">{children}</h3>,
              p: ({children}) => <p className="text-gray-300 mb-2 leading-relaxed">{children}</p>,
              ul: ({children}) => <ul className="list-disc list-inside text-gray-300 space-y-1 mb-2">{children}</ul>,
              li: ({children}) => <li className="text-gray-300">{children}</li>,
              strong: ({children}) => <strong className="text-gray-100 font-semibold">{children}</strong>,
              em: ({children}) => <em className="text-gray-200 italic">{children}</em>,
            }}
          >
            {markdownBuffer.replace(/\n/g, '  \n')}
          </ReactMarkdown>
        </div>

        {/* Related News Section */}
        {newsItems.length > 0 && (
          <div className="border-t border-gray-600 pt-3">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Related News</h4>
            <NewsList news={newsItems} compact={true} />
          </div>
        )}

        {/* Timestamp */}
        {isDone && (
          <div className="border-t border-gray-600 pt-2 flex justify-end">
            <TimeAgo timestamp={Number(ranAtBuffer)} />
          </div>
        )}
      </div>
    );
}
