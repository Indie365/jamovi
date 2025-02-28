
'use strict';

const $ = require('jquery');
const Backbone = require('backbone');
const ActionHub = require('../actionhub');
const focusLoop = require('../../common/focusloop');
const EventEmitter = require('events');

class RibbonGroup extends EventEmitter {

    /*
    params
    {
        title:          //Title to be displayed by the group. Make '' for not title but leave space or null for no title and no space.
        orientation:    //How are the contents displayed 'vertical' or 'horizontal' (default)
        titlePosition:  //Title at the 'top' or 'bottom' (default)
        right:          //Is the button docked to the right? [default: false]
        margin:         //defines the size of the left right magins [default: normal]
        $el:            //jquery element. Will create if missing.
        items:          //Array of menu items. Not needed, can use 'addItem'.
        align-contents: // [default: stretch]
    }
    */

    constructor(params) {
        super();
        let title = params.title === undefined ? null : params.title;
        let orientation = params.orientation === undefined ? 'horizontal' : params.orientation;
        let right = params.right === undefined ? false : params.right;
        let $el = params.$el === undefined ? $('<div></div>') : params.$el;
        let titlePosition =  params.titlePosition === undefined ? 'bottom' : params.titlePosition;
        let margin =  params.margin === undefined ? 'normal' : params.margin;
        let align = params.alignContents === undefined ? (orientation === 'horizontal' ? 'center' : 'stretch') : params.alignContents;
        let name = params.name === undefined ? null : params.name;

        let labelId = focusLoop.getNextAriaElementId('label');

        this.$el = $el;
        this.$el.addClass('jmv-ribbon-group');
        this.$el.addClass('jmv-ribbon-group-margin-' + margin);
        if (title !== null) {
            this.$el.attr('data-position', titlePosition);
            this.$el.attr('aria-labelledby', labelId);
            this.$el.attr('role', 'group');
        }
        else
            this.$el.attr('role', 'group');
        this.$el.attr('aria-orientation', orientation);

        if (name !== null)
            this.$el.attr('data-name', this.name.toLowerCase());

        this.name = name;
        this.title = title;
        this.dock = right ? 'right' : 'left';

        this.$el.attr('disabled');
        if (right)
            this.$el.addClass('right');

        this.items = [];

        let html = '';
        html += '<div class="jmv-ribbon-group-body jmv-ribbon-group-body-' + orientation + '" style="align-items: ' + align + '" role="none">';
        html += '</div>';
        if (title !== null)
            html += `<div id="${labelId}" class="jmv-ribbon-group-label">${title}</div>`;

        this.$el.append(html);

        this.$label = this.$el.find('.jmv-ribbon-group-label');
        this.$body   = this.$el.find('.jmv-ribbon-group-body');

        if (params.items !== undefined) {
            for (let i = 0; i < params.items.length; i++)
                this.addItem(params.items[i]);
        }
    }
    
    setParent(parent, parentShortcutPath, inMenu) {
        for (let i = 0; i < this.items.length; i++) {
            let item = this.items[i];
            if (item.setParent)
                item.setParent(parent, parentShortcutPath, inMenu);
        }
    }

    setTabName(name) {
        for (let i = 0; i < this.items.length; i++) {
            let item = this.items[i];
            if (item.setTabName)
                item.setTabName(name);
        }
    }

    getEntryButton(openPath, open, fromMouse) {
        if (openPath.length > 0) {
            for (let item of this.items) {
                if (item.getEntryButton) {
                    let openedItem = item.getEntryButton(openPath, open, fromMouse);
                    if (openedItem !== null)
                        return openedItem;
                }
            }
        }
        return null;
    }

    addItem(item) {
        this.items.push(item);

        if (this.$separator === undefined && item.dock === 'right')
            this.$separator = $('<div class="jmv-ribbon-button-separator"></div>').appendTo(this.$body);

        if (item.dock === 'right')
            item.$el.insertAfter(this.$separator);
        else {
            if (this.$separator === undefined)
                item.$el.appendTo(this.$body);
            else
                item.$el.insertBefore(this.$separator);
        }

        item.on('menuActioned', (item) => {
            if (this.name !== null) {
                let action = ActionHub.get(this.name);
                action.do(item);
            }
            this.emit('menuActioned', item);
        });
    }

    hideMenu() {
        for (let item of this.items) {
            if (item.hideMenu)
                item.hideMenu();
        }
    }

    setEnabled(enabled) {
        this.$el.prop('disabled', ! enabled);
    }

    getMenus() {
        let menus = [];
        for (let item of this.items) {
            if (item.getMenus)
                menus = menus.concat(item.getMenus());
        }
        return menus;
    }
}

module.exports = RibbonGroup;
