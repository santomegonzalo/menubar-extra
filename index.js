'use strict';

let path = require('path');
let events = require('events');
let fs = require('fs');

let electron = require('electron');
let app = electron.app;
let Tray = electron.Tray;
let BrowserWindow = electron.BrowserWindow;

let extend = require('extend');
let Positioner = require('electron-positioner');

let _opts;

module.exports = function create(opts) {
    _opts = opts;

    if(typeof _opts === 'undefined') {
        _opts = {
            dir: app.getAppPath()
        };
    }

    if(typeof _opts === 'string') {
        _opts = {dir: _opts};
    }

    if(!_opts.dir) {
        _opts.dir = app.getAppPath();
    }

    if(!(path.isAbsolute(_opts.dir))) {
        _opts.dir = path.resolve(_opts.dir);
    }

    if(!_opts.index) {
        _opts.index = 'file://' + path.join(_opts.dir, 'index.html');
    }

    if(!_opts['windowPosition']) {
        _opts['windowPosition'] = (process.platform === 'win32') ? 'trayBottomCenter' : 'trayCenter';
    }

    if(typeof _opts['showDockIcon'] === 'undefined') {
        _opts['showDockIcon'] = false;
    }

    // set width/height on _opts to be usable before the window is created
    _opts.width = _opts.width || 400;
    _opts.height = _opts.height || 400;
    _opts.tooltip = _opts.tooltip || '';
    _opts.untached = false;

    app.on('ready', appReady);

    let menubar = new events.EventEmitter();
    menubar.app = app;

    // Set / get options
    menubar.setOption = function(opt, val) {
        _opts[opt] = val;
    };

    menubar.getOption = function(opt) {
        return _opts[opt];
    };

    menubar.detach = function() {
        _opts.untached = true;
    };

    menubar.attach = function() {
        _opts.untached = false;
    }

    return menubar;
}

function appReady() {
    if(app.dock && !_opts['showDockIcon']) {
        app.dock.hide();
    }

    let iconPath = _opts.icon || path.join(_opts.dir, 'IconTemplate.png');

    if(!fs.existsSync(iconPath)) {
        iconPath = path.join(__dirname, 'example', 'IconTemplate.png');
    }

    let cachedBounds; // cachedBounds are needed for double-clicked event
    let defaultClickEvent = _opts['show-on-right-click'] ? 'right-click' : 'click';

    menubar.tray = _opts.tray || new Tray(iconPath);
    menubar.tray.on(defaultClickEvent, clicked);
    menubar.tray.on('double-click', clicked);
    menubar.tray.setToolTip(_opts.tooltip);

    if(_opts.preloadWindow || _opts['preload-window']) {
        createWindow();
    }

    menubar.showWindow = showWindow;
    menubar.hideWindow = hideWindow;
    menubar.emit('ready');

    function clicked(e, bounds) {
        if(e.altKey || e.shiftKey || e.ctrlKey || e.metaKey) {
            return hideWindow();
        }

        if(menubar.window && menubar.window.isVisible()) {
            return hideWindow();
        }

        cachedBounds = bounds || cachedBounds;
        showWindow(cachedBounds);
    }

    function createWindow() {
        menubar.emit('create-window');

        let defaults = {
            show: false,
            frame: _opts.untached
        };

        let winOpts = extend(defaults, _opts);
        menubar.window = new BrowserWindow(winOpts);

        menubar.positioner = new Positioner(menubar.window);

        if(!_opts['always-on-top']) {
            menubar.window.on('blur', hideWindow);
        } 
        else {
            menubar.window.on('blur', emitBlur);
        }

        if(_opts['show-on-all-workspaces'] !== false) {
            menubar.window.setVisibleOnAllWorkspaces(true);
        }

        menubar.window.on('close', windowClear);
        menubar.window.loadURL(_opts.index);
        menubar.emit('after-create-window');
    }

    function showWindow(trayPos) {
        if(!menubar.window) {
            createWindow();
        }

        menubar.emit('show');

        if(trayPos && trayPos.x !== 0) {
            // Cache the bounds
            cachedBounds = trayPos;
        } 
        else if(cachedBounds) {
            // Cached value will be used if showWindow is called without bounds data
            trayPos = cachedBounds;
        }

        // Default the window to the right if `trayPos` bounds are undefined or null.
        let noBoundsPosition = null;

        if((trayPos === undefined || trayPos.x === 0) && _opts['windowPosition'].substr(0, 4) === 'tray') {
            noBoundsPosition =(process.platform === 'win32') ? 'bottomRight' : 'topRight';
        }

        let position = menubar.positioner.calculate(noBoundsPosition || _opts['windowPosition'], trayPos);

        let x =(_opts.x !== undefined) ? _opts.x : position.x;
        let y =(_opts.y !== undefined) ? _opts.y : position.y;

        menubar.window.setPosition(x, y);
        menubar.window.show();
        menubar.emit('after-show');

        return;
    }

    function hideWindow() {
        if(!menubar.window || _opts.untached ) {
            return;
        }

        menubar.emit('hide');
        menubar.window.hide();
        menubar.emit('after-hide');
    }

    function windowClear() {
        delete menubar.window;
        menubar.emit('after-close');
    }

    function emitBlur() {
        menubar.emit('focus-lost');
    }
}
