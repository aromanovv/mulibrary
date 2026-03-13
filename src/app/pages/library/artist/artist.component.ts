import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { EMPTY, Subject, combineLatest, switchMap, takeUntil, tap } from "rxjs";
import { AlbumService } from "src/app/core/services/album.service";
import { ArtistService } from "src/app/core/services/artist.service";
import { Album } from "src/app/shared/models/album.model";
import { Artist } from "src/app/shared/models/artist.model";
import { normalizeName } from "src/app/shared/utils/normalize-name.util";
import { debug } from "src/app/shared/utils/debug-util";

@Component({
  selector: "app-artist",
  templateUrl: "./artist.component.html",
  styleUrls: ["./artist.component.css"],
  standalone: false,
})
export class ArtistComponent implements OnInit, OnDestroy {
  constructor(
    private artistService: ArtistService,
    private albumService: AlbumService,
    protected activatedRoute: ActivatedRoute,
    protected router: Router,
  ) {}

  destroy$ = new Subject();
  albums: Album[] = [];
  artist: Artist | undefined;

  // Added properties for history state
  artistHistory: any = null; // Type this according to your history model
  isHistoryLoading: boolean = true;

  trackPlays = 0;
  albumPlays = 0;
  length = 0;
  tags: string[] | undefined;
  cover = "";
  currentSort: "year" | "listens" | "time" = "listens";

  ngOnInit(): void {
    const artistParams$ = this.activatedRoute.params.pipe(
      tap(() => (this.isHistoryLoading = true)), // Reset loading state when route changes
      takeUntil(this.destroy$),
    );

    // STREAM 1: Load Artist & Albums (Primary data)
    artistParams$
      .pipe(
        switchMap((params) => {
          if (params["artist"]) {
            const { artist } = params;
            return combineLatest([
              this.artistService.getArtistByName(artist),
              this.albumService.getAlbumsByArtistName(artist),
            ]);
          }
          return EMPTY;
        }),
      )
      .subscribe((data) => {
        debug("artist component returning artist and albums:", data);
        const [artist, albums] = data;
        this.albums = albums;
        this.artist = artist;
        this.sortAlbums(this.currentSort);
        //if (artist) this.treeviewService.updateActiveNode(new FlatNode(artist.name, 1, artist, true, true, true))
        this.albums.map((album) => {
          if (album && album.artwork && album.artwork.length > 0 && album.artwork![0].slice(2).slice(0, -2)) {
            album.artwork = ["http://localhost:3000/artwork/" + album.artwork![0].slice(2).slice(0, -2)];
          }
        });

        /*this.tracks = coll[1];
        coll[1].map(track => {
          this.length += track.duration ? track.duration : 0;
          this.trackPlays += track.playcount ? track.playcount : 0
        })
        this.albumPlays = Math.floor((this.trackPlays / this.tracks.length) * 100) / 100;   */
      });

    // STREAM 2: Load History independently
    artistParams$
      .pipe(
        switchMap((params) => {
          if (params["artist"]) {
            return this.albumService.getArtistAlbumHistory(params["artist"], "month");
          }
          return EMPTY;
        }),
      )
      .subscribe((historyData) => {
        this.artistHistory = historyData;
        this.isHistoryLoading = false; // Turn off skeleton loader
        debug("artist history loaded:", historyData);
      });
  }

  getHistorySkeletonHeight(): string {
    // Ridgeline charts overlap, so the height per album is much smaller
    const heightPerAlbumPx = 10; // Dropped from 60 to 30

    // The base height of the chart (for axes, padding, or the bottom row's full height)
    const basePaddingPx = 120;

    // Calculate total height
    const totalHeight = this.albums.length * heightPerAlbumPx + basePaddingPx;

    return `${totalHeight}px`;
  }

  // 1. Helper to calculate estimated hours
  getEstimatedHours(album: Album): number {
    const scrobbles = album.scrobbles || 0;
    if (scrobbles === 0) return 0;

    const trackCount = album.tracks?.length || 10; // Fallback to 10
    const durationMs = album.duration || 0;
    const avgTrackDurationMs = durationMs / trackCount;

    const totalMs = scrobbles * avgTrackDurationMs;

    // Convert ms to hours (divide by 1000 * 60 * 60)
    // IF YOUR DB USES SECONDS: change 3600000 to 3600
    return totalMs / 3600000;
  }

  // 2. Updated Bar Width Calculator to handle both modes
  calculateDynamicBarWidth(album: Album): number {
    if (!this.albums || this.albums.length === 0) return 0;

    if (this.currentSort === "time") {
      // Calculate based on hours
      const maxHours = Math.max(...this.albums.map((a) => this.getEstimatedHours(a)));
      const hours = this.getEstimatedHours(album);
      return maxHours === 0 ? 0 : (hours / maxHours) * 100;
    } else {
      // Calculate based on scrobbles (default for 'year' and 'listens')
      const maxScrobbles = Math.max(...this.albums.map((a) => a.scrobbles || 0));
      const scrobbles = album.scrobbles || 0;
      return maxScrobbles === 0 ? 0 : (scrobbles / maxScrobbles) * 100;
    }
  }

  sortAlbums(metric: "year" | "listens" | "time") {
    this.currentSort = metric;

    this.albums.sort((a, b) => {
      if (metric === "year") {
        const yearA = parseInt(String(a.year)) || 9999;
        const yearB = parseInt(String(b.year)) || 9999;
        return yearA - yearB; // Ascending (Oldest first)
      }

      if (metric === "listens") {
        const listensA = a.scrobbles || 0;
        const listensB = b.scrobbles || 0;
        return listensB - listensA; // Descending (Most plays first)
      }

      if (metric === "time") {
        // Estimated Time Listened = Scrobbles * Average Track Duration
        const trackCountA = a.tracks?.length || 10; // Fallback to 10 tracks if missing
        const trackCountB = b.tracks?.length || 10;

        const avgDurationA = (a.duration || 0) / trackCountA;
        const avgDurationB = (b.duration || 0) / trackCountB;

        const timeA = (a.scrobbles || 0) * avgDurationA;
        const timeB = (b.scrobbles || 0) * avgDurationB;

        return timeB - timeA; // Descending (Most time spent first)
      }

      return 0;
    });
  }

  setPlaceholderAlbumCover() {}

  navigateToAlbumPage(album: Album) {
    // TODO: album.artist shouldn't be optional?
    this.router.navigate(["library", "album", normalizeName(album.artist!.join("-")), normalizeName(album.name)]);
  }

  ngOnDestroy(): void {
    this.destroy$.next(true);
    this.destroy$.complete();
  }
}
