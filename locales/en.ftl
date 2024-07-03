bot = 
    .description = Acquire your NFT character for the Cube Worlds game
    .short_description = News: @cube_worlds | Chat: @cube_worlds_chat
    Collection: https://getgems.io/cubeworlds
    
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
    
    💎 /mint your NFT character and get ready for the launch!
    
    🔥 Are you ready to become a Hero of the Cube Worlds?

vote = 
    .no_receiver = No receiver exists
    .self_vote = You can't vote for yourself

whales = 
    .count = Total {$points} $CUBE on {$count} wallets

line =
    .count = The line currently consists of {$count} people

donation = 😍 Thank you for your donation! {$ton} TON has been accepted successfully! ❤️

speedup = 
    .title_minted = 💎 You have {$points} $CUBE. To get even more, you can:
    .title_not_minted = 💎 You have {$points} $CUBE. To get more and move up in the /line for NFT, you can:
    .variants = 💰 Donate Toncoin from <strong>your wallet</strong> to <code>cubeworlds.ton</code> address <code>{$collectionOwner}</code>

    👨‍👨‍👦‍👦 <a href="{$shareLink}">Invite friends</a> using link <code>{$inviteLink}</code>

    🎲 Roll the dice using /dice every 5 minutes

dice = 
    .wait = ⌛️ Please wait another {$minutes} min {$seconds} sec
    .success = 🎉 Congratulations! You've earned {$score} $CUBE. We can't wait to see you back in 5 minutes!
    .success_series = 🎉 Congratulations! You've rolled double {$diceSeriesNumber} for the {$diceSeries}-th time in a row, earning you {$score} $CUBE! We're excited to welcome you back in 5 minutes!
    .mint_winner = 🥳🥳🥳 Congrats, @{$username}, you are THE ONE! You rolled {$diceSeriesNumber}-{$diceSeriesNumber} in a row {$diceSeries} times! Check the /line
    .captcha_solved = You successfully solved captcha and can roll the /dice again
    .wish_luck = Good luck with the roll of those two dice!
    .captcha_title = Still human there?
    .captcha_button = Play Doom to prove it!

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
    .subscribe_required = Subscribe to channel {$channel} and join the group {$chat} to continue
    .share = Mint your NFT character for absolutely free!
    
queue = 
    .title = {$count} in queue
    .new_nft = {$emoji1} Collection update alert! {$emoji2}
        New NFT <strong>#{$number}</strong> in {$collectionLink}!
    .new_nft_dice = {$emoji1} Dice victory! {$emoji2}
        Congratulations to the winner on receiving a new NFT <strong>#{$number}</strong> in {$collectionLink}!
    .new_nft_button = Open NFT
    .no_photo_after_submit = Access to your avatars is unavailable. Please resubmit your request with the /mint command
    .no_square_avatars = It appears that you don't currently have an avatar with square dimensions, please upload and resubmit your request with the /mint command
    .no_suitable_photo = Your avatars need to include at least one photo with people, preferably a portrait. Please add a suitable photo and resubmit your request with the /mint command
    .minted = 🎉 Congrats on minting your NFT! We're excited to be part of your journey. Your NFT is live <a href="{$nftUrl}">here</a>. Enjoy the attention that come with owning a unique digital artwork 💎

        ❤️ To help us bring <a href="https://teleg.notion.site/Immersive-Text-Based-Adventure-A-New-Era-of-Gaming-on-Telegram-TON-Blockchain-3a93687faa7b4595bfade11fc29eddca?pvs=4">our game vision</a> to life, you can:

cnft = 
    .claim = Claim cNFT
