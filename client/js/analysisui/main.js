/* jshint evil: true, strict: true */

'use strict';

var _ = require('underscore');
var $ = require('jquery');
var Backbone = require('backbone');
Backbone.$ = $;

var Options = require('./options');
var OptionsView = require('./optionsview');
var Layoutdef = require('./layoutdef');
var FormatDef = require('./formatdef');

function addMsgListener(cmd, callback, failed) {
    window.addEventListener("message",
        function (e) {
            //try {

                var msg = e.data;
                if (msg.cmd !== cmd)
                    return;

                callback(msg.data);
            //} catch (e) {
            //    failed(e);
            //}
        }, false);
}

function sendMsg(id, data) {
    var msg = { cmd: id, data: data };
    window.parent.postMessage(msg, '*');
}

var Analysis = function(def) {
    //var module = { exports : { } };
    eval(def);

    var options = module.exports.options;

    this.model = { options: new Options(options), layoutdef: new module.exports.Layoutdef() };
    this.View = new OptionsView( { className: "silky-options-content", model: this.model } );
};

var analysis = null;
var analysisResources = null;
var errored = false;
var $header = null;
var $hide = null;

$(document).ready(function() {

    $(document).mouseup(this, mouseDown);
    $(document).mouseup(this, mouseUp);
    $(document).mousemove(this, mouseMove);

    addMsgListener("options.def", loadAnalysis, loadFailed);
    addMsgListener("analysis.resources", setResources);
    addMsgListener("options.changed", setOptionsValues);

    sendMsg("document.ready");

    $(window).resize( updateContainerHeight );
});

function loadAnalysis(def) {
    analysis = new Analysis(def);

    analysis.model.resources = analysisResources;

    var title = analysis.model.layoutdef.getTitle();
    console.log("loading - " + title + "...");
    var $title = $('.silky-options-title');
    $title.empty();
    $title.append(title);


    $('body').append(analysis.View.$el);
    analysis.View.render();

    var $hide = $('.silky-sp-back-button');
    $hide.on("click", function(event) {
        closeOptions();
    });

    analysis.model.options.on('options.valuesForServer', onValuesForServerChanges);

    updateContainerHeight();
}

function loadFailed(e) {
    errored = true;
    console.log(e);
}

function setResources(resources) {

    analysisResources = resources;

    if (analysis === null)
        return;

    analysis.model.resources = resources;
}

function setOptionsValues(data) {

    var model = analysis.model;
    var params = Options.getDefaultEventParams("changed");
    params.silent = true;
    model.options.beginEdit();
    _.each(data, function(value, key, list) {
        model.options.setOptionValue(key, value, params);
    });
    model.options.endEdit();
}

function onValuesForServerChanges(e) {

    var compiledList = {};

    _.each(e.map, function(value, key, list) {
        compiledList[key] = value.option.getValue();
    });

    /*for (var i = 0; i < e.data.length; i++)
        list[e.data[i].name] = e.data[i].option.getValue();*/

    sendMsg("options.changed", compiledList);
}


function mouseUp(event) {
    var data = {
        eventName: "mouseup",
        which: event.which,
        pageX: event.pageX,
        pageY: event.pageY
    };

    sendMsg("document.mouse", data);
}

function mouseMove(event) {
    var data = {
        eventName: "mousemove",
        which: event.which,
        pageX: event.pageX,
        pageY: event.pageY
    };

    sendMsg("document.mouse", data);
}

function mouseDown(event) {
    var data = {
        eventName: "mousedown",
        which: event.which,
        pageX: event.pageX,
        pageY: event.pageY
    };

    sendMsg("document.mouse", data);
}


function closeOptions() {
    sendMsg("options.close");
}

function updateContainerHeight() {

    if (analysis === null)
        return;

    var $content = $('.silky-options-content');

    var pos = $content.position();

    var properties = $('body').css(["height", "padding-top", "padding-bottom", "border-top", "border-bottom"]);
    var height = parseFloat(properties.height) - parseFloat(properties["padding-top"]) - parseFloat(properties["padding-bottom"]) - parseFloat(properties["border-top"]) - parseFloat(properties["border-bottom"]);

    var value = height - pos.top;

    $content.css("height", value);
}
