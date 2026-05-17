export const THUMBNAIL_PRESETS = [
  "bold-text",
  "question",
  "numbered-list",
  "reaction",
] as const;

export type ThumbnailPreset = (typeof THUMBNAIL_PRESETS)[number];

export interface ThumbnailContext {
  title: string;
  topic: string;
  firstSlideTitle?: string;
  numberHook?: string;
}

export const THUMB_WIDTH = 1280;
export const THUMB_HEIGHT = 720;
