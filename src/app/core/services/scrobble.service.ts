import { Injectable } from "@angular/core";
import { BehaviorSubject, EMPTY, Observable, catchError, filter, from, map, of, skip, take, tap } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { SERVER_API_URL } from "src/app/app.constants";
import { ICategoryScrobbles, Scrobble as IScrobble } from "src/app/shared/models/scrobble.model";
import { Album } from "src/app/shared/models/album.model";
import { SupabaseService } from "./supabase.service";
import { TimeRangeService } from "./time-range.service";

@Injectable({ providedIn: "root" })
export class ScrobbleService {
  private topArtists: { [period: number]: BehaviorSubject<IScrobble[]> } = {};
  private topAlbums: { [period: number]: BehaviorSubject<IScrobble[]> } = {};
  private topTracks: { [period: number]: BehaviorSubject<IScrobble[]> } = {};
  private scrobblesPerYear: BehaviorSubject<{
    [artist: string]: {
      scrobbles?: { [year: string]: number };
      albums: {
        [album: string]: {
          scrobbles: { [year: string]: number };
        };
      };
    };
  }> = new BehaviorSubject({});
  private recentScrobbles: BehaviorSubject<IScrobble[] | null> = new BehaviorSubject<IScrobble[] | null>(null);
  private timelineScrobbles: BehaviorSubject<any> = new BehaviorSubject<any>(undefined);
  private categoryScrobbles: BehaviorSubject<ICategoryScrobbles | null> =
    new BehaviorSubject<ICategoryScrobbles | null>(null);
  private categoryColors: BehaviorSubject<Record<string, string> | null> = new BehaviorSubject<Record<
    string,
    string
  > | null>(null);
  private categoryArtistsScrobbles: { [category: string]: BehaviorSubject<ICategoryScrobbles | null> } = {};
  private topCategoryScrobbles: BehaviorSubject<
    {
      category: string;
      playcount: number;
    }[]
  > = new BehaviorSubject<
    {
      category: string;
      playcount: number;
    }[]
  >([]);
  normalized = false;

  constructor(
    private http: HttpClient,
    private supabaseService: SupabaseService,
    private timeRangeService: TimeRangeService,
  ) {
    this.fetchCategoryColors();
    this.timeRangeService.sliderRange$.pipe(skip(1)).subscribe(() => {
      this.fetchCategoryScrobbles();
      this.fetchTopArtists(3);
      this.fetchTopAlbums(3);
    });
  }

  getCategoryColors(): Observable<Record<string, string> | null> {
    if (!this.categoryColors.value) {
      this.fetchCategoryColors();
    }
    return this.categoryColors.asObservable();
  }

  private fetchCategoryColors() {
    from(this.supabaseService.getCategories())
      .pipe(
        map((response) => {
          if (response.error) {
            console.error("Error fetching categories:", response.error);
            return null;
          }

          // Transform the array of rows into a single dictionary object
          const colorMap: Record<string, string> = {};
          response.data.forEach((row: any) => {
            // Only add if it has a valid color
            if (row.color && row.color !== "NULL") {
              colorMap[row.name] = row.color;
            }
          });
          return colorMap;
        }),
        tap((colorMap) => this.categoryColors.next(colorMap)),
      )
      .subscribe();
  }

