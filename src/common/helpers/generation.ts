import { Buffer } from 'node:buffer'
import fs from 'node:fs'
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

export async function generate(
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
    const engineId = 'stable-diffusion-v1-6' // "stable-diffusion-xl-1024-v1-0",
    const apiHost = 'https://api.stability.ai'
    const apiKey = config.STABILITY_API_KEY

    if (!apiKey)
        throw new Error('Missing Stability API key.')

    const formData = new FormData()
    formData.append('init_image', fs.readFileSync(filePath))
    formData.append('init_image_mode', 'IMAGE_STRENGTH')

    // Close to 1 will yield images very similar to the init_image
    // while values close to 0 will yield images wildly different
    formData.append('image_strength', strength) // default: 0.35

    // 3d-model analog-film anime cinematic comic-book digital-art enhance fantasy-art isometric
    // line-art low-poly modeling-compound neon-punk origami photographic pixel-art tile-texture
    formData.append('style_preset', 'pixel-art')

    formData.append('text_prompts[0][text]', positive)
    formData.append('text_prompts[0][weight]', '1')

    formData.append('text_prompts[1][text]', negative)
    formData.append('text_prompts[1][weight]', '-1')

    // How strictly the diffusion process adheres to the prompt text
    // (higher values keep your image closer to your prompt)
    // [ 0 .. 35 ]
    formData.append('cfg_scale', scale) // default: 7

    // [FAST_BLUE, FAST_GREEN, NONE, SIMPLE, SLOW, SLOWER, SLOWEST]
    formData.append('clip_guidance_preset', preset) // default: NONE

    // [ 10 .. 50 ]
    formData.append('steps', steps) // default: 30

    // 0 - random
    formData.append('seed', '0')

    // DDIM, DDPM, K_DPMPP_2M, K_DPMPP_2S_ANCESTRAL, K_DPMPP_SDE, K_DPM_2
    // K_DPM_2_ANCESTRAL, K_EULER, K_EULER_ANCESTRAL, K_HEUN, K_LMS
    formData.append('sampler', sampler)

    // DO NOT CHANGE
    formData.append('samples', 1)

    const response = await fetch(`${apiHost}/v1/generation/${engineId}/image-to-image`, {
        method: 'POST',
        headers: {
            ...formData.getHeaders(),
            Accept: 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
    })

    if (!response.ok) {
        throw new Error(`Non-200 response: ${await response.text()}`)
    }

    interface GenerationResponse {
        artifacts: Array<{
            base64: string
            seed: number
            finishReason: string
        }>
    }

    const json = await response.json()
    const generationResponse = json as GenerationResponse

    const artifact = generationResponse.artifacts[0]
    if ('finishReason' in artifact) {
        if (artifact.finishReason === 'SUCCESS') {
            const fp = `./data/${username}/${username}_${adminIndex}.png`
            fs.writeFileSync(fp, Buffer.from(artifact.base64, 'base64'))
            return fp
        }
        throw new Error(artifact.finishReason)
    }
    logger.error(`Unknown generation error: ${json}`)
    throw new Error(`Unknown generation error: ${json}`)
}
