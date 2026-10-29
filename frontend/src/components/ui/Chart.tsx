import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart, BarChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkAreaComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { chartBaseOptions } from '../../lib/chartTheme';

// Register necessary modular ECharts components for tree-shaking
echarts.use([
  LineChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkAreaComponent,
  CanvasRenderer,
]);

export interface ChartProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  option: Record<string, any>;
  className?: string;
  style?: React.CSSProperties;
  loading?: boolean;
  'aria-label'?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEvents?: Record<string, (params: any) => void>;
}


export const Chart: React.FC<ChartProps> = ({
  option,
  className = '',
  style,
  loading = false,
  'aria-label': ariaLabel,
  onEvents,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!instanceRef.current) {
      instanceRef.current = echarts.init(chartRef.current, undefined, {
        renderer: 'canvas',
      });
    }

    const instance = instanceRef.current;

    // Merge base options with user-provided options
    const mergedOption = {
      ...chartBaseOptions,
      ...option,
      tooltip: {
        ...chartBaseOptions.tooltip,
        ...(option.tooltip || {}),
      },
      grid: {
        ...chartBaseOptions.grid,
        ...(option.grid || {}),
      },
    };

    instance.setOption(mergedOption, true);

    if (loading) {
      instance.showLoading('default', {
        text: '',
        color: '#148937',
        textColor: '#2b2a2a',
        maskColor: 'rgba(255, 255, 255, 0.6)',
      });
    } else {
      instance.hideLoading();
    }

    if (onEvents) {
      Object.entries(onEvents).forEach(([eventName, handler]) => {
        instance.off(eventName);
        instance.on(eventName, handler);
      });
    }

    const resizeObserver = new ResizeObserver(() => {
      if (instance && !instance.isDisposed()) {
        instance.resize();
      }
    });

    resizeObserver.observe(chartRef.current);

    return () => {
      resizeObserver.disconnect();
      if (onEvents && instance && !instance.isDisposed()) {
        Object.keys(onEvents).forEach((eventName) => {
          instance.off(eventName);
        });
      }
    };
  }, [option, loading, onEvents]);

  useEffect(() => {
    return () => {
      if (instanceRef.current && !instanceRef.current.isDisposed()) {
        instanceRef.current.dispose();
        instanceRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={chartRef}
      role="img"
      aria-label={ariaLabel}
      className={`w-full ${className}`}
      style={style}
    />
  );
};
