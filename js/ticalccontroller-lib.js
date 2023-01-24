(function (root, factory) { root.TIControllerAPI = factory(); }(this, function () {
/**
 * almond 0.2.5 Copyright (c) 2011-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {

            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        if (config.deps) {
            req(config.deps, config.callback);
        }
        return req;
    };

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());
define("almond", function(){});

define('texasinstruments/TICalc',[],
    function() {

        var TICalcView = function () {
            this._template = "<div id='calculatorDiv' class='calculatorDiv' style='position:fixed; top:120px; left:50%; z-index:1040;' tabIndex=0></div>";
            this._calc = {};
            this._render();
        };

        TICalcView.prototype.monitorDeepZoom = function() {
            $(document).on('deepZoomLevel.enter deepZoomLevel.exit',$.proxy( this._handleDeepZoomStatusChange, this));
            $(document).trigger('deepZoomLayer.getStatus', $.proxy(this._handleDeepZoomStatus, this));
        };

        TICalcView.prototype._handleDeepZoomStatusChange = function(e) {
            if( e.namespace === 'enter' ) {
                this._deepZoomHide();
            } else if( e.namespace === "exit" ) {
                this._enableDraggable();
            }
        };

        TICalcView.prototype._handleDeepZoomStatus = function( isInDeepZoom ) {
            if( isInDeepZoom ) {
                this._doDeepZoomCoupling();
            }
        };

        TICalcView.prototype._doDeepZoomCoupling = function() {
            var title = $("[toolId=" + this._toolId +"]" ).attr( "data-original-title")
            $(document).trigger('deepZoomLayer.setCoupling', {
                title: title,
                html: '#calculatorDiv',
                hideCallback: $.proxy( this._deepZoomHide, this ),
                specialCare: $.proxy( this.onRenderDeepZoom, this )
            });
        };

        TICalcView.prototype.onRenderDeepZoom = function() {
            this.focus();
            this._disableDraggable();
        };

        TICalcView.prototype._deepZoomHide = function() {
            $( document ).trigger( 'toolClosed', this._toolId );
        };

        TICalcView.prototype.focus = function() {
            $('#calculatorDiv').focus();
        };

        TICalcView.prototype._render = function () {
            if( !(typeof($('#calculatorDiv').data('ui-draggable')) === "undefined") ){
                this._disableInteraction();
            }
            if( $("head + body > #calculatorDiv").length === 0 ) {
                if( window.app && TN8.usecalcs ){
                    /* Add calculatorDiv for previewer */
                    $('body').append( this._template );
                } else if($('#tn8-aslvideo').length === 0) {
                    // Added so ASL Player will always be the last thing before lastTabbable if it is present
                    $('#lastTabbable').before( this._template );
                } else {
                    $('#tn8-aslvideo').before( this._template );
                }
            }
            $('#calculatorDiv').draggable({
                drag: TICalcView.prototype._contain,
                stop: TICalcView.prototype._contain
            });
            TICalcView.prototype._startListening();
            $(document).trigger('tn.TICalculatorOpened', [this.name]);
        };

        TICalcView.prototype._startListening = function() {
            $(document).off('do.disableInteraction', $.proxy(TICalcView.prototype._disableInteraction, this))
                .on('do.disableInteraction', $.proxy(TICalcView.prototype._disableInteraction, this));
            $(document).off('do.enableInteraction', $.proxy(TICalcView.prototype._enableInteraction, this))
                .on('do.enableInteraction', $.proxy(TICalcView.prototype._enableInteraction, this));
        };

        TICalcView.prototype._disableInteraction = function() {
            this._disableDraggable();
        };

        TICalcView.prototype._enableInteraction = function() {
            this._enableDraggable();
        };

        TICalcView.prototype._enableDraggable = function() {
            $('#calculatorDiv').draggable() && $('#calculatorDiv').draggable("enable");
        };

        TICalcView.prototype._disableDraggable = function() {
            $('#calculatorDiv').draggable() && $('#calculatorDiv').draggable("disable");
        };

        TICalcView.prototype._resetDisplay = function(width, height) {
            $('#calculatorDiv').html("<div class='displayDiv' id='displayDiv'><canvas id='display' class='display' width='" + width + "' height='" + height + "'></canvas></div></div>");
        };

        TICalcView.prototype.remove = function() {
            $(document).off('deepZoomLevel.enter deepZoomLevel.exit', $.proxy( this._handleDeepZoomStatusChange, this ));
            $(document).off('do.disableInteraction', TICalcView.prototype._disableInteraction);
            $(document).off('do.enableInteraction', TICalcView.prototype._enableInteraction);
            $('#calculatorDiv').draggable( "destroy" );
            this._calc.killInstance && this._calc.killInstance();
            TICalcView.prototype._removeDragUtilHandlers();
        };

        TICalcView.prototype.show = function () {
            this._calc.showCalculator();
            TICalcView.prototype._addDragUtilHandlers();
            TICalcView.prototype._center();
            this._enableDraggable();
            $('#calculatorDiv').focus().trigger('mouseup');
            $(document).trigger('tn.TICalculatorOpened', [this.name]);
        };

        TICalcView.prototype.hide = function () {
            TICalcView.prototype._removeDragUtilHandlers();
            this._calc.hideCalculator && this._calc.hideCalculator();
            $(document).trigger('tn.TICalculatorClosed', [this.name]);
        };

        TICalcView.prototype.reset = function() {                
            this._calc.resetEmulator();
        };

        // -------------------------------------------------------------------------
        //            drag, bounding rect, and positioning methods
        // -------------------------------------------------------------------------
        //
        TICalcView.prototype._getViewportSize = function() {
            return {
                width: Math.round( Math.max(document.documentElement.clientWidth, window.innerWidth || 0) ),
                height: Math.round( Math.max(document.documentElement.clientHeight, window.innerHeight || 0) )
            };
        };
        TICalcView.prototype._normalize = function ( value, min, max ) {
            //return Math.round( Math.min( Math.max( value, min), max ) );
            if ( value < min ) {
                value = min;
            } else if ( value > max ) {
                value = max;
            }
            return value;
        };

        TICalcView.prototype._center = function() {
            var $calc = $('#calculatorDiv');
            var viewport = TICalcView.prototype._getViewportSize();
            // They put the "last z-index" in a closure but that gets messed up during navigation
            $calc.css({
                'z-index':1040,
                left: Math.max( viewport.width/2 - $calc.outerWidth()/2, 0 ),
                top: Math.max( viewport.height/2 - $calc.outerHeight()/2, 0 )
            });
        };

        TICalcView.prototype._contain = function( e, ui ) {
            var props = TICalcView.prototype._getContainmentDetails();
            if ( !!ui ) {
                ui.position.left = TICalcView.prototype._normalize( ui.position.left, props.left, props.right );
                ui.position.top = TICalcView.prototype._normalize( ui.position.top, props.top, props.bottom );
            } else {
                props.calc.css('left', TICalcView.prototype._normalize(parseInt(props.calc.css('left'),0), props.left, props.right) );
                props.calc.css('top', TICalcView.prototype._normalize( parseInt(props.calc.css('top'),0), props.top, props.bottom) );
            }
        };

        TICalcView.prototype._getContainmentDetails = function() {
            var $calc = $('#calculatorDiv');
            var w = $calc.outerWidth();
            var h = $calc.outerHeight();
            var viewport = TICalcView.prototype._getViewportSize();
            var remaining = 100;
            return {
                calc: $calc,
                viewport: viewport,
                remaining: remaining,
                left: Math.round( remaining - w ),
                top: Math.round( remaining - h ),
                right: Math.round( viewport.width - remaining ),
                bottom: Math.round( viewport.height - remaining ),
            };
        };

        TICalcView.prototype._debounce = function(func, wait, immediate) {
            var timeout;
            return function() {
                var context = this, args = arguments;
                var later = function() {
                    timeout = null;
                    if (!immediate) func.apply(context, args);
                };
                var callNow = immediate && !timeout;
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
                if (callNow) func.apply(context, args);
            };
        };

        var debounceDelay = 100;
        TICalcView.prototype._onResize = TICalcView.prototype._debounce( function() {
            TICalcView.prototype._contain();
        }, debounceDelay );

        TICalcView.prototype._addDragUtilHandlers = function() {
            $(window).off( 'resize', TICalcView.prototype._onResize )
                .on( 'resize', TICalcView.prototype._onResize );
        };
        TICalcView.prototype._removeDragUtilHandlers = function() {
            $(window).off( 'resize', TICalcView.prototype._onResize );
        };

        TICalcView.prototype._addId = function(calcType) {
            $('#calculatorDiv').addClass(calcType);
        };

        TICalcView.prototype._onDetectLoadComplete = function(calcType) {
            TICalcView.prototype._addId(calcType);
            TICalcView.prototype._addDragUtilHandlers();
            TICalcView.prototype._center();
            TICalcView.prototype._accessibilitySetup();
        };
        TICalcView.prototype._accessibilitySetup = function(calcType) {
            //The JAWS reader does not handle aria-describedby well and so the value of 
            //aria-describedby is copied to aria-label and aria-describedby is removed
            $('#calculatorDiv').attr("aria-label",$("#"+$('#calculatorDiv').attr("aria-describedby")).html());
            $('#calculatorDiv').removeAttr("aria-describedby");
        };
        // -------------------------------------------------------------------------

        return TICalcView;
    }
);
define(
    'texasinstruments/TI30',[
        'texasinstruments/TICalc'
    ],
    function(TICalcView) {
        var TI30CalcView = function() {
            this.readyEvent = 'ti30calc.ready';
            this.name = 'TI30';
            this._toolId = 16;
            TICalcView.call(this);
            return this;
        };

        TI30CalcView.prototype = $.extend(true, {}, TICalcView.prototype);

        TI30CalcView.prototype.onInitialized = function() {
            this.resize();
            this._onDetectLoadComplete(this.name);
            $(document).trigger(this.readyEvent);
        };

        TI30CalcView.prototype.resize = function() {
            // These sizes are the default sizes from TI Calcs version 2.2.x, the default size was decreased in 2.3.x
            this._calc.resize('width: 308px');
            this._calc.resize('height: 595px');
        };

        TI30CalcView.prototype.initialize = function(secure) {
            var urlPrefix = "";
            if( window.app ) {
                urlPrefix = document.location.origin + '/public/javascripts/';
            }
            $.ajax({url: TN8.baseUrl + urlPrefix + 'texasinstruments/js/ti30mv-min.js', dataType: 'script', timeout: 15000, cache: secure})
            .done(function() {
                this._resetDisplay(192, 75);
                var config =
                {
                    elementId: "calculatorDiv",
                    ROMLocation: TN8.baseUrl + urlPrefix + "texasinstruments/bin/ti30mv.h84state",
                    FaceplateLocation: TN8.baseUrl + urlPrefix + "texasinstruments/images/TI30XS_touch.svg",
                    KeyMappingFile: "",
                    KeyHistBufferLength: "10",
                    AngleMode: "RAD",
                    DisplayMode: "MATHPRINT",
                    accessibility: {
                        tabOrder: 0,
                        screenReaderAria: true,
                    },
                    onInitialized: $.proxy( this.onInitialized, this )
                };
                this._calc = new TI30(config);
                this._calc.errorHandler = $.proxy( this.errorHandlerTI30, this );
            }.bind(this))
            .fail(function(jqxhr, settings, exception) {
                $(document).trigger('ti.calc.destroy');
                $(document).trigger('ti.calc.resetBtn');
                //throw LIBRARY_LOAD_FAILED TN8 error
                if(window.TN8) {
                    window.TN8.throw("Failure to load ti30mv-min.js: " + exception, 3004);
                } 
            });
        };

        TI30CalcView.prototype.errorHandlerTI30 = function() {
            $(document).trigger('ti.calc.resetBtn');
            this._calc = {};
            
            TN8.throw("Failed to load TI-30 Calculator", TN8.errorType.TI30_LOAD_ERROR);
        };

        return TI30CalcView;
    }
);

