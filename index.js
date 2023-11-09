const TelegramBot = require('node-telegram-bot-api');
const { create_table } = require('./db/createTable')
const { add_data } = require('./db/addData')
const { get_data } = require('./db/getData')
const { check_data } = require('./db/checkData')
const { update_data } = require('./db/updateData')
const { delete_data } = require('./db/deleteData')
const { domainToASCII } = require('node:url');

const dao = require('./Redis/dataAccessObject')

require('dotenv').config()
const scrape = require("./scrape/scrape")
const {init_index} = require("./Redis/initIndex");

const commands = [
    {
        command: "start",
        description: "Запуск бота"
    },
    {
        command: "menu",
        description: "Меню"
    },
    {
        command: "add_url",
        description: "Добавить товар"
    },
    {
        command: "check_urls",
        description: "Список отслеживаемых товаров"
    },
    {
        command: "del_url",
        description: "Удалить товар"
    },
    {
        command: "help",
        description: "Раздел помощи"
    },
]

const bot = new TelegramBot(process.env.BOT_TOKEN, {
    polling: true,
    autoStart: false
});

bot.setMyCommands(commands);

async function get_menu(chat_id) {
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['Список ссылок'],
                ['Добавить товар', 'Удалить товар'],
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
        },
    };

    bot.sendMessage(chat_id, 'Выберите опцию:', keyboard);
}

async function get_help(chat_id) {
    await bot.sendMessage(chat_id, `Отслеживание ссылок происходит каждый час\nПо всем вопросам обращайтесь к @SylocFi`);
}

async function start() {

    await init_index("idx:notification")


    let level = 0;
    let cmd = '';

    bot.on('text', async msg => {

        try {

            if(msg.text.startsWith('/start')) {

                await bot.sendMessage(msg.chat.id, `Добро пожаловать в бота для проверок цен на наличие скидок ozon`);

                await get_menu(msg.chat.id)

            }
            else if(msg.text.startsWith('/menu')) {

                await get_menu(msg.chat.id)

            }
            else if (msg.text === '/check_urls' || msg.text === 'Список ссылок') {
                let urls = "";

                try {
                    // urls = await get_data()
                    const { total, documents } = await dao.find([
                        ['userId', msg.chat.id]
                    ]);

                    await bot.sendMessage(msg.chat.id, `Всего отслеживаемых товаров: ${total}`);

                    documents.forEach((item) => {
                        urls += `${item.value.name} - ${'https://www.ozon.ru/' + item.value.url}\n`
                    })

                }
                catch (e) {
                    console.log(e)
                }
                finally {
                    // await bot.sendMessage(
                    //     msg.chat.id,
                    //     `Список ссылок:\n${urls.replaceAll(',', '\n')}`
                    // );
                    await bot.sendMessage(msg.chat.id, urls);
                }
            }
            else if(msg.text === '/add_url' || msg.text === 'Добавить товар') {
                level = 1
                cmd = 'add'

                await bot.sendMessage(msg.chat.id, "Пришлите url сайта и краткое наименование через пробел: ");
            }
            else if(msg.text === '/del_url' || msg.text === 'Удалить товар') {
                level = 1
                cmd = 'del'

                await bot.sendMessage(msg.chat.id, "Введите номер наименование из списка: ");
            }
            else if(msg.text === '/help') {

                await get_help(msg.chat.id)

                await get_menu(msg.chat.id)

            }
            else {
                if (level === 0)
                    await bot.sendMessage(msg.chat.id, "Извините, я вас не понял! Введите команду из списка");
                else if(level === 1) {
                    if (cmd === 'add') {

                        let price;
                        let name;
                        let url;
                        let domen;

                        await create_table()

                        try {
                            name = msg.text.split(' ')[1]
                            url = msg.text.split(' ')[0]
                            console.log(url)

                            if (url.includes('https://www.ozon.ru/')) {
                                url = url.substring(20, url.length)
                                domen = 'https://www.ozon.ru/'
                            }
                            else if('https://ozon.ru/') {
                                url = url.substring(16, url.length)
                                domen = 'https://ozon.ru/'
                            }
                            else {
                                throw new SyntaxError("Данные некорректны");
                            }

                            price = await scrape(domen + url)
                            price = Number((price.substring(0, price.length - 1)).replace(/\s/g, ''))

                        }
                        catch (e) {
                            console.log(e)
                            await bot.sendMessage(msg.chat.id, "Произошла ошибка при получении цены по этому url")
                        }
                        finally {

                            if ((await dao.find([
                                ['userId', msg.chat.id],
                                ['name', name]
                            ])).total !== 0) {
                                await bot.sendMessage(msg.chat.id, "Это имя уже занято")
                            }
                            else {

                                if ((await dao.find([
                                    ['userId', msg.chat.id],
                                    ['url', url]
                                ])).total !== 0) {
                                    await bot.sendMessage(msg.chat.id, "Товар уже отслеживается")
                                }
                                else {
                                    await add_data(name, url, price)

                                    await dao.save(msg.chat.id, name, url, price)

                                    let scrape_interval = setInterval(async () => {

                                        if (!(await check_data(url, name)))
                                            clearInterval(scrape_interval);
                                        else {
                                            let price;
                                            try {
                                                price = await scrape(domen + url)
                                            }
                                            catch (e) {
                                                await bot.sendMessage(
                                                    msg.chat.id,
                                                    `Невозможно получить доступ к товару ${domen + url}`
                                                );
                                            }
                                            finally {
                                                let int_price = parseInt(price.replace(/\s+/g, ''))

                                                let old_price = await get_data(name);


                                                if (Number(int_price) !== Number(old_price['price'])) {
                                                    await bot.sendMessage(
                                                        msg.chat.id,
                                                        `Цена на товар ${name} по ссылке ${url} изменилась`
                                                    );
                                                    await update_data(name, int_price)
                                                }
                                            }
                                        }

                                    }, 3600000) // 1h 3600000

                                    await bot.sendMessage(msg.chat.id, "Товар успешно добавлен")
                                }
                            }

                        }

                    }
                    else if (cmd === 'del') {


                        if ((await dao.find([
                            ['userId', msg.chat.id],
                            ['name', msg.text]
                        ])).total !== 0) {

                            // await delete_data(msg.text)
                            await dao.del(msg.chat.id, msg.text)
                            await bot.sendMessage(msg.chat.id, "Ссылка успешна удалена");
                        }
                        else {
                            await bot.sendMessage(msg.chat.id, "Нет ссылки с таким именем");
                        }

                    }

                    level = 0
                    cmd = ''
                }

            }

        }
        catch(error) {

            console.log(error);

        }

    })

}

start()
