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
            console.log('ChartComponent: useImperativeHandle setData called with data length:', data.length);
            setChartData(data); // Update internal state, which will trigger the useEffect below
        },
    }));

    // Effect for chart initialization and cleanup (runs once on mount)
    useEffect(() => {
        console.log('ChartComponent: Chart initialization useEffect triggered.');
        if (!chartContainerRef.current) {
            console.log('ChartComponent: Chart container ref not available.');
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
        // Correctly use chart.addSeries with AreaSeries constant
        const newSeries: ISeriesApi<'Area'> = chart.addSeries(AreaSeries, {
            lineColor,
            topColor: areaTopColor,
            bottomColor: areaBottomColor,
            lineWidth: 1,
        });
        seriesRef.current = newSeries;
        console.log('ChartComponent: Chart and AreaSeries initialized.');

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
        lineColor, areaTopColor, areaBottomColor
    ]); // Dependencies for chart initialization

    // Effect to update chart data when internal chartData state changes
    useEffect(() => {
        console.log('ChartComponent: chartData update useEffect triggered. chartData length:', chartData.length);
        if (seriesRef.current) {
            if (chartData.length === 0) {
                console.log('ChartComponent: Clearing chart data (chartData is empty).');
                seriesRef.current.setData([]);
            } else {
                // Convert all data to lightweight-charts format (time in seconds)
                const formattedChartData = chartData.map(p => ({ time: (p.time / 1000) as Time, value: p.value }));
                console.log('ChartComponent: Formatted chart data for lightweight-charts:', formattedChartData);

                // Get the last point currently in the series and explicitly cast it
                const currentSeriesData = seriesRef.current.data();
                const lastChartPoint = currentSeriesData.length > 0 ? (currentSeriesData[currentSeriesData.length - 1] as { time: Time, value: number }) : null;
                console.log('ChartComponent: Last point currently in chart series:', lastChartPoint);

                const lastNewPoint = formattedChartData[formattedChartData.length - 1];
                console.log('ChartComponent: Last new point from updated chartData:', lastNewPoint);

                // If the chart is empty or the last point is different, update the chart
                if (!lastChartPoint || lastChartPoint.time !== lastNewPoint.time || lastChartPoint.value !== lastNewPoint.value) {
                    console.log('ChartComponent: New data detected or chart is empty, updating series.');
                    // If the series is empty, or the new data represents a full reset/initial load
                    // (e.g., more than one point added at once, or the first point)
                    if (currentSeriesData.length === 0 || formattedChartData.length > currentSeriesData.length + 1) {
                        console.log('ChartComponent: Calling setData with full formattedChartData.');
                        seriesRef.current.setData(formattedChartData);
                    } else {
                        // Otherwise, it's likely a single new point, use update
                        console.log('ChartComponent: Calling update with lastNewPoint.');
                        seriesRef.current.update(lastNewPoint);
                    }
                    chartRef.current?.timeScale().scrollToRealTime(); // Scroll to the latest point
                    console.log('ChartComponent: Chart scrolled to real time.');
                } else {
                    console.log('ChartComponent: No new data or last point is the same, skipping series update.');
                }
            }
        } else {
            console.log('ChartComponent: seriesRef.current is not available for update effect.');
        }
    }, [chartData]); // Dependency on internal chartData state

    // Effect to set initial data from props when component mounts
    // This runs once to get the initial historical data from StockTable
    useEffect(() => {
        console.log('ChartComponent: initialData prop useEffect triggered. initialData length:', initialData.length);
        if (initialData && initialData.length > 0) {
            console.log('ChartComponent: Setting chartData from initialData prop.');
            setChartData(initialData);
        } else {
            console.log('ChartComponent: initialData prop is empty or null.');
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
