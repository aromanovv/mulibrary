import { Component, ElementRef, Input, OnChanges, ViewChild, HostListener } from "@angular/core";
import * as d3 from "d3";

@Component({
  selector: "app-line-chart",
  standalone: false,
  templateUrl: "./line-chart.component.html",
  styleUrls: ["./line-chart.component.css"],
})
export class LineChartComponent implements OnChanges {
  @Input() data: any[] = [];

  @ViewChild("chart", { static: true }) chartContainer!: ElementRef;

  private margin = { top: 20, right: 20, bottom: 30, left: 40 };
  private width = 0;
  private height = 100; // Set a fixed height for the line chart

  ngOnChanges(): void {
    if (this.data && this.data.length > 0) {
      this.drawChart();
    }
  }

  @HostListener("window:resize")
  onResize() {
    if (this.data && this.data.length > 0) {
      this.drawChart();
    }
  }

  private drawChart() {
    const element = this.chartContainer.nativeElement;
    d3.select(element).selectAll("*").remove();

    this.width = (element.offsetWidth || window.innerWidth) - this.margin.left - this.margin.right;

    // 1. Filter valid data
    const validAlbums = this.data.filter((d) => d.history && d.history.length > 0);
    if (validAlbums.length === 0) return;

    // 2. Generate Continuous Timeline & Aggregate Data
    const globalMinMs = d3.min(validAlbums, (a) => d3.min(a.history, (h: any) => Number(h.date))) as number;
    const globalMaxMs = d3.max(validAlbums, (a) => d3.max(a.history, (h: any) => Number(h.date))) as number;

    const continuousDates: number[] = [];
    let currentMonth = new Date(globalMinMs);
    currentMonth.setUTCDate(1);
    currentMonth.setUTCHours(0, 0, 0, 0);

    const endMonth = new Date(globalMaxMs);
    endMonth.setUTCDate(1);
    endMonth.setUTCHours(0, 0, 0, 0);

    while (currentMonth.getTime() <= endMonth.getTime()) {
      continuousDates.push(currentMonth.getTime());
      currentMonth.setUTCMonth(currentMonth.getUTCMonth() + 1);
    }

    // Sum the scrobbles across all albums for each month
    const aggregatedData = continuousDates.map((dateMs) => {
      const sum = validAlbums.reduce((total, album) => {
        // Find if this specific album has listens for this month
        const matchingHistory = album.history.find((h: any) => Number(h.date) === dateMs);
        return total + (matchingHistory ? Number(matchingHistory.count) : 0);
      }, 0);
      return { date: new Date(dateMs), count: sum };
    });

    // 3. Setup SVG
    const svg = d3
      .select(element)
      .append("svg")
      .attr("width", "100%")
      .attr("height", this.height + this.margin.top + this.margin.bottom)
      .append("g")
      .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

    // 4. Setup Scales
    const x = d3
      .scaleTime()
      .domain(d3.extent(aggregatedData, (d) => d.date) as [Date, Date])
      .range([0, this.width]);

    const y = d3
      .scaleLinear()
      .domain([0, (d3.max(aggregatedData, (d) => d.count) || 0) * 1.1]) // Add 10% padding to the top
      .range([this.height, 0]);

    // 5. Draw Axes
    svg
      .append("g")
      .attr("transform", `translate(0,${this.height})`)
      .call(d3.axisBottom(x).ticks(5))
      .attr("color", "#737373")
      .select(".domain")
      .attr("stroke", "#404040");

    svg.append("g").call(d3.axisLeft(y).ticks(5)).attr("color", "#737373").select(".domain").remove(); // Hide the vertical axis line for a cleaner look

    // 6. Setup Generators
    const area = d3
      .area<any>()
      .x((d) => x(d.date))
      .y0(this.height) // Base of the chart
      .y1((d) => y(d.count))
      .curve(d3.curveBasis); // Smooth curves

    const line = d3
      .line<any>()
      .x((d) => x(d.date))
      .y((d) => y(d.count))
      .curve(d3.curveBasis);

    // 7. Draw Area and Line
    // Subtle filled area underneath
    svg
      .append("path")
      .datum(aggregatedData)
      .attr("fill", "rgba(14, 165, 233, 0.1)") // Subtle blue tint
      .attr("stroke", "none")
      .attr("d", area);

    // Solid top line
    svg
      .append("path")
      .datum(aggregatedData)
      .attr("fill", "none")
      .attr("stroke", "#ffffff") // Solid sky blue line
      .attr("stroke-width", 2)
      .attr("d", line);
  }
}
