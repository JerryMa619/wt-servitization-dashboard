import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart, GaugeChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([LineChart, GaugeChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);
export default function TelemetryChart({ option }: { option: object }) {
  return <ReactEChartsCore echarts={echarts} option={option} notMerge lazyUpdate style={{ height: 230 }} />;
}
