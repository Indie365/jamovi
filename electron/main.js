'use strict';
const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const path = require('path')

if (process.argv.length >= 3)
    global.port = process.argv[2]

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

app.on('ready', function() {

    mainWindow = new BrowserWindow({ width: 800, height: 1200 });

    var rootPath = path.join(__dirname, '..', 'client') + '/'
	
	// windows path adjustments
	if (rootPath.startsWith('/') === false)
		rootPath = '/' + rootPath
	rootPath = rootPath.replace(/\\/g, '/')
	
    var rootUrl = 'file://' + rootPath
    var serverPath = rootPath + 's/'
    var serverUrl = rootUrl + 's/'
    
    mainWindow.loadURL(rootUrl + 'index.html');

    // Open the DevTools.
    mainWindow.webContents.openDevTools();
    
    var session = mainWindow.webContents.session
    session.webRequest.onBeforeRequest(function(details, callback) {

        // redirect requests to the local tornado server when appropriate

        var url = details.url
        
        if (url.startsWith(serverUrl)) {
        
            var relative = url.slice(serverUrl.length)
            var newUrl = 'http://localhost:' + global.port + '/' + relative
            
            callback({ redirectURL : newUrl })
        }
        else {
        
            callback({})
        }
    })

    // Emitted when the window is closed.
    mainWindow.on('closed', function() {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null;
    })
})

app.on('window-all-closed', function() {
    app.quit()
})
