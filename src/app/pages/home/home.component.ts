import { Component, OnInit } from "@angular/core";
import { take } from "rxjs";
import { AlbumService } from "src/app/core/services/album.service";
import { ScrobbleService } from "src/app/core/services/scrobble.service";

@Component({
  selector: "app-home",
  standalone: false,
  templateUrl: "./home.component.html",
  styleUrl: "./home.component.css",
})
export class HomeComponent implements OnInit {
  constructor(
    private scrobbleService: ScrobbleService,
    private albumService: AlbumService,
  ) {}
  ngOnInit(): void {
    this.albumService.getBacklog().pipe(take(1)).subscribe();
    this.albumService.getRecentReviews().pipe(take(1)).subscribe();
    this.scrobbleService.getRecentTracks(1, 10).pipe(take(1)).subscribe();
    this.scrobbleService.getTopAlbums(3).pipe(take(1)).subscribe();
    this.scrobbleService.getTopArtists(3).pipe(take(1)).subscribe();
    this.scrobbleService.getTopCategories().pipe(take(1)).subscribe();
    this.scrobbleService.getCategoryScrobbles().pipe(take(1)).subscribe();
    this.scrobbleService.getTimelineSliderScrobbles().pipe(take(1)).subscribe();
  }
}
