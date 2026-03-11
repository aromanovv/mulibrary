import { Component, ElementRef, HostListener, OnInit, ViewChild, AfterViewInit } from "@angular/core";
import rangeSlider from "range-slider-input";
import { ScrobbleService } from "src/app/core/services/scrobble.service";
import { TimeRangeService } from "src/app/core/services/time-range.service";
import * as d3 from "d3";

@Component({
  selector: "app-total-listens-chart",
  standalone: false,
  templateUrl: "./total-listens-chart.component.html",
  styleUrl: "./total-listens-chart.component.css",
})
export class TotalListensChartComponent implements OnInit, AfterViewInit {
  data: any;
  points?: number = undefined;

  leftTooltipText: string = "";
  rightTooltipText: string = "";

  containerWidth!: number;
  startDate = new Date(2009, 5, 1);
  endDate = new Date();
  totalMonths = 0;
  currentRange: [number, number] = [0, 0];

  // Array to hold the legend markings
  ticks: { label: string; positionPct: number }[] = [];

  @ViewChild("lineChart") lineChartRef!: ElementRef<SVGElement>;

  constructor(
    private scrobbleService: ScrobbleService,
    private timeRangeService: TimeRangeService,
  ) {}

  ngOnInit(): void {
    this.containerWidth = window.innerWidth;

    this.totalMonths = this.timeRangeService.getTotalMonths();
    this.generateTicks(); // Generate the legend markings

    this.timeRangeService.sliderRangeMonths$.subscribe((range) => (this.currentRange = range));
    this.scrobbleService.getTimelineSliderScrobbles().subscribe((data) => {
      this.data = data;
      const n = 2;
      const sampled = this.data.filter((_: any, i: any) => i % n === 0);
      this.points = data?.length;
      this.drawChart(sampled);
    });
  }

  generateTicks() {
    const startYear = this.startDate.getFullYear();
    const endYear = this.endDate.getFullYear();
    const ticks = [];

    // Calculate position for January 1st of every year
    for (let year = startYear; year <= endYear; year++) {
      const monthDiff = (year - startYear) * 12 - this.startDate.getMonth();

      // Only include it if it falls within the slider's valid range
      if (monthDiff >= 0 && monthDiff <= this.totalMonths) {
        const positionPct = (monthDiff / this.totalMonths) * 100;
        ticks.push({ label: year.toString(), positionPct });
      }
    }

    this.ticks = ticks;
  }

  drawChart(data: any) {
    if (!data?.length || !this.lineChartRef) return;

    const el = this.lineChartRef.nativeElement;
    const width = el.clientWidth || this.containerWidth;
    const height = 40;

    const svg = d3.select(el).attr("width", width).attr("height", height);
    svg.selectAll("*").remove();

    const x = d3
      .scaleTime()
      .domain(d3.extent(data, (d: any) => new Date(d.quarter)) as [Date, Date])
      .range([0, width]);

    const y = d3
      .scalePow()
      .exponent(1)
      .domain([0, d3.max(data, (d: any) => +d.listens)!])
      .range([height, 0]);

    const line = d3
      .line<any>()
      .x((d) => x(new Date(d.quarter)))
      .y((d) => y(Math.max(1, d.listens)))
      .curve(d3.curveCardinal.tension(0.1));

    svg
      .append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#d4d4d4")
      .attr("stroke-width", 1.5)
      .attr("d", line);
  }

  @HostListener("window:resize", ["$event"])
  onResize(event: any) {
    this.containerWidth = event.target.innerWidth;
  }

  updateTooltipTexts(value: number[]) {
    this.leftTooltipText = this.formatDate(value[0]);
    this.rightTooltipText = this.formatDate(value[1]);
  }

  formatDate(monthIndex: number): string {
    const d = new Date(this.startDate);
    d.setMonth(this.startDate.getMonth() + monthIndex);
    return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(d);
  }

  onSliderChange(range: [number, number]) {
    const startDate = new Date(this.startDate);
    startDate.setMonth(this.startDate.getMonth() + range[0]);
    const endDate = new Date(this.startDate);
    endDate.setMonth(this.startDate.getMonth() + range[1]);

    const start_ts = Math.floor(startDate.getTime() / 1000);
    const end_ts = Math.floor(endDate.getTime() / 1000);

    this.timeRangeService.setSliderRange(start_ts, end_ts, range);
  }

  ngAfterViewInit() {
    const slider = document.querySelector("#range-slider");
    if (slider) {
      rangeSlider(slider, {
        min: 0,
        max: this.totalMonths,
        step: 1,
        value: this.currentRange,
        onInput: (value: [number, number]) => {
          this.currentRange = value;
          this.updateTooltipTexts(value);
        },
        onThumbDragEnd: () => {
          this.onSliderChange(this.currentRange);
        },
        onRangeDragEnd: () => {
          this.onSliderChange(this.currentRange);
        },
      });

      this.updateTooltipTexts(this.currentRange);
    }
  }
}
