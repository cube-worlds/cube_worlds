import { changeImageData } from "#root/bot/callback-data/image-selection.js";

export enum SelectImageButton {
  Refresh = "image-refresh",
  Done = "image-done",
}

export const photoKeyboard = [
  [
    {
      text: "🔄 Refresh",
      callback_data: changeImageData.pack({
        select: SelectImageButton.Refresh,
      }),
    },
    {
      text: "✅ Done",
      callback_data: changeImageData.pack({
        select: SelectImageButton.Done,
      }),
    },
  ],
];