define(
    'texasinstruments/TI84',[
        'texasinstruments/TICalc'
    ],
    function(TICalcView) {
        var TI84CeCalcView = function() {
            this.readyEvent = 'ti84calc.ready';
            this.name = 'TI84';
            this._toolId = 13;
            TICalcView.call(this);
            return this;
        };

        TI84CeCalcView.prototype = $.extend(true, {}, TICalcView.prototype);

        TI84CeCalcView.prototype.onInitialized = function() {
            this.checkScreenSize();
            this._onDetectLoadComplete(this.name);
            $(document).trigger(this.readyEvent);
        };

        TI84CeCalcView.prototype.checkScreenSize = function() {
            if( ( window.app || !TestEngine._isAppMode() ) && $(window).height() < 690 ) { //check if active window height is smaller than default calc size height
                this.resizeSmall();
            } else {
                this.resizeNormal();
            }
        };

        TI84CeCalcView.prototype.resizeNormal = function() {
            // These sizes are the default sizes from TI Calcs version 2.2.x, the default size was decreased in 2.3.x
            this._calc.resize('width: 303px');
            this._calc.resize('height: 690px');
        };

        TI84CeCalcView.prototype.resizeSmall = function() {
            // These sizes are the "small" sizes from TI Calcs version 2.2.x, the "small" size was decreased in 2.3.x
            this._calc.resize('width: 227px');
            this._calc.resize('height: 518px');
        };

        TI84CeCalcView.prototype.initialize = function(secure) {
            var urlPrefix = "";
            if( window.app ) {
                urlPrefix = document.location.origin + '/public/javascripts/';
            }
            $.ajax({url: TN8.baseUrl + urlPrefix + 'texasinstruments/js/ELG-min.js', dataType: 'script', timeout: 15000, cache: secure})
            .done(function() {
                this._resetDisplay(288, 192);
                var config = 
                {
                    elementId: "calculatorDiv",
                    ROMLocation: TN8.baseUrl + urlPrefix + "texasinstruments/bin/No_AppsCE.h84statej",
                    FaceplateLocation: TN8.baseUrl + urlPrefix + "texasinstruments/images/TI84CE_touch.svg",
                    KeyMappingFile: "",
                    KeyHistBufferLength: "10",
                    AngleMode: "RAD",
                    DisplayMode: "MATHPRINT",
                    accessibility: {
                        tabOrder: 0,
                        screenReaderAria: true,
                    },
                    onInitialized: $.proxy( this.onInitialized, this )
                };
                this._calc = new TI84PCE(config);
                this._calc.errorHandler = $.proxy( this.errorHandlerTI84CE, this );
            }.bind(this))
            .fail(function(jqxhr, settings, exception) {                
                $(document).trigger('ti.calc.destroy');
                $(document).trigger('ti.calc.resetBtn');
                //throw LIBRARY_LOAD_FAILED TN8 error
                if(window.TN8) {
                    window.TN8.throw("Failure to load ti84p-min.js: " + exception, 3004);
                }                    
            });
        };

        TI84CeCalcView.prototype.errorHandlerTI84CE = function() {
            $(document).trigger('ti.calc.resetBtn');
            this._calc = {};
            
            TN8.throw("Failed to load TI-84CE Calculator", TN8.errorType.TI84_LOAD_ERROR);
        };

        return TI84CeCalcView;
    }
);

