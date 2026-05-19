bot =
    .description = Получи NFT своего персонажа в игре Cube Worlds
    .short_description = Новости: @cube_worlds_ru | Чат: @cube_worlds_chat_ru
    Коллекция: https://getgems.io/cubeworlds

help_command =
    .description = ❓ Как пользоваться ботом
help =
    .message = 👋 Привет! Бот теперь живёт в мини-приложении.

        Нажмите кнопку приложения рядом с полем ввода, чтобы открыть его.
menu_button =
    .label = Открыть приложение
removed_command =
    .message = ⚠️ Эта команда больше не существует. Откройте мини-приложение, чтобы продолжить.
start_command =
    .description = 🚀 Стартовать бота
language_command =
    .description = 🎎 Изменить язык
setcommands_command =
    .description = 🚅 Установить команды бота
mint_command =
    .description = 💎 Создать свой NFT
line_command =
    .description = ⏳ Посмотреть очередь
dice_command =
    .description = 🎲 Бросить кости
whales_command =
    .description = 🐳 Киты
play_command =
    .description = 🎮 Играть

reset = Состояние сброшено. Пожалуйста, нажмите /mint
language =
    .select = Пожалуйста, выберите ваш язык
    .changed = Язык успешно изменен!
admin =
    .commands-updated = Команды обновлены.
unhandled = Неопознанная команда. Попробуйте /mint
wrong = Что-то пошло не так

start = 🎮 Приготовьтесь к "<a href="https://teleg.notion.site/Immersive-Text-Based-Adventure-A-New-Era-of-Gaming-on-Telegram-TON-Blockchain-3a93687faa7b4595bfade11fc29eddca?pvs=4">Кубическим мирам</a>", вас ждет новая приключенческая игра!

    🌟 Исследуйте пиксельные чудеса, собирайте NFT кубических героев и отправляйтесь в захватывающие квесты.

    💎 Делайте /mint NFT своего персонажа и готовьтесь к запуску!

    🔥 Готовы ли вы стать Героем мира Cube Worlds?

vote =
    .no_receiver = Получатель не найден
    .self_vote = Вы не можете проголосовать за себя

whales =
    .count = Всего {$points} $CUBE на {$count} кошельках

line =
    .count = Очередь сейчас состоит из {$count} человек

donation = 😍 Спасибо за ваше участие! {$ton} TON успешно получено! ❤️

speedup =
    .title_minted = 💎 Вы обладаете {$points} $CUBE. Чтобы получить ещё больше, вы можете:
    .title_not_minted = 💎 Вы обладаете {$points} $CUBE. Чтобы получить ещё и продвинуться в очереди /line, вы можете:
    .variants = 💰 Отправить TON со <strong>своего кошелька</strong> на <code>cubeworlds.ton</code> адрес <code>{$collectionOwner}</code>

    👨‍👨‍👦‍👦 <a href="{$shareLink}">Пригласить друзей</a>, используя ссылку <code>{$inviteLink}</code>

    🎲 Бросать кости с помощью команды /dice каждые пять минут

dice =
    .wait = ⌛️ Пожалуйста, подождите ещё {$minutes} мин {$seconds} сек
    .success = 🎉 Поздравляем, вы получили {$score} $CUBE! Мы ждем вас снова через 5 минут.
    .success_series = 🎉 Поздравляем, {$diceSeries}-й раз подряд выпал дубль числа {$diceSeriesNumber}. Вы получили {$score} $CUBE! Мы ждем вас снова через 5 минут.
    .mint_winner = 🥳🥳🥳 Поздравляем, @{$username}, вы — ПОБЕДИТЕЛЬ! Вы выкинули дубль {$diceSeriesNumber}-{$diceSeriesNumber} подряд {$diceSeries} раза! Проверьте очередь /line
    .captcha_solved = Вы успешно разгадали капчу и снова можете снова кидать кубики /dice
    .wish_luck = Удачи с броском этих двух кубиков!
    .captcha_title = Всё ещё человек?
    .captcha_button = Играй в Doom, чтобы это доказать!

