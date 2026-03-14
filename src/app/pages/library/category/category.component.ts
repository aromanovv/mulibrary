import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { ScrobbleService } from "src/app/core/services/scrobble.service";
import { ICategoryScrobbles } from "src/app/shared/models/scrobble.model";
import { normalizeName } from "src/app/shared/utils/normalize-name.util";
import * as d3 from "d3";

@Component({
  selector: "app-category",
  standalone: false,
  templateUrl: "./category.component.html",
  styleUrls: ["./category.component.css"],
})
export class CategoryComponent implements OnInit {
  categoryName: string = "";
  categoryColor: string = "#888888"; // Fallback color
  artistData: ICategoryScrobbles | null = null;
  artistColorMap: Record<string, string> = {};
  offset = d3.stackOffsetWiggle;

  constructor(
    private route: ActivatedRoute,
    private scrobbleService: ScrobbleService,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get("category");
      if (slug) {
        this.loadCategoryData(slug);
      }
    });
  }

  private loadCategoryData(slug: string) {
    // 1. Fetch the color map first to reverse-lookup the exact category name
    this.scrobbleService.getCategoryColors().subscribe((colors) => {
      if (!colors) return;

      // Find the exact database name (e.g. "Hardcore & Crossover") by matching slugs
      const exactName = Object.keys(colors).find((key) => normalizeName(key) === slug);

      if (!exactName) {
        console.error(`Could not find category matching slug: ${slug}`);
        return;
      }

      this.categoryName = exactName;
      this.categoryColor = colors[exactName];

      // 2. Now fetch the artist data using the exact capitalized name
      this.scrobbleService.getCategoryArtistsScrobbles(this.categoryName, 2).subscribe((data) => {
        if (!data) return;
        this.artistData = data;
        this.generateArtistColors(data);
      });
    });
  }

  private generateArtistColors(data: ICategoryScrobbles) {
    const artists = Object.keys(data);
    const base = d3.hsl(this.categoryColor);

    this.artistColorMap = {};
    const n = artists.length;

    // Determine the hue spread.
    // 1-5 artists: 0 hue shift (pure monochrome).
    // >5 artists: gradually widen the hue span up to a maximum of 60 degrees (+/- 30 degrees).
    const hueSpan = n > 5 ? Math.min(60, (n - 5) * 4) : 0;

    artists.forEach((artist, i) => {
      // t goes from 0 to 1 across the array
      const t = n > 1 ? i / (n - 1) : 0.5;

      // centeredT goes from -0.5 (first item) to 0 (middle item) to +0.5 (last item)
      const centeredT = t - 0.5;

      // 1. HUE: Shift slightly around the base hue, maxing out at +/- 30 degrees
      const h = base.h + centeredT * hueSpan;

      // 2. LIGHTNESS: Anchor the exact base color in the middle (centeredT = 0)
      let l;
      if (centeredT < 0) {
        // Map the lower half from 15% lightness (very dark) up to the exact base lightness
        l = base.l + centeredT * 2 * (base.l - 0.15);
      } else {
        // Map the upper half from the exact base lightness up to 85% lightness (very bright)
        l = base.l + centeredT * 2 * (0.85 - base.l);
      }

      // Safety clamp just in case D3 tries to render pure black or white
      l = Math.max(0.1, Math.min(0.9, l));

      // 3. Keep the original saturation intact!
      const c = d3.hsl(h, base.s, l);
      this.artistColorMap[artist] = c.formatHex();
    });
  }
}
