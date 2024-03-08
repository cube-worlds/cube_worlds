import { changeImageData } from "#root/bot/callback-data/image-selection.js";

export enum SelectImageButton {
  Refresh = "refresh",
  Description = "description",
  Upload = "upload",
  Done = "done",
}

export const photoKeyboard = [
  [
    {
      text: "🔄 Regenerate",
      callback_data: changeImageData.pack({
        select: SelectImageButton.Refresh,
      }),
    },
    {
      text: "📝 Description",
      callback_data: changeImageData.pack({
        select: SelectImageButton.Description,
      }),
    },
  ],
  [
    {
      text: "🚀 IPFS",
      callback_data: changeImageData.pack({
        select: SelectImageButton.Upload,
      }),
    },
    {
      text: "✅ Mint",
      callback_data: changeImageData.pack({
        select: SelectImageButton.Done,
      }),
    },
  ],
];