description =
    .wait = Пожалуйста, поделитесь ключевыми деталями о себе. Эта информация будет использоваться для создания более точного и персонализированного описания вашего NFT.
    .fill = Описание вашего профиля: <code>{$bio}</code>

        Отправьте мне другой текст о себе или нажмите <strong>✅ Подтвердить</strong>
    .success = Ваше описание: <code>{$description}</code> сохранено. Если вы ошиблись или хотите изменить описание, используйте команду /reset

wallet =
    .wait = 🚀 Теперь, пожалуйста, предоставьте мне ваш <strong>некастодиальный адрес TON</strong>, который получит NFT.

        🛟 Мы рекомендуем Ton Space @wallet внутри Telegram или мобильное приложение <a href="https://tonkeeper.com">Tonkeeper</a>.

        ⚠️ Имейте в виду, что обычный @wallet не будет работать. Убедитесь, что вы создали кошелек Ton Space внутри.
    .already_exists = Кошелек <code>{$wallet}</code> уже кем-то добавлен.

mint =
    .no_username = Убедитесь, что вы установили никнейм в своем профиле Telegram
    .no_photo = Убедитесь, что вы установили аватар в своем профиле Telegram. Если это так, убедитесь, что все могут видеть ваши фотографии:
        <strong>Настройки -> Конфиденциальность и безопасность -> Кто может видеть мои фотографии -> Все</strong>
    .subscribe_required = Подпишитесь на канал {$channel} и вступите в группу {$chat} чтобы продолжить
    .share = Получи NFT своего персонажа абсолютно бесплатно!

queue =
    .title = {$count} в очереди
    .new_nft = {$emoji1} Пополнение коллекции! {$emoji2}
        Новый NFT <strong>№{$number}</strong> в {$collectionLink}!
    .new_nft_dice = {$emoji1} Победа в кубиках! {$emoji2}
        Поздравляем победителя с получением нового NFT <strong>№{$number}</strong> в {$collectionLink}!
    .new_nft_button = Открыть NFT
    .no_photo_after_submit = Доступ к вашим аватаркам недоступен. Пожалуйста, повторно отправьте ваш запрос с помощью команды /mint
    .no_square_avatars = Похоже, у вас в данный момент нет аватара с квадратными размерами. Пожалуйста, загрузите его и повторно отправьте ваш запрос с помощью команды /mint
    .no_suitable_photo = Ваши аватары должны включать как минимум одну фотографию с людьми, желательно портрет. Пожалуйста, добавьте подходящую фотографию и повторно отправьте ваш запрос с помощью команды /mint
    .minted = 🎉 Поздравляем с созданием вашего NFT! Мы рады быть частью вашего пути. Ваш NFT доступен <a href="{$nftUrl}">здесь</a>. Наслаждайтесь вниманием, которое привлекает уникальное цифровое произведение искусства 💎

        ❤️ Чтобы помочь нам воплотить <a href="https://teleg.notion.site/Immersive-Text-Based-Adventure-A-New-Era-of-Gaming-on-Telegram-TON-Blockchain-3a93687faa7b4595bfade11fc29eddca?pvs=4">нашу игровую концепцию</a> в жизнь, вы можете:

cnft =
    .claim = Заклеймить cNFT

play =
    .clicker = Кликер
    .minted = Игра ещё в разработке. Это сложный и долгий процесс. Но если вам не терпится, вы можете опробовать наш Кликер
    .not_minted = Для участия в игре вам потребуется NFT, который выдается в порядке очереди. Чтобы встать в очередь, используйте команду /mint

## Web

cnft-header = Заклеймите свой cNFT!
cnft-show-button = Смотреть
cnft-claim-button = Заклеймить
cnft-not-eligible = К сожалению, в настоящее время вы не имеете права на получение cNFT. Пожалуйста, попробуйте позже.
cnft-connect = Пожалуйста, подключите свой кошелек, чтобы проверить доступность вашего cNFT.

clicker-title = Cube Worlds Кликер
clicker-share-text = Новый классный кликер
clicker-no-title = Шутка!
clicker-no = НЕТ, НЕТ И НЕТ! ЗДЕСЬ НИКАКИХ КЛИКЕРОВ НЕ БУДЕТ!