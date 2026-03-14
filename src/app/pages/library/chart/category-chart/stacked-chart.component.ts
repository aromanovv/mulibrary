import { Component, ElementRef, ViewChild, HostListener, Input, OnChanges } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import * as d3 from "d3";
import { TimeRangeService } from "src/app/core/services/time-range.service";
import { normalizeName } from "src/app/shared/utils/normalize-name.util";

@Component({
  selector: "app-stacked-chart",
  standalone: false,
  templateUrl: "./stacked-chart.component.html",
  styleUrls: ["./stacked-chart.component.css"],
})
export class StackedChartComponent implements OnChanges {
  @ViewChild("chart", { static: true }) chartContainer!: ElementRef;

  private svg: any;
  private x: any;
  private y: any;
  private area: any;
  private stack: any;
  private keys: string[] = [];
  private stackData: any[] = [];
  private phases: Record<string, number> = {};

  @Input() data: any;
  @Input() colors: any;
  @Input() offset: any;
  @Input() verticalZoom: number = 1; // Default to 1 (normal)
  @Input() routeType: "category" | "artist" = "category";
  @Input() height: number = 600;
  @Input() normalize: boolean = false;

  private margin = { top: 0, right: 0, bottom: 10, left: 0 };
  private innerHeight = 0;
  private width = 0;
  monthRange = 0;

  constructor(
    private timeRangeService: TimeRangeService,
    private router: Router,
  ) {}

  ngOnChanges(): void {
    if (!this.data || !this.colors) return;
    this.prepareData(this.data, this.colors, this.offset);
    this.initChart();
    this.updateChart();

    this.timeRangeService.sliderRangeMonths$.subscribe((range) => (this.monthRange = range[1] - range[0]));
  }

  // THE MAGIC ZOOM HELPER
  private updateYDomain(series: any[]) {
    const yMin = Number(d3.min(series, (s: any) => d3.min(s, (d: any) => d[0]))) || 0;
    const yMax = Number(d3.max(series, (s: any) => d3.max(s, (d: any) => d[1]))) || 0;

    const center = (yMax + yMin) / 2;
    const halfHeight = (yMax - yMin) / 2;

    const zoom = this.verticalZoom && this.verticalZoom > 0 ? Number(this.verticalZoom) : 1;

    // Divide by zoom to make the "window" smaller, zooming IN on the shapes
    this.y.domain([center - halfHeight / zoom, center + halfHeight / zoom]);
  }

  private prepareData(rawData: any, colorMap: any, offset: any) {
    const dates = Array.from(
      new Set(Object.values(rawData).flatMap((v: any) => v.map((d: any) => new Date(d.date).getTime()))),
    )
      .map((t) => new Date(t))
      .sort((a, b) => a.getTime() - b.getTime());

    this.stackData = dates.map((date) => {
      const entry: any = { date };
      Object.keys(rawData).forEach((key) => {
        const found = rawData[key].find((d: any) => new Date(d.date).getTime() === date.getTime());

        let count = found ? found.count : 0;

        // ORGANIC COMPRESSION: If normalize is true, square root the count!
        if (this.normalize && count > 0) {
          count = Math.sqrt(count); // You can also try Math.pow(count, 0.4) for even more compression!
        }

        entry[key] = count;
      });
      return entry;
    });

    const colorOrder = Object.keys(colorMap);
    this.keys = Object.keys(rawData).sort((a, b) => colorOrder.indexOf(a) - colorOrder.indexOf(b));

    const totalMonths = this.stackData.length;
    let step = 1;

    if (totalMonths >= 144) {
      step = 6;
    } else if (totalMonths >= 96) {
      step = 4;
    } else if (totalMonths >= 60) {
      step = 3;
    } else if (totalMonths >= 24) {
      step = 2;
    } else {
      step = 1;
    }

    this.stackData = this.downsampleData(this.stackData, step, 12);

    this.stack = d3
      .stack()
      .keys(this.keys)
      .offset(offset || d3.stackOffsetWiggle);

    this.phases = {};
    this.keys.forEach((k) => (this.phases[k] = Math.random() * Math.PI * 2));
  }

