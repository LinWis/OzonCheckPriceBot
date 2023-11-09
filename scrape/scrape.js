const puppeteer = require('puppeteer');

async function scrape(url) {
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();
    await page.goto(
        url,
        {waitUntil: 'load'}
    );

    const result = await page.evaluate(() => {
        let price;


        if (!document.querySelector('.l7l').innerText) {
            price = document.querySelector('.l7l').innerText
        }
        else {
            price = document.querySelector('.lm').innerText
        }

        return price;
    });


    await browser.close();
    return result;
}

module.exports = scrape