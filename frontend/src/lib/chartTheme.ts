/**
 * Chart color palette and theme definitions for ECharts.
 * Matches design tokens strictly:
 * - forecast = brand solid (#148937)
 * - expected = ink dashed (#2b2a2a)
 * - firm-to-upside band = brand-soft fill (rgba(20, 137, 55, 0.12))
 * - actual = ink solid (#2b2a2a)
 * - naive = amber (#d97706)
 * - grid lines = border colour (rgba(43, 42, 42, 0.10))
 * - axis labels = subtext (#5a5856) in mono 11px
 * - Tooltips: white surface, border, radius-card, mono numbers
 */

export const CHART_COLORS = {
  forecast: '#148937',
  expected: '#2b2a2a',
  bandFill: 'rgba(20, 137, 55, 0.12)',
  bandBorder: 'rgba(20, 137, 55, 0.35)',
  actual: '#2b2a2a',   // ink solid 2px
  naive: '#d97706',
  amber: '#d97706',
  gridLine: 'rgba(43, 42, 42, 0.10)',
  subtext: '#5a5856',
  surface: '#ffffff',
  ink: '#2b2a2a',
} as const;


export const chartBaseOptions = {
  textStyle: {
    fontFamily: '"Inter Variable", sans-serif',
    color: CHART_COLORS.ink,
  },
  grid: {
    top: 36,
    right: 20,
    bottom: 36,
    left: 48,
    containLabel: true,
  },
  tooltip: {
    trigger: 'axis',
    backgroundColor: CHART_COLORS.surface,
    borderColor: CHART_COLORS.gridLine,
    borderWidth: 1,
    borderRadius: 12,
    padding: [10, 14],
    textStyle: {
      color: CHART_COLORS.ink,
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 12,
    },
    extraCssText: 'box-shadow: 0 4px 12px rgba(43, 42, 42, 0.08);',
  },
  xAxis: {
    axisLine: {
      lineStyle: {
        color: CHART_COLORS.gridLine,
      },
    },
    axisTick: {
      show: false,
    },
    axisLabel: {
      color: CHART_COLORS.subtext,
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 11,
      margin: 10,
    },
    splitLine: {
      show: false,
    },
  },
  yAxis: {
    axisLine: {
      show: false,
    },
    axisTick: {
      show: false,
    },
    axisLabel: {
      color: CHART_COLORS.subtext,
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 11,
      margin: 12,
    },
    splitLine: {
      lineStyle: {
        color: CHART_COLORS.gridLine,
        type: 'dashed' as const,
      },
    },
  },
};
