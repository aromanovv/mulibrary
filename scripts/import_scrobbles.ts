import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

// Initialize Supabase client
const supabase = createClient(process.env["SB_URL"]!, process.env["SB_SECRET"]!);

const importScrobbles = async () => {
  console.log("Starting scrobble import...");

  // Get the most recent timestamp from your database
  const { data, error } = await supabase
    .from("scrobbles")
    .select("timestamp")
    .order("timestamp", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Error fetching latest scrobble:", error);
    return;
  }

  if (data && data.length > 0 && data[0].timestamp) {
    const timestamp = data[0].timestamp + 1;
    let page = 1;
    let lastPage = 2;

    // 1. Arrays and Objects to hold our aggregated data
    const scrobblesToInsert: any[] = [];
    const artistIncrements: Record<string, number> = {};
    const albumIncrements: Record<string, number> = {};

    while (page <= lastPage) {
      console.log(`Fetching page ${page}...`);
      const res = await fetch(
        `https://ws.audioscrobbler.com/2.0/?method=user.getRecentTracks&api_key=${process.env["LFM_KEY"]}&token=${process.env["LFM_TOKEN"]}&user=${process.env["LFM_USER"]}&limit=200&format=json&from=${timestamp}&page=${page}`,
      );
      const tracks: any = await res.json();

      if (!tracks?.recenttracks) break;
      lastPage = parseInt(tracks.recenttracks["@attr"].totalPages, 10);

      // Last.fm sometimes returns a single object instead of an array if there's only 1 track
      const trackList = Array.isArray(tracks.recenttracks.track)
        ? tracks.recenttracks.track
        : [tracks.recenttracks.track];

      for (const track of trackList) {
        // Skip null tracks or tracks currently playing (no final timestamp yet)
        if (!track || (track["@attr"] && track["@attr"].nowplaying)) continue;

        const artistName = track.artist["#text"];
        const albumName = track.album["#text"];

        // Queue up the insert
        scrobblesToInsert.push({
          name: track.name,
          artist: artistName,
          album: albumName,
          timestamp: parseInt(track.date.uts, 10),
        });

        // Aggregate new artist scrobbles
        if (artistName) {
          artistIncrements[artistName] = (artistIncrements[artistName] || 0) + 1;
        }

        // Aggregate new album scrobbles (Using a combined key so we don't mix up identical album names by different artists)
        if (artistName && albumName) {
          const albumKey = `${artistName}|||${albumName}`;
          albumIncrements[albumKey] = (albumIncrements[albumKey] || 0) + 1;
        }
      }
      page++;
    }

    // --- BATCH EXECUTIONS ---

    if (scrobblesToInsert.length > 0) {
      console.log(`Preparing to insert ${scrobblesToInsert.length} new scrobbles...`);

      // 2. ONE call to insert all new scrobbles
      const { error: insertError } = await supabase.from("scrobbles").insert(scrobblesToInsert);

      if (insertError) {
        console.error("Scrobble insert error:", insertError);
        return; // Stop here if the insert fails
      }
      console.log(`Successfully inserted ${scrobblesToInsert.length} scrobbles.`);

      // 3. Format the data for our bulk RPCs
      const artistPayload = Object.entries(artistIncrements).map(([artist, inc]) => ({
        artist: artist,
        increment: inc,
      }));

      const albumPayload = Object.entries(albumIncrements).map(([key, inc]) => {
        const [artist, album] = key.split("|||");
        return { artist, album, increment: inc };
      });

      // 4. ONE call to bulk update artists
      console.log(`Updating counts for ${artistPayload.length} artists...`);
      const { error: artistError } = await supabase.rpc("bulk_increment_artists", {
        payload: artistPayload,
      });
      if (artistError) console.error("Artist update error:", artistError);

      // 5. ONE call to bulk update albums
      console.log(`Updating counts for ${albumPayload.length} albums...`);
      const { error: albumError } = await supabase.rpc("bulk_increment_albums", {
        payload: albumPayload,
      });
      if (albumError) console.error("Album update error:", albumError);

      console.log("Finished bulk updating artist and album counts.");
    } else {
      console.log("No new scrobbles to import.");
    }
  } else {
    console.log("Could not find a starting timestamp in the database.");
  }
};

importScrobbles();
