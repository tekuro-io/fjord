'use client';

import { AreaSeries, CandlestickSeries, HistogramSeries, createChart, ColorType, IChartApi, ISeriesApi, Time, createTextWatermark } from 'lightweight-charts';
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

// Import ChartDataPoint and CandleDataPoint from StockTable to ensure consistency across components
import type { ChartDataPoint, CandleDataPoint } from './stock-table/types';

interface ChartColors {
    backgroundColor?: string;
    lineColor?: string;
    textColor?: string;
    areaTopColor?: string;
    areaBottomColor?: string;
    vertLinesColor?: string;
    horzLinesColor?: string;
    upColor?: string;
    downColor?: string;
    wickUpColor?: string;
    wickDownColor?: string;
    watermarkTextColor?: string;
}

type ChartType = 'area' | 'candlestick';

interface ChartComponentProps {
    initialData: ChartDataPoint[] | CandleDataPoint[]; // This is for the very first chart load
    chartType?: ChartType;
    colors?: ChartColors;
    showWatermark?: boolean;
    watermarkText?: string;
    watermarkTextColor?: string;
    onChartReady?: () => void; // Callback to notify parent when chart is ready
    isExpanded?: boolean; // Whether this is an expanded chart with enhanced features
}

// Define the shape of the ref handle that this component will expose to its parent
export interface ChartHandle {
    updateData: (point: ChartDataPoint | CandleDataPoint) => void; // Method to add a single new data point
    setData: (data: ChartDataPoint[] | CandleDataPoint[]) => void;   // Method to set/reset all data (e.g., initial load)
    updateWithPrice: (timestamp: number, price: number) => void; // Method for simple price updates without volume
}