  getCategoryArtistsScrobbles(category: string, step = 1, forceReload = false): Observable<ICategoryScrobbles | null> {
    if (!this.categoryArtistsScrobbles[category] || forceReload) {
      this.categoryArtistsScrobbles[category] = new BehaviorSubject<ICategoryScrobbles | null>(null);
      this.fetchCategoryArtistsScrobbles(category, step);
    }
    return this.categoryArtistsScrobbles[category].asObservable();
  }
  private fetchCategoryArtistsScrobbles(category: string, step: number) {
    // Call the RPC without specific timestamps to get the full history
    from(this.supabaseService.getCategoryArtists(category))
      .pipe(
        take(1),
        map((response) => {
          if (response.status !== 200) {
            console.error("Request failed with status:", response.status, "Error:", response.error);
            return null;
          }

          const artistCountMap: ICategoryScrobbles = {};

          // 1. Find the absolute min and max years dynamically from the returned data
          // Fallback to 2009 and the current year just in case the data is empty
          // Fallback bounds
          let minYear = 2009;
          let maxYear = new Date().getUTCFullYear(); // ALWAYS use the current year (e.g. 2026)

          if (response.data && response.data.length > 0) {
            // Find the earliest year in the data
            const dataMinYear = Math.min(
              ...response.data.map((r: any) => (r.year ? r.year : new Date(r.date).getUTCFullYear())),
            );

            // Start either in 2009, or 1 year BEFORE the data starts (guarantees the left side pinches shut)
            minYear = Math.min(2009, dataMinYear - 1);

            // Find the latest year in the data
            const dataMaxYear = Math.max(
              ...response.data.map((r: any) => (r.year ? r.year : new Date(r.date).getUTCFullYear())),
            );

            // End either on the current year, or the data's last year—whichever is LATER (guarantees the right side pinches shut)
            maxYear = Math.max(new Date().getUTCFullYear(), dataMaxYear);
          }

          response.data.forEach((r: any) => {
            const { artist, count } = r;

            // 2. Initialize the artist array with 0s using our dynamic full-range bounds
            if (!artistCountMap[artist]) {
              artistCountMap[artist] = [];
              for (let y = minYear; y <= maxYear; y++) {
                for (let month = 0; month <= 11; month += step) {
                  artistCountMap[artist].push({ date: new Date(Date.UTC(y, month, 1)), count: 0 });
                }
              }
            }

            // Normalize the incoming date safely
            const rYear = r.year ? r.year : new Date(r.date).getUTCFullYear();

            // If downsampling (step > 1), we "bucket" the month down to the nearest step interval
            // e.g. if step = 3 (quarterly), month 2 (March) becomes month 0 (Jan).
            const rawMonth = r.month ? r.month - 1 : new Date(r.date).getUTCMonth();
            const bucketedMonth = Math.floor(rawMonth / step) * step;

            const entry = artistCountMap[artist].find(
              (e) => e.date.getTime() === new Date(Date.UTC(rYear, bucketedMonth, 1)).getTime(),
            );

            // Use += instead of = just in case we are buckling multiple months into one step!
            if (entry) entry.count += Number(count);
          });

          return artistCountMap;
        }),
        tap((response) => this.categoryArtistsScrobbles[category].next(response)),
      )
      .subscribe();
  }

  getTopCategories(): Observable<
    {
      category: string;
      playcount: number;
    }[]
  > {
    return this.topCategoryScrobbles.asObservable();
  }

  getTopArtists(period: number, forceReload = false): Observable<any> {
    if (!this.topArtists[period] || forceReload) {
      this.topArtists[period] = new BehaviorSubject<IScrobble[]>([]);
      this.fetchTopArtists(period);
    }
    return this.topArtists[period].asObservable();
  }

  private fetchTopArtists(period: number): void {
    const { start_ts, end_ts } = this.timeRangeService.getSliderRange();
    from(this.supabaseService.getTopArtists(start_ts, end_ts))
      .pipe(
        catchError((error) => {
          return of("Error occurred:", error);
        }),
        map((response) => {
          if (response.status === 200) {
            return response.data;
          } else {
            console.error("Unable to fetch top artists, status:", response.status, "Error:", response.error);
          }
        }),
        tap((response) => {
          this.topArtists[period].next(response);
        }),
      )
      .subscribe();
  }

  getTopAlbums(period: any, forceReload = false): Observable<any> {
    if (!this.topAlbums[period] || forceReload) {
      this.topAlbums[period] = new BehaviorSubject<IScrobble[]>([]);
      this.fetchTopAlbums(period);
    }
    return this.topAlbums[period].asObservable();
  }

  private fetchTopAlbums(period: any): void {
    const { start_ts, end_ts } = this.timeRangeService.getSliderRange();
    from(this.supabaseService.getTopAlbums(start_ts, end_ts))
      .pipe(
        catchError((error) => {
          return of("Error occurred:", error);
        }),
        map((response) => {
          if (response.status === 200) {
            return response.data;
          } else {
            console.error("Request failed with status:", response.status);
          }
        }),
        tap((response) => {
          this.topAlbums[period].next(response);
        }),
      )
      .subscribe();
  }

  getTopTracks(period: number, forceReload = false): Observable<any> {
    if (!this.topTracks[period] || forceReload) {
      this.topTracks[period] = new BehaviorSubject<IScrobble[]>([]);
      this.fetchTopTracks(period).subscribe();
    }
    return this.topTracks[period].asObservable();
  }

  private fetchTopTracks(period: number): any {
    return this.http
      .get<IScrobble[]>(`${SERVER_API_URL}/scrobbles/top-tracks`, {
        params: {
          range: String(period),
        },
        observe: "response",
      })
      .pipe(
        catchError((error) => {
          return of("Error occurred:", error);
        }),
        map((response) => {
          if (response.status === 200) {
            return response.body;
          } else {
            console.error("Request failed with status:", response.status);
          }
        }),
        tap((response) => {
          this.topTracks[period].next(response);
        }),
      );
  }

  getCategoryScrobbles(forceReload = false): Observable<ICategoryScrobbles | null> {
    if (!this.categoryScrobbles.value || forceReload) {
      this.fetchCategoryScrobbles();
    }
    return this.categoryScrobbles.asObservable();
  }

