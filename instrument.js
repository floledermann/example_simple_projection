// instrumentation

//"use strict";

(function() {
    
    var filterLogPrefix = "HTMLCanvasElement.";
    var filterObject = function(obj) {
        return false;
        return obj && obj.tagName && obj.tagName == "CANVAS";
    }
    function log(str, obj) {
        if (str && (!filterLogPrefix || str.startsWith(filterLogPrefix))) {
            console.log(str);
            if (obj && filterObject(obj)) console.info(obj);
        }
    }
    
    function proxyMethod(obj, funcName, callback) {
        var originalFunction = obj[funcName];
        obj[funcName] = function() {
            var retVal = false;
            // obj may be a prototype, so we need to use "this" to have correct runtime object reference
            try {
                retVal = callback.call(this, arguments, originalFunction);
            }
            catch(e) {
                console.error("Exception in proxy callback: " + e.message);
                console.trace();
            }
            // a bit hacky: if return value is truthy, assume function has been handled
            if (!retVal) return originalFunction.apply(this, arguments);
            return retVal;
        }
    }
    
    function proxyMethods(obj, methodsTable) {
        Object.keys(methodsTable).forEach(function(funcName) {
            proxyMethod(obj, funcName, methodsTable[funcName]);
        });
    };
    
    function proxySetter(obj, propName, callback) {
        var descriptor = Object.getOwnPropertyDescriptor(obj, propName);
        var originalFunction = descriptor.set;
        if (!originalFunction) {
            console.error("Warning: no property named " + propName + " on " + obj);
        }
        Object.defineProperty(obj, propName, {
            set: function() {
                callback.call(this, arguments, originalFunction);
                originalFunction.apply(this, arguments);
            }
        })
    }
    
/*
    proxyMethod(document, "createElement", function(tagName, options) {
        log("creating element: " + tagName);
    });
*/   
    function logFunction(namePrefix, func) {
        return function(arguments, originalFunction) {
            var str = Array.prototype.join.call(arguments, ", ");
            log(namePrefix + "(" + str + ")", this);
            if (func) return func.call(this,arguments, originalFunction);
        }
    }
    
    function logAll(obj, functionNames, prefix, func) {
        functionNames.forEach(name => proxyMethod(obj, name, logFunction(prefix + name), func));
    }

    function proxyCanvas(canvas) {
        var canvasContext2dMethods = [
            "addHitRegion",
            "arc",
            "arcTo",
            "asyncDrawXULElement",
            "beginPath",
            "bezierCurveTo",
            "clearHitRegions",
            "clearRect",
            "clip",
            "closePath",
            "createImageData",
            "createLinearGradient",
            "createPattern",
            "createRadialGradient",
            "drawFocusIfNeeded",
            "drawImage",
            "drawWidgetAsOnScreen",
            "drawWindow",
            "ellipse",
            "fill",
            "fillRect",
            "fillText",
            "getImageData",
            "getLineDash",
            "isPointInPath",
            "isPointInStroke",
            "lineTo",
            "measureText",
            "moveTo",
            "putImageData",
            "quadraticCurveTo",
            "rect",
            "removeHitRegion",
            "resetTransform",
            "restore",
            "rotate",
            "save",
            "scale",
            "scrollPathIntoView",
            "setLineDash",
            "setTransform",
            "stroke",
            "strokeRect",
            "strokeText",
            "transform",
            "translate"
        ];
        /*
        {
            "lineTo": logFunction("CanvasRenderingContext2D.lineTo"),
            "lineTo": logFunction("CanvasRenderingContext2D.lineTo"),
        }*/
        
        proxyMethod(canvas, "getContext", logFunction("HTMLCanvasElement.getContext", function(arguments, originalFunction) {
            // contextType, contextAttributes
            if (arguments[0] == "2d") {
                if (this._proxyContext2d) return this._proxyContext2d;
                var context = originalFunction.apply(this, arguments);
                logAll(context, canvasContext2dMethods, "HTMLCanvasElement.CanvasRenderingContext2D.");
                this._proxyContext2d = context;
                return context;
            }
            else {
                console.warn("HTMLCanvasElement.getContext: Canvas context type " + arguments[0] + " requested - proxy not implemented");
            }
        }));
    }
    
    var documentMethods = {
        "createElement": function(arguments, originalFunction) {
            // arguments: tagName, options
            var tagName = arguments[0].toLowerCase();
            log("creating element: " + tagName);
            if (tagName == "canvas") {
                var canvas = originalFunction.apply(this, arguments);
                proxyCanvas(canvas);
                return canvas;
            }
            
        },
        "createElementNS": function(arguments, originalFunction) {
            // arguments: namespaceURI, qualifiedName, options
            log("creating element: " + arguments[0] + ":" + arguments[1]);
        }
    };
    
    proxyMethods(document, documentMethods);
    
    proxyMethod(EventTarget.prototype, "addEventListener", function(arguments, originalFunction) {
        // arguments: type, listener, options
        var targetName = this.tagName;
        if (!targetName && this == window) targetName = "global object (window)";
        if (!targetName && this == document) targetName = "global object (document)";
        if (!targetName) throw new Error("unknown target in EventTarget.prototype.addEventListener proxy");
        //log("addEventListener called: " + arguments[0] + " on " + targetName);
    });
    
    proxyMethod(Element.prototype, "setAttribute", function(arguments, originalFunction) {
        // arguments: name, value
        log("setAttribute: " + arguments[0] + " to " + arguments[1] + " on " + this.tagName);
    });

    proxySetter(HTMLElement.prototype, "style", function(arguments, originalFunction) {
        log("style set: \"" + arguments[0] + "\" on " + this.tagName);
    });

})();
