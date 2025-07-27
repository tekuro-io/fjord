'use client';

import React, { useEffect, useRef, useState } from 'react';
import SpinnerWithMessage from './ui/SpinnerWithMessage';
import NewsList, { NewsItem } from './NewsList';
import TimeAgo from './TimeAgo';
import { TrendingUp, TrendingDown, Minus, Zap, FileText, Calendar } from 'lucide-react';

interface SentimentProps {
    ticker: string;
}

interface SentimentData {
    overview: string;
    technical_sentiment: 'bullish' | 'bearish' | 'neutral';
    news_sentiment: 'bullish' | 'bearish' | 'neutral';
    squeeze_potential: 'high' | 'medium' | 'low';
    known_catalyst: string;
    notes: string;
}

// Helper function to get sentiment icon and color
const getSentimentDisplay = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
        case 'bullish':
            return { icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-900/30', label: 'Bullish' };
        case 'bearish':
            return { icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-900/30', label: 'Bearish' };
        default:
            return { icon: Minus, color: 'text-gray-400', bg: 'bg-gray-700/30', label: 'Neutral' };
    }
};

// Helper function to get squeeze potential display
const getSqueezeDisplay = (potential: string) => {
    switch (potential.toLowerCase()) {
        case 'high':
            return { color: 'text-red-400', bg: 'bg-red-900/30', label: 'High' };
        case 'medium':
            return { color: 'text-yellow-400', bg: 'bg-yellow-900/30', label: 'Medium' };
        default:
            return { color: 'text-gray-400', bg: 'bg-gray-700/30', label: 'Low' };
    }
};

const Sentiment = React.memo(function Sentiment({ ticker }: SentimentProps) {
    const [loading, setLoading] = useState<boolean>(true);
    const [loadingMessage, setLoadingMessage] = useState<string>("Analyzing sentiment...");
    const [error, setError] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [sentimentData, setSentimentData] = useState<SentimentData | null>(null);
    const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
    const [timestamp, setTimestamp] = useState<number>(0);

    useEffect(() => {
        const upperTicker = ticker.toUpperCase();
        let jsonBuffer = '';
        
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
                setLoadingMessage("Analyzing sentiment...")
            } else if (data === '[DONE]') {
                // Try to parse the complete JSON buffer
                if (jsonBuffer.trim()) {
                    try {
                        const parsedData: SentimentData = JSON.parse(jsonBuffer);
                        setSentimentData(parsedData);
                        setLoading(false);
                    } catch (err) {
                        console.error('Failed to parse sentiment JSON:', err);
                        setErrorMessage('Failed to parse sentiment data');
                        setError(true);
                        setLoading(false);
                    }
                }
                eventSource.close();
            } else if (data.startsWith('[ERROR]')) {
                setErrorMessage(data);
                setLoading(false);
                setError(true);
                eventSource.close();
            } else if (data === '[TICKNEWS]') {
                // Handle news items separately
            } else if (data === '[RANAT]') {
                // Handle timestamp
            } else {
                // Check if this is a news item
                if (data.startsWith('{') && data.includes('title')) {
                    try {
                        const newsItem: NewsItem = JSON.parse(data);
                        setNewsItems(prev => [...prev, newsItem]);
                    } catch (err) {
                        console.error('Failed to parse news item:', err);
                    }
                } 
                // Check if this is a timestamp
                else if (/^\d+$/.test(data.trim())) {
                    setTimestamp(parseInt(data.trim()));
                }
                // Otherwise, accumulate JSON data
                else if (data.trim()) {
                    jsonBuffer += data;
                }
            }
        };

        eventSource.onerror = (err) => {
            setErrorMessage(`Connection error: Unable to load sentiment analysis`);
            setLoading(false);
            setError(true);
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, [ticker]);

    if (error) return <div className="text-red-400 p-4 text-center">{errorMessage}</div>;
    if (loading) return <SpinnerWithMessage status={loadingMessage} />
    if (!sentimentData) return <div className="text-gray-400 p-4 text-center">No sentiment data available</div>;

    const technicalDisplay = getSentimentDisplay(sentimentData.technical_sentiment);
    const newsDisplay = getSentimentDisplay(sentimentData.news_sentiment);
    const squeezeDisplay = getSqueezeDisplay(sentimentData.squeeze_potential);

    return (
      <div className="flex flex-col space-y-6 text-sm">
        {/* Overview Section */}
        <div className="bg-gray-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-blue-400" />
            <h3 className="text-base font-semibold text-gray-200">Overview</h3>
          </div>
          <p className="text-gray-300 leading-relaxed">{sentimentData.overview}</p>
        </div>

        {/* Sentiment Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Technical Sentiment */}
          <div className={`${technicalDisplay.bg} rounded-lg p-4 border border-gray-600`}>
            <div className="flex items-center gap-2 mb-2">
              <technicalDisplay.icon className={`w-4 h-4 ${technicalDisplay.color}`} />
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Technical</span>
            </div>
            <span className={`text-sm font-semibold ${technicalDisplay.color}`}>
              {technicalDisplay.label}
            </span>
          </div>

          {/* News Sentiment */}
          <div className={`${newsDisplay.bg} rounded-lg p-4 border border-gray-600`}>
            <div className="flex items-center gap-2 mb-2">
              <newsDisplay.icon className={`w-4 h-4 ${newsDisplay.color}`} />
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">News</span>
            </div>
            <span className={`text-sm font-semibold ${newsDisplay.color}`}>
              {newsDisplay.label}
            </span>
          </div>

          {/* Squeeze Potential */}
          <div className={`${squeezeDisplay.bg} rounded-lg p-4 border border-gray-600`}>
            <div className="flex items-center gap-2 mb-2">
              <Zap className={`w-4 h-4 ${squeezeDisplay.color}`} />
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Squeeze Risk</span>
            </div>
            <span className={`text-sm font-semibold ${squeezeDisplay.color}`}>
              {squeezeDisplay.label}
            </span>
          </div>
        </div>

        {/* Catalyst Section */}
        {sentimentData.known_catalyst && (
          <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-yellow-400" />
              <h3 className="text-base font-semibold text-yellow-300">Known Catalyst</h3>
            </div>
            <p className="text-gray-300 leading-relaxed">{sentimentData.known_catalyst}</p>
          </div>
        )}

        {/* Notes Section */}
        {sentimentData.notes && (
          <div className="bg-gray-700/50 rounded-lg p-4">
            <h3 className="text-base font-semibold text-gray-200 mb-3">Analysis Notes</h3>
            <p className="text-gray-300 leading-relaxed">{sentimentData.notes}</p>
          </div>
        )}

        {/* Related News Section */}
        {newsItems.length > 0 && (
          <div className="border-t border-gray-600 pt-4">
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Related News</h4>
            <NewsList news={newsItems} compact={true} />
          </div>
        )}

        {/* Timestamp */}
        {timestamp > 0 && (
          <div className="border-t border-gray-600 pt-3 flex justify-end">
            <TimeAgo timestamp={timestamp} />
          </div>
        )}
      </div>
    );
});

export default Sentiment;
