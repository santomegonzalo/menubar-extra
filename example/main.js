'use strict';

let menubar = require('menubar');

let mb = menubar();

mb.on('ready', function ready() {
  console.log('app is ready');
});
