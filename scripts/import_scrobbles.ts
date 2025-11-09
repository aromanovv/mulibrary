import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const supabase = createClient(process.env["SB_URL"]!, process.env["SB_SECRET"]!);

const importScrobbles = async () => {
  const { data, error } = await supabase
    .from("scrobbles")
    .select("timestamp")
    .order("timestamp", { ascending: false })
    .limit(1);

  if (data && data[0].timestamp) {
    const timestamp = data[0].timestamp + 1;
    let page = 1;
    let lastPage = 2;
    let nowPlaying = "";

    while (page <= lastPage) {
      const res = await fetch(
        `https://ws.audioscrobbler.com/2.0/?method=user.getRecentTracks&api_key=${process.env.LFM_KEY}&token=${process.env.LFM_TOKEN}&user=${process.env.LFM_USER}&limit=200&format=json&from=${timestamp}&page=${page}`
      );
      const tracks: any = await res.json();

      lastPage = tracks.recenttracks["@attr"].totalPages;

      for (let i = 0; i < tracks.recenttracks.track.length; i++) {
        const res = tracks.recenttracks.track[i];

        if (res["@attr"] && res["@attr"].nowplaying) {
        } else {
          await supabase
            .from("scrobbles")
            .insert([
              { name: res.name, artist: res.artist["#text"], album: res.album["#text"], timestamp: res.date.uts },
            ]);
        }
      }
      page++;
    }
  }
};

importScrobbles();