// Wrap the component with forwardRef to allow parent components to get a ref to it
export const ChartComponent = forwardRef<ChartHandle, ChartComponentProps>((props, ref) => {
    const {
        initialData, // Use initialData for the very first chart load
        chartType = 'area',
        colors: {
            backgroundColor = '#1f2937',
            lineColor = '#08f2f6',
            textColor = '#e5e7eb',
            areaTopColor = 'rgba(8, 242, 246, 0.4)',
            areaBottomColor = 'rgba(8, 242, 246, 0.0)',
            vertLinesColor = '#374151',
            horzLinesColor = '#374151',
            upColor = '#22c55e',
            downColor = '#ef4444',
            wickUpColor = '#22c55e',
            wickDownColor = '#ef4444',
        } = {},
        showWatermark = true,
        watermarkText = 'BOOP',
        watermarkTextColor = 'rgba(59, 130, 246, 0.4)',
        onChartReady,
        isExpanded = false,
    } = props;


    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Area'> | ISeriesApi<'Candlestick'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const initializedWithData = useRef<boolean>(false);

    // useImperativeHandle: Expose updateData and setData methods to the parent via ref
    useImperativeHandle(ref, () => {
        // This object is what chartRef.current in the parent will point to
        const handle = {
            updateData: (point: ChartDataPoint | CandleDataPoint) => {
                if (seriesRef.current) {
                    // Ensure time is in seconds for lightweight-charts
                    let timeInSeconds: number;
                    
                    if (typeof point.time === 'number') {
                        // If it's already in seconds (< 1e12), use as-is, otherwise convert from milliseconds
                        timeInSeconds = point.time > 1e12 ? Math.floor(point.time / 1000) : point.time;
                    } else if (typeof point.time === 'string') {
                        timeInSeconds = Math.floor(new Date(point.time).getTime() / 1000);
                    } else {
                        console.error(`Chart.tsx: Invalid time format:`, point.time, typeof point.time);
                        return;
                    }
                    
                    const timeForChart = timeInSeconds as Time;
                    
                    if (chartType === 'candlestick' && 'open' in point) {
                        // Handle candlestick data
                        
                        const candleData = {
                            time: timeForChart,
                            open: point.open,
                            high: point.high,
                            low: point.low,
                            close: point.close
                        };
                        seriesRef.current.update(candleData);
                    } else if (chartType === 'area' && 'value' in point) {
                        // Handle area chart data
                        seriesRef.current.update({ time: timeForChart, value: point.value });
                    }
                    
                    // Force price scale to recalculate if value is outside current range
                    if (chartRef.current) {
                        chartRef.current.priceScale('right').applyOptions({ autoScale: true });
                    }
                } else {
                }
            },
            setData: (data: ChartDataPoint[] | CandleDataPoint[]) => {
                if (seriesRef.current) {
                    // Ensure all times are in seconds for lightweight-charts
                    if (chartType === 'candlestick' && data.length > 0 && 'open' in data[0]) {
                        // Handle candlestick data
                        const candleData = (data as CandleDataPoint[]).map(p => ({
                            time: (p.time / 1000) as Time,
                            open: p.open,
                            high: p.high,
                            low: p.low,
                            close: p.close
                        }));
                        seriesRef.current.setData(candleData);
                        
                        // Set volume data if available and we have a volume series
                        if (volumeSeriesRef.current && data.length > 0 && 'volume' in data[0] && data[0].volume !== undefined) {
                            const volumeData = (data as CandleDataPoint[]).map(p => ({
                                time: (p.time / 1000) as Time,
                                value: p.volume || 0,
                                color: p.close >= p.open ? '#26a69a' : '#ef5350', // Green for up, red for down
                            }));
                            volumeSeriesRef.current.setData(volumeData);
                        }
                    } else if (chartType === 'area' && data.length > 0 && 'value' in data[0]) {
                        // Handle area chart data
                        const areaData = (data as ChartDataPoint[]).map(p => ({
                            time: (p.time / 1000) as Time,
                            value: p.value
                        }));
                        seriesRef.current.setData(areaData);
                    }
                    
                    // Note: Removed fitContent() call to preserve user navigation preferences
                } else {
                }
            },
            updateWithPrice: (timestamp: number, price: number) => {
                if (seriesRef.current) {
                    // Ensure time is in seconds for lightweight-charts
                    const timeInSeconds = timestamp > 1e12 ? Math.floor(timestamp / 1000) : timestamp;
                    const timeForChart = timeInSeconds as Time;
                    
                    if (chartType === 'candlestick') {
                        // Create a simple candlestick with same OHLC values for price updates
                        const candleData = {
                            time: timeForChart,
                            open: price,
                            high: price,
                            low: price,
                            close: price
                        };
                        seriesRef.current.update(candleData);
                    } else if (chartType === 'area') {
                        // Handle area chart data
                        seriesRef.current.update({ time: timeForChart, value: price });
                    }
                }
            },
        };
        return handle;
    });

    // Effect for chart initialization and cleanup (runs once on mount)
    useEffect(() => {
        if (!chartContainerRef.current) {
            return;
        }

        // Create the chart instance
        const chart = createChart(chartContainerRef.current, {
            layout: {
                attributionLogo: false,
                background: { type: ColorType.Solid, color: backgroundColor },
                textColor,
            },
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
            grid: {
                vertLines: {
                    color: vertLinesColor,
                    visible: isExpanded, // Show vertical grid lines only in expanded view
                },
                horzLines: {
                    color: horzLinesColor,
                    visible: true,
                },
            },
            crosshair: {
                mode: isExpanded ? 1 : 0, // Enable crosshair only in expanded view (1 = normal, 0 = hidden)
                vertLine: {
                    visible: isExpanded,
                    labelVisible: isExpanded,
                    color: textColor,
                    width: 1,
                    style: 0, // Solid line
                },
                horzLine: {
                    visible: isExpanded,
                    labelVisible: isExpanded,
                    color: textColor,
                    width: 1,
                    style: 0, // Solid line
                },
            },
            timeScale: {
                rightOffset: isExpanded ? 5 : 1, // Very minimal right padding for multichart view
                barSpacing: isExpanded ? 8 : 4, // Much tighter bar spacing for multichart view  
                borderVisible: isExpanded, // Show border in expanded view
                visible: true,
                timeVisible: isExpanded, // Only show time labels in expanded view
                secondsVisible: isExpanded, // Show seconds only in expanded view
                lockVisibleTimeRangeOnResize: true,
                rightBarStaysOnScroll: false, // Don't auto-scroll to keep data from sliding off
                minBarSpacing: 0.5,
                shiftVisibleRangeOnNewBar: false, // Don't auto-scroll - build from left to right
                fixLeftEdge: true, // Keep left edge fixed to prevent horizontal scrolling
                fixRightEdge: !isExpanded, // Fix right edge for multichart view to prevent overflow
            },
            rightPriceScale: {
                autoScale: true,
                borderVisible: isExpanded, // Show price scale border in expanded view
                visible: true,
                scaleMargins: {
                    top: 0.1,     // 10% margin at top for better visibility
                    bottom: 0.1,  // 10% margin at bottom for better visibility
                },
                entireTextOnly: false, // Allow partial price labels for better space usage
            },
        });

        // Add Watermark
        createTextWatermark(chart.panes()[0], {
            horzAlign: 'right',
            vertAlign: 'bottom',
            lines: [
                {
                    text: watermarkText,
                    color: watermarkTextColor,
                    fontSize: 32,
                    fontStyle: 'normal',
                },
            ],
        });

        chartRef.current = chart;

        // Create the appropriate series based on chartType
        let newSeries: ISeriesApi<'Area'> | ISeriesApi<'Candlestick'>;
        
        if (chartType === 'candlestick') {
            newSeries = chart.addSeries(CandlestickSeries, {
                upColor,
                downColor,
                wickUpColor,
                wickDownColor,
                borderVisible: false,
                priceFormat: {
                    type: 'price',
                    precision: 2,
                    minMove: 0.01,
                },
            });
        } else {
            newSeries = chart.addSeries(AreaSeries, {
                lineColor,
                topColor: areaTopColor,
                bottomColor: areaBottomColor,
                lineWidth: 1,
            });
        }
        
        seriesRef.current = newSeries;

        // Add volume series for expanded charts
        if (isExpanded && chartType === 'candlestick') {
            const volumeSeries = chart.addSeries(HistogramSeries, {
                color: '#26a69a',
                priceFormat: {
                    type: 'volume',
                },
                priceScaleId: '', // Set as an overlay by setting to empty string
            });
            
            // Set scale margins for the volume series to appear at the bottom
            chart.priceScale('').applyOptions({
                scaleMargins: {
                    top: 0.7, // Leave most of the space for the main series
                    bottom: 0,
                },
            });
            
            volumeSeriesRef.current = volumeSeries;
        }


        // Initialize with historical data if available, otherwise empty
        if (initialData.length > 0) {
            // Process initial data to ensure proper time format
            if (chartType === 'candlestick' && 'open' in initialData[0]) {
                const processedData = (initialData as CandleDataPoint[]).map(point => ({
                    time: (typeof point.time === 'number' && point.time > 1e12 ? 
                           Math.floor(point.time / 1000) : point.time) as Time,
                    open: point.open,
                    high: point.high,
                    low: point.low,
                    close: point.close
                }));
                newSeries.setData(processedData);
                
                // Initialize volume data if available and we have a volume series
                if (volumeSeriesRef.current && initialData.length > 0 && 'volume' in initialData[0] && initialData[0].volume !== undefined) {
                    const volumeData = (initialData as CandleDataPoint[]).map(point => ({
                        time: (typeof point.time === 'number' && point.time > 1e12 ? 
                               Math.floor(point.time / 1000) : point.time) as Time,
                        value: point.volume || 0,
                        color: point.close >= point.open ? '#26a69a' : '#ef5350', // Green for up, red for down
                    }));
                    volumeSeriesRef.current.setData(volumeData);
                }
            } else if (chartType === 'area' && 'value' in initialData[0]) {
                const processedData = (initialData as ChartDataPoint[]).map(point => ({
                    time: (typeof point.time === 'number' && point.time > 1e12 ? 
                           Math.floor(point.time / 1000) : point.time) as Time,
                    value: point.value
                }));
                newSeries.setData(processedData);
            }
        } else {
            // No initial data - start with empty series
            newSeries.setData([]);
            // Set initial range to start from left (logical position 0) with proper containment
            chart.timeScale().setVisibleLogicalRange({
                from: -1,  // Minimal negative buffer to ensure left alignment
                to: isExpanded ? 20 : 12  // Conservative space for multichart view to prevent overflow
            });
        }
        // Don't call fitContent() here - let individual charts set their own view ranges

        // Notify parent that the chart is ready
        if (onChartReady) {
            onChartReady();
        } else {
        }

        // Handle window resizing
        const handleResize = () => {
            if (chartRef.current && chartContainerRef.current) {
                chartRef.current.applyOptions({ 
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight
                });
            }
        };

        window.addEventListener('resize', handleResize);

        // Cleanup function: remove event listener and destroy chart on unmount
        return () => {
            window.removeEventListener('resize', handleResize);
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
                seriesRef.current = null;
                volumeSeriesRef.current = null;
            }
        };
    }, [
        chartType,
        backgroundColor, textColor,
        vertLinesColor, horzLinesColor,
        showWatermark,
        watermarkText,
        watermarkTextColor,
        lineColor, areaTopColor, areaBottomColor,
        upColor, downColor, wickUpColor, wickDownColor,
        isExpanded, // Include isExpanded to recreate chart when switching between modes
        // Removed initialData from dependencies to prevent chart recreation on data updates
        onChartReady // Add onChartReady to dependencies for stability
    ]); // Dependencies for chart initialization

    // Separate effect to handle initial data loading (only once)
    useEffect(() => {
        if (seriesRef.current && initialData.length > 0 && !initializedWithData.current) {
            // Initialize with historical data if available
            if (chartType === 'candlestick' && 'open' in initialData[0]) {
                const processedData = (initialData as CandleDataPoint[]).map(point => ({
                    time: (typeof point.time === 'number' && point.time > 1e12 ? 
                           Math.floor(point.time / 1000) : point.time) as Time,
                    open: point.open,
                    high: point.high,
                    low: point.low,
                    close: point.close
                }));
                seriesRef.current.setData(processedData);
                // For candlestick charts, show a consistent view that fits well in the container
                if (chartRef.current && processedData.length > 0) {
                    // Calculate how many bars to show based on chart expansion state
                    const maxVisibleBars = isExpanded ? 50 : 20; // Fewer bars for multichart view to prevent overflow
                    
                    if (processedData.length <= maxVisibleBars) {
                        // If we have fewer bars than max, show all with some padding
                        chartRef.current.timeScale().setVisibleRange({
                            from: processedData[0].time,
                            to: processedData[processedData.length - 1].time,
                        });
                    } else {
                        // If we have more bars than max, show the most recent ones
                        const startIndex = Math.max(0, processedData.length - maxVisibleBars);
                        chartRef.current.timeScale().setVisibleRange({
                            from: processedData[startIndex].time,
                            to: processedData[processedData.length - 1].time,
                        });
                    }
                }
            } else if (chartType === 'area' && 'value' in initialData[0]) {
                const processedData = (initialData as ChartDataPoint[]).map(point => ({
                    time: (typeof point.time === 'number' && point.time > 1e12 ? 
                           Math.floor(point.time / 1000) : point.time) as Time,
                    value: point.value
                }));
                seriesRef.current.setData(processedData);
                chartRef.current?.timeScale().fitContent(); // Only fit content for initial data load
            }
            initializedWithData.current = true;
        }
    }, [initialData, chartType]); // Only depend on initialData and chartType

    return (
        <div
            ref={chartContainerRef}
            style={{ width: '100%', height: '100%' }}
        />
    );
});

ChartComponent.displayName = 'ChartComponent';
