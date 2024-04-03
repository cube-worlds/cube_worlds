import { changeImageData } from "#root/bot/callback-data/image-selection.js";

export enum SelectImageButton {
  Refresh = "refresh",
  Description = "description",
  Avatar = "avatar",
  Upload = "upload",
  Done = "done",
}

export const photoKeyboard = [
  [
    {
      text: "📝 Description",
      callback_data: changeImageData.pack({
        select: SelectImageButton.Description,
      }),
    },
    {
      text: "🔄 Regenerate",
      callback_data: changeImageData.pack({
        select: SelectImageButton.Refresh,
      }),
    },
  ],
  [
    {
      text: "🦄 Change avatar",
      callback_data: changeImageData.pack({
        select: SelectImageButton.Avatar,
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
