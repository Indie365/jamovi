'use strict';

var $ = require('jquery');
var _ = require('underscore');
var PropertySupplier = require('./propertysupplier');

var ListItemControl = function(params) {

    PropertySupplier.extendTo(this, params);

    this.$el = $('<div></div>');

    this.registerSimpleProperty("format", null);
    this.registerSimpleProperty("valuekey", null);

    this.updateValue = function() {
        var index = this.getPropertyValue('valuekey');
        var data = this.option.getValue(index);
        if (_.isUndefined(data))
            this.disconnect();
        else
            this.render();
    };

    this._rendered = false;
    this._valid = false;

    this.render = function() {
        var format = this.getPropertyValue("format");
        if (format === null)
            throw "ListItemControl must have a fixed or specified data format.";
        var index = this.getPropertyValue("valuekey");
        var data = this.option.getValue(index);

        var inError = data !== null && format.isValid(data) === false;

        var properties = null;
        if (inError === false && this.getDataRenderProperties)
            properties = this.getDataRenderProperties(data, format, index);

        if (this._valid && inError === false)
            this.onUpdateView(data, format, properties);
        else {
            if (this.onEmptyingView)
                this.onEmptyingView();

            this.$el.empty();

            if (inError === false)
                this.onRender(data, format, properties);
            else
                this.onRenderError(data, format, properties);

            this._valid = inError === false;
        }

        var self = this;
        if (this._rendered)
            self.$el.trigger("contentchanged", {type:"both"});
        else
            this._rendered = true;
    };

    this.onRenderError = function(data, format, properties) {
        var $item = $('<div style="white-space: nowrap;  display: inline-block;" class="silky-list-item-value">Data Error</div>');
        this.$el.append($item);
    };

    this.option = null;

    this.onValueChanged = function(keys, data) {
        if (keys.length === 0)
            this.updateValue();
        else {
            var index = this.getPropertyValue("valuekey");
            var diff = this.keyDifference(keys, index);

            var d = diff[diff.length - 1];
            if (d !== null && d === 0)
                this.updateValue();
        }
    };

    this.onValueInserted = function(keys, data) {
        var index = this.getPropertyValue("valuekey");
        var diff = this.keyDifference(keys, index);

        var d = diff[diff.length - 1];
        if (d !== null && d >= 0)
            index[diff.length - 1] += 1;
    };

    this.onValueRemoved = function(keys, data) {
        var index = this.getPropertyValue("valuekey");
        var diff = this.keyDifference(keys, index);

        var d = diff[diff.length - 1];
        if (d === 0)
            this.disconnect();
        else if (d !== null && d > 0)
            index[diff.length - 1] -= 1;
    };

    this.connect = function(option) {
        this.option = option;
        option.source.on("valuechanged", this.onValueChanged, this);
        option.source.on("valueinserted", this.onValueInserted, this);
        option.source.on("valueremoved", this.onValueRemoved, this);
        if (this.onConnection)
            this.onConnection(option);

    };

    this.disconnect = function() {
        this.option.source.off("valuechanged", this.onValueChanged, this);
        this.option.source.off("valueinserted", this.onValueInserted, this);
        this.option.source.off("valueremoved", this.onValueRemoved, this);
        this.option = null;
        this.setPropertyValue("valuekey", null);
    };

    this.setOption = function(option) {
        this.connect(option);
    };

    this.keyDifference = function(originalKey, newKey) {
        var diff = [];
        for (var i = 0; i < newKey.length; i++) {
            if (i >= originalKey.length)
                break;

            var a1 = originalKey[i];
            var b1 = newKey[i];

            if (typeof a1 !== typeof b1)
                break;

            var f = 0;
            if (typeof a1 === 'string') {
                if (a1 !== b1)
                    f = null;
            }
            else {
                f = b1 - a1;
            }

            diff.push(f);
            if (f !== 0)
                break;
        }

        return diff;
    };
};

ListItemControl.extendTo = function(target, params) {
    ListItemControl.call(target, params);
};

module.exports = ListItemControl;
