const fetch = require('node-fetch');


if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

async function getLatestArtifact() {
    const artifactURL = 'https://api.github.com/repos/arobus/ui-lighthouse-reports/actions/artifacts';

    let respObject = await fetch(artifactURL, {
        method: 'GET',
        headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Basic ${process.env.TOKEN}`
        }
    });
    let resp = await respObject.json();
    return resp.artifacts[0];

}

/**
 * Sends asynchronous message into Google Chat
 * @return{obj} response
 */
async function webhook(data) {
    const webhookURL = 'https://chat.googleapis.com/v1/spaces/AAAAdssUjg0/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=O8Ndnx1eXtPo3JL1DYq1PgfI2iCb5KVcCEmodT5wIHE%3D';

    const payload = JSON.stringify({
        "cards": [
            {
                "header": {
                    "title": "Lighthouse Report",
                    "subtitle": data.REPORT_DATE,
                },
                "sections": [
                    {
                        "widgets": [
                            {
                                "textParagraph": {
                                    "text": `<b>Avg. Performance Score</b> is <font color="#ff0000">${data.AVG_SCORE}</font>,<br><b>Least Performant Component / Page</b> is <font color="#0000ff">${data.LEAST_SCORE_COMPONENT}</font> with <font color="#ff0000">${data.LEAST_SCORE_VALUE}</font>`
                                }
                            },
                            {
                                "buttons": [
                                    {
                                        "textButton": {
                                            "text": "VIEW RUN",
                                            "onClick": {
                                                "openLink": {
                                                    "url": `https://github.com/arobus/ui-lighthouse-reports/actions/runs/${data.RUN_ID}`
                                                }
                                            }
                                        }
                                    }
                                ]
                            },
                            {
                                "textParagraph": {
                                    "text": `<i>You can download an html version of the report from the run page. Look for Artifacts section -> Click on report-artifact </i>`
                                }
                            }
                        ]
                    }
                ]
            }
        ]
    });
    return await fetch(webhookURL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
        },
        body: payload,
    });
}

(async () => {
    const artifact = await getLatestArtifact();
    const response = await webhook(Object.assign({}, process.env, { ARTIFACT_URL: artifact.archive_download_url, RUN_ID: artifact.workflow_run.id }));
})();