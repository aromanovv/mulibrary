import { Component, ElementRef, HostListener, OnInit, ViewChild } from "@angular/core";
import { IScrobble } from "../../../shared/models/scrobble.model";
import { ScrobbleService } from "../../../core/services/scrobble.service";
import { normalizeName } from "src/app/shared/utils/normalize-name.util";
import { TimeRangeService } from "src/app/core/services/time-range.service";
import rangeSlider from "range-slider-input";

@Component({
  selector: "app-home-library",
  templateUrl: "./home-library.component.html",
  styleUrls: ["./home-library.component.css"],
  standalone: false,
})
export class HomeLibraryComponent implements OnInit {
  normalizeName = normalizeName;
  chart: any;
  periods = [3];
  recentScrobbles: IScrobble[] | null = null;

  topArtists: { [period: number]: IScrobble[] } = {};
  topAlbums: { [period: number]: IScrobble[] } = {};
  topTracks: { [period: number]: IScrobble[] } = {};

  constructor(private scrobbleService: ScrobbleService) {}

  ngOnInit(): void {
    // add unsubscribe
    this.scrobbleService
      .getRecentTracks(1, 10)
      .subscribe((scrobbles: IScrobble[] | null) => (this.recentScrobbles = scrobbles));

    this.periods.forEach((period) => {
      this.scrobbleService.getTopArtists(3).subscribe((artists: IScrobble[]) => {
        this.topArtists[period] = artists;
      });
      this.scrobbleService.getTopAlbums(3).subscribe((albums: IScrobble[]) => {
        this.topAlbums[period] = albums;
      });
      /*    this.scrobbleService.getTopTracks(getTimestampYearsAgo(period)).subscribe((tracks: IScrobble[]) => {
        this.topTracks[period] = tracks;
      }); */
    });
  }

  /* 
  formatRange(value: number[]): string {
    const [startIndex, endIndex] = value;
    const start = new Date(this.startDate);
    start.setMonth(this.startDate.getMonth() + startIndex);
    const end = new Date(this.startDate);
    end.setMonth(this.startDate.getMonth() + endIndex);
    const fmt = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });
    return `${fmt.format(start)} → ${fmt.format(end)}`;
  } */
}
