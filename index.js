const chromeLauncher = require('chrome-launcher');
const puppeteer = require('puppeteer');
const lighthouse = require('lighthouse');
const lightHouseConfig = require('lighthouse/lighthouse-core/config/lr-desktop-config.js');
const request = require('request');
const util = require('util');
const fs = require('fs');


// Get routes
const routes = require("./routes/routes.json");

const config = require("./config.json");

if (!fs.existsSync(config.reportsFolder)) {
    fs.mkdirSync(config.reportsFolder);
}


(async () => {

    const baseURL = 'https://9bae-122-171-18-119.in.ngrok.io';
    const username = 'admin@robustest.com';
    const password = 'NU#$#%dfg$D5@#$Q#%7KKM35#%jy0';

    const opts = {
        //chromeFlags: ['--headless'],
        logLevel: 'error',
        output: 'html',
        disableDeviceEmulation: true,
        defaultViewport: {
            width: 1600,
            height: 900
        },
        chromeFlags: ['--headless', '--disable-mobile-emulation', '--no-sandbox', '--disable-setuid-sandbox']
    };

    // Launch chrome using chrome-launcher
    const chrome = await chromeLauncher.launch(opts);
    opts.port = chrome.port;

    // Connect to it using puppeteer.connect().
    const resp = await util.promisify(request)(`http://localhost:${opts.port}/json/version`);
    const { webSocketDebuggerUrl } = JSON.parse(resp.body);
    const browser = await puppeteer.connect({ browserWSEndpoint: webSocketDebuggerUrl });
    // login
    let page = await browser.newPage();
    await page.goto(`${baseURL}/auth/login`, { waitUntil: 'load' });
    await page.type('#email', username);
    await page.type('#password', password);
    await page.$eval('form button#submit', x => x.click());
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    page = (await browser.pages())[0];
    await runLightHouseForRoutes(baseURL, page, opts, routes);

    await browser.disconnect();
    await chrome.kill();


})().catch((err) => {
    console.error('error', err);
    process.exit(1);
});

async function runLightHouseForRoutes(baseURL, page, opts, routes) {
    const reports = {};
    const date = new Date().getTime();
    for (const route of routes) {
        if (route.path.indexOf(":") == -1) {
            try {
                console.log(`Running lighthouse for ${baseURL}/#${route.path}`);
                await page.setViewport({ width: 1600, height: 900 });
                await page.goto(`${baseURL}/#${route.path}`, { waitUntil: 'networkidle2' });
                const result = await runLighthouseForURL(page.url(), opts, date, route.name ? route.name : route.path.replace(/\//g,'') + "-" + date);
                reports[route.name] = result;
            } catch (err) {
                console.error('err', err);
            }
        }
    }
    fs.writeFileSync(`reports/report-${date}.json`, JSON.stringify(reports, null, 4));
}


async function runLighthouseForURL(pageURL, opts, reportDate, reportName) {

    const reportNameForFile = reportName.replace(/\s/g, '');
    const reportFolder = `reports/${reportDate}`;

    if (!fs.existsSync(reportFolder)) {
        fs.mkdirSync(reportFolder);
    }
    const reportPath = `${reportFolder}/${reportNameForFile}.html`;
    const runnerResult = await lighthouse(pageURL, opts, lightHouseConfig).then(results => results);

    // `.report` is the HTML report as a string
    const reportHtml = runnerResult.report;
    fs.writeFileSync(reportPath, reportHtml);

    // `.lhr` is the Lighthouse Result as a JS object
    console.log('Report is done for', pageURL);
    console.log('Performance score was', runnerResult.lhr.categories.performance.score * 100);
    return {
        reportPath,
        score: runnerResult.lhr.categories.performance.score * 100
    }

}
