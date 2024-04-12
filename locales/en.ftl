start_command = 
    .description = 🚀 Start the bot
language_command = 
    .description = 🎎 Change language
setcommands_command =
    .description = 🚅 Set bot commands
mint_command = 
    .description = 💎 Mint your NFT
line_command =
    .description = ⏳ Show the line
dice_command =
    .description = 🎲 Roll the dice
whales_command =
    .description = 🐳 Whales

reset = The state has been reset. Please press /mint
language = 
    .select = Please, select your language
    .changed = Language successfully changed!
admin =
    .commands-updated = Commands updated.
unhandled = Unrecognized command. Try /mint
wrong = Something went wrong

start = 🎮 Get ready for "<a href="https://teleg.notion.site/Immersive-Text-Based-Adventure-A-New-Era-of-Gaming-on-Telegram-TON-Blockchain-3a93687faa7b4595bfade11fc29eddca?pvs=4">Cube Worlds</a>", new adventure game awaits! 

    🌟 Explore pixelated wonders, collect cube NFT heroes, and embark on thrilling quests.
    
    💎 Join now to /mint your free NFT character and prepare for the launch!
    
    🔥 Are you ready to become a Hero of the Cube Worlds?

vote = 
    .no_receiver = No receiver exists
    .self_vote = You can't vote for yourself
    .already = You already voted
    .success = You have successfully voted for @{$name}!

whales = 
    .count = Total {$points} $CUBE on {$count} wallets

line =
    .count = The line currently consists of {$count} people

donation = 😍 Thank you for your donation! {$ton} TON has been accepted successfully! ❤️

speedup = 
    .title_minted = 💎 You have {$points} $CUBE. To get even more, you can:
    .title_not_minted = 💎 You have {$points} $CUBE. To get more and move up in the /line for NFT, you can:
    .variants = 💰 Donate Toncoin from <strong>your wallet</strong> to address <code>{$collectionOwner}</code>

    👨‍👨‍👦‍👦 <a href="{$shareLink}">Invite friends</a> using link <code>{$inviteLink}</code>

    🎲 Roll the dice using /dice every 5 minutes

dice = 
    .wait = ⌛️ Please wait another {$minutes} min {$seconds} sec
    .success = 🎉 Congratulations, it's {$score}! We look forward to seeing you again in 5 minutes.

description = 
    .wait = Please share some details about yourself. This information will be used to create more precise and personalized description for your NFT.
    .fill = Your profile description: <code>{$bio}</code>
        
        Send me another text about yourself or press <strong>✅ Correct</strong> button
    .success = Your description: <code>{$description}</code> has been saved. If you made a mistake or would like to change description, use the command /reset

wallet = 
    .wait = 🚀 Now please provide me with your <strong>non-custodial TON address</strong> that will receive the NFT. 
    
        🛟 We recommend the Ton Space @wallet inside Telegram or <a href="https://tonkeeper.com">Tonkeeper</a> mobile app.
        
        ⚠️ Keep in mind that a regular @wallet won't work. Make sure you create a Ton Space wallet inside.
    .already_exists = Wallet <code>{$wallet}</code> already exists.

mint = 
    .no_username = Make sure that you set username to your telegram profile
    .no_photo = Make sure you set avatar to your Telegram profile. If so, make sure everyone can see your photos:
        <strong>Settings -> Privacy & Security -> Who can see my photos -> Everybody</strong>
    .subscribe_required = Subscribe 💎 {$channel} 💎 to continue
    .share = Mint your NFT character for absolutely free!
    
queue = 
    .title = {$count} in queue
    .new_nft = {$emoji1} Collection update alert! {$emoji2}
        New NFT <strong>#{$number}</strong> in {$collectionLink}!
    .new_nft_button = Open NFT
    .no_photo_after_submit = Access to your avatars is unavailable. Please resubmit your request with the /mint command
    .no_square_avatars = It appears that you don't currently have an avatar with square dimensions, please upload and resubmit your request with the /mint command
    .no_suitable_photo = Your avatars need to include at least one photo with people, preferably a portrait. Please add a suitable photo and resubmit your request with the /mint command
    .success = 🎉 Congrats on minting your NFT! We're excited to be part of your journey. Your NFT is live <a href="{$nftUrl}">here</a>. Enjoy the attention that come with owning a unique digital artwork 💎

        ❤️ To help us bring <a href="https://teleg.notion.site/Immersive-Text-Based-Adventure-A-New-Era-of-Gaming-on-Telegram-TON-Blockchain-3a93687faa7b4595bfade11fc29eddca?pvs=4">our game vision</a> to life, you can donate to address <code>{$collectionOwner}</code> or <a href="{$shareLink}">share bot with your friends</a>. Thanks for your support! 🤗
