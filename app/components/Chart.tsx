'use client';

import { AreaSeries, createChart, ColorType, IChartApi, ISeriesApi, Time, BusinessDay, createTextWatermark  } from 'lightweight-charts';
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

export interface ChartDataPoint {
    time: Time; // Can be BusinessDay, number (timestamp), or string
    value: number;
}

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
    initialData: ChartDataPoint[]; // Changed prop name for clarity: this is for the initial load
    colors?: ChartColors;
    showWatermark?: boolean;
    watermarkText?: string;
    watermarkTextColor?: string;
}

// Define the shape of the ref handle that this component will expose to its parent
export interface ChartHandle {
    updateData: (point: ChartDataPoint) => void;
    // You could expose other methods here, e.g., to reset data or change options dynamically
    // resetData: (data: ChartDataPoint[]) => void;
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
    // Here, we expose an `updateData` method.
    useImperativeHandle(ref, () => ({
        updateData: (point: ChartDataPoint) => {
            if (seriesRef.current) {
                // Use series.update() for efficient adding/updating of a single data point
                seriesRef.current.update(point);
                // Optional: Fit content after update if you want the chart to always adjust
                // chartRef.current?.timeScale().fitContent(); // Removed to maintain scroll position during live updates
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


            // --- Configure the timeScale for intraday seconds ---
            timeScale: {
                rightOffset: 2,         // Small offset for real-time updates
                barSpacing: 5,          // Adjust for denser intraday data
                borderVisible: false,
                visible: true,
                timeVisible: true,      // Show time (hours, minutes)
                secondsVisible: true,   // Crucial: Show seconds
                lockVisibleTimeRangeOnResize: true, 
                rightBarStaysOnScroll: true,

                minBarSpacing: 0.5,

            },
        });

        createTextWatermark(chart.panes()[0], {
            horzAlign: 'center',
            vertAlign: 'center',
            lines: [
                {
                    text: watermarkText,
                    color: 'rgba(8, 242, 246, 0.5)',
                    fontSize: 32,
                    fontStyle: 'bold',
                },
            ],
        });

        chartRef.current = chart;
        chart.timeScale().fitContent();


        const newSeries: ISeriesApi<'Area'> = chart.addSeries(AreaSeries, {
            lineColor,
            topColor: areaTopColor,
            bottomColor: areaBottomColor,
            lineWidth: 1, // Common setting for line width
        });
        seriesRef.current = newSeries; // Store series instance in ref

        // Set the initial historical data using setData
        // This runs only once with the initialData prop
        if (initialData.length > 0) {
            newSeries.setData(initialData);
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
        vertLinesColor, horzLinesColor, // Grid colors kept as they were (visible: false)
        showWatermark, watermarkText, watermarkTextColor, // Watermark props kept as they were
        lineColor, areaTopColor, areaBottomColor, // Area series colors
    ]);


    return (
        <div
            ref={chartContainerRef}
            style={{ width: '100%', height: '300px' }}
        />
    );
});

ChartComponent.displayName = 'ChartComponent';