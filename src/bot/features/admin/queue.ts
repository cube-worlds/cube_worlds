import type { Context } from '#root/bot/context'
import type { NFTMintParameters } from '#root/common/helpers/nft-item'
import type { PhotoSize } from '@grammyjs/types'
import { changeImageData } from '#root/bot/callback-data/image-selection'
import { isAdmin } from '#root/bot/filters/is-admin'
import { photoKeyboard, SelectImageButton } from '#root/bot/keyboards/photo'
import { photoCaption, queueMenu, sendUserMetadata } from '#root/bot/keyboards/queue-menu'
import { randomAttributes } from '#root/common/helpers/attributes'
import { ClipGuidancePreset, generate, SDSampler } from '#root/common/helpers/generation'
import { pinImageURLToIPFS, pinJSONToIPFS, unpin, warmIPFSHash } from '#root/common/helpers/ipfs'
import { logHandle } from '#root/common/helpers/logging'
import { NftCollection } from '#root/common/helpers/nft-collection'
import { NftItem } from '#root/common/helpers/nft-item'
import {
    adminIndex,
    sendPostToChannels,
    sendPreviewNFT,
    sendToGroupsNewNFT,
    // sendNewPlaces,
} from '#root/common/helpers/telegram'
import { sleep } from '#root/common/helpers/time'
import { countUsers, findUserById } from '#root/common/models/User'
import { config } from '#root/config'
import { logger } from '#root/logger'
import { Address, toNano } from '@ton/core'
import { ChatGPTAPI } from 'chatgpt'
import { Composer, InputFile } from 'grammy'

const composer = new Composer<Context>()

const feature = composer.chatType('private').filter(isAdmin)

feature.command('queue', logHandle('command-queue'), async (ctx) => {
    const count = await countUsers(false)
    return ctx.reply(ctx.t('queue.title', { count }), {
        reply_markup: queueMenu,
    })
})

