'use client';

import React, { useEffect, useState } from 'react';
import SpinnerWithMessage from './ui/SpinnerWithMessage';
import NewsList, { NewsItem } from './NewsList';
import TimeAgo from './TimeAgo';
import { TrendingUp, TrendingDown, Minus, Zap, FileText, Calendar } from 'lucide-react';
import { useTheme } from './ThemeContext';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

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

// Helper function to get sentiment icon and color (theme-aware)
const getSentimentDisplay = (sentiment: string, colors: ThemeColors) => {
    switch (sentiment.toLowerCase()) {
        case 'bullish':
            return { icon: TrendingUp, color: colors.success, bg: colors.successBg, label: 'Bullish' };
        case 'bearish':
            return { icon: TrendingDown, color: colors.danger, bg: colors.dangerBg, label: 'Bearish' };
        default:
            return { icon: Minus, color: colors.textMuted, bg: colors.secondary, label: 'Neutral' };
    }
};

// Helper function to get squeeze potential display (theme-aware)
const getSqueezeDisplay = (potential: string, colors: ThemeColors) => {
    switch (potential.toLowerCase()) {
        case 'high':
            return { color: colors.danger, bg: colors.dangerBg, label: 'High' };
        case 'medium':
            return { color: colors.warning, bg: colors.warningBg, label: 'Medium' };
        default:
            return { color: colors.textMuted, bg: colors.secondary, label: 'Low' };
    }
};

const Sentiment = React.memo(function Sentiment({ ticker }: SentimentProps) {
    const { colors } = useTheme();
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
        let isCollectingJson = false;
        
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
            } else if (data === '[MODELBEGIN]') {
                setLoadingMessage("Processing analysis...")
                isCollectingJson = true;
                jsonBuffer = '';
            } else if (data === '[DONE]') {
                // Try to parse the complete JSON buffer
                if (jsonBuffer.trim()) {
                    console.log('Raw JSON buffer:', jsonBuffer);
                    try {
                        // Clean up the JSON string
                        let cleanJson = jsonBuffer.trim();
                        
                        // Remove any trailing commas before closing braces
                        cleanJson = cleanJson.replace(/,(\s*[}\]])/g, '$1');
                        
                        const parsedData: SentimentData = JSON.parse(cleanJson);
                        setSentimentData(parsedData);
                        setLoading(false);
                    } catch (err) {
                        console.error('Failed to parse sentiment JSON:', err);
                        console.error('JSON buffer was:', jsonBuffer);
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
                // Switch to news collection mode
                isCollectingJson = false;
            } else if (data === '[RANAT]') {
                // Switch to timestamp collection mode
                isCollectingJson = false;
            } else {
                // Check if this is a news item (complete JSON object)
                if (data.trim().startsWith('{') && data.trim().endsWith('}') && data.includes('title')) {
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
                // If we're collecting JSON data, accumulate it
                else if (isCollectingJson && data.trim()) {
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

    if (error) return <div className={`${colors.danger} p-4 text-center`}>{errorMessage}</div>;
    if (loading) return <SpinnerWithMessage status={loadingMessage} />
    if (!sentimentData) return <div className={`${colors.textMuted} p-4 text-center`}>No sentiment data available</div>;

    const technicalDisplay = getSentimentDisplay(sentimentData.technical_sentiment, colors);
    const newsDisplay = getSentimentDisplay(sentimentData.news_sentiment, colors);
    const squeezeDisplay = getSqueezeDisplay(sentimentData.squeeze_potential, colors);

    return (
      <div className="flex flex-col space-y-6 text-sm">
        {/* Overview Section */}
        <div className={`${colors.secondary} rounded-lg p-4 border ${colors.border}`}>
          <div className="flex items-center gap-2 mb-3">
            <FileText className={`w-4 h-4 ${colors.accent}`} />
            <h3 className={`text-base font-semibold ${colors.textPrimary}`}>Overview</h3>
          </div>
          <p className={`${colors.textSecondary} leading-relaxed`}>{sentimentData.overview}</p>
        </div>

        {/* Sentiment Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Technical Sentiment */}
          <div className={`${technicalDisplay.bg} rounded-lg p-4 border ${colors.border}`}>
            <div className="flex items-center gap-2 mb-2">
              <technicalDisplay.icon className={`w-4 h-4 ${technicalDisplay.color}`} />
              <span className={`text-xs font-medium ${colors.textMuted} uppercase tracking-wide`}>Technical</span>
            </div>
            <span className={`text-sm font-semibold ${technicalDisplay.color}`}>
              {technicalDisplay.label}
            </span>
          </div>

          {/* News Sentiment */}
          <div className={`${newsDisplay.bg} rounded-lg p-4 border ${colors.border}`}>
            <div className="flex items-center gap-2 mb-2">
              <newsDisplay.icon className={`w-4 h-4 ${newsDisplay.color}`} />
              <span className={`text-xs font-medium ${colors.textMuted} uppercase tracking-wide`}>News</span>
            </div>
            <span className={`text-sm font-semibold ${newsDisplay.color}`}>
              {newsDisplay.label}
            </span>
          </div>

          {/* Squeeze Potential */}
          <div className={`${squeezeDisplay.bg} rounded-lg p-4 border ${colors.border}`}>
            <div className="flex items-center gap-2 mb-2">
              <Zap className={`w-4 h-4 ${squeezeDisplay.color}`} />
              <span className={`text-xs font-medium ${colors.textMuted} uppercase tracking-wide`}>Squeeze Risk</span>
            </div>
            <span className={`text-sm font-semibold ${squeezeDisplay.color}`}>
              {squeezeDisplay.label}
            </span>
          </div>
        </div>

        {/* Catalyst Section */}
        {sentimentData.known_catalyst && (
          <div className={`${colors.warningBg} border ${colors.border} rounded-lg p-4`}>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className={`w-4 h-4 ${colors.warning}`} />
              <h3 className={`text-base font-semibold ${colors.warning}`}>Known Catalyst</h3>
            </div>
            <p className={`${colors.textSecondary} leading-relaxed`}>{sentimentData.known_catalyst}</p>
          </div>
        )}

        {/* Notes Section */}
        {sentimentData.notes && (
          <div className={`${colors.secondary} rounded-lg p-4 border ${colors.border}`}>
            <h3 className={`text-base font-semibold ${colors.textPrimary} mb-3`}>Analysis Notes</h3>
            <p className={`${colors.textSecondary} leading-relaxed`}>{sentimentData.notes}</p>
          </div>
        )}

        {/* Related News Section */}
        {newsItems.length > 0 && (
          <div className={`border-t ${colors.divider} pt-4`}>
            <h4 className={`text-sm font-semibold ${colors.textSecondary} mb-3`}>Related News</h4>
            <NewsList news={newsItems} compact={true} />
          </div>
        )}

        {/* Timestamp */}
        {timestamp > 0 && (
          <div className={`border-t ${colors.divider} pt-3 flex justify-end`}>
            <TimeAgo timestamp={timestamp} />
          </div>
        )}
      </div>
    );
});

export default Sentiment;
