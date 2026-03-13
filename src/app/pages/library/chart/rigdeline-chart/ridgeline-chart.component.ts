import { Component, ElementRef, Input, OnChanges, ViewChild, HostListener } from "@angular/core";
import * as d3 from "d3";

@Component({
  selector: "app-ridgeline-chart",
  standalone: false,
  templateUrl: "./ridgeline-chart.component.html",
  styleUrls: ["./ridgeline-chart.component.css"],
})
export class RidgelineChartComponent implements OnChanges {
  @Input() data: any[] = [];

  @ViewChild("chart", { static: true }) chartContainer!: ElementRef;

  private margin = { top: 60, right: 10, bottom: 60, left: 10 };
  private width = 0;
  private height = 0;

  // Height per album band. Adjust this if you want the rows to be taller/shorter.
  private heightPerAlbum = 20;
  // How much the peaks spill into the row above them. Higher = taller mountains.
  private overlapFactor = 3;

  ngOnChanges(): void {
    if (this.data && this.data.length > 0) {
      this.drawChart();
    }
  }

  @HostListener("window:resize")
  onResize() {
    if (this.data && this.data.length > 0) {
      //  this.drawChart();
    }
  }

  private drawChart() {
    const element = this.chartContainer.nativeElement;
    d3.select(element).selectAll("*").remove();

    this.width = (element.offsetWidth || window.innerWidth) - this.margin.left - this.margin.right;

    // 1. Filter out bad data and albums that have 0 total history
    const validAlbums = this.data.filter((d) => d.history && d.history.length > 0);
    const albumsWithListens = validAlbums.filter((a) => (d3.max(a.history, (h: any) => Number(h.count)) ?? 0) > 0);

    if (albumsWithListens.length === 0) return;

    albumsWithListens.sort((a, b) => {
      // Parse the year. If it's "NULL" or invalid, assign 9999 so it drops to the bottom
      const yearA = parseInt(a.year) || 9999;
      const yearB = parseInt(b.year) || 9999;

      return yearA - yearB;
    });
    // Calculate dynamic height based on discography size so labels never squish
    this.height = Math.max(40, albumsWithListens.length * this.heightPerAlbum);
    // 2. Zero-Padding Algorithm: Ensure gaps in history drop cleanly to 0
    // Get the absolute minimum and maximum dates across the entire artist's history
    const globalMinMs = d3.min(albumsWithListens, (a) => d3.min(a.history, (h: any) => Number(h.date))) as number;
    const globalMaxMs = d3.max(albumsWithListens, (a) => d3.max(a.history, (h: any) => Number(h.date))) as number;

    // Generate a continuous array of timestamps for EVERY month between min and max
    const continuousDates: number[] = [];
    let currentMonth = new Date(globalMinMs);
    currentMonth.setUTCDate(1);
    currentMonth.setUTCHours(0, 0, 0, 0);

    const endMonth = new Date(globalMaxMs);
    endMonth.setUTCDate(1);
    endMonth.setUTCHours(0, 0, 0, 0);

    while (currentMonth.getTime() <= endMonth.getTime()) {
      continuousDates.push(currentMonth.getTime());
      // Increment by exactly 1 month
      currentMonth.setUTCMonth(currentMonth.getUTCMonth() + 1);
    }

    const bufferMs = 30 * 24 * 60 * 60 * 1000; // ~1 month bookend buffer

    // Map over the albums and fill in the blanks
    const paddedSeries = albumsWithListens.map((album) => {
      // Create a fast lookup map for the months that DO have data
      const historyMap = new Map(album.history.map((h: any) => [Number(h.date), Number(h.count)]));

      // Map over our continuous timeline. If the album has no data for that month, force a 0.
      let paddedHistory = continuousDates.map((dateMs) => ({
        date: new Date(dateMs),
        count: historyMap.get(dateMs) || 0,
      }));

      // Add a guaranteed zero to the very start and end to pin the curves to the floor
      if (continuousDates.length > 0) {
        paddedHistory.unshift({ date: new Date(continuousDates[0] - bufferMs), count: 0 });
        paddedHistory.push({ date: new Date(continuousDates[continuousDates.length - 1] + bufferMs), count: 0 });
      }

      // If you are using the moving average smoothing function we added earlier, apply it here!
      // paddedHistory = smoothData(paddedHistory, 2);

      return { name: album.name, history: paddedHistory };
    });

    // 3. Setup global scales
    const globalMinDate = paddedSeries[0].history[0].date;
    const globalMaxDate = paddedSeries[0].history[paddedSeries[0].history.length - 1].date;
    const globalMaxCount = d3.max(paddedSeries, (s) => d3.max(s.history, (h: any) => Number(h.count))) ?? 1; // Default to 1 to prevent divide-by-zero if somehow completely flat

    const albumNames = paddedSeries.map((a) => a.name);

    const svg = d3
      .select(element)
      .append("svg")
      .attr("width", "100%")
      .attr("height", this.height + this.margin.top + this.margin.bottom)
      .append("g")
      .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

    const x = d3.scaleTime().domain([globalMinDate, globalMaxDate]).range([0, this.width]);

    const yName = d3.scaleBand().domain(albumNames).range([0, this.height]).paddingInner(1);

    const yArea = d3
      .scaleLinear()
      .domain([0, globalMaxCount])
      .range([yName.step() * this.overlapFactor, 0]);

    // 4. Draw Axes
    svg
      .append("g")
      .attr("transform", `translate(0,${this.height})`)
      .call(d3.axisBottom(x).ticks(5))
      .attr("color", "#737373") // Color of the text and tick marks
      .select(".domain")
      .attr("stroke", "#404040"); // Color of the actual horizontal axis line

    // Y-Axis (Album names on the left)

    // 5. Setup Area Generator
    // 5. Setup Generators
    // This creates the solid shape (the fill)
    const area = d3
      .area<any>()
      .x((d) => x(d.date))
      .y0(yArea(0))
      .y1((d) => yArea(d.count))
      .curve(d3.curveBasis);

    // NEW: This creates ONLY the top curve (the stroke)
    const line = d3
      .line<any>()
      .x((d) => x(d.date))
      .y((d) => yArea(d.count))
      .curve(d3.curveBasis);
    // 6. Draw and Animate the Ridgelines
    // 6. Draw the Ridgelines
    const paths = svg
      .selectAll(".ridge-group")
      .data(paddedSeries)
      .enter()
      .append("g")
      .attr("class", "ridge-group")
      .attr("transform", (d) => `translate(0, ${(yName(d.name) || 0) - yArea(0)})`);

    // Draw the Fill (No bottom outline!)
    paths
      .append("path")
      .attr("class", "ridge-area")
      .attr("fill", "#262626") // Dark grey mountain fill
      .attr("stroke", "none") // NO STROKE: This removes the flat bottom line!
      .style("opacity", 0)
      .transition()
      .duration(1000)
      .delay((_, i) => i * 80)
      .style("opacity", 0.8)
      .attr("d", (d) => area(d.history));

    // Draw the Top Curve (Your custom chart color)
    paths
      .append("path")
      .attr("class", "ridge-line")
      .attr("fill", "none")
      .attr("stroke", "#ffffff") // Custom Chart Color (e.g., a nice Sky Blue)
      .attr("stroke-width", 1.5)
      .style("opacity", 0)
      .transition()
      .duration(1000)
      .delay((_, i) => i * 80)
      .style("opacity", 0.8)
      .attr("d", (d) => line(d.history));
  }
}
