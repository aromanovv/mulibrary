import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { ScrobbleService } from "src/app/core/services/scrobble.service";
import { ICategoryScrobbles } from "src/app/shared/models/scrobble.model";
import * as d3 from "d3";

@Component({
  selector: "app-category",
  standalone: false,
  templateUrl: "./category.component.html",
  styleUrls: ["./category.component.css"],
})
export class CategoryComponent implements OnInit {
  categoryName: string = "";
  artistData: ICategoryScrobbles | null = null;
  artistColorMap: Record<string, string> = {};

  constructor(
    private route: ActivatedRoute,
    private scrobbleService: ScrobbleService,
  ) {}

  ngOnInit(): void {
    // Subscribe to route parameters so the page updates if you click from one category to another
    this.route.paramMap.subscribe((params) => {
      const slug = params.get("category");
      if (slug) {
        // NOTE: If your API requires the exact capitalized name (e.g. "Post-rock"),
        // you may need to map the URL slug ("post-rock") back to its original spelling.
        this.categoryName = this.unNormalizeName(slug);
        this.loadCategoryData();
      }
    });
  }

  private loadCategoryData() {
    this.scrobbleService.getCategoryArtistsScrobbles(this.categoryName).subscribe((data) => {
      if (!data) return;

      this.artistData = data;
      this.generateArtistColors(data);
    });
  }

  private generateArtistColors(data: ICategoryScrobbles) {
    const artists = Object.keys(data);

    // Use a built-in D3 color palette designed for distinct categories
    const colorScale = d3.scaleOrdinal<string>(d3.schemeTableau10).domain(artists);

    this.artistColorMap = {};
    artists.forEach((artist) => {
      this.artistColorMap[artist] = colorScale(artist);
    });
  }

  // Quick helper to turn URL slugs back into human-readable strings if needed
  private unNormalizeName(slug: string): string {
    return slug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
}
