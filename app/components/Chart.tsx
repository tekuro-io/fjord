'use client';

import { AreaSeries, createChart, ColorType, IChartApi, ISeriesApi, Time, BusinessDay, createTextWatermark } from 'lightweight-charts';
import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';

// Import ChartDataPoint from StockTable to ensure consistency across components
import { ChartDataPoint } from './StockTable';

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
    onChartReady?: () => void; // Callback to notify parent when chart is ready
}

// Define the shape of the ref handle that this component will expose to its parent
export interface ChartHandle {
    updateData: (point: ChartDataPoint) => void; // Method to add a single new data point
    setData: (data: ChartDataPoint[]) => void;   // Method to set/reset all data (e.g., initial load)
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
        showWatermark = true,
        watermarkText = 'BOOP',
        watermarkTextColor = 'rgba(250, 6, 6, 0.75)',
        onChartReady,
    } = props;

    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);

    // useImperativeHandle: Expose updateData and setData methods to the parent via ref
    useImperativeHandle(ref, () => {
        console.log('ChartComponent: useImperativeHandle callback executed.');
        // This object is what chartRef.current in the parent will point to
        const handle = {
            updateData: (point: ChartDataPoint) => {
                if (seriesRef.current) {
                    console.log('ChartComponent: updateData called with point:', point);
                    // Ensure time is in seconds for lightweight-charts
                    seriesRef.current.update({ time: (point.time / 1000) as Time, value: point.value });
                    chartRef.current?.timeScale().scrollToRealTime(); // Keep chart scrolled to the latest point
                } else {
                    console.warn('ChartComponent: seriesRef.current not available for updateData (inside handle).');
                }
            },
            setData: (data: ChartDataPoint[]) => {
                if (seriesRef.current) {
                    console.log('ChartComponent: setData called with data length:', data.length);
                    // Ensure all times are in seconds for lightweight-charts
                    seriesRef.current.setData(data.map(p => ({ time: (p.time / 1000) as Time, value: p.value })));
                    if (data.length > 0) {
                        chartRef.current?.timeScale().fitContent(); // Fit content after setting initial data
                    }
                } else {
                    console.warn('ChartComponent: seriesRef.current not available for setData (inside handle).');
                }
            },
        };
        console.log('ChartComponent: useImperativeHandle returning handle:', handle);
        return handle;
    });

    // Effect for chart initialization and cleanup (runs once on mount)
    useEffect(() => {
        console.log('ChartComponent: Chart initialization useEffect triggered.');
        if (!chartContainerRef.current) {
            console.log('ChartComponent: Chart container ref not available.');
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
            },
            rightPriceScale: {
                autoScale: true,
                borderVisible: false,
            },
        });

        // Add Watermark
        createTextWatermark(chart.panes()[0], {
            horzAlign: 'center',
            vertAlign: 'center',
            lines: [
                {
                    text: watermarkText,
                    color: 'rgba(8, 242, 246, 0.5)',
                    fontSize: 100,
                    fontStyle: 'bold',
                },
            ],
        });

        chartRef.current = chart;

        // Correctly use chart.addSeries with AreaSeries constant
        const newSeries: ISeriesApi<'Area'> = chart.addSeries(AreaSeries, {
            lineColor,
            topColor: areaTopColor,
            bottomColor: areaBottomColor,
            lineWidth: 1,
        });
        seriesRef.current = newSeries;
        console.log('ChartComponent: Chart and AreaSeries initialized and refs assigned.');
        console.log('ChartComponent: chartRef.current after assignment:', chartRef.current);
        console.log('ChartComponent: seriesRef.current after assignment:', seriesRef.current);


        // Set the initial historical data using setData
        // This runs only once with the initialData prop when the chart is created
        if (initialData.length > 0) {
            console.log('ChartComponent: Setting initial data during initialization (from initialData prop). Data length:', initialData.length);
            newSeries.setData(initialData.map(p => ({ time: (p.time / 1000) as Time, value: p.value })));
            chart.timeScale().fitContent(); // Fit content after setting initial data
        } else {
            // If no initial data, explicitly set empty data to ensure the series is initialized
            console.log('ChartComponent: Initial data is empty, setting empty series data.');
            newSeries.setData([]);
            chart.timeScale().fitContent(); // Fit content even for empty data
        }

        // Notify parent that the chart is ready
        if (onChartReady) {
            onChartReady();
            console.log('ChartComponent: Called onChartReady callback.');
        } else {
            console.log('ChartComponent: onChartReady callback not provided.');
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
            console.log('ChartComponent: Cleanup function triggered.');
            window.removeEventListener('resize', handleResize);
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
                seriesRef.current = null;
                console.log('ChartComponent: Chart destroyed during cleanup.');
            }
        };
    }, [
        backgroundColor, textColor,
        vertLinesColor, horzLinesColor,
        showWatermark,
        watermarkText,
        watermarkTextColor,
        lineColor, areaTopColor, areaBottomColor,
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
