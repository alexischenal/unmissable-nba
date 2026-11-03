// src/config/gifs.ts
// The GIFs of the empty screens, from GIPHY (media.giphy.com): the official files, never a copy here.
// One is picked at random per visit, so returning visitors don't always see the same one.
// id: the end of the GIPHY page address (giphy.com/gifs/futurama-…-<id>). alt: what happens in it.

export type Gif = { id: string; alt: string };

// "No games last night"
export const EMPTY_NIGHT_GIFS: Gif[] = [];