feature.callbackQuery(
    changeImageData.filter(),
    logHandle('keyboard-image-select'),
    async (ctx: Context) => {
        try {
            const selectedUserId = ctx.dbuser.selectedUser
            if (!selectedUserId) {
                return ctx.reply(ctx.t('wrong'))
            }
            const selectedUser = await findUserById(selectedUserId)
            if (!selectedUser) {
                return ctx.reply(ctx.t('wrong'))
            }
            const { select } = changeImageData.unpack(ctx.callbackQuery?.data ?? '')
            try {
                await ctx.editMessageReplyMarkup()
            } catch {
                // do nothing
            }
            switch (select) {
                case SelectImageButton.Description: {
                    const api = new ChatGPTAPI({
                        apiKey: config.OPENAI_API_KEY,
                        completionParams: {
                            max_tokens: 512,
                        },
                    })
                    const name = selectedUser.name ?? ''
                    const info = ctx.dbuser.customDescription ?? selectedUser.description ?? ''
                    const result = await api.sendMessage(
                        `Write an inspiring text about a person named "${name}" who has decided to start a journey.
            You could also use additional information: "${info}", if it feels appropriate, and translate into English if not.
            Result should NOT contains terms in original language and "embarking" word. TEXT MUST BE ONLY IN ENGLISH.
            Remove any links. NOT use any quotation marks.
            Response MUST BE up to 500 characters maximum`,
                    )
                    selectedUser.nftDescription = result.text.slice(0, 700)
                    await selectedUser.save()
                    await sendUserMetadata(ctx, selectedUser)
                    break
                }

                case SelectImageButton.Refresh: {
                    if (!selectedUser.avatar) {
                        return ctx.reply(ctx.t('wrong'))
                    }
                    const username = selectedUser.name
                    if (!username)
                        return ctx.reply('Empty username')
                    ctx.chatAction = 'upload_document'
                    generate(
                        selectedUser.avatar,
                        adminIndex(ctx.dbuser.id),
                        username,
                        ctx.dbuser.positivePrompt ?? '',
                        ctx.dbuser.negativePrompt ?? '',
                        ctx.dbuser.strength ?? 0.35,
                        ctx.dbuser.scale ?? 7,
                        ctx.dbuser.steps ?? 30,
                        ctx.dbuser.preset ?? ClipGuidancePreset.NONE,
                        ctx.dbuser.sampler ?? SDSampler.K_DPMPP_2S_ANCESTRAL,
                    )
                        .then(async (generatedFilePath) => {
                            const inputFile = new InputFile(generatedFilePath)
                            // const newMedia = InputMediaBuilder.photo(inputFile);
                            const newMessage = await ctx.replyWithPhoto(inputFile, {
                                caption: photoCaption(selectedUser),
                                parse_mode: 'Markdown',
                                reply_markup: {
                                    inline_keyboard: photoKeyboard,
                                },
                            })
                            ctx.logger.info(newMessage)
                            const fileId = newMessage.photo
                                .filter((p: PhotoSize) => p.width === p.height)
                                .sort(
                                    (a: PhotoSize, b: PhotoSize) =>
                                        (b.file_size ?? b.width) - (a.file_size ?? a.width),
                                )[0]
                                .file_id
                            const file = await ctx.api.getFile(fileId)
                            selectedUser.image = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${file.file_path}`
                            await selectedUser.save()
                        })
                        .catch(error => ctx.reply((error as Error).message))
                    break
                }

                case SelectImageButton.Avatar: {
                    const nextAvatarNumber
                        = ctx.dbuser.selectedUser === selectedUser.id ? (ctx.dbuser.avatarNumber ?? -1) + 1 : 0
                    ctx.dbuser.avatarNumber = nextAvatarNumber
                    await ctx.dbuser.save()
                    sendUserMetadata(ctx, selectedUser).catch(error => ctx.reply((error as Error).message))
                    break
                }

                case SelectImageButton.Upload: {
                    if (!selectedUser.nftDescription) {
                        return ctx.reply('Empty description')
                    }
                    if (!selectedUser.image) {
                        return ctx.reply('Empty image')
                    }

                    if (selectedUser.nftImage && selectedUser.nftJson) {
                        try {
                            await unpin(selectedUser.nftImage)
                            selectedUser.nftImage = ''
                            await unpin(selectedUser.nftJson)
                            selectedUser.nftJson = ''
                            await selectedUser.save()
                        } catch (error) {
                            logger.info(`Unable to unpin IPFS files: ${error}`)
                        }
                    }

                    const username = selectedUser.name
                    if (!username)
                        return ctx.reply('Empty username')
                    const ipfsImageHash = await pinImageURLToIPFS(
                        adminIndex(ctx.dbuser.id),
                        username,
                        selectedUser.image ?? '',
                    )
                    ctx.logger.info(ipfsImageHash)
                    const json = {
                        name: selectedUser.name,
                        description: selectedUser.nftDescription,
                        image: `ipfs://${ipfsImageHash}`,
                        attributes: randomAttributes(),
                    }
                    ctx.logger.info(json)
                    const ipfsJSONHash = await pinJSONToIPFS(adminIndex(ctx.dbuser.id), username, json)
                    selectedUser.nftImage = ipfsImageHash
                    selectedUser.nftJson = ipfsJSONHash
                    await selectedUser.save()
                    sendUserMetadata(ctx, selectedUser)
                        .then(() => {
                            warmIPFSHash(ipfsImageHash)
                            warmIPFSHash(ipfsJSONHash)
                        })
                        .catch(error => ctx.reply((error as Error).message))
                    break
                }

                case SelectImageButton.Mint: {
                    if (!selectedUser.nftDescription) {
                        return ctx.reply('🚫 Empty description')
                    }
                    if (!selectedUser.nftJson || !selectedUser.nftImage) {
                        return ctx.reply('🚫 Empty NFT metadata')
                    }
                    if (selectedUser.minted) {
                        return ctx.reply('🚫 Already minted for this user!')
                    }
                    ctx.chatAction = 'upload_document'

                    // reset custom description for admin
                    ctx.dbuser.customDescription = undefined
                    await ctx.dbuser.save()

                    selectedUser.minted = true
                    selectedUser.mintedAt = new Date()
                    await selectedUser.save()

                    const nextItemIndex = await NftCollection.fetchNextItemIndexWithRetry()
                    const userAddress = Address.parse(selectedUser.wallet ?? '')
                    const parameters: NFTMintParameters = {
                        queryId: 0,
                        itemOwnerAddress: userAddress,
                        itemIndex: nextItemIndex,
                        amount: toNano('0.01'),
                        commonContentUrl: `ipfs://${selectedUser.nftJson}`,
                    }
                    ctx.logger.info(parameters)

                    const nft = new NftItem()
                    nft
                        .deployNFT(parameters)
                        .then(async (nftUrl) => {
                            selectedUser.nftUrl = nftUrl
                            await selectedUser.save()

                            // TODO: uncomment after change logic
                            // await sendNewPlaces(ctx.api);

                            await sendPreviewNFT(
                                ctx.api,
                                selectedUser.id,
                                selectedUser.language,
                                selectedUser.nftImage ?? '',
                                selectedUser.nftUrl ?? '',
                                nextItemIndex,
                                selectedUser.diceWinner ?? false,
                            )

                            // send to admin
                            await sendPreviewNFT(
                                ctx.api,
                                ctx.dbuser.id,
                                selectedUser.language,
                                selectedUser.nftImage ?? '',
                                selectedUser.nftUrl ?? '',
                                nextItemIndex,
                                selectedUser.diceWinner ?? false,
                            )

                            await ctx.api.sendSticker(
                                selectedUser.id,
                                'CAACAgIAAxkBAAEq6zpmIPgeW-peX09nTeFVvHXneFJZaQACQxoAAtzjkEhebdhBXbkEnzQE',
                            )

                            await sleep(60_000)

                            await sendToGroupsNewNFT(
                                ctx.api,
                                selectedUser.nftImage ?? '',
                                nextItemIndex,
                                selectedUser.nftUrl ?? '',
                                selectedUser.diceWinner ?? false,
                            )

                            await sendPostToChannels(ctx.api)
                        })
                        .catch(async (error) => {
                            logger.error(error)
                            await ctx.reply(`😡 Mint NFT error: ${error}`)
                        })

                    await ctx.reply('💥 Mint NFT started!')
                    break
                }
                default: {
                    break
                }
            }
        } catch (error) {
            ctx.logger.error(error)
            const { message } = error as Error
            await (message ? ctx.reply(`Error: ${message}`) : ctx.reply(ctx.t('wrong')))
        }
        ctx.chatAction = null
    },
)

export { composer as queueFeature }
