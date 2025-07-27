'use client';

import { AreaSeries, CandlestickSeries, createChart, ColorType, IChartApi, ISeriesApi, Time, createTextWatermark } from 'lightweight-charts';
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

// Import ChartDataPoint and CandleDataPoint from StockTable to ensure consistency across components
import type { ChartDataPoint, CandleDataPoint } from './stock-table';

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
}

// Define the shape of the ref handle that this component will expose to its parent
export interface ChartHandle {
    updateData: (point: ChartDataPoint | CandleDataPoint) => void; // Method to add a single new data point
    setData: (data: ChartDataPoint[] | CandleDataPoint[]) => void;   // Method to set/reset all data (e.g., initial load)
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
        watermarkTextColor = 'rgba(59, 130, 246, 0.15)',
        onChartReady,
    } = props;


    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Area'> | ISeriesApi<'Candlestick'> | null>(null);
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
                    
                    // Note: Removed scrollToRealTime() call - auto-scroll is now controlled by shiftVisibleRangeOnNewBar option
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
                    visible: false,
                },
                horzLines: {
                    color: horzLinesColor,
                    visible: true,
                },
            },
            timeScale: {
                rightOffset: 2,
                barSpacing: 5,
                borderVisible: false,
                visible: true,
                timeVisible: true,
                secondsVisible: true,
                lockVisibleTimeRangeOnResize: true,
                rightBarStaysOnScroll: true,
                minBarSpacing: 0.5,
                shiftVisibleRangeOnNewBar: false, // Disable auto-scroll on new data - allows user interaction
            },
            rightPriceScale: {
                autoScale: true,
                borderVisible: false,
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
                    fontSize: 24,
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
        }
        chart.timeScale().fitContent();

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
                chartRef.current?.timeScale().fitContent(); // Only fit content for initial data load
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
