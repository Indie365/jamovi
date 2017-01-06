'use strict';

var $ = require('jquery');
var _ = require('underscore');
var OptionListControl = require('./optionlistcontrol');
var GridOptionControl = require('./gridoptioncontrol');
var FormatDef = require('./formatdef');
var DragNDrop = require('./dragndrop');
var EnumPropertyFilter = require('./enumpropertyfilter');
var TargetListValueFilter = require('./targetlistvaluefilter');
var SuperClass = require('../common/superclass');
var Backbone = require('backbone');

var GridTargetList = function(params) {
    GridOptionControl.extendTo(this, params);
    DragNDrop.extendTo(this);
    _.extend(this, Backbone.Events);

    this.registerSimpleProperty("maxItemCount", -1);
    this.registerSimpleProperty("valueFilter", "none", new EnumPropertyFilter(["none", "unique", "uniquePerRow", "uniquePerColumn"], "none"));
    this.registerSimpleProperty("itemDropBehaviour", "insert", new EnumPropertyFilter(["overwrite", "insert", "emptyspace"], "insert"));

    this.gainOnClick = true;
    this._supplier = null;
    this._actionsBlocked = false;

    this._listFilter = new TargetListValueFilter();

    this.targetGrid = new OptionListControl(params);
    this.targetGrid.$el.addClass("silky-target-list");
    this.targetGrid.on('changing', (event) => {
        this.trigger('changing', event);
    });

    this._targetDoubleClickDetect = 0;
    this.targetGrid.$el.on('click', null, this, function(event) {
        var self = event.data;
        self._targetDoubleClickDetect += 1;
        if (self._targetDoubleClickDetect === 1) {
            setTimeout(function () {
                if (self._targetDoubleClickDetect > 1)
                    self.onAddButtonClick();
                self._targetDoubleClickDetect = 0;
            }, 300);
        }
    });

    this.setControlManager = function(context) {
        this.targetGrid.setControlManager(context);
    };

    this.onPropertyChanged = function(name) {
        if (name === "maxItemCount") {
            var value = this.getPropertyValue(name);
            this.targetGrid.setPropertyValue(name, value);
        }
    };

    this.refreshListItems = function() {
        this.targetGrid.refreshItems();
    };

    // Drag/Drop methods
    this.setPickupSourceElement(this.targetGrid.$el);

    this.getPickupItems = function() {
        var items = [];
        for (var i = 0; i < this.targetGrid.selectedCellCount(); i++) {
            var cell = this.targetGrid.getSelectedCell(i);
            var cellInfo = this.targetGrid.getCellInfo(cell);
            if (cellInfo.value !== null && cellInfo.value !== undefined) {
                let formattedValue = new FormatDef.constructor(cellInfo.value, cellInfo.format);
                let pickupItem = { value: formattedValue, cellInfo: cellInfo, $el: cell.$el };
                let item = this._supplier.getItemFromValue(formattedValue);
                if (item !== null)
                    pickupItem.properties = item.properties;
                items.push(pickupItem);
            }
        }
        return items;
    };

    this.onDragDropStart = function() {
        this.option.beginEdit();
        this.beginPropertyEdit();
    };

    this.onDragDropEnd = function() {
        this.endPropertyEdit();
        this.option.endEdit();
    };

    this.onItemsDropping = function(items, intoSelf) {
        var list = [];
        while (items.length > 0)
            list.push(items.shift());

        for (var i = 0; i < list.length; i++) {
            var cellInfo = list[i].cellInfo;
            if (cellInfo.removed === false) {

                if (this.targetGrid.removeFromOption(cellInfo)) {
                    for (var j = i + 1; j < list.length; j++) {
                        if (list[j].cellInfo.listIndex > cellInfo.listIndex)
                            list[j].cellInfo.listIndex -= 1;
                        else if (list[j].cellInfo.listIndex === cellInfo.listIndex) {
                            list.splice(j, 1);
                            j -= 1;
                        }
                    }
                }

                //only drop the compatible formats
                let formats = cellInfo.format.allFormats();
                for (let sf = 0; sf < formats.length; sf++) {
                    let formattedValue = new FormatDef.constructor(self._findValueWithKey(cellInfo.value, formats[sf].key), formats[sf].format);
                    let pickupItem = { value: formattedValue, cellInfo: cellInfo, $el: cellInfo.cell.$el };
                    let item = this._supplier.getItemFromValue(formattedValue);
                    if (item !== null) {
                        pickupItem.properties = item.properties;
                        items.push(pickupItem);
                    }
                }
            }
        }
    };

    this.testValue = function(item, rowIndex, columnName) {
        return this._listFilter.testValue(this.getPropertyValue("valueFilter"), item.value, rowIndex, columnName);
    };

    this.checkDropBehaviour = function() {
        let dropBehaviour = this.getPropertyValue("itemDropBehaviour");

        let hasMaxItemCount = this.targetGrid.maxItemCount >= 0;
        if (hasMaxItemCount && this.option.getLength() >= this.targetGrid.maxItemCount)
            dropBehaviour = "overwrite";

        return dropBehaviour;
    };

    // Catching methods
    this.catchDroppedItems = function(source, items, xpos, ypos) {
        let dropBehaviour = this.checkDropBehaviour();

        var cell = this.targetGrid.cellFromPosition(xpos, ypos);
        var pos = null;
        var destFormat = null;
        var onCell = false;
        if (dropBehaviour !== "emptyspace" && cell !== null) {
            var cellInfo = this.targetGrid.getCellInfo(cell);
            pos = cellInfo.valueIndex;
            destFormat = cellInfo.format;
            onCell = cellInfo.isValueCell;
        }
        let insert = dropBehaviour === "insert";

        for (var i = 0; i < items.length; i++) {
            if (onCell) {
                let subkeys = destFormat.allFormats(items[i].value.format);
                for (let x = 0; x < subkeys.length; x++) {
                    let key = pos.concat(subkeys[x].key);
                    this.addRawToOption(items[i++], key, insert);
                    insert = false;
                    if (i >= items.length)
                        break;
                }
            }
            else
                this.addRawToOption(items[i], null, false);
            pos = null;
            destFormat = null;
            insert = false;
            onCell = false;
        }
    };

    this.filterItemsForDrop = function(items, intoSelf, xpos, ypos) {
        return this.preprocessItems(items, intoSelf);
    };

    var _$hoverCell = null;

    this.onDraggingLeave = function() {
        if (_$hoverCell !== null) {
            _$hoverCell.removeClass("item-hovering");
            _$hoverCell.removeClass("item-overwrite-on-drop");
            _$hoverCell.removeClass("item-insert-on-drop");
            _$hoverCell.removeClass("item-emptyspace-on-drop");
            _$hoverCell = null;
        }
    };

    this.hasSubDropTarget = function(xpos, ypos) {
        let cell =  this.targetGrid.cellFromPosition(xpos, ypos);
        var subDroppable = null;
        if (cell.item !== null && cell.item._dropId !== undefined)
            subDroppable = cell.item;
        return subDroppable;
    };

    this.onDraggingOver = function(xpos, ypos) {
        let dropBehaviour = this.checkDropBehaviour();
        if (_$hoverCell !== null) {
            _$hoverCell.removeClass("item-hovering");
            _$hoverCell.removeClass("item-overwrite-on-drop");
            _$hoverCell.removeClass("item-insert-on-drop");
            _$hoverCell.removeClass("item-emptyspace-on-drop");
            _$hoverCell = null;
        }

        let cell =  this.targetGrid.cellFromPosition(xpos, ypos);
        let cellInfo = null;
        if (cell !== null)
            cellInfo = this.targetGrid.getCellInfo(cell);

        if (cellInfo !== null) {

            var hasMaxItemCount = this.targetGrid.maxItemCount >= 0;
            if (cellInfo.isValueCell === false && hasMaxItemCount && this.option.getLength() >= this.targetGrid.maxItemCount)
                return;

            if (cellInfo.isValueCell === false)
                dropBehaviour = 'insert';

            _$hoverCell = cell.$content;
            _$hoverCell.addClass("item-hovering");
            _$hoverCell.addClass("item-" + dropBehaviour + "-on-drop");
        }
    };

    this.inspectDraggedItems = function(source, items) {

    };

    this.dropTargetElement = function() {
        return this.targetGrid.$el;
    };

    this.setSupplier = function(supplier) {
        this._supplier = supplier;
        var self = this;
        this._supplier.supplierGrid.on('layoutgrid.gotFocus', function() {
            self.gainOnClick = true;
            self.targetGrid.clearSelection();
            self.unblockActionButtons();
        });

        this._supplierDoubleClickDetect = 0;
        this._supplier.supplierGrid.$el.on('click', null, this, function(event) {
            var self = event.data;
            if (self._supplier.isMultiTarget())
                return;

            self._supplierDoubleClickDetect += 1;
            if (self._supplierDoubleClickDetect === 1) {
                setTimeout(function () {
                    if (self._supplierDoubleClickDetect > 1)
                        self.onAddButtonClick();
                    self._supplierDoubleClickDetect = 0;
                }, 300);
            }
        });
    };

    this.blockActionButtons = function() {
        this.$button.prop('disabled', true);
        this.targetGrid.clearSelection();
        this._actionsBlocked = true;
    };

    this.unblockActionButtons = function() {
        this.$button.prop('disabled', false);
        this._actionsBlocked = false;
    };

    this.renderTransferButton = function(grid, row, column) {

        this.$button = $('<button type="button" class="silky-option-variable-button"><span class="mif-arrow-right"></span></button>');
        var self = this;
        this.$button.click(function(event) {
            if (self._actionsBlocked === false)
                self.onAddButtonClick();
        });

        grid.addCell(column, row, true, this.$button);

        return { height: 1, width: 1 };
    };

    this.onRenderToGrid = function(grid, row, column) {

        this.targetGrid.setOption(this.option);

        this.targetGrid.setCellBorders(this.targetGrid._columnInfo._list.length > 1 ? "columns" : null);

        if (grid.addTarget) {
            this.setSupplier(grid);
            grid.addTarget(this);
            this.registerDropTargets(this);
        }

        var self = this;
        var id = this.option.getName();
        var label = this.getPropertyValue('label');
        var hasSupplier = this._supplier !== null;

        if (label !== null)
            grid.addCell(hasSupplier ? column + 1 : column, row, true, $('<div style="white-space: nowrap;" class="silky-target-list-header silky-control-margin-' + this.getPropertyValue("margin") + '">' + label + '</div>'));

        if (hasSupplier === true)
            this.renderTransferButton(grid, row + 1, column);

        this.targetGrid.setAutoSizeHeight(false);

        this.targetGrid.on('layoutgrid.lostFocus layoutgrid.gotFocus', function() {
            self.onSelectionChanged();
        });
        var cell = grid.addLayout(column + 1, row + 1, false, this.targetGrid);
        cell.setStretchFactor(0.5);
        if (this.targetGrid.isSingleItem === false)
            cell.dockContentHeight = true;

        return { height: 2, width: 2 };
    };

    this.onSelectionChanged = function() {
        var gainOnClick = this.targetGrid.hasFocus === false;
        this.gainOnClick = gainOnClick;
        var $span = this.$button.find('span');
        $span.addClass(gainOnClick ? 'mif-arrow-right' : 'mif-arrow-left');
        $span.removeClass(gainOnClick ? 'mif-arrow-left' : 'mif-arrow-right');
    };

    var self = this;
    this.targetGrid.getSupplierItem = function(localItem) {
        var properties = { root: null, sub: null };
        var supplierItem = self._supplier.pullItem(localItem, false);
        if (supplierItem !== null)
            properties.root = supplierItem.properties;

        if (localItem.format.children && localItem.raw !== null && localItem.raw !== undefined) {
            let subProperties = { };
            let subFormatInfo = localItem.format.allFormats();
            for (let sf = 0; sf < subFormatInfo.length; sf++) {
                supplierItem = self._supplier.pullItem(new FormatDef.constructor(self._findValueWithKey(localItem.raw, subFormatInfo[sf].key), subFormatInfo[sf].format), false);
                if (supplierItem !== null)
                    subProperties[subFormatInfo[sf].key.join("-")] = supplierItem.properties;
            }
            properties.sub = subProperties;
        }

        return properties;
    };

    this.getSupplierItems = function() {
        var items = this._supplier.getSelectedItems();
        return this.preprocessItems(items, false);
    };

    this.preprocessItems = function(items, intoSelf) {
        var data = { items: items, intoSelf: intoSelf };
        this.trigger("preprocess", data);

        var testedItems = [];
        for (var i = 0; i < data.items.length; i++) {
            if (this.testValue(data.items[i])) {
                testedItems.push(data.items[i]);
                if (this.targetGrid.isSingleItem)
                    break;
            }
        }
        return testedItems;
    };

    this.addRawToOption = function(item, key, insert) {
        return this.targetGrid.addRawToOption(item.value.raw, key, insert, item.value.format);
    };

    this.onAddButtonClick = function() {
        this._supplier.blockFilterProcess = true;
        this.targetGrid.suspendLayout();

        this.option.beginEdit();
        this.beginPropertyEdit();
        var postProcessSelectionIndex = null;
        var postProcessList = null;
        if (this.gainOnClick) {
            var selectedItems = this.getSupplierItems();
            var selectedCount = selectedItems.length;
            if (selectedCount > 0) {
                for (var i = 0; i < selectedCount; i++) {
                    var selectedItem = selectedItems[i];
                    if (postProcessSelectionIndex === null || postProcessSelectionIndex > selectedItem.index) {
                        postProcessSelectionIndex = selectedItem.index;
                        if (this._supplier.getPropertyValue("persistentItems"))
                            postProcessSelectionIndex += 1;
                    }

                    if (this.addRawToOption(selectedItem, null, false) === false)
                        break;
                }
                postProcessList = this._supplier;
            }
        }
        else if (this.targetGrid.selectedCellCount() > 0) {
            var startRow = -1;
            var length = 0;
            var selectionCount = this.targetGrid.selectedCellCount();
            var index = 0;
            while (this.targetGrid.selectedCellCount() > index) {
                var cell = this.targetGrid.getSelectedCell(index);

                var rowIndex = this.targetGrid.displayRowToRowIndex(cell.data.row);
                if (postProcessSelectionIndex === null || postProcessSelectionIndex > rowIndex)
                    postProcessSelectionIndex = rowIndex;

                if (this.targetGrid.removeFromOption(this.targetGrid.getCellInfo(cell)) === false)
                    index += 1;
            }
            postProcessList = this.targetGrid;
        }

        this.endPropertyEdit();
        this.option.endEdit();

        this.targetGrid.resumeLayout();
        this._supplier.blockFilterProcess = false;
        this._supplier.filterSuppliersList();

        if (postProcessSelectionIndex !== null)
            postProcessList.selectNextAvaliableItem(postProcessSelectionIndex);
    };

    this.pushRowsBackToSupplier = function(rowIndex, count) {
        count = _.isUndefined(count) ? 1 : count;
        for (var row = rowIndex; row < rowIndex + count; row++) {
            var rowCells = this.targetGrid.getRow(this.targetGrid.rowIndexToDisplayIndex(row));
            for (var c = 0; c < rowCells.length; c++) {
                var rowCell = rowCells[c];
                var columnInfo = this.targetGrid._columnInfo._list[rowCell.data.column];
                var cellInfo = this.targetGrid.getCellInfo(rowCell);
                if (cellInfo.value !== null && cellInfo.value !== undefined) {
                    let subFormatInfo = cellInfo.format.allFormats();
                    for (let sf = 0; sf < subFormatInfo.length; sf++)
                        self._supplier.pushItem(new FormatDef.constructor(self._findValueWithKey(cellInfo.value, subFormatInfo[sf].key), subFormatInfo[sf].format));
                }
            }
        }
    };

    this._findValueWithKey = function(data, key) {
        let value = data;
        for (let i = 0; i < key.length; i++)
            value = value[key[i]];

        return value;
    };

    this.targetGrid._override('updateValueCell', function(baseFunction, columnInfo, dispRow, value) {
        baseFunction.call(self.targetGrid, columnInfo, dispRow, value);
        var rowIndex = this.displayRowToRowIndex(dispRow);
        self._listFilter.addValue(new FormatDef.constructor(value, columnInfo.format), rowIndex, columnInfo.name);
    });

    //overrideing functions in the target grid
    this.targetGrid._override('onOptionValueInserted', function(baseFunction, keys, data) {
        if (self._supplier !== null)
            self.pushRowsBackToSupplier(0, this._localData.length);

        baseFunction.call(self.targetGrid, keys, data);

        for (var i = 0; i < self.targetGrid._cells.length; i++) {
            var cellInfo = this.getCellInfo(self.targetGrid._cells[i]);
            if (cellInfo.value !== null && cellInfo.value !== undefined) {
                let subFormatInfo = cellInfo.format.allFormats();
                for (let sf = 0; sf < subFormatInfo.length; sf++)
                    self._supplier.pullItem(new FormatDef.constructor(self._findValueWithKey(cellInfo.value, subFormatInfo[sf].key), subFormatInfo[sf].format));
            }
        }

        if (self._supplier !== null)
            self._supplier.filterSuppliersList();
    });

    //overrideing functions in the target grid
    this.targetGrid._override('onOptionValueRemoved', function(baseFunction, keys, data) {
        if (self._supplier !== null)
            self.pushRowsBackToSupplier(keys[0], 1);

        self._listFilter.removeRow(keys[0]);

        baseFunction.call(self.targetGrid, keys, data);

        if (self._supplier !== null)
            self._supplier.filterSuppliersList();
    });

    //overrideing functions in the target grid
    this.targetGrid._override('onOptionValueChanged', function(baseFunction, keys, data) {
        if (self._supplier !== null)
            self.pushRowsBackToSupplier(0, this._localData.length);

        self._listFilter.clear();

        baseFunction.call(self.targetGrid, keys, data);

        for (var i = 0; i < self.targetGrid._cells.length; i++) {
            var cellInfo = this.getCellInfo(self.targetGrid._cells[i]);
            if (cellInfo.value !== null && cellInfo.value !== undefined) {
                let subFormatInfo = cellInfo.format.allFormats();
                for (let sf = 0; sf < subFormatInfo.length; sf++)
                    self._supplier.pullItem(new FormatDef.constructor(self._findValueWithKey(cellInfo.value, subFormatInfo[sf].key), subFormatInfo[sf].format));
            }
        }

        if (self._supplier !== null)
            self._supplier.filterSuppliersList();
    });

};

SuperClass.create(GridTargetList);

module.exports = GridTargetList;
