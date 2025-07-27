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
            backgroundColor = '000000',
            lineColor = '#5da7f7',
            textColor = '#296e80',
            areaTopColor = 'rgba(135, 206, 235, 0.7)',
            areaBottomColor = 'rgba(135, 206, 235, 0.01)',
            vertLinesColor = '#374151',
            horzLinesColor = '#374151',
            upColor = '#26a69a',
            downColor = '#ef5350',
            wickUpColor = '#26a69a',
            wickDownColor = '#ef5350',
        } = {},
        showWatermark = true,
        watermarkText = 'BOOP',
        watermarkTextColor = 'rgba(250, 6, 6, 0.75)',
        onChartReady,
    } = props;


    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Area'> | ISeriesApi<'Candlestick'> | null>(null);

    // useImperativeHandle: Expose updateData and setData methods to the parent via ref
    useImperativeHandle(ref, () => {
        // This object is what chartRef.current in the parent will point to
        const handle = {
            updateData: (point: ChartDataPoint | CandleDataPoint) => {
                if (seriesRef.current) {
                    // Ensure time is in seconds for lightweight-charts
                    const timeInSeconds = (point.time / 1000) as Time;
                    
                    if (chartType === 'candlestick' && 'open' in point) {
                        // Handle candlestick data
                        seriesRef.current.update({
                            time: timeInSeconds,
                            open: point.open,
                            high: point.high,
                            low: point.low,
                            close: point.close
                        });
                    } else if (chartType === 'area' && 'value' in point) {
                        // Handle area chart data
                        seriesRef.current.update({ time: timeInSeconds, value: point.value });
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
                    
                    if (data.length > 0) {
                        chartRef.current?.timeScale().fitContent(); // Fit content after setting initial data
                    }
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
            height: 300,
            grid: {
                vertLines: {
                    color: vertLinesColor,
                    visible: false,
                },
                horzLines: {
                    color: horzLinesColor,
                    visible: false,
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
                    color: 'rgba(8, 242, 246, 0.3)',
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


        // Set the initial historical data using setData
        // This runs only once with the initialData prop when the chart is created
        if (initialData.length > 0) {
            
            if (chartType === 'candlestick' && 'open' in initialData[0]) {
                // Handle candlestick data
                const candleData = (initialData as CandleDataPoint[]).map(p => ({
                    time: (p.time / 1000) as Time,
                    open: p.open,
                    high: p.high,
                    low: p.low,
                    close: p.close
                }));
                newSeries.setData(candleData);
            } else if (chartType === 'area' && 'value' in initialData[0]) {
                // Handle area chart data
                const areaData = (initialData as ChartDataPoint[]).map(p => ({
                    time: (p.time / 1000) as Time,
                    value: p.value
                }));
                newSeries.setData(areaData);
            }
            
            chart.timeScale().fitContent(); // Fit content after setting initial data
        } else {
            // If no initial data, explicitly set empty data to ensure the series is initialized
            newSeries.setData([]);
            chart.timeScale().fitContent(); // Fit content even for empty data
        }

        // Notify parent that the chart is ready
        if (onChartReady) {
            onChartReady();
        } else {
        }

        // Handle window resizing
        const handleResize = () => {
            if (chartRef.current && chartContainerRef.current) {
                chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
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
        initialData,
        onChartReady // Add onChartReady to dependencies for stability
    ]); // Dependencies for chart initialization

    // No longer need a separate useEffect for internal chartData state,
    // as updates are now handled directly by updateData/setData via ref.

    return (
        <div
            ref={chartContainerRef}
            style={{ width: '100%', height: '300px' }}
        />
    );
});

ChartComponent.displayName = 'ChartComponent';
