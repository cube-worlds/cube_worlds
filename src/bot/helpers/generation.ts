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
    // "2D Vector Illustration of a child with soccer ball Art for Sublimation, Design Art, Chrome Art, Painting and Stunning Artwork, Highly Detailed Digital Painting, Airbrush Art, Highly Detailed Digital Artwork, Dramatic Artwork, stained antique yellow copper paint, digital airbrush art, detailed by Mark Brooks, Chicano airbrush art, Swagger! snake Culture",
    // "generate a collage-style illustration inspired by the Procreate raster graphic editor, photographic illustration with the theme, 2D vector, art for textile sublimation, containing surrealistic cartoon cat wearing a baseball cap and jeans standing in front of a poster, inspired by Sadao Watanabe, Doraemon, Japanese cartoon style, Eichiro Oda, Iconic high detail character, Director: Nakahara Nantenbō, Kastuhiro Otomo, image detailed, by Miyamoto, Hidetaka Miyazaki, Katsuhiro illustration, 8k, masterpiece, Minimize noise and grain in photo quality without lose quality and increase brightness and lighting,Symmetry and Alignment, Avoid asymmetrical shapes and out-of-focus points. Focus and Sharpness: Make sure the image is focused and sharp and encourages the viewer to see it as a work of art printed on fabric.",
    // "Renaissance-style portrait of an astronaut in space, detailed starry background, reflective helmet.",
    // "Art Nouveau painting of a female botanist surrounded by exotic plants in a greenhouse.",
    // "High-fashion photography in an abandoned industrial warehouse, with dramatic lighting and edgy outfits.”",
    // "8-bit pixel portrait video game character in a retro platformer.",
    // "cartoon character of a person with a hoodie , in style of cytus and deemo, ork, gold chains, realistic anime cat, dripping black goo, lineage revolution style, thug life, cute anthropomorphic bunny, balrog, arknights, aliased, very buff, black and red and yellow paint, painting illustration collage style, character composition in vector with white background",
    // "generate a collage-style illustration inspired by the Procreate raster graphic editor, photographic illustration with the theme, 2D vector, art for textile sublimation, containing surrealistic cartoon cat wearing a baseball cap and jeans standing in front of a poster, inspired by Sadao Watanabe, Doraemon, Japanese cartoon style, Eichiro Oda, Iconic high detail character, Director: Nakahara Nantenbō, Kastuhiro Otomo, image detailed, by Miyamoto, Hidetaka Miyazaki, Katsuhiro illustration, 8k, masterpiece, Minimize noise and grain in photo quality without lose quality and increase brightness and lighting,Symmetry and Alignment, Avoid asymmetrical shapes and out-of-focus points. Focus and Sharpness: Make sure the image is focused and sharp and encourages the viewer to see it as a work of art printed on fabric.",
    // "Iron Man, Masterpiece, Studio Quality, 6k , toa, toaair, 1boy, glowing, axe, mecha, science_fiction, solo, weapon, jungle , green_background, nature, outdoors, solo, tree, weapon, mask, dynamic lighting, detailed shading, digital texture painting",
    // "Alphonse Mucha pixiv vintage",
    // "filthy treasure hunter with a filthy guitar in a amazing amusement park, foggy, dark, grimdark, wonderful, magical, post-apocalyptic, dim, magnificent, oil painting, motion lines, eyes focus, steampunk, astrophotography, masterpiece, absurdres, trending on artstation, 3840×2160, volumetric lighting, sharp focus, HQ, detailed",
    // "memoji style digital avatar, an optimistic individual with a bright smile, radiating positivity",
    // "2D digital avatar, pixiv, vintage",
    // "blue pen ink drawing of adventure character",
    // "Blue pen and wash picture of the face and shoulders of a hedgehog in semi profile with a happy face, face in the center of the frame, semi profile, with sharp blue lines, no fill color just the outline, plain white background with no fill, in the style of Michelangelo sketch, makes the viewer happy",
    // "sketch, bold use of line, in the style of Peter Paul Rubens, light gray, intense close-ups, i can't believe how beautiful this",
    // "fully pixed professional 3d cartoon portrait of hero adventure warrior with melee weapon, beautiful big cartoon eyes, pixar art style character, octane render, highly detailed, golden hour",
    "fully pixel professional 3d cartoon portrait, beautiful big cartoon eyes, pixar art style character, octane render, highly detailed, golden hour",
  );
  formData.append("text_prompts[0][weight]", "1");

  // negative
  formData.append(
    "text_prompts[1][text]",
    // "un-detailed skin, semi-realistic, 3d, render, drawing, ugly eyes, (out of frame:1.3), worst quality, low quality, jpeg artifacts, cgi, sketch, drawing, (out of frame:1.1)",
    "photographic, photo, worst quality, bad eyes, bad anatomy, comics, cropped, cross-eyed, ugly, deformed, glitch, mutated, watermark, worst quality, unprofessional, jpeg artifacts, low quality",
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

  // TO NOT CHANGE
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