  private fetchCategoryScrobbles() {
    const { start_ts, end_ts } = this.timeRangeService.getSliderRange();
    const startYear = new Date(start_ts * 1000).getUTCFullYear();
    const endYear = new Date(end_ts * 1000).getUTCFullYear();

    from(this.supabaseService.getCategoryScrobbles(this.normalized, start_ts, end_ts))
      .pipe(
        take(1),
        map((response) => {
          if (response.status !== 200) {
            console.error("Request failed with status:", response.status, "Error:", response.error);
            return null;
          }

          const categoryCountMap: ICategoryScrobbles = {};

          response.data.forEach((r: any) => {
            const { category, year, count } = r;

            if (!categoryCountMap[category]) {
              categoryCountMap[category] = [];
              let step = 1;

              for (let y = startYear; y <= endYear; y++) {
                for (let month = 0; month <= 11; month += step) {
                  categoryCountMap[category].push({ date: new Date(Date.UTC(y, month, 1)), count: 0 });
                }
              }
            }

            const entry = categoryCountMap[category].find(
              (e) =>
                e.date.getTime() ===
                new Date(Date.UTC(r.year ? r.year : r.date, r.month ? r.month - 1 : 0, 1)).getTime(),
            );
            if (entry) entry.count = r.count;
          });

          // Calculate top 10 categories
          const topCategories = Object.entries(categoryCountMap)
            .map(([category, entries]) => ({
              category,
              playcount: entries.reduce((sum, e) => sum + e.count, 0),
            }))
            .sort((a, b) => b.playcount - a.playcount)
            .slice(0, 10);

          this.topCategoryScrobbles.next(topCategories);

          return categoryCountMap;
        }),
        tap((response) => this.categoryScrobbles.next(response)),
      )
      .subscribe();
  }

  getTimelineSliderScrobbles(forceReload = false): Observable<IScrobble[] | null> {
    if (!this.timelineScrobbles.value || forceReload) {
      this.fetchTimelineSliderScrobbles().subscribe();
    }
    return this.timelineScrobbles.asObservable();
  }

  private fetchTimelineSliderScrobbles(): any {
    return from(this.supabaseService.getTimelineSliderScrobbles()).pipe(
      catchError((error) => {
        return of("Error occurred:", error);
      }),
      map((response) => {
        if (response.status === 200) {
          return response.data;
        } else {
          console.error("Request failed with status:", response.status);
        }
      }),
      tap((response) => this.timelineScrobbles.next(response)),
    );
  }

  getRecentTracks(page: number, pageSize: number, forceReload = false): Observable<IScrobble[] | null> {
    if (!this.recentScrobbles.value || forceReload) {
      this.fetchRecentScrobbles(page, pageSize).subscribe();
    }
    return this.recentScrobbles.asObservable();
  }

  private fetchRecentScrobbles(page: number, pageSize: number): any {
    return from(this.supabaseService.getRecentScrobbles(page, pageSize)).pipe(
      catchError((error) => {
        return of("Error occurred:", error);
      }),
      map((response) => {
        if (response.status === 200) {
          return response.data;
        } else {
          console.error("Request failed with status:", response.status);
        }
      }),
      tap((response) => this.recentScrobbles.next(response)),
    );
  }

  getAlbumScrobblesPerYear(album: string, artist: string, forceReload = false): Observable<any> {
    if (!this.scrobblesPerYear.value[artist] || !this.scrobblesPerYear.value[artist].albums[album] || forceReload) {
      this.fetchAlbumScrobblesPerYear(album, artist).subscribe();
    }

    return this.scrobblesPerYear.pipe(
      map((scrobbles) => {
        if (scrobbles[artist] && scrobbles[artist].albums && scrobbles[artist].albums[album].scrobbles) {
          return scrobbles[artist].albums[album].scrobbles;
        } else {
          return EMPTY;
        }
      }),
    );
  }

  private fetchAlbumScrobblesPerYear(album: string, artist: string): any {
    return this.http
      .get<IScrobble[]>(`${SERVER_API_URL}/scrobbles/album`, {
        params: {
          album,
          artist,
        },
        observe: "response",
      })
      .pipe(
        catchError((error) => {
          return of("Error occurred:", error);
        }),
        map((response) => {
          if (response.status === 200) {
            const scrobbles: { [year: string]: number } = {};
            response.body.forEach((entry: any) => (scrobbles[entry.year] = entry.scrobbles));
            // if there's no artist in the behaviorsubject
            if (!this.scrobblesPerYear.value[artist]) {
              this.scrobblesPerYear.value[artist] = { albums: { [album]: { scrobbles } } };
              // if there's no album in the behaviorsubject
            } else if (!this.scrobblesPerYear.value[artist].albums[album]) {
              this.scrobblesPerYear.value[artist].albums[album] = { scrobbles };
            }
            this.scrobblesPerYear.next(this.scrobblesPerYear.value);
          } else {
            console.error("Request failed with status:", response.status);
          }
        }),
      );
  }
}
