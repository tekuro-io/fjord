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
}

// Define the shape of the ref handle that this component will expose to its parent
export interface ChartHandle {
    // We'll simplify this to just setData, and handle incremental updates internally
    setData: (data: ChartDataPoint[]) => void;
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
    } = props;

    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);

    // Internal state to hold the chart data, which will be incrementally updated
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

    // useImperativeHandle: Expose a setData method for parent to update data
    useImperativeHandle(ref, () => ({
        setData: (data: ChartDataPoint[]) => {
            setChartData(data); // Update internal state, which will trigger the useEffect below
        },
    }));

    // Effect for chart initialization and cleanup (runs once on mount)
    useEffect(() => {
        if (!chartContainerRef.current) {
            return;
        }

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
        const newSeries: ISeriesApi<'Area'> = chart.addAreaSeries({
            lineColor,
            topColor: areaTopColor,
            bottomColor: areaBottomColor,
            lineWidth: 1,
        });
        seriesRef.current = newSeries;

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
        lineColor, areaTopColor, areaBottomColor
    ]); // Dependencies for chart initialization

    // Effect to update chart data when internal chartData state changes
    useEffect(() => {
        if (seriesRef.current && chartData.length > 0) {
            // Check if the last point in the current series is the same as the last point in chartData
            // This prevents redundant updates and ensures smooth animation for new points
            const lastChartPoint = seriesRef.current.dataByIndex(seriesRef.current.data().length - 1);
            const lastNewPoint = chartData[chartData.length - 1];

            if (!lastChartPoint || lastChartPoint.time !== (lastNewPoint.time / 1000) || lastChartPoint.value !== lastNewPoint.value) {
                // If the last point is different, update the chart.
                // For initial load or significant changes, use setData
                // For single new points, use updateData
                if (chartData.length === 1 && seriesRef.current.data().length === 0) {
                    // This is likely the very first point
                    seriesRef.current.setData(chartData.map(p => ({ time: (p.time / 1000) as Time, value: p.value })));
                } else if (chartData.length > 0 && lastNewPoint) {
                    // Update with the latest point
                    seriesRef.current.update({ time: (lastNewPoint.time / 1000) as Time, value: lastNewPoint.value });
                } else {
                    // Fallback for other cases, or if data is reset
                    seriesRef.current.setData(chartData.map(p => ({ time: (p.time / 1000) as Time, value: p.value })));
                }
                chartRef.current?.timeScale().scrollToRealTime(); // Scroll to the latest point
            }
        } else if (seriesRef.current && chartData.length === 0) {
            // If chartData becomes empty, clear the chart
            seriesRef.current.setData([]);
        }
    }, [chartData]); // Dependency on internal chartData state

    // Effect to set initial data from props when component mounts
    // This runs once to get the initial historical data from StockTable
    useEffect(() => {
        if (initialData && initialData.length > 0) {
            setChartData(initialData);
        }
    }, [initialData]); // Only run when initialData prop changes

    return (
        <div
            ref={chartContainerRef}
            style={{ width: '100%', height: '300px' }}
        />
    );
});

ChartComponent.displayName = 'ChartComponent';
