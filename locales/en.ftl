start_command = 
    .description = Start the bot
language_command = 
    .description = Change language
setcommands_command =
    .description = Set bot commands
mint_command = 
    .description = Mint your own NFT

reset = The state has been reset. Please press /mint
language = 
    .select = Please, select your language
    .changed = Language successfully changed!
admin =
    .commands-updated = Commands updated.
unhandled = Unrecognized command. Try /mint
wrong = Something went wrong
submitted = You have already submitted a request.

start = 🎮 Get ready for "<a href="https://teleg.notion.site/Immersive-Text-Based-Adventure-A-New-Era-of-Gaming-on-Telegram-TON-Blockchain-3a93687faa7b4595bfade11fc29eddca?pvs=4">Cube Worlds</a>", new adventure game awaits! 

    🌟 Explore pixelated wonders, collect cube NFT heroes, and embark on thrilling quests.
    
    💎 Join now to /mint your free NFT character and prepare for the launch!
    
    🔥 Are you ready to become a Hero of the Cube Worlds?

bet = Your bet {$ton} TON has been accepted.
speedup = You are currently in line number {$place}. To move up the queue, you could:
    — Donate any amount of Toncoin from your wallet to the address <code>{$collectionOwner}</code>
    — Invite friends to vote for you using link <code>{$inviteLink}</code>
    — Roll the dice by using the command /dice every hour

dice = 
    .wait = Please wait another {$minutes} min {$seconds} sec
    .success = Congratulations, it's {$score}! Now you are {$place}th in line. We look forward to seeing you again in one hour.

description = 
    .wait = Please share some details about yourself. This information will be used to create more precise and personalized description for your NFT
    .success = Information <code>{$description}</code> has been saved. If you made a mistake or would like to change description, please use the command /reset

wallet = 
    .wait = Now please provide me with your self-custodial <strong>TON wallet address that will receive the NFT</strong>. 
    
        If you don't have a TON wallet yet, we recommend using <a href="https://tonkeeper.com">Tonkeeper</a>. However, you can also use <a href="https://ton.org/wallets?locale=en&filters[wallet_features][slug][$in]=nft">any other wallet that supports NFTs</a>.
    .incorrect = Please provide correct TON wallet address.
    .already_exists = Wallet {$wallet} already exists.
    
queue = 
    .title = {$count} in queue
    .success = 🎉 Congratulations on successfully minted an NFT! This is an amazing achievement and we are thrilled to be part of your journey. Your NFT is now publicly available <a href="{$url}">here</a>. We hope you enjoy all the attention and appreciation that come with owning a unique piece of digital artwork. Stay tuned!

no_photo = Make sure you upload images to your Telegram profile. If so, make sure everyone can see your photos:
    Settings -> Privacy & Security -> Who can see my photos -> Everybody
no_photo_after_submit = Access to your avatars is unavailable. Please resubmit your application again using the /mint command
no_username = Make sure that you set username to your telegram profile
subscribe_required = Subscribe to 💎 {$channel} 💎 to continue