define(
    'texasinstruments/TI108',[
        'texasinstruments/TICalc'
    ],
    function(TICalcView) {
        var TI108CalcView = function() {
            this.readyEvent = 'ti108calc.ready';
            this.name = 'TI108';
            this._toolId = 17;
            TICalcView.call(this);
            return this;
        };

        TI108CalcView.prototype = $.extend(true, {}, TICalcView.prototype);

        TI108CalcView.prototype.onInitialized = function() {
            this.resize();
            this._onDetectLoadComplete(this.name);
            $(document).trigger(this.readyEvent);
        };

        TI108CalcView.prototype.resize = function() {
            // These sizes are the default sizes from TI Calcs version 2.2.x, the default size was decreased in 2.3.x
            this._calc.resize('width: 245px');
            this._calc.resize('height: 369px');
        };

        TI108CalcView.prototype.initialize = function(secure) {
            var urlPrefix = "";
            if( window.app ) {
                urlPrefix = document.location.origin + '/public/javascripts/';
            }
            $.ajax({url: TN8.baseUrl + urlPrefix + 'texasinstruments/js/ti108-min.js', dataType: 'script', timeout: 15000, cache: secure})
                .done(function() {
                    this._resetDisplay(128, 20);
                    var config =
                    {
                        elementId: "calculatorDiv",
                        ROMLocation: TN8.baseUrl + urlPrefix + "texasinstruments/bin/ti108.h84state",
                        FaceplateLocation: TN8.baseUrl + urlPrefix + "texasinstruments/images/TI108_touch.svg",
                        KeyMappingFile: "",
                        KeyHistBufferLength: "10",
                        accessibility: {
                            tabOrder: 0,
                            screenReaderAria: true,
                        },
                        onInitialized: $.proxy( this.onInitialized, this )
                    };
                    this._calc = new TI108(config);
                    this._calc.errorHandler = $.proxy( this.errorHandlerTI108, this );
                }.bind(this))
                .fail(function(jqxhr, settings, exception) {
                    $(document).trigger('ti.calc.destroy');
                    $(document).trigger('ti.calc.resetBtn');
                    //throw LIBRARY_LOAD_FAILED TN8 error
                    if(window.TN8) {
                        window.TN8.throw("Failure to load ti108-min.js: " + exception, 3004);
                    }
                });
        };

        TI108CalcView.prototype.errorHandlerTI108 = function() {
            $(document).trigger('ti.calc.resetBtn');
            this._calc = {};
            
            TN8.throw("Failed to load TI-108 Calculator", TN8.errorType.TI108_LOAD_ERROR);
        };

        return TI108CalcView;
    }
);

/**
 * TICalcController
 * Copyright 2014 Pearson Education. 
 *
 * Build.version = ${project.version}
 * Build.timestamp = ${timestamp}
 */
define('texasinstruments/main',[
    'texasinstruments/TI30',
    'texasinstruments/TI84',//TI84 CE (Color Edition)
    'texasinstruments/TI108'
],
function(TI30View, TI84View, TI108View) {
    "use strict";
    return {
        createToolController: function() {
            return {
                TI30: TI30View,
                TI84: TI84View,
                TI108: TI108View
            }
        }
    }
});

return require('texasinstruments/main'); }));
