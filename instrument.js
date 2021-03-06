// instrumentation

//"use strict";

(function() {

    var NAMES = {};
    
    // source: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Properties_Reference
    NAMES.cssAttributes = ["background","backgroundAttachment","backgroundColor","backgroundImage","backgroundPosition","backgroundRepeat","border","borderBottom","borderBottomColor","borderBottomStyle","borderBottomWidth","borderColor","borderLeft","borderLeftColor","borderLeftStyle","borderLeftWidth","borderRight","borderRightColor","borderRightStyle","borderRightWidth","borderStyle","borderTop","borderTopColor","borderTopStyle","borderTopWidth","borderWidth","clear","clip","color","cursor","display","filter","float","font","fontFamily","fontSize","fontVariant","fontWeight","height","left","letterSpacing","lineHeight","listStyle","listStyleImage","listStylePosition","listStyleType","margin","marginBottom","marginLeft","marginRight","marginTop","overflow","padding","paddingBottom","paddingLeft","paddingRight","paddingTop","pageBreakAfter","pageBreakBefore","position","textAlign","textDecoration","textIndent","textTransform","transform","top","verticalAlign","visibility","width","zIndex"];
    
    // these seem not to be defined in Chrome: cssFloat 
    // TODO: there are more css properties defined on the style object in Chrome, check in debugger!
    
    // source: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D
    NAMES.canvasContext2dMethods = ["arc","arcTo","beginPath","bezierCurveTo","clearRect","clip","closePath","createLinearGradient","createPattern","createRadialGradient","drawImage","ellipse","fill","fillRect","fillText","lineTo","moveTo","putImageData","quadraticCurveTo","rect","resetTransform","restore","rotate","save","scale","setLineDash","setTransform","stroke","strokeRect","strokeText","transform","translate"
    ];
    // ignore: "addHitRegion","asyncDrawXULElement","clearHitRegions","createImageData","drawFocusIfNeeded","drawWidgetAsOnScreen","drawWindow","getImageData","getLineDash","isPointInPath","isPointInStroke","measureText","removeHitRegion","scrollPathIntoView",
    
    var filterInclude = "";
    //filterInclude = "HTMLCanvasElement.";
    var filterExclude = "";
    
    var filterObject = function(obj) {
        return obj && obj.tagName && obj.tagName == "CANVAS";
    }
    function objectToString(obj) {
        if (!obj.tagName) return "";
        return "[" + obj.tagName + "]";
        // console.info(obj);
    }
    function log(str, obj) {
        if (str && (!filterInclude || str.startsWith(filterInclude))) {
            if (obj && filterObject(obj)) {
                str += " " + objectToString(obj);
            }
            console.log(str);
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
        var originalFunction = null;
        if (!descriptor) {
            console.warn("Warning: no property descriptor for " + propName + " on " + obj);
        }
        else {
            originalFunction = descriptor.set;
            if (!originalFunction) {
                // no setter previously defined
                // we have a problem here: we cannot assign properties that have the same name
                // as the setter (i.e. original property name)
                // TODO: what to do? maybe cache value and define a getter to retrieve it?
                // console.warn("Warning: no property named " + propName + " on " + obj);
            }
        }
        Object.defineProperty(obj, propName, {
            set: function() {
                callback.call(this, arguments, propName, originalFunction);
                if (originalFunction) {
                    originalFunction.apply(this, arguments);
                }
                else {
                    // this does not work, as we cannot set "raw" property of same name
                    // as setter (infinite recursion)
                    // obj[propName] = arguments[0];
                }
            }
        })
    }
      
    function logFunction(namePrefix, func) {
        return function(arguments, originalFunction) {
            // surround strings in ""
            var strargs = Array.prototype.map.call(arguments, function(arg) {
                if (typeof arg == "string") return '"' + arg + '"';
                if (typeof arg == "function") return "function()...";
                return arg;
            });
            var str = strargs.join(", ");
            log(namePrefix + "(" + str + ")", this);
            if (func) {
                return func.call(this,arguments, originalFunction);
            }
        }
    }
    
    function logAll(obj, functionNames, prefix, func) {
        functionNames.forEach(name => proxyMethod(obj, name, logFunction(prefix + name, func)));
    }
    
    function logAllSetters(obj, attributeNames, prefix, func) {
        attributeNames.forEach(name => proxySetter(obj, name, logFunction(prefix + name, func)));
    }
    
    var documentMethods = {
        "createElement": function(arguments, originalFunction) {
            // arguments: tagName, options
            var tagName = arguments[0].toLowerCase();
            log("Document.createElement(" + tagName + ")");
            var el = originalFunction.apply(this, arguments);
            el.__PROXY = true;
            if (tagName == "canvas") {
                proxyCanvas(el);
            }
            // TODO: this seems to be not persistent - Chome seems to 
            // randomly recreate the style object (?)
            // try to make style a getter/setter, proxying the original style object
            if (el.style) {
                Object.getOwnPropertyDescriptor(el, "style");
                var _style = el.style;
                logAllSetters(_style, NAMES.cssAttributes, "CSSStyleDeclaration.<set>", function(arguments, propName, originalFunction) {
                    // convert camelcase to dashed CSS attribute
                    propName = propName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
                    this.setProperty(propName, arguments[0]);
                });
                Object.defineProperty(el, "style", {
                    set: function(val) {
                        _style.cssText = val;
                    },
                    get: function() {
                        return _style;
                    }
                });
            }
            return el;
            
        },
        "createElementNS": function(arguments, originalFunction) {
            // arguments: namespaceURI, qualifiedName, options
            log("Document.createElementNS(" + arguments[0] + "," + arguments[1] + ")");
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
    
    // Proxy all methods and attributes on DOM prototypes that may change the DOM
    
    // Node: https://developer.mozilla.org/en-US/docs/Web/API/Node
    
    logAll(Node.prototype, ["appendChild", "insertBefore", "removeChild", "replaceChild", "cloneNode"], "Node.");
    
    logAllSetters(Node.prototype, ["textContent"], "Node.<set>");

    // Element: https://developer.mozilla.org/en-US/docs/Web/API/Element
    // TODO: data-* attributes?

    logAll(Element.prototype, ["addEventListener", "dispatchEvent", "remove", "removeAttribute", "removeAttributeNS", "removeEventListener", "setAttribute", "setAttributeNS"], "Element.");
    
    logAllSetters(Element.prototype, ["className", "id", "innerHTML", "outerHTML"], "Element.<set>");
    
    // HTMLElement: https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement    

    logAllSetters(HTMLElement.prototype, ["style", "title"], "HTMLElement.<set>");
    /*
    TODO: log tag name in previous function like so?
    function(arguments, originalFunction) {
        log("Element.<set>style(\"" + arguments[0] + "\") on " + this.tagName);
    });
    */
    
    // CSSStyleDeclaration
    
    logAll(CSSStyleDeclaration.prototype, ["setProperty", "removeProperty"], "CSSStyleDeclaration.")
    logAllSetters(CSSStyleDeclaration.prototype, ["cssText"], "CSSStyleDeclaration.<set>")

    /*
    TODO: systematically proxy all DOM modifications:
    - TODO: check specific HTML elements, e.g. Canvas, Image
    - TODO: check specific SVG elements (SVGElement has no methods/properties over Element)
    - TODO: EventTarget
    */    

    
    function proxyCanvas(canvas) {
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
                logAll(context, NAMES.canvasContext2dMethods, "HTMLCanvasElement.CanvasRenderingContext2D.");
                this._proxyContext2d = context;
                return context;
            }
            else {
                console.warn("HTMLCanvasElement.getContext: Canvas context type " + arguments[0] + " requested - proxy not implemented");
            }
        }));
    }
    
    // HACK - remove when canvas defined in HTML is instrumented
    window.logAll = logAll;
    window.NAMES = NAMES;

})();
