'use client';

import { AreaSeries, createChart, ColorType, IChartApi, ISeriesApi, Time, BusinessDay, createTextWatermark } from 'lightweight-charts';
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

// Import ChartDataPoint from StockTable to ensure consistency across components
import { ChartDataPoint } from './StockTable'; // Corrected import path if needed

interface ChartColors {
    backgroundColor?: string;
    lineColor?: string;
    textColor?: string;
    areaTopColor?: string;
    areaBottomColor?: string;
    vertLinesColor?: string;
    horzLinesColor?: string;
}

interface ChartComponentProps {
    initialData: ChartDataPoint[]; // This is for the very first chart load
    colors?: ChartColors;
    showWatermark?: boolean;
    watermarkText?: string;
    watermarkTextColor?: string;
}

// Define the shape of the ref handle that this component will expose to its parent
export interface ChartHandle {
    updateData: (point: ChartDataPoint) => void;
    setData: (data: ChartDataPoint[]) => void; // Method to set/reset all data
}

// Wrap the component with forwardRef to allow parent components to get a ref to it
export const ChartComponent = forwardRef<ChartHandle, ChartComponentProps>((props, ref) => {
    const {
        initialData, // Use initialData for the very first chart load
        colors: {
            backgroundColor = '000000',
            lineColor = '#5da7f7',
            textColor = '#296e80',
            areaTopColor = 'rgba(135, 206, 235, 0.7)',
            areaBottomColor = 'rgba(135, 206, 235, 0.01)',
            vertLinesColor = '#374151',
            horzLinesColor = '#374151',
        } = {},
        showWatermark = true, // Keep this as per your current setup
        watermarkText = 'BOOP', // Keep this as per your current setup
        watermarkTextColor = 'rgba(250, 6, 6, 0.75)', // Keep this as per your current setup
    } = props;

    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);

    // useImperativeHandle: This hook is used to customize the instance value that is exposed to parent components when using ref.
    // Here, we expose an `updateData` and `setData` method.
    useImperativeHandle(ref, () => ({
        updateData: (point: ChartDataPoint) => {
            if (seriesRef.current) {
                // Ensure time is in seconds for lightweight-charts
                seriesRef.current.update({ time: (point.time / 1000) as Time, value: point.value });
                // NEW: After updating data, try to scroll to the most recent point
                // This is a more subtle way to ensure visibility without aggressive fitContent
                chartRef.current?.timeScale().scrollToRealTime();
            }
        },
        setData: (data: ChartDataPoint[]) => { // Implementation for setting all data
            if (seriesRef.current) {
                // Ensure all times are in seconds for lightweight-charts
                seriesRef.current.setData(data.map(p => ({ time: (p.time / 1000) as Time, value: p.value })));
                chartRef.current?.timeScale().fitContent(); // Fit content after setting initial data
            }
        },
    }));

    // Effect for chart initialization and cleanup (runs once on mount)
    useEffect(() => {
        if (!chartContainerRef.current) {
            return;
        }

        // Create the chart instance
        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: backgroundColor },
                textColor,
            },
            width: chartContainerRef.current.clientWidth,
            height: 300,
            grid: {
                vertLines: {
                    color: vertLinesColor,
                    visible: false, // Keep as per your current setup
                },
                horzLines: {
                    color: horzLinesColor,
                    visible: false, // Keep as per your current setup
                },
            },
            timeScale: {
                rightOffset: 2,         // Small offset for real-time updates
                barSpacing: 5,          // Adjust for denser intraday data
                borderVisible: false,
                visible: true,
                timeVisible: true,      // Show time (hours, minutes)
                secondsVisible: true,   // Crucial: Show seconds
                lockVisibleTimeRangeOnResize: true,
                rightBarStaysOnScroll: true, // This should help with auto-scrolling
                minBarSpacing: 0.5,
            },
            // FIXED: Price scale configuration moved under rightPriceScale
            rightPriceScale: { // Use rightPriceScale to configure the default price scale
                autoScale: true, // Automatically adjust the price scale
                borderVisible: false,
            },
        });

        // Add Watermark (only once on initialization)
        createTextWatermark(chart.panes()[0], {
            horzAlign: 'center',
            vertAlign: 'center',
            lines: [
                {
                    text: watermarkText,
                    color: 'rgba(8, 242, 246, 0.5)', // Your existing color
                    fontSize: 32,
                    fontStyle: 'bold',
                },
            ],
        });

        chartRef.current = chart;
        // Initial fitContent is crucial, even if initialData is empty, to set up the view
        chart.timeScale().fitContent();

        const newSeries: ISeriesApi<'Area'> = chart.addSeries(AreaSeries, {
            lineColor,
            topColor: areaTopColor,
            bottomColor: areaBottomColor,
            lineWidth: 1,
        });
        seriesRef.current = newSeries;

        // Set the initial historical data using setData
        // This runs only once with the initialData prop when the chart is created
        if (initialData.length > 0) {
            newSeries.setData(initialData.map(p => ({ time: (p.time / 1000) as Time, value: p.value })));
            chart.timeScale().fitContent(); // Fit again after setting initial data
        } else {
            // If no initial data, explicitly set empty data to ensure the series is initialized
            newSeries.setData([]);
            chart.timeScale().fitContent(); // Fit content even for empty data
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
        backgroundColor, textColor,
        vertLinesColor, horzLinesColor,
        showWatermark,
        watermarkText,
        watermarkTextColor,
        lineColor, areaTopColor, areaBottomColor,
        initialData // Keep initialData in dependencies to re-initialize if it changes
    ]);

    return (
        <div
            ref={chartContainerRef}
            style={{ width: '100%', height: '300px' }}
        />
    );
});

ChartComponent.displayName = 'ChartComponent';
