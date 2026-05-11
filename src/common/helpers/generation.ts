import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import { sanitizeFilename, userFilePath } from '#root/common/helpers/files'
import { config } from '#root/config'
import { logger } from '#root/logger'
import FormData from 'form-data'
import fetch from 'node-fetch'

export enum ClipGuidancePreset {
  NONE = 'NONE',
  FAST_BLUE = 'FAST_BLUE',
  FAST_GREEN = 'FAST_GREEN',
  SIMPLE = 'SIMPLE',
  SLOW = 'SLOW',
  SLOWER = 'SLOWER',
  SLOWEST = 'SLOWEST',
}

export enum SDSampler {
  K_DPMPP_2S_ANCESTRAL = 'K_DPMPP_2S_ANCESTRAL',
  DDIM = 'DDIM',
  DDPM = 'DDPM',
  K_DPMPP_2M = 'K_DPMPP_2M',
  K_DPMPP_SDE = 'K_DPMPP_SDE',
  K_DPM_2 = 'K_DPM_2',
  K_DPM_2_ANCESTRAL = 'K_DPM_2_ANCESTRAL',
  K_EULER = 'K_EULER',
  K_EULER_ANCESTRAL = 'K_EULER_ANCESTRAL',
  K_HEUN = 'K_HEUN',
  K_LMS = 'K_LMS',
}

interface MinimalResponse {
  ok: boolean
  text: () => Promise<string>
  json: () => Promise<unknown>
}

export interface ImageGeneratorDependencies {
  fetch: (
    url: string,
    init: { method: string, headers: Record<string, string>, body: unknown },
  ) => Promise<MinimalResponse>
  readFileSync: (filePath: string) => Buffer
  writeFileSync: (filePath: string, data: Buffer) => void
  resolveOutputPath: (username: string, adminIndex: number) => string
  apiKey: () => string | undefined
  errorLog: (message: string) => void
}

function createDefaultImageGeneratorDependencies(): ImageGeneratorDependencies {
  return {
    fetch: fetch as unknown as ImageGeneratorDependencies['fetch'],
    readFileSync: fs.readFileSync as unknown as ImageGeneratorDependencies['readFileSync'],
    writeFileSync: fs.writeFileSync as unknown as ImageGeneratorDependencies['writeFileSync'],
    resolveOutputPath: (username, adminIndex) =>
      userFilePath(username, `${sanitizeFilename(username)}_${adminIndex}.png`),
    apiKey: () => config.STABILITY_API_KEY,
    errorLog: (msg) => logger.error(msg),
  }
}

interface GenerationArtifact {
  base64: string
  seed: number
  finishReason: string
}

interface GenerationResponse {
  artifacts: GenerationArtifact[]
}

export function buildImageGenerator(
  deps: ImageGeneratorDependencies = createDefaultImageGeneratorDependencies(),
) {
  async function generate(
    filePath: string,
    adminIndex: number,
    username: string,
    positive: string,
    negative: string,
    strength: number,
    scale: number,
    steps: number,
    preset: ClipGuidancePreset,
    sampler: SDSampler,
  ): Promise<string> {
    const engineId = 'stable-diffusion-v1-6'
    const apiHost = 'https://api.stability.ai'
    const apiKey = deps.apiKey()

    if (!apiKey) throw new Error('Missing Stability API key.')

    const formData = new FormData()
    formData.append('init_image', deps.readFileSync(filePath))
    formData.append('init_image_mode', 'IMAGE_STRENGTH')
    formData.append('image_strength', strength)
    formData.append('style_preset', 'pixel-art')
    formData.append('text_prompts[0][text]', positive)
    formData.append('text_prompts[0][weight]', '1')
    formData.append('text_prompts[1][text]', negative)
    formData.append('text_prompts[1][weight]', '-1')
    formData.append('cfg_scale', scale)
    formData.append('clip_guidance_preset', preset)
    formData.append('steps', steps)
    formData.append('seed', '0')
    formData.append('sampler', sampler)
    formData.append('samples', 1)

    const response = await deps.fetch(
      `${apiHost}/v1/generation/${engineId}/image-to-image`,
      {
        method: 'POST',
        headers: {
          ...formData.getHeaders(),
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      },
    )

    if (!response.ok) {
      throw new Error(`Non-200 response: ${await response.text()}`)
    }

    const json = (await response.json()) as GenerationResponse

    const artifact = json.artifacts[0]
    if ('finishReason' in artifact) {
      if (artifact.finishReason === 'SUCCESS') {
        const fp = deps.resolveOutputPath(username, adminIndex)
        deps.writeFileSync(fp, Buffer.from(artifact.base64, 'base64'))
        return fp
      }
      throw new Error(artifact.finishReason)
    }
    deps.errorLog(`Unknown generation error: ${json}`)
    throw new Error(`Unknown generation error: ${json}`)
  }

  return { generate }
}

const defaultImageGenerator = buildImageGenerator()

export const generate = defaultImageGenerator.generate
