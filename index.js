const chromeLauncher = require('chrome-launcher');
const puppeteer = require('puppeteer');
const lighthouse = require('lighthouse');
const lightHouseConfig = require('lighthouse/lighthouse-core/config/lr-desktop-config.js');
const request = require('request');
const util = require('util');
const fs = require('fs');
const ejs = require('ejs');
const path = require('path');

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const parentResolveInclude = ejs.resolveInclude;
Date.prototype.toString = function () {
    const padZero = (value) => value.toString().padStart(2, "0");
    return `${padZero(this.getDate())} ${padZero(this.getMonth() + 1)} ${this.getFullYear()} ${padZero(this.getHours())}:${padZero(this.getMinutes())}:${padZero(this.getSeconds())}`
}

ejs.resolveInclude = function (name, filename, isDir) {
    if (!path.extname(name)) {
        name += ".ejs.html";
    }
    return parentResolveInclude(name, filename, isDir);
}

// Get routes
const routes = require("./routes/routes.json");

const config = require("./config.json");

if (!fs.existsSync(config.reportsFolder)) {
    fs.mkdirSync(config.reportsFolder);
}


(async () => {

    const baseURL = process.env.RT_URL;
    const username = process.env.RT_USER_NAME;
    const password = process.env.RT_USER_PASS;
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

function getLowestScore(keys, array) {
    // There's no real number bigger than plus Infinity
    let lowest = Number.POSITIVE_INFINITY;
    let highest = Number.NEGATIVE_INFINITY;
    let tmp;
    let key = null;
    for (var i = keys.length - 1; i >= 0; i--) {
        tmp = array[keys[i]].score;
        if (tmp < lowest) {
            lowest = tmp;
            key = keys[i];
        }
        if (tmp > highest) highest = tmp;
    }
    return { value: lowest, key };
}

const camelToSnakeCase = str => str.replace(/[A-Z]/g, letter => `_${letter}`).toUpperCase();


function createPropertiesFile(fileName, data) {
    if (fs.existsSync(fileName)) {
        fs.truncateSync(fileName, 0)
    }
    var logger = fs.createWriteStream(fileName, {
        flags: 'a' // 'a' means appending (old data will be preserved)
    })
    Object.keys(data).forEach((key) => {
        logger.write(`${camelToSnakeCase(key.toString())}=${data[key]}\n`);
    })
    logger.end();
}

async function runLightHouseForRoutes(baseURL, page, opts, routes) {
    const report = { avgScore: 0, leastScore: null, pages: {} };
    const date = new Date().getTime();
    for (const route of routes) {
        if (route.path.indexOf(":") == -1) {
            try {
                console.log(`Running lighthouse for ${baseURL}/#${route.path}`);
                await page.setViewport({ width: 1600, height: 900 });
                await page.goto(`${baseURL}/#${route.path}`, { waitUntil: 'networkidle2' });
                const result = await runLighthouseForURL(page.url(), opts, date, route.name ? route.name : route.path.replace(/\//g, '') + "-" + date);
                report.pages[route.name] = result;
                
            } catch (err) {
                console.error('err', err);
            }
        }
    }

    // Get Avg Score and Least Scored
    const keys = Object.keys(report.pages);
    report.avgScore = parseInt(keys.map(k => report.pages[k].score).reduce((sum, value) => {
        return sum + value;
    }, 0) / keys.length);
    report.leastScore = getLowestScore(keys, report.pages);
    fs.writeFileSync(`reports/report-${date}.json`, JSON.stringify(report, null, 4));
    if (process.env.HTML_MODE && process.env.HTML_MODE == 'browser') {
        try {
            const result = await ejs.renderFile('views/report.ejs.html', {
                reportDate: date,
                report: report.pages,
                htmlMode: process.env.HTML_MODE ? process.env.HTML_MODE : 'node'
            }, { root: path.join(__dirname, 'views') });
            fs.writeFileSync('index.html', result);
            createPropertiesFile('report.properties', {
                avgScore: report.avgScore,
                leastScoreComponent: report.leastScore.key,
                leastScoreValue: report.leastScore.value,
                reportDate: date.toString()
            })
        } catch (err) {
            console.error('err', err);
        }
    }
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
