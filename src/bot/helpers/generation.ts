import fetch from "node-fetch";
import FormData from "form-data";
import fs from "node:fs";
import { config } from "#root/config.js";

export async function generate(
  filePath: string,
  index: number,
): Promise<string> {
  const engineId = "stable-diffusion-v1-6"; // "stable-diffusion-xl-1024-v1-0",
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

  formData.append("style_preset", "pixel-art");

  formData.append(
    "text_prompts[0][text]",
    "fully pixel professional 3d cartoon portrait, beautiful big cartoon eyes, pixar art style character, octane render, highly detailed, golden hour",
  );
  formData.append("text_prompts[0][weight]", "1");

  // negative
  formData.append(
    "text_prompts[1][text]",
    "glasses, photographic, photo, worst quality, bad eyes, bad anatomy, comics, cropped, cross-eyed, ugly, deformed, glitch, mutated, watermark, worst quality, unprofessional, jpeg artifacts, low quality",
  );
  formData.append("text_prompts[1][weight]", "-1");

  // [1 - 30] when 1 - mostly ignore the prompt, 30 - strictly follow
  formData.append("cfg_scale", 7);

  formData.append("steps", 30);

  // 0 - random
  formData.append("seed", "0");

  // DDIM, DDPM, K_DPMPP_2M, K_DPMPP_2S_ANCESTRAL,
  // K_DPMPP_SDE, K_DPM_2, K_DPM_2_ANCESTRAL, K_EULER,
  // K_EULER_ANCESTRAL, K_HEUN, K_LMS.
  formData.append("sampler", "K_DPMPP_2S_ANCESTRAL");

  // DO NOT CHANGE
  formData.append("samples", 1);

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

  const artifact = responseJSON.artifacts[0];
  if (artifact.finishReason === "SUCCESS") {
    const fp = `./data/${index}/${index}.png`;
    fs.writeFileSync(fp, Buffer.from(artifact.base64, "base64"));
    return fp;
  }
  throw artifact.finishReason;
}
