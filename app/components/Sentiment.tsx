'use client';

import React, { useEffect, useRef, useState } from 'react';
import SpinnerWithMessage from './ui/SpinnerWithMessage';
import ReactMarkdown from 'react-markdown';
import NewsList, { NewsItem } from './NewsList';
import TimeAgo from './TimeAgo';

interface SentimentProps {
    ticker: string;
}

// Function to properly process markdown text with line breaks
const processMarkdownText = (text: string): string => {
    return text
        // Normalize line endings
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        // Ensure proper bullet point formatting
        .replace(/^[\-\*]\s+/gm, '- ')
        // Add extra newlines before headers to ensure they're treated as separate blocks
        .replace(/^(#{1,6})\s*(.+)$/gm, '\n$1 $2\n')
        // Ensure bullet points have proper spacing
        .replace(/^(-\s.+)$/gm, '\n$1\n')
        // Convert sentences that end with period followed by newline to paragraph breaks
        .replace(/\.\s*\n/g, '.\n\n')
        // Convert multiple newlines to double newlines (paragraph breaks)
        .replace(/\n{3,}/g, '\n\n')
        // Clean up any leading/trailing whitespace
        .trim();
};

const Sentiment = React.memo(function Sentiment({ ticker }: SentimentProps) {
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
        <div className="text-gray-200 leading-relaxed">
          <ReactMarkdown 
            components={{
              h1: ({children}) => <h1 className="text-lg font-bold text-gray-100 mb-3 mt-4 first:mt-0">{children}</h1>,
              h2: ({children}) => <h2 className="text-base font-semibold text-gray-200 mb-2 mt-3 first:mt-0">{children}</h2>,
              h3: ({children}) => <h3 className="text-sm font-medium text-gray-300 mb-2 mt-2 first:mt-0">{children}</h3>,
              p: ({children}) => <p className="text-gray-300 mb-3 leading-relaxed">{children}</p>,
              ul: ({children}) => <ul className="list-disc list-inside text-gray-300 space-y-1 mb-3 ml-2">{children}</ul>,
              ol: ({children}) => <ol className="list-decimal list-inside text-gray-300 space-y-1 mb-3 ml-2">{children}</ol>,
              li: ({children}) => <li className="text-gray-300 mb-1">{children}</li>,
              strong: ({children}) => <strong className="text-gray-100 font-semibold">{children}</strong>,
              em: ({children}) => <em className="text-gray-200 italic">{children}</em>,
              br: () => <br className="my-1" />,
              blockquote: ({children}) => <blockquote className="border-l-4 border-gray-500 pl-3 italic text-gray-400 mb-3">{children}</blockquote>,
            }}
          >
            {processMarkdownText(markdownBuffer)}
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
});

export default Sentiment;