  private initChart() {
    const element = this.chartContainer.nativeElement;
    d3.select(element).selectAll("*").remove();

    this.width = (element.offsetWidth || window.innerWidth) - this.margin.left - this.margin.right;

    const isMobile = window.innerWidth < 768;
    const actualHeight = isMobile ? Math.min(this.height, 350) : this.height;
    this.innerHeight = actualHeight - this.margin.top - this.margin.bottom;

    this.svg = d3
      .select(element)
      .append("svg")
      .attr("width", "100%")
      .attr("height", this.innerHeight + this.margin.top + this.margin.bottom)
      .style("overflow", "visible") // <--- ADD THIS LINE!
      .append("g")
      .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

    this.x = d3
      .scaleTime()
      .domain(d3.extent(this.stackData, (d) => d.date) as [Date, Date])
      .range([0, this.width]);

    this.y = d3.scaleLinear().range([this.innerHeight, 0]);

    this.area = d3
      .area<any>()
      .x((d) => this.x(d.data.date))
      .y0((d) => this.y(d[0]))
      .y1((d) => this.y(d[1]))
      .curve(d3.curveBasis);

    const series = this.stack(this.stackData);

    // Apply the zoom domain here!
    this.updateYDomain(series);

    const hoverLine = this.svg
      .append("line")
      .attr("class", "hover-line")
      .attr("y1", 0)
      .attr("y2", this.innerHeight)
      .attr("stroke", "rgba(255,255,255,0.5)")
      .attr("stroke-width", 1)
      .style("pointer-events", "none")
      .style("display", "none");

    const tooltip = this.svg
      .append("text")
      .attr("class", "hover-tooltip")
      .attr("x", this.width - 20)
      .attr("y", 40)
      .attr("fill", "#fff")
      .attr("font-size", "14px")
      .style("pointer-events", "none")
      .style("display", "none")
      .style("text-anchor", "end");

    this.svg
      .selectAll("path.area")
      .data(series)
      .enter()
      .append("path")
      .attr("class", "area")
      .attr("d", this.area)
      // ADDED THE HOT PINK FALLBACK COLOR HERE
      .attr("fill", (d: any) => this.colors[d.key as keyof typeof this.colors] || "#ff0088")
      .style("stroke", "#fff")
      .style("stroke-width", 0.3)
      .style("stroke-linejoin", "round")
      .style("opacity", 1)
      .style("cursor", "pointer")
      .on("mouseover", (event: MouseEvent, d: any) => {
        this.svg.selectAll(".area").style("opacity", 0.25);
        d3.select(event.currentTarget as SVGPathElement).style("opacity", 1);
        tooltip.style("display", null);
        hoverLine.style("display", null);
      })
      .on("mousemove", (event: MouseEvent, d: any) => {
        const [mx] = d3.pointer(event, this.svg.node());
        const date = this.x.invert(mx);
        tooltip.text(`${d.key} · ${date.toLocaleString(undefined, { month: "short", year: "numeric" })}`);
        hoverLine.attr("x1", mx).attr("x2", mx);
      })
      .on("mouseleave", (_event: MouseEvent) => {
        tooltip.style("display", "none");
        this.svg.selectAll(".area").style("opacity", 1);
        hoverLine.style("display", "none");
      })
      .on("click", (event: MouseEvent, d: any) => {
        this.router.navigate(["/library", this.routeType, normalizeName(d.key)]);
      });
  }

  private downsampleData(data: any[], step = 3, minPoints = 12) {
    if (data.length <= minPoints) return data;
    const result = data.filter((_row, i) => i % step === 0);
    if (result[0].date.getTime() !== data[0].date.getTime()) {
      result.unshift(data[0]);
    }
    if (result[result.length - 1].date.getTime() !== data[data.length - 1].date.getTime()) {
      result.push(data[data.length - 1]);
    }
    return result;
  }

  private updateChart() {
    const series = this.stack(this.stackData);

    // THIS IS WHAT FIXED IT! Using the helper here too so it doesn't overwrite initChart
    this.updateYDomain(series);

    this.svg.selectAll("path.area").data(series).attr("d", this.area);
  }

  @HostListener("window:resize")
  onResize() {
    if (this.data && this.colors) {
      this.initChart();
      this.updateChart();
    }
  }
}
