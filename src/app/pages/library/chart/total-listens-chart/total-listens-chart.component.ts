import { Component, ElementRef, HostListener, OnInit, ViewChild, AfterViewInit } from "@angular/core";
import rangeSlider from "range-slider-input";
import { ScrobbleService } from "src/app/core/services/scrobble.service";
import { TimeRangeService } from "src/app/core/services/time-range.service";

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

  constructor(private timeRangeService: TimeRangeService) {}

  ngOnInit(): void {
    this.containerWidth = window.innerWidth;

    this.totalMonths = this.timeRangeService.getTotalMonths();
    this.generateTicks(); // Generate the legend markings

    this.timeRangeService.sliderRangeMonths$.subscribe((range) => (this.currentRange = range));
  }

  generateTicks() {
    const startYear = this.startDate.getFullYear();
    const endYear = this.endDate.getFullYear();
    const ticks = [];

    // Determine interval step based on screen width
    let step = 1;
    if (this.containerWidth < 500) {
      step = 3; // Mobile: show every 3rd year
    } else if (this.containerWidth < 768) {
      step = 2; // Tablet: show every 2nd year
    }

    // Calculate position for January 1st of the years in range
    for (let year = startYear; year <= endYear; year++) {
      const monthDiff = (year - startYear) * 12 - this.startDate.getMonth();

      // Only include it if it falls strictly inside the slider's valid range
      if (monthDiff > 0 && monthDiff <= this.totalMonths) {
        // Base the interval on the first visible year (2010) to keep the cadence clean
        if ((year - (startYear + 1)) % step === 0) {
          const positionPct = (monthDiff / this.totalMonths) * 100;
          ticks.push({ label: year.toString(), positionPct });
        }
      }
    }

    this.ticks = ticks;
  }

  @HostListener("window:resize", ["$event"])
  onResize(event: any) {
    this.containerWidth = event.target.innerWidth;
    this.generateTicks();
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
