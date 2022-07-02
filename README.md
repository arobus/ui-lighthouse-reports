## Lighthouse Report Generator

## How to run 
* Setup project
`> npm install`

* Create routes folder with routes.json file with the following format
```
 [
   ...
   {
     "name": "RouteName",
     "path": "/relativeRoutePath"
   }
   ...
 ]
```

* Generate reports
`> node index.js`


* You can view the reports by going into the reports folder or by running `node viewer.js` which will start a web server by default running at `http://localhost:3000`