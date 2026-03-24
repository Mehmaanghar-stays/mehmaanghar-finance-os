'use client';
// src/app/(dashboard)/cashflow/RevExpenseBar.tsx
//
// Bar chart: Revenue vs Expenses 12-month trend (cExp in the HTML).
// Co-located with the Cash Flow page — only used here.
// Verbatim port of the cExp chart from rndCashflow() in the HTML.

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import {
  CHART_DEFAULTS,
  ANIMATION,
  legendConfig,
} from '@/components/charts/chartUtils';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);
ChartJS.defaults.font.family = CHART_DEFAULTS.fontFamily;
ChartJS.defaults.color = CHART_DEFAULTS.color;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RevExpTrendPoint {
  /** Month label e.g. "Jan" */
  l: string;
  /** Revenue in ₹K units */
  rev: number;
  /** Expenses in ₹K units */
  exp: number;
}

interface RevExpenseBarProps {
  trend: RevExpTrendPoint[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RevExpenseBar({ trend }: RevExpenseBarProps) {
  const data = {
    labels: trend.map((t) => t.l),
    datasets: [
      {
        label: 'Revenue',
        data: trend.map((t) => t.rev),
        backgroundColor: 'rgba(22,163,74,.2)',
        borderColor: 'rgba(22,163,74,.7)',
        borderWidth: 1.5,
        borderRadius: 4,
      },
      {
        label: 'Expenses',
        data: trend.map((t) => t.exp),
        backgroundColor: 'rgba(220,38,38,.75)',
        borderColor: '#DC2626',
        borderWidth: 0,
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    animation: ANIMATION,
    plugins: {
      legend: legendConfig('top'),
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; raw?: unknown }) =>
            ` ${ctx.dataset.label}: ₹${ctx.raw}K`,
        },
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        grid: { color: '#F1F0EC' },
        ticks: { callback: (v: number | string) => '₹' + v + 'K' },
      },
    },
  };

  return <Bar data={data} options={options as Parameters<typeof Bar>[0]['options']} />;
}