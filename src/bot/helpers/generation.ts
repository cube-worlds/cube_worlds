import fetch from "node-fetch";
import FormData from "form-data";
import fs from "node:fs";
import { config } from "#root/config";

export async function generate(filePath: string) {
  const engineId = "stable-diffusion-v1-6";
  const apiHost = "https://api.stability.ai";
  const apiKey = config.STABILITY_API_KEY;

  if (!apiKey) throw new Error("Missing Stability API key.");

  // NOTE: This example is using a NodeJS FormData library.
  // Browsers should use their native FormData class.
  // React Native apps should also use their native FormData class.
  const formData = new FormData();
  formData.append("init_image", fs.readFileSync(filePath));
  formData.append("init_image_mode", "IMAGE_STRENGTH");
  formData.append("image_strength", 0.35);
  formData.append(
    "text_prompts[0][text]",
    "fighter character mortal combat poster style",
  );
  formData.append("cfg_scale", 7);
  formData.append("samples", 1);
  formData.append("steps", 30);

  const response = await fetch(
    `${apiHost}/v1/generation/${engineId}/image-to-image`,
    {
      method: "POST",
      headers: {
        ...formData.getHeaders(),
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    },
  );

  if (!response.ok) {
    throw new Error(`Non-200 response: ${await response.text()}`);
  }

  interface GenerationResponse {
    artifacts: Array<{
      base64: string;
      seed: number;
      finishReason: string;
    }>;
  }

  const responseJSON = (await response.json()) as GenerationResponse;

  // eslint-disable-next-line no-restricted-syntax
  for (const [index, image] of responseJSON.artifacts.entries()) {
    fs.writeFileSync(
      `v1_img2img_${index}.png`,
      Buffer.from(image.base64, "base64"),
    );
  }
}
