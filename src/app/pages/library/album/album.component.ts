import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import {
  EMPTY,
  Subject,
  combineLatest,
  distinct,
  distinctUntilChanged,
  distinctUntilKeyChanged,
  first,
  of,
  startWith,
  switchMap,
  take,
  takeUntil,
} from "rxjs";
import { AlbumService } from "src/app/core/services/album.service";
import { TrackService } from "src/app/core/services/track.service";
import { Album } from "src/app/shared/models/album.model";
import { Track } from "src/app/shared/models/track.model";
import { calculateBarWidth } from "src/app/shared/utils/calculate-bar-width";
import { ScrobbleService } from "src/app/core/services/scrobble.service";
import { getCurrentYear } from "src/app/shared/utils/date.util";
import { SupabaseService } from "src/app/core/services/supabase.service";
import { normalizeName } from "src/app/shared/utils/normalize-name.util";

@Component({
  selector: "app-album",
  templateUrl: "./album.component.html",
  styleUrls: ["./album.component.css"],
  standalone: false,
})
export class AlbumComponent implements OnInit, OnDestroy {
  constructor(
    private albumService: AlbumService,
    private trackService: TrackService,
    private supabaseService: SupabaseService,
    private activatedRoute: ActivatedRoute,
    private router: Router,
  ) {}
  calculateBarWidth = calculateBarWidth;
  normalizeName = normalizeName;
  chart: any;
  destroy$ = new Subject();
  scrobblesByYear: { year: number; value: number }[] = [];
  album: Album | undefined;
  tracks: Track[] = [];
  trackPlays = 0;
  albumPlays = 0;
  length = 0;
  tags: string[] | undefined;
  admin = false;

  ngOnInit(): void {
    //Chart.register(BarController, BarElement, LinearScale, CategoryScale);
    this.admin = this.supabaseService.isAdmin();
    this.activatedRoute.params
      .pipe(
        switchMap((params) => {
          if (params["artist"] && params["album"]) {
            const { artist, album } = params;
            return combineLatest([
              this.albumService.getAlbumByName(artist, album),
              this.trackService.getAlbumTracks(artist, album),
              //this.scrobbleService.getAlbumScrobblesPerYear(album, artist),
            ]).pipe(take(1));
          }
          return EMPTY;
        }),
      )
      .subscribe(([album, tracks]) => {
        this.length = 0;
        this.trackPlays = 0;
        this.album = album;
        /*  this.scrobblesByYear = Object.entries(scrobbles).map(([year, value]) => ({
          year: Number(year),
          value: value as number,
        })); */
        //  this.createChart();

        this.tracks = tracks;
        tracks.map((track) => {
          this.length += Number(track.duration) ? Number(track.duration) : 0;
          this.trackPlays += track.playcount ? track.playcount : 0;
        });
        this.albumPlays = Math.floor((this.trackPlays / this.tracks.length) * 100) / 100;
      });
  }

  editAlbum() {
    this.router.navigate(["edit"], { relativeTo: this.activatedRoute });
  }

  setPlaceholderAlbumCover() {}

  /*   createChart() {
    if (this.scrobblesByYear.length > 0) {
      const labels = this.scrobblesByYear.map((scrobbles) => scrobbles.year);
      const data = this.scrobblesByYear.map(scrobbles => +scrobbles.value);
      const totalYears = getCurrentYear() - 2008;
      
      const colors = new Array(20).fill('#ffffff');
      this.chart = new Chart("albumScrobblesByYear", {
        type: "bar",

        data: {
          // values on X-Axis
          labels,
          datasets: [{
              data,
              borderColor: colors,
              backgroundColor: colors,
              borderWidth: 1,
              barThickness: 10
            }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          aspectRatio: 2,
          indexAxis: 'y',
          scales: {
            y: {
              ticks: {
                display: true,
              },
            },
          },
        },
      });
    }
  } */

  ngOnDestroy(): void {
    this.destroy$.next(true);
  }
}
