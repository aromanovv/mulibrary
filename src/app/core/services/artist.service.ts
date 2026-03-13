import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable, catchError, filter, from, map, of, tap } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { SERVER_API_URL } from "src/app/app.constants";
import { Artist } from "src/app/shared/models/artist.model";
import { Scrobble } from "src/app/shared/models/scrobble.model";
import { ITreenode } from "src/app/shared/models/treenode.model";
import { normalizeName } from "src/app/shared/utils/normalize-name.util";
import { debug } from "src/app/shared/utils/debug-util";
import { SupabaseService } from "./supabase.service";

@Injectable({ providedIn: "root" })
export class ArtistService {
  artists: BehaviorSubject<Artist[]> = new BehaviorSubject<Artist[]>([]);
  // TODO: this is huh what?    v
  artistNodes: BehaviorSubject<ITreenode[]> = new BehaviorSubject<ITreenode[]>([]);

  constructor(
    private http: HttpClient,
    private supabaseService: SupabaseService,
  ) {}

  getArtists(forceReload = false): Observable<any> {
    if (this.artistNodes.value.length === 0 || forceReload) {
      this.fetchArtists().subscribe();
    }
    return this.artistNodes.pipe(filter((artists) => artists && artists.length > 0));
  }

  fetchArtists(): any {
    return this.http
      .get<ITreenode[]>(`${SERVER_API_URL}/artist/all`, {
        observe: "response",
      })
      .pipe(
        catchError((error) => {
          return of("Error occurred:", error);
        }),
        map((response) => {
          if (response.status === 200) {
            this.artistNodes.next(response.body);
          } else {
            console.error("Request failed with status:", response.status);
          }
        }),
      );
  }

  getArtistByName(name: string, forceReload = false): Observable<Artist> {
    // 1. Normalize the input once for the checks
    const normalizedSearch = normalizeName(name);

    // 2. Helper function to check both the main name and the other_names array
    const isMatch = (artist: Artist) => {
      if (normalizeName(artist.name) === normalizedSearch) return true;
      if (artist.other_names && artist.other_names.length > 0) {
        return artist.other_names.some((alias) => normalizeName(alias) === normalizedSearch);
      }
      return false;
    };

    // 3. Check the cache using our new logic (fixed the artist.category bug here!)
    const foundInCache = this.artists.value.find(isMatch);

    if (this.artists.value.length === 0 || forceReload || !foundInCache) {
      this.fetchArtistByName(name).subscribe();
    }

    // 4. Return the first artist that matches the main name OR an alias
    // 4. Return the first artist that matches, filtering out undefined
    return this.artists.pipe(
      map((artists) => artists.find(isMatch)),
      filter((artist): artist is Artist => !!artist), // <-- This type-guard fixes the error!
    );
  }

  fetchArtistByName(artist: string): any {
    return from(this.supabaseService.getArtistByName(artist)).pipe(
      catchError((error) => {
        return of(error);
      }),
      map((response) => {
        if (response.status === 200) {
          return response.data;
        } else {
          console.error("fetchArtistByName() Request failed:", response, "Error:", response.error);
        }
      }),
      tap((response) => {
        this.artists.next(Array.from(new Set([...this.artists.value, ...response])));
      }),
    );
  }

  getArtistsByCategory(category: string, forceReload = false): Observable<Artist[]> {
    if (
      this.artists.value.length === 0 ||
      forceReload ||
      !this.artists.value.find((artist) => artist.category === category)
    ) {
      this.fetchArtistsByCategory(category).subscribe();
    }
    return this.artists.pipe(
      map((artists) => {
        return artists.filter((artist) => {
          return artist.category && normalizeName(artist.category) === category;
        });
      }),
      filter((artists) => {
        debug("Getting artists:", artists, "by category", category);
        return artists.length > 0;
      }),
    );
  }

  fetchArtistsByCategory(category: string): any {
    return this.http
      .get<Artist[]>(`${SERVER_API_URL}/artist/category`, {
        params: {
          category,
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
          this.artists.next(Array.from(new Set([...this.artists.value, ...response])));
        }),
      );
  }
}
