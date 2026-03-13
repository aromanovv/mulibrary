import { Genre } from "./genre.model";
import { Track } from "./track.model";

export interface IAlbum {
  name: string;
  artist?: string[];
  artist_id?: number[];
  year?: number;
  genre?: Genre[] | string[];
  artwork?: string[];
  tracks?: number[];
  id?: number;
  other_names?: string[];
  category?: string;
  scrobbles?: number;
  duration?: number;
  first_listen_date?: number;
  rating?: number;
  review?: string;
  history?: any[];
}

export class Album implements IAlbum {
  constructor(
    public name: string,
    public artist?: string[],
    public artist_id?: number[],
    public year?: number,
    public genre?: Genre[] | string[],
    public artwork?: string[],
    public id?: number,
    public tracks?: number[],
    public other_names?: string[],
    public category?: string,
    public scrobbles?: number,
    public duration?: number,
    public first_listen_date?: number,
    public rating?: number,
    public review?: string,
    public history = [],
  ) {
    this.tracks = [];
    this.artwork = [];
  }
}
