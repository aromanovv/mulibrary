// src/app/services/supabase.service.ts
import { Injectable } from "@angular/core";
import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import { BehaviorSubject, Observable, of } from "rxjs";
import { Album } from "src/app/shared/models/album.model";
import { Artist } from "src/app/shared/models/artist.model";
import { debug } from "src/app/shared/utils/debug-util";
import { environment } from "src/environments/environment";

@Injectable({
  providedIn: "root",
})
export class SupabaseService {
  from(arg0: string) {
    throw new Error("Method not implemented.");
  }
  private supabase: SupabaseClient;
  private readonly adminUid = "67b2ed58-6fbc-4b81-8b29-bb4b493dbdc0";
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
    this.supabase.auth.onAuthStateChange((event, session) => {
      this.currentUserSubject.next(session?.user ?? null);
    });
    this.loadUser();
  }

  // Getter to access the client
  get client() {
    return this.supabase;
  }

  async loadUser() {
    const { data } = await this.supabase.auth.getUser();
    this.currentUserSubject.next(data.user);
  }

  async signIn(email: string, password: string) {
    return await this.supabase.auth.signInWithPassword({ email, password });
  }

  async signOut() {
    const result = await this.supabase.auth.signOut();
    this.currentUserSubject.next(null);
    return result;
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  isAdmin(): boolean {
    return !!this.getCurrentUser();
  }

  async upsertReview(album_id: number, rating: number, review: string) {
    return await this.supabase.rpc("upsert_album_review_rating", {
      id: album_id,
      new_rating: rating,
      new_review: review,
    });
  }

  async getArtistByName(artistName: string) {
    return await this.supabase.rpc("get_artist_by_name", {
      artist_name_input: artistName,
    });
  }

  async getAlbumTracks(artist: string, album: string) {
    return await this.supabase.rpc("get_album_tracks", {
      artist_name_input: artist,
      album_name_input: album,
    });
  }

  async getAlbumByName(artist: string, album: string) {
    return await this.supabase.rpc("get_album_by_name", {
      artist_name_input: artist,
      album_name_input: album,
    });
  }

  async getAlbumsByArtistName(artistName: string) {
    return await this.supabase.rpc("get_albums_by_artist_name", {
      artist_name_input: artistName,
    });
  }

  async getArtistAlbumHistory(artistName: string, period: string) {
    return await this.supabase.rpc("get_artist_album_history", {
      artist_name_input: artistName,
      time_interval: period,
    });
  }

  // Or create specific methods
  async getTopArtists(start_ts: number, end_ts: number) {
    return await this.supabase.rpc("top_artists", {
      start_ts,
      end_ts,
    });
  }

  async getTopAlbums(start_ts: number, end_ts: number) {
    return await this.supabase.rpc("top_albums", {
      start_ts,
      end_ts,
      limit_count: 10,
    });
  }

  async getRecentReviews() {
    return await this.supabase.rpc("get_recent_reviews");
  }

  async getListeningBacklog(start_ts: any, end_ts: any) {
    return await this.supabase.rpc("get_listening_backlog", { start_ts, end_ts, limit_count: 10 });
  }

  async getCategoryScrobbles(normalized: boolean, start_ts: any, end_ts: any) {
    if (normalized) {
      return await this.supabase.rpc("get_category_scrobbles_normalized_ts", {
        start_ts,
        end_ts,
      });
    }
    return await this.supabase.rpc("get_category_scrobbles_raw_ts", {
      start_ts,
      end_ts,
    });
  }

  async getTimelineSliderScrobbles() {
    return await this.supabase.rpc("get_quarterly_listens");
  }

  async getRecentScrobbles(page: number, pageSize: number) {
    return await this.supabase.rpc("get_scrobbles_paginated", {
      page_size: pageSize,
      page_offset: page,
    });
  }

  async getTracksByArtist(artist: string) {
    const { data, error } = await this.supabase.from("tracks").select("*").contains("artists", [artist]);

    if (error) throw error;
    return data;
  }

  searchInternal(query: string): Observable<{
    artists: Artist[];
    albums: Album[];
  }> {
    if (!query.trim()) {
      return of({ artists: [], albums: [] });
    }

    return new Observable((subscriber) => {
      Promise.all([
        this.supabase.from("artist").select("name").textSearch("name", query, { type: "websearch" }),

        this.supabase
          .from("album")
          .select("name, album_artist (artist (name))")
          .textSearch("name", query, { type: "websearch" }),
      ])
        .then(([artists, albums]) => {
          if (artists.error) console.debug(artists.error);
          if (albums.error) console.debug(albums.error);

          const results = {
            artists: (artists.data || []) as Artist[],
            albums: (albums.data || []).map((album: any) => ({
              name: album.name,
              artist: album.album_artist.map((aa: any) => aa.artist.name),
            })) as Album[],
          };

          subscriber.next(results);
          subscriber.complete();
        })
        .catch((error) => subscriber.error(error));
    });
  }
}
