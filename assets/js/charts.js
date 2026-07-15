(function (global) {
  const PALETTE = ['#1E3A8A', '#16A34A', '#F59E0B', '#0EA5E9', '#DC2626', '#0F172A', '#7C3AED', '#EA580C', '#0D9488', '#64748B'];

  const GENDER_COLORS = { Male: '#16A34A', Female: '#1E3A8A', Other: '#F59E0B', 'Not Specified': '#94A3B8', Unspecified: '#94A3B8' };
  function colorsForLabels(labels, fixedMap, fallbackPalette) {
    let i = 0;
    return labels.map((l) => fixedMap[l] || fallbackPalette[(i++) % fallbackPalette.length]);
  }

  function applyChartDefaults(Chart) {
    Chart.defaults.font.family = "'Inter', 'Noto Sans Kannada', sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = '#64748B';
    Chart.defaults.plugins.tooltip.backgroundColor = '#0F172A';
    Chart.defaults.plugins.tooltip.titleColor = '#FFFFFF';
    Chart.defaults.plugins.tooltip.titleFont = { weight: '700' };
    Chart.defaults.plugins.tooltip.bodyColor = '#EAEFF7';
    Chart.defaults.plugins.tooltip.padding = 12;
    Chart.defaults.plugins.tooltip.cornerRadius = 10;
    Chart.defaults.plugins.tooltip.displayColors = true;
    Chart.defaults.plugins.tooltip.boxPadding = 6;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.padding = 16;
    Chart.defaults.plugins.legend.labels.font = { size: 12, weight: '600' };
    Chart.defaults.animation.duration = 700;
    Chart.defaults.animation.easing = 'easeOutQuart';
  }

  // Vertical gradient fill — used as a backgroundColor callback so it re-resolves once chartArea is known.
  function verticalGradient(colorStops) {
    return (context) => {
      const { ctx, chartArea } = context.chart;
      if (!chartArea) return null;
      const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
      colorStops.forEach(([stop, color]) => gradient.addColorStop(stop, color));
      return gradient;
    };
  }

  function horizontalGradient(colorStops) {
    return (context) => {
      const { ctx, chartArea } = context.chart;
      if (!chartArea) return null;
      const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
      colorStops.forEach(([stop, color]) => gradient.addColorStop(stop, color));
      return gradient;
    };
  }

  const centerTextPlugin = {
    id: 'centerText',
    beforeDraw(chart) {
      const opts = chart.config.options.plugins && chart.config.options.plugins.centerText;
      if (!opts) return;
      const { text, sub } = opts;
      const { ctx, chartArea: { left, right, top, bottom } } = chart;
      const cx = (left + right) / 2;
      const cy = (top + bottom) / 2;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = "800 24px 'Inter', sans-serif";
      ctx.fillStyle = '#0F172A';
      ctx.fillText(text, cx, cy - (sub ? 11 : 0));
      if (sub) {
        ctx.font = "700 10px 'Inter', sans-serif";
        ctx.fillStyle = '#64748B';
        ctx.fillText(String(sub).toUpperCase(), cx, cy + 13);
      }
      ctx.restore();
    }
  };

  // Draws the value (and optional %) at the end of each bar — keeps small datasets readable
  // without leaning on a sparse axis for the numbers.
  const barValueLabelsPlugin = {
    id: 'barValueLabels',
    afterDatasetsDraw(chart) {
      const opts = chart.config.options.plugins && chart.config.options.plugins.barValueLabels;
      if (!opts) return;
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      const data = chart.data.datasets[0].data;
      const total = data.reduce((s, v) => s + v, 0);
      const horizontal = chart.options.indexAxis === 'y';
      ctx.save();
      ctx.font = "700 11px 'Inter', sans-serif";
      ctx.fillStyle = '#1F2937';
      meta.data.forEach((bar, i) => {
        const value = data[i];
        const pct = opts.showPct && total ? ` (${((value / total) * 100).toFixed(0)}%)` : '';
        const label = `${value}${pct}`;
        if (horizontal) {
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, bar.x + 8, bar.y);
        } else {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(label, bar.x, bar.y - 6);
        }
      });
      ctx.restore();
    }
  };

  // Sensible pixel height for a horizontal bar chart given its row count — avoids
  // a fixed tall frame looking sparse with 2 bars or cramped with 15.
  function barHeightFor(rowCount) {
    return Math.min(560, Math.max(200, rowCount * 46 + 60));
  }

  global.RJPCharts = {
    PALETTE, GENDER_COLORS, colorsForLabels, applyChartDefaults, verticalGradient, horizontalGradient,
    centerTextPlugin, barValueLabelsPlugin, barHeightFor
  };
})(window);
