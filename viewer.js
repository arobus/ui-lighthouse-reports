const koa = require('koa');
const app = new koa();
const render = require('koa-ejs');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');


const config = require('./config.json');
render(app, {
    root: path.join(__dirname, 'views'),
    layout: 'template',
    viewExt: 'ejs.html',
    cache: false,
    debug: false
});

function readdirAsync(path) {
    return new Promise(function (resolve, reject) {
        fs.readdir(path, function (error, result) {
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        });
    });
}

app.use(async (ctx) => {
    let reports = {};

    if (ctx.request.query.reportsServer) {

    } else if (ctx.request.query.reportDate) {
        const { reportDate, component } = ctx.request.query;
        try {
            const reportJSON = JSON.parse(fs.readFileSync(`${config.reportsFolder}/report-${reportDate}.json`));

            if (component && reportJSON.pages[component]) {
                const file = fs.createReadStream(reportJSON.pages[component].reportPath);
                ctx.type = 'html';
                ctx.body = file;
            } else {
                const data = {
                    report: reportJSON.pages,
                    reportDate,
                    htmlMode: process.env.HTML_MODE ? process.env.HTML_MODE : 'node'
                }

                await ctx.render('report', data);
            }
            return;
        } catch (err) {
            console.error('error', err);
        }

    } else {
        try {
            let reportsJSON = await readdirAsync(config.reportsFolder);
            // filter hidden files like .DS_Store
            reportsJSON = reportsJSON.filter(item => !(/(^|\/)\.[^\/\.]/g).test(item));
            reportsJSON.forEach(report => {
                if (report.indexOf('.json') != -1) {
                    try {
                        const reportJSON = JSON.parse(fs.readFileSync(`${config.reportsFolder}/${report}`));

                        reports[report.replace("report-", "").replace(".json", "")] = reportJSON.pages;
                    } catch (err) {
                        console.error('error parsing json file', err);
                    }
                }

            });


        } catch (err) {
            console.error('error', err);
        }
    }
    await ctx.render('reports', {
        reports
    });
})

app.listen(3000);